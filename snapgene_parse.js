/* SnapGene binary .dna parser — works in browser (window.SnapGene) and Node (module.exports). */
(function (root) {
  const GATC = ["G", "A", "T", "C"];
  const IUPAC = "GATCRYSWKMBDHVN";

  function parseTLV(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 19 || u8[0] !== 0x09 || dv.getUint32(1) !== 14 ||
        String.fromCharCode(...u8.subarray(5, 13)) !== "SnapGene")
      throw new Error("Not a SnapGene .dna file (bad cookie)");
    const f = {
      seqType: dv.getUint16(13),
      exportVersion: dv.getUint16(15),
      importVersion: dv.getUint16(17),
      blocks: [],
    };
    let off = 19;
    while (off < u8.length) {
      const type = u8[off];
      const len = dv.getUint32(off + 1);
      if (len > u8.length - off - 5) throw new Error("Truncated TLV block");
      f.blocks.push({ type, payload: u8.subarray(off + 5, off + 5 + len) });
      off += 5 + len;
    }
    return f;
  }

  function decodeDNA(block) {
    if (block.type === 0x00 || block.type === 0x20 || block.type === 0x15) {
      return { flags: block.payload[0], seq: ascii(block.payload.subarray(1)) };
    }
    if (block.type === 0x01) return decodeCompressed(block.payload.subarray(1));
    return null;
  }

  function decodeCompressed(p) {
    const dv = (o) => ((p[o] << 24) | (p[o + 1] << 16) | (p[o + 2] << 8) | p[o + 3]) >>> 0;
    const decodedLen = dv(4);
    const nSections = dv(9);
    const nLower = dv(13);
    let marker = p[17], count = dv(18), off = 22;
    const out = [];
    for (let s = 0; s < nSections; s++) {
      if (marker === 0x01) {
        for (let i = 0; i < count; i++) {
          const byte = p[off + (i >> 2)];
          out.push(GATC[(byte >> (6 - 2 * (i & 3))) & 3]);
        }
        off += (count + 3) >> 2;
      } else if (marker === 0x02) {
        for (let i = 0; i < count; i++) {
          const byte = p[off + (i >> 1)];
          const nib = i & 1 ? byte & 15 : byte >> 4;
          out.push(IUPAC[nib] || "N");
        }
        off += (count + 1) >> 1;
      } else if (marker === 0x03) {
        for (let i = 0; i < count; i++) out.push("N");
      } else {
        throw new Error("unknown compressed marker " + marker);
      }
      if (s + 1 < nSections) { marker = p[off]; count = dv(off + 1); off += 5; }
    }
    for (let i = 0; i < nLower; i++) {
      const start = dv(off), end = dv(off + 4);
      off += 8;
      for (let j = start; j <= end && j < out.length; j++) out[j] = out[j].toLowerCase();
    }
    if (out.length !== decodedLen) throw new Error("compressed DNA length mismatch");
    return { flags: 3, seq: out.join("") };
  }

  function ascii(u8) {
    let s = "";
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s;
  }

  function utf8(u8) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(u8);
    return ascii(u8); // node: buffers are ASCII-safe for our regex use
  }

  function unescapeXml(s) {
    return s
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }

  function attr(tag, name) {
    const m = new RegExp(name + '\\s*=\\s*"([^"]*)"').exec(tag);
    return m ? unescapeXml(m[1]) : null;
  }

  function parseNotes(xml) {
    const out = {};
    const root = /<Notes[^>]*>([\s\S]*)<\/Notes>/.exec(xml);
    const body = root ? root[1] : xml;
    const re = /<(\w+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
    let m;
    while ((m = re.exec(body))) out[m[1]] = unescapeXml(m[2]).trim();
    return out;
  }

  function parseFeatures(xml) {
    const feats = [];
    const fre = /<Feature\s([^>]*?)(?:\/>|>([\s\S]*?)<\/Feature>)/g;
    let m;
    while ((m = fre.exec(xml))) {
      const tag = "<Feature " + m[1];
      const body = m[2] || "";
      const segments = [];
      const sre = /<Segment\s[^>]*range="(\d+)-(\d+)"[^>]*\/?>/g;
      let s;
      while ((s = sre.exec(body))) {
        segments.push({ start: +s[1] - 1, end: +s[2], color: attr(s[0], "color") });
      }
      const qualifiers = {};
      const qre = /<Q\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/Q>/g;
      let q;
      while ((q = qre.exec(body))) {
        const vals = [];
        const vre = /<V\s[^>]*?(?:text|value)="([^"]*)"[^>]*>/g;
        let v;
        while ((v = vre.exec(q[2]))) vals.push(unescapeXml(v[1]));
        qualifiers[q[1]] = vals;
      }
      feats.push({
        name: attr(tag, "name") || "(unnamed)",
        type: attr(tag, "type") || "misc",
        direction: +(attr(tag, "directionality") || 0),
        segments,
        qualifiers,
      });
    }
    return feats;
  }

  function parsePrimers(xml) {
    const primers = [];
    const pre = /<Primer\s([^>]*?)(?:\/>|>([\s\S]*?)<\/Primer>)/g;
    let m;
    while ((m = pre.exec(xml))) {
      const body = m[2] || "";
      const bm = /<BindingSite\s[^>]*location="(\d+)-(\d+)"[^>]*/.exec(body);
      primers.push({
        name: attr("<Primer " + m[1], "name") || "(primer)",
        sequence: attr("<Primer " + m[1], "sequence") || "",
        start: bm ? +bm[1] : null,
        end: bm ? +bm[2] + 1 : null,
        strand: bm && attr(bm[0], "boundStrand") === "1" ? -1 : 1,
      });
    }
    return primers;
  }

  function parse(data) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const f = parseTLV(u8);
    let seq = "", flags = 0;
    for (const t of [0x00, 0x01]) {
      const b = f.blocks.find((b) => b.type === t);
      if (b) ({ flags, seq } = decodeDNA(b));
      if (seq) break;
    }
    if (!seq) for (const t of [0x20, 0x15]) {
      const b = f.blocks.find((b) => b.type === t);
      if (b) ({ flags, seq } = decodeDNA(b));
      if (seq) break;
    }
    const xmlOf = (t) => f.blocks.filter((b) => b.type === t).map((b) => utf8(b.payload));
    const features = xmlOf(0x0a).flatMap(parseFeatures);
    const primers = xmlOf(0x05).flatMap(parsePrimers);
    const notes = xmlOf(0x06).map(parseNotes).reduce((a, b) => Object.assign(a, b), {});
    return {
      seqType: f.seqType,
      exportVersion: f.exportVersion,
      sequence: seq,
      length: seq.length,
      circular: !!(flags & 1),
      features,
      primers,
      notes,
      blocks: f.blocks.map((b) => b.type),
    };
  }

  const api = { parse, parseTLV, unescapeXml };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SnapGene = api;
})(typeof self !== "undefined" ? self : globalThis);

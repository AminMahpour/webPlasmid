/* GenBank flatfile parser — works in browser (window.GenBank) and Node (module.exports). */
(function (root) {
  function matchParen(s, i) {
    let d = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "(") d++;
      else if (s[j] === ")" && --d === 0) return j;
    }
    return -1;
  }

  // Parses a GenBank location string into { segments:[{start,end}], complement }
  // with 0-based half-open ranges, matching the SnapGene parser's segment model.
  function parseLocation(str) {
    str = str.replace(/\s+/g, "");
    const result = { segments: [], complement: false };
    walk(str, false);
    result.segments.sort((a, b) => a.start - b.start);
    return result;

    function walk(s, comp) {
      let m;
      if ((m = /^complement\(/.exec(s))) {
        walk(s.slice(m[0].length, matchParen(s, m[0].length - 1)), !comp);
        return;
      }
      if ((m = /^(?:join|order|bond|exon|polya|gap|misc)\(/.exec(s))) {
        const inner = s.slice(m[0].length, matchParen(s, m[0].length - 1));
        let d = 0, cur = "";
        for (const ch of inner) {
          if (ch === "(") d++;
          if (ch === ")") d--;
          if (ch === "," && d === 0) { walk(cur, comp); cur = ""; }
          else cur += ch;
        }
        if (cur) walk(cur, comp);
        return;
      }
      if ((m = /^(\d+)\^(\d+)$/.exec(s))) {
        result.segments.push({ start: +m[1] - 1, end: +m[1], color: null });
        return;
      }
      if ((m = /^<?(\d+)(?:\.\.?[<>]?(\d+)?)?>?$/.exec(s))) {
        const a = +m[1];
        const b = m[2] != null ? +m[2] : a;
        result.segments.push({ start: a - 1, end: Math.max(a, b), color: null });
        if (comp) result.complement = true;
      }
    }
  }

  function parse(text) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    let name = "", circular = false, section = "", seqAccum = "";
    const features = [];
    let curKey = null, curLoc = "", qualifiers = null;

    function flush() {
      if (!curKey) return;
      const loc = parseLocation(curLoc);
      const q = qualifiers || {};
      if (loc.complement) q.complement = ["true"];
      if (curLoc) q.location = [curLoc];
      features.push({
        name: firstOf(q, ["label", "gene", "product", "standard_name", "note"]) || curKey,
        type: curKey,
        direction: curKey === "source" ? 0 : loc.complement ? 2 : 1,
        segments: loc.segments,
        qualifiers: q,
      });
      curKey = null;
      curLoc = "";
      qualifiers = null;
    }

    function firstOf(q, keys) {
      for (const k of keys) if (q[k] && q[k][0]) return q[k][0];
      return null;
    }

    for (const raw of lines) {
      if (/^\/\/\s*$/.test(raw)) break;
      let m;
      if ((m = /^LOCUS\s+(\S+)/.exec(raw))) {
        name = m[1];
        if (/circular/i.test(raw)) circular = true;
        section = "locus";
      } else if (/^FEATURES\s/.test(raw)) {
        section = "features";
      } else if (/^ORIGIN\b/.test(raw)) {
        flush();
        section = "sequence";
      } else if (section === "features") {
        if (/^ {5}(\S+)/.test(raw) && !/^ {6}/.test(raw)) {
          flush();
          m = /^ {5}(\S+)\s*(.*)$/.exec(raw);
          curKey = m[1];
          curLoc = m[2];
          qualifiers = null;
        } else if ((m = /^ {21}\/(\w+)(?:="?([^"]*)"?)?$/.exec(raw))) {
          (qualifiers = qualifiers || {})[m[1]] = [m[2] != null ? m[2] : ""];
        } else if (/^ {21}/.test(raw)) {
          if (qualifiers) {
            const keys = Object.keys(qualifiers);
            qualifiers[keys[keys.length - 1]][0] += raw.trim().replace(/"$/, "");
          } else {
            curLoc += raw.trim();
          }
        } else if (/^ {5,20}\S/.test(raw)) {
          curLoc += raw.trim();
        }
      } else if (section === "sequence") {
        if (/^\s*\//.test(raw)) continue;
        seqAccum += raw.replace(/[\d\s]/g, "");
      }
    }
    flush();

    const seq = seqAccum.toUpperCase();
    if (!circular && /TOPOLOGY\s*:\s*CIRCULAR/i.test(text)) circular = true;

    return {
      sequence: seq,
      length: seq.length,
      circular,
      features,
      primers: [],
      notes: { Name: name, format: "GenBank" },
      blocks: [],
    };
  }

  function parseAll(text) {
    return text.split(/^\/\/[ \t]*\r?\n?/m)
      .filter((chunk) => /^\s*LOCUS\b/.test(chunk))
      .map(parse);
  }

  const api = { parse, parseAll, parseLocation };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GenBank = api;
})(typeof self !== "undefined" ? self : globalThis);

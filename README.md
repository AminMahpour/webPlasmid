# webPlasmid

A dependency-free, browser-based plasmid/vector viewer. Drop in a SnapGene `.dna` or GenBank file — or fetch a record straight from NCBI — and get a circular map, feature/ primer lists, restriction sites, and a zoomable sequence view. No build step, no libraries; just open the HTML.

**Live demo:** <https://aminmahpour.github.io/webPlasmid/>

## Files

| File | Purpose |
|---|---|
| `vector_viewer.html` | The viewer app (UI, map rendering, sequence panel) |
| `snapgene_parse.js` | Parser for SnapGene binary `.dna` files (exposes `SnapGene.parse`) |
| `genbank_parse.js` | Parser for GenBank flatfiles (exposes `GenBank.parse` / `GenBank.parseAll`) |

Both parsers are UMD-style: they work in the browser (globals `SnapGene` / `GenBank`) and in Node (`require`).

## Usage

Serve the folder over HTTP (recommended; also required when opening via `file://` on some browsers):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/vector_viewer.html
```

Loading sequences:

- **Drag & drop** a `.dna`, `.gb`, `.gbk`, or `.genbank` file onto the map.
- **Open file** button in the header.
- **NCBI fetch**: type one or more accessions (comma-separated) into the header box and press Enter or “Fetch”. Records are pulled from `eutils.ncbi.nlm.nih.gov` (CORS-enabled, no proxy needed). If a query returns multiple records, pick one from the dropdown.

URL parameters:

- `?ncbi=X83542` — pre-fills the accession box (nothing is fetched until you press “Fetch”)

## Features shown

- **Circular map**: features as arc arrows (strand-aware, multi-segment/joined features supported), ruler ticks, primers as triangles, center label.
- **Restriction sites**: computed in-browser against a built-in enzyme list (`EcoRI` … `AflII`, IUPAC-aware, circular-junction aware); shown as inner ticks and a sidebar list.
- **Sidebar**: feature list, primer list, restriction sites, and per-feature qualifier details.
- **Sequence panel**: drag to select, wheel to scroll, Ctrl/⌘-wheel or +/−/fit to zoom, letter glyphs at high zoom / barcode at low zoom, and a **copy** button for the selected slice. Selection is mirrored as an arc on the map.
- **Translation view**: the **AA** button under the sequence panel toggles three forward reading frames (+1/+2/+3) drawn below the sequence — single-letter amino acids at high zoom, stop-codon ticks at low zoom. Codons inside a drag selection (aligned to the selection start) are highlighted, and the panel reports `N aa · fK` for the frame with fewest stops. Clicking a CDS shows its protein in the sidebar: the `/translation` qualifier when present, otherwise translated from the sequence (reverse-strand and `join()`ed CDSs handled; stop codon excluded, GTG/TTG/ATT starts shown as Met).

## Format support notes

- **SnapGene `.dna`**: plain + compressed (2-bit / nibble / run) encodings, lowercase masking, features (with per-segment colors and directionality), primers with binding sites, and notes.
- **GenBank**: `LOCUS` name and circular topology, features with `join` / `order` / `complement` / `a^b` locations, qualifiers (feature name resolved from `/label` > `/gene` > `/product` > ...), and `ORIGIN` sequence. Only the first record of a stream is rendered by `GenBank.parse`; `GenBank.parseAll` handles multi-record files (used by the NCBI fetcher and `.gb` file loading).

## Known limitations

- Primer tracks exist only for SnapGene files (GenBank `/primer_bind` features render as regular features).
- The translation track shows forward frames only; reverse-strand CDS proteins appear in the sidebar when you click the feature.
- The enzyme list is hardcoded in `vector_viewer.html` (`ENZYMES`) — edit that map to add enzymes.
- No GenBank writing/export and no FASTA support.

## License

Released under the [MIT License](LICENSE).

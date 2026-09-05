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
- **Digest**: the “Digest…” button in the restriction panel cuts at every visible site and reports the fragment table (size, coordinates, the enzymes at each end — origin-crossing fragments included) next to a schematic agarose gel with a 1 kb ladder. Sort by size or by map position, click a row to select that fragment on the map and in the sequence panel, and copy the table as TSV. Respects the enzyme checkboxes above it.
- **Find**: `Find` in the header or Ctrl/⌘-F opens a search bar over the map. Searches the current record as an IUPAC DNA motif on both strands (`GAATTC`, `GGNNCC`), as a protein query across all six reading frames (`MALDISMW`), or as a regular expression. Enter / Shift-Enter step through hits (marks drawn in the sequence panel, current hit mirrored as an arc on the map, with strand, frame and flanking context in the sidebar). A number jumps to that base (`4000`) and `1200-1600` selects a range.
- **Sidebar**: feature list, primer list, restriction sites, and per-feature qualifier details.
- **Sequence panel**: drag to select, wheel to scroll, Ctrl/⌘-wheel or +/−/fit to zoom, letter glyphs at high zoom / barcode at low zoom, and a **copy** button for the selected slice. Selection is mirrored as an arc on the map.
- **Translation view**: the **AA** button under the sequence panel toggles three forward reading frames (+1/+2/+3) drawn below the sequence — single-letter amino acids at high zoom, stop-codon ticks at low zoom. Codons inside a drag selection (aligned to the selection start) are highlighted, and the panel reports `N aa · fK` for the frame with fewest stops. Clicking a CDS shows its protein in the sidebar: the `/translation` qualifier when present, otherwise translated from the sequence (reverse-strand and `join()`ed CDSs handled; stop codon excluded, GTG/TTG/ATT starts shown as Met).

## Format support notes

- **SnapGene `.dna`**: plain + compressed (2-bit / nibble / run) encodings, lowercase masking, features (with per-segment colors and directionality), primers with binding sites, and notes.
- **GenBank**: `LOCUS` name and circular topology, features with `join` / `order` / `complement` / `a^b` locations, qualifiers (feature name resolved from `/label` > `/gene` > `/product` > ...), and `ORIGIN` sequence. Only the first record of a stream is rendered by `GenBank.parse`; `GenBank.parseAll` handles multi-record files (used by the NCBI fetcher and `.gb` file loading).

## Known limitations

- Primer tracks exist only for SnapGene files (GenBank `/primer_bind` features render as regular features).
- The translation track shows forward frames only; reverse-strand CDS proteins appear in the sidebar when you click the feature. (Find → Protein searches all six frames.)
- The enzyme list is hardcoded in `vector_viewer.html` (`ENZYMES`) — edit that map to add enzymes.
- Cut positions come from a fixed `ENZYME_CUT` table; an enzyme missing from it is assumed to cut at the middle of its recognition site.
- The digest gel is schematic: log-spaced bands sized by fragment mass, co-migrating fragments merged. Not a model of real electrophoresis.
- No GenBank writing/export and no FASTA support.

## License

Released under the [MIT License](LICENSE).

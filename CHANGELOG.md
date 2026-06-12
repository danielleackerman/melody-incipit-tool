# Changelog

All notable changes to the Melody Incipit Grid Tool.

## Version 0.1.0 — 2026-06-11

First complete functional build. Not a mature release: it implements the full approved Version 1 scope and passes its test suite, but it has lived with exactly one melody so far. Expect rough edges to surface with real daily capture.

### Core features

- Single-page static app: `index.html` + `styles.css` + `app.js`. No build step, no external dependencies, no network requests; deployable as-is to GitHub Pages.
- **Phrase → Bars → Lanes** editor: labeled phrases containing musical bar cards, each with a lead-sheet-style chord field and three aligned lanes (system-generated Counts, editable Degrees, editable Lyrics).
- Canonical **cell-level data model** (`schema_version 1.0`, documented in `schema/melody-incipit.schema.json`): per-subdivision degree/lyric arrays under phrases → bars; counts derived from meter × grid unit, never stored; chords as `{symbol, position}` arrays; `grid_unit` stored per bar.
- **Grid resolutions** quarter / eighth / sixteenth with safe remapping: coarse→fine lossless, fine→coarse warns and lists exactly what would drop, cancel keeps everything.
- **Meters** 4/4, 3/4, 2/4 fully gridded; 6/8 as a true compound meter (2 beats / 6 pulses / 12 sixteenth slots); unknown meters accepted as metadata with a 4/4-style grid and a visible notice.
- **Degree entry** with typed ASCII accidentals (`b3`, `#4`) rendered as ♭3/♯4 on blur; `-` holds; empty cells as space.
- Bar management: add, duplicate (deep copy), clear, delete with Undo toast, ◀ ▶ reorder; phrase add / rename / delete.
- **Capture and Read modes**, plus a print stylesheet driven by the Read sheet.
- **Live preview** (debounced) with Text / Markdown / JSON tabs; the Text tab is character-identical to the plain-text export.
- Metadata panel with the documented controlled vocabularies (status, hook function, mode/scale, feel, key, meter) as suggestion lists over free-text fields; tags as chips; auto dates.
- Empty-state guidance with a one-tap **Load example** (the "Walking Home Hook" from the source notes).

### Export, import, and persistence

- **Markdown** export with YAML frontmatter (Obsidian-compatible) embedding the aligned grid in a fenced block; **JSON** export of the canonical data; **plain-text** export with metadata header/footer. Copy and Download buttons for all three (`YYYY-MM-DD-slug.ext` filenames), plus Print.
- One shared alignment renderer feeds preview, plain text, and Markdown — outputs cannot drift apart.
- **JSON import** with hand-rolled validation (type, schema version, phrase/bar shapes, lane-length parity, grid units); rejections explain themselves and never touch current work; successful imports offer Undo.
- **Autosave** to `localStorage` (`melody-incipit:current`, debounced, with a "Saved ✓" indicator); reload restores exactly. **New** confirms, writes a one-step backup (`melody-incipit:backup`), and offers Undo.

### Functional improvements added during implementation (bounded judgment)

- Undo toasts extended beyond bar deletion to **New**, **Load example**, and **Import** — all three replace the whole document, so all three are one-step reversible.
- **Never-zero-bars rule**: deleting the only remaining bar yields a fresh empty bar instead of an empty editor.
- **Tab continues from the end of the degree lane into the lyric lane**, so one key walks the entire melody entry.
- **←/→ at the cell edge** move along the lane without interfering with in-cell text editing.
- **Long chord names widen their bar** in the aligned output instead of overflowing the lane.
- `init()` made idempotent (guards against double event binding).
- Import normalization fills missing optional metadata with defaults and reconciles lane lengths, so slightly-old or hand-edited JSON still loads safely.

### Usability and accessibility

- Full keyboard operation: lane-major Tab order, Enter to next bar, ↑/↓ lane switch, Ctrl/Cmd+D duplicate, Ctrl/Cmd+Enter add bar; in-app **Keys** reference.
- Visible focus everywhere (`:focus-visible`), skip link, descriptive `aria-label`s on every cell ("Bar 2 degree on the & of 3") and icon button, `aria-live` status region and preview, ≥44 px touch targets, `prefers-reduced-motion` respected.
- Responsive: stacked single column on phones, sticky side-by-side preview ≥1024 px; wide grids scroll horizontally **inside** their bar card with the lane labels pinned, so alignment never breaks.
- Anti-spreadsheet styling: warm paper palette, serif chord symbols in brass, heavy left barline on each card, borderless-until-focus cells, beat numbers visually heavier than offbeats.

### Architectural decisions

- Vanilla JS over a framework (per the approved audit): one state object, pure-function exporters, targeted re-renders (typing never rebuilds the DOM, so focus is never lost).
- ASCII accidental storage with display-layer ♭/♯ rendering.
- Counts derived rather than stored (a deliberate strengthening of the source notes' draft structure).
- Pure logic exposed as `window.MIT` / CommonJS export so the same `tests.js` runs in the browser (`tests.html`) and in Node.

### Known limitations

- Single autosaved incipit (plus one backup); `localStorage` is per-browser and clearable — JSON download is the durable copy.
- 6/8 counts as numbered pulses (`1 2 3 4 5 6`), not `1 & a 2 & a`; meters beyond 4/4 · 3/4 · 2/4 · 6/8 fall back to a 4/4-shaped grid with a notice.
- One chord per bar in the UI (the data model already allows more).
- ♭/♯ glyph width in text exports depends on the viewer's monospace font (rarely an issue; JSON stays ASCII).
- Pathologically long syllables/chords make legitimately wide bars in text output.

### Deferred enhancements (intentionally not built)

Multi-incipit library with search/filter; CSV export; degree quick-entry button palette; chord suggestions; quick-fill rhythm patterns; duplicate phrase; collapsible bar cards; paste-lyrics auto-distribution; per-bar grid resolution UI; per-cell articulation lane; MIDI interpretation; audio recording/playback; Save-to-Song-Bank / Creativity Engine / Chaos Portal integrations.

### Incomplete approved requirements

None — every approved Version 1 acceptance criterion is implemented and verified (see the build's completion report).

### Blockers encountered

None.

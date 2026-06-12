/* =========================================================================
   Melody Incipit Grid Tool — app.js
   Zero dependencies. One canonical state object; every output is a render.
   Pure functions are exposed on window.MIT (or module.exports) for tests.
   ========================================================================= */
(function (root) {
  'use strict';

  /* =====================  CONSTANTS & VOCABULARIES  ===================== */

  var SCHEMA_VERSION = '1.0';

  var METERS = {
    '4/4': { beats: 4, compound: false },
    '3/4': { beats: 3, compound: false },
    '2/4': { beats: 2, compound: false },
    '6/8': { beats: 2, compound: true } // two dotted-quarter beats of three eighths
  };

  var GRID_UNITS = ['quarter', 'eighth', 'sixteenth'];

  var VOCAB = {
    status: ['raw', 'promising', 'hook', 'verse', 'chorus', 'bridge', 'motif', 'developed', 'archived'],
    hook_function: ['opening line', 'chorus hook', 'verse motif', 'call-and-response', 'tag ending', 'melodic answer', 'riff', 'vocal run', 'countermelody'],
    mode: ['major', 'natural minor', 'harmonic minor', 'melodic minor', 'major pentatonic', 'minor pentatonic', 'blues', 'mixolydian', 'dorian', 'lydian', 'phrygian', 'chromatic color', 'uncertain'],
    feel: ['straight', 'swing', 'shuffle', 'gospel sway', '6/8 ballad', 'funk', 'folk', 'hymnlike', 'cinematic', 'rubato', 'spoken-like'],
    key: ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
      'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'],
    meter: ['4/4', '3/4', '2/4', '6/8']
  };

  var STORAGE_KEY = 'melody-incipit:current';
  var BACKUP_KEY = 'melody-incipit:backup';

  /* ==========================  GRID MATH  ============================== */

  // Parse a meter string. Unknown meters fall back to a 4/4-shaped grid and
  // are flagged so the UI can show a notice (approved decision D3).
  function parseMeter(str) {
    var m = METERS[String(str || '').trim()];
    if (m) return { beats: m.beats, compound: m.compound, known: true, label: String(str).trim() };
    return { beats: 4, compound: false, known: false, label: String(str || '').trim() || '4/4' };
  }

  // Number of subdivision slots in one bar for meter x grid unit.
  function slotsFor(meterStr, unit) {
    var m = parseMeter(meterStr);
    if (m.compound) {
      // 6/8: beat level = 2 dotted-quarter beats; eighth = 6; sixteenth = 12
      if (unit === 'quarter') return 2;
      if (unit === 'eighth') return 6;
      return 12;
    }
    if (unit === 'quarter') return m.beats;
    if (unit === 'eighth') return m.beats * 2;
    return m.beats * 4;
  }

  // System-generated count labels — the counts lane is derived, never stored.
  function countLabels(meterStr, unit) {
    var m = parseMeter(meterStr);
    var out = [];
    var b;
    if (m.compound) {
      if (unit === 'quarter') return ['1', '2'];
      if (unit === 'eighth') { for (b = 1; b <= 6; b++) out.push(String(b)); return out; }
      for (b = 1; b <= 6; b++) { out.push(String(b)); out.push('&'); }
      return out;
    }
    if (unit === 'quarter') {
      for (b = 1; b <= m.beats; b++) out.push(String(b));
      return out;
    }
    if (unit === 'eighth') {
      for (b = 1; b <= m.beats; b++) { out.push(String(b)); out.push('&'); }
      return out;
    }
    for (b = 1; b <= m.beats; b++) { out.push(String(b)); out.push('e'); out.push('&'); out.push('a'); }
    return out;
  }

  // Remap a cell array when the slot count changes.
  // coarse -> fine is lossless (values land on matching slots);
  // fine -> coarse keeps on-grid values and reports what would be lost;
  // incompatible counts (meter changes) truncate/pad and report losses.
  function remapCells(cells, oldN, newN) {
    cells = cells || [];
    var out = [], lost = [], i, f;
    for (i = 0; i < newN; i++) out.push('');
    if (newN === oldN) {
      for (i = 0; i < newN; i++) out[i] = cells[i] || '';
      return { cells: out, lost: lost };
    }
    if (oldN > 0 && newN % oldN === 0) {            // coarse -> fine
      f = newN / oldN;
      for (i = 0; i < oldN; i++) out[i * f] = cells[i] || '';
      return { cells: out, lost: lost };
    }
    if (newN > 0 && oldN % newN === 0) {            // fine -> coarse
      f = oldN / newN;
      for (i = 0; i < oldN; i++) {
        var v = cells[i] || '';
        if (i % f === 0) out[i / f] = v;
        else if (v !== '') lost.push(v);
      }
      return { cells: out, lost: lost };
    }
    for (i = 0; i < oldN; i++) {                    // incompatible: pad/truncate
      var w = cells[i] || '';
      if (i < newN) out[i] = w;
      else if (w !== '') lost.push(w);
    }
    return { cells: out, lost: lost };
  }

  /* =====================  DEGREE / TEXT HELPERS  ======================== */

  // ASCII in storage (b3, #4), musical glyphs in display and text exports.
  function prettyDegree(s) {
    return String(s == null ? '' : s)
      .replace(/b([1-7])/g, '\u266D$1')
      .replace(/#([1-7])/g, '\u266F$1');
  }

  function pad(s, w) {
    s = String(s == null ? '' : s);
    while (s.length < w) s += ' ';
    return s;
  }

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u266D]/g, 'b').replace(/[\u266F]/g, 'sharp')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled-incipit';
  }

  function parseTags(s) {
    return String(s || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function todayISO() {
    var d = new Date();
    var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
    var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  /* ==========================  STATE MODEL  ============================= */

  function newBar(meter, unit) {
    var n = slotsFor(meter, unit);
    var degrees = [], lyrics = [];
    for (var i = 0; i < n; i++) { degrees.push(''); lyrics.push(''); }
    return {
      meter: meter,
      grid_unit: unit,
      chords: [{ symbol: '', position: 0 }],
      degrees: degrees,
      lyrics: lyrics
    };
  }

  function newState() {
    var date = todayISO();
    return {
      schema_version: SCHEMA_VERSION,
      type: 'melody-incipit',
      id: date + '-' + Math.random().toString(36).slice(2, 6),
      title: '',
      song_id: '',
      date_created: date,
      date_modified: date,
      audio_ref: '',
      key: '',
      tonal_center: '',
      mode: '',
      meter: '4/4',
      tempo: '',
      feel: '',
      hook_function: '',
      default_grid_unit: 'eighth',
      contour: '',
      notes: '',
      tags: [],
      status: 'raw',
      phrases: [
        { label: 'Phrase 1', bars: [newBar('4/4', 'eighth')] }
      ]
    };
  }

  // The canonical worked example from the source notes ("Walking Home Hook").
  function exampleState() {
    var s = newState();
    s.title = 'Walking Home Hook';
    s.song_id = 'walking-home';
    s.audio_ref = 'voice-memo-2026-04-29-214pm.m4a';
    s.key = 'C';
    s.tonal_center = 'C';
    s.mode = 'major';
    s.meter = '4/4';
    s.feel = 'gospel sway';
    s.hook_function = 'chorus hook';
    s.contour = 'Starts on 3, steps down to 1, drops to b7 color, resolves home.';
    s.notes = 'Keep the b7 against the Bb chord. Do not over-quantize.';
    s.tags = ['gospel', 'melody', 'hook', 'flat-seven'];
    s.status = 'promising';
    s.phrases = [{
      label: 'Phrase 1',
      bars: [
        { meter: '4/4', grid_unit: 'eighth', chords: [{ symbol: 'C', position: 0 }],
          degrees: ['3', '', '3', '2', '1', '', '5', ''],
          lyrics: ['I', '', 'was', 'walk-', 'ing', '', 'home', ''] },
        { meter: '4/4', grid_unit: 'eighth', chords: [{ symbol: 'Bb', position: 0 }],
          degrees: ['b7', '', '6', '', '5', '', '', ''],
          lyrics: ['through', '', 'the', '', 'rain', '', '', ''] },
        { meter: '4/4', grid_unit: 'eighth', chords: [{ symbol: 'F', position: 0 }],
          degrees: ['4', '', '3', '', '2', '', '', ''],
          lyrics: ['call-', '', 'ing', '', 'Your', '', '', ''] },
        { meter: '4/4', grid_unit: 'eighth', chords: [{ symbol: 'C', position: 0 }],
          degrees: ['1', '-', '-', '', '', '', '', ''],
          lyrics: ['name', '', '', '', '', '', '', ''] }
      ]
    }];
    return s;
  }

  /* =========================  VALIDATION  =============================== */

  // Hand-rolled import validation (no library). Returns {ok, errors, state}.
  function validateIncipit(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, errors: ['Not a JSON object.'] };
    }
    if (obj.type !== 'melody-incipit') errors.push('Missing or wrong "type" (expected "melody-incipit").');
    if (typeof obj.schema_version !== 'string') errors.push('Missing "schema_version".');
    if (!Array.isArray(obj.phrases) || obj.phrases.length < 1) {
      errors.push('"phrases" must be a non-empty array.');
      return { ok: false, errors: errors };
    }
    obj.phrases.forEach(function (p, pi) {
      if (!p || typeof p !== 'object') { errors.push('Phrase ' + (pi + 1) + ' is not an object.'); return; }
      if (!Array.isArray(p.bars)) { errors.push('Phrase ' + (pi + 1) + ': "bars" must be an array.'); return; }
      p.bars.forEach(function (b, bi) {
        var where = 'Phrase ' + (pi + 1) + ', bar ' + (bi + 1);
        if (!b || typeof b !== 'object') { errors.push(where + ' is not an object.'); return; }
        if (GRID_UNITS.indexOf(b.grid_unit) === -1) errors.push(where + ': grid_unit must be quarter, eighth, or sixteenth.');
        if (!Array.isArray(b.degrees) || !Array.isArray(b.lyrics)) {
          errors.push(where + ': degrees and lyrics must be arrays.');
        } else if (b.degrees.length !== b.lyrics.length) {
          errors.push(where + ': degrees (' + b.degrees.length + ') and lyrics (' + b.lyrics.length + ') lengths differ.');
        }
        if (!Array.isArray(b.chords) || !b.chords.length || typeof b.chords[0].symbol !== 'string') {
          errors.push(where + ': chords must be an array with at least { symbol, position }.');
        }
      });
    });
    if (errors.length) return { ok: false, errors: errors };

    // Normalize: fill optional metadata with defaults, reconcile lane lengths.
    var base = newState();
    var s = {};
    Object.keys(base).forEach(function (k) {
      s[k] = (obj[k] !== undefined && k !== 'phrases') ? obj[k] : base[k];
    });
    s.tags = Array.isArray(obj.tags) ? obj.tags.map(String) : [];
    s.phrases = obj.phrases.map(function (p, pi) {
      return {
        label: typeof p.label === 'string' ? p.label : 'Phrase ' + (pi + 1),
        bars: p.bars.map(function (b) {
          var meter = typeof b.meter === 'string' ? b.meter : s.meter;
          var n = slotsFor(meter, b.grid_unit);
          var deg = remapCells(b.degrees.map(String), b.degrees.length, n).cells;
          var lyr = remapCells(b.lyrics.map(String), b.lyrics.length, n).cells;
          return {
            meter: meter,
            grid_unit: b.grid_unit,
            chords: [{ symbol: String(b.chords[0].symbol), position: 0 }],
            degrees: deg,
            lyrics: lyr
          };
        })
      };
    });
    return { ok: true, errors: [], state: s };
  }

  /* =====================  ALIGNED-TEXT RENDERER  ======================== */
  // One renderer feeds the live preview, the plain-text export, and the grid
  // block inside the Markdown export — guaranteeing they are identical.

  function alignedText(state) {
    var LABELS = ['Chords:', 'Counts:', 'Degrees:', 'Lyrics:'];
    var labelW = 0;
    LABELS.forEach(function (l) { if (l.length > labelW) labelW = l.length; });
    var blocks = [];

    (state.phrases || []).forEach(function (phrase, pi) {
      var rows = { chords: '', counts: '', degrees: '', lyrics: '' };
      rows.chords = pad(LABELS[0], labelW) + ' |';
      rows.counts = pad(LABELS[1], labelW) + ' |';
      rows.degrees = pad(LABELS[2], labelW) + ' |';
      rows.lyrics = pad(LABELS[3], labelW) + ' |';

      (phrase.bars || []).forEach(function (bar) {
        var counts = countLabels(bar.meter, bar.grid_unit);
        var n = counts.length;
        var widths = [], i;
        for (i = 0; i < n; i++) {
          var c = counts[i];
          var d = prettyDegree(bar.degrees[i] || '');
          var l = bar.lyrics[i] || '';
          widths.push(Math.max(c.length, d.length, l.length, 1));
        }
        var cCells = [], dCells = [], lCells = [];
        for (i = 0; i < n; i++) {
          cCells.push(pad(counts[i], widths[i]));
          dCells.push(pad(prettyDegree(bar.degrees[i] || ''), widths[i]));
          lCells.push(pad(bar.lyrics[i] || '', widths[i]));
        }
        var inner = cCells.join(' ');
        var chord = prettyDegree(bar.chords[0] ? bar.chords[0].symbol : '');
        var innerW = inner.length;
        // A long chord name widens the whole bar rather than breaking lanes.
        if (chord.length > innerW) {
          var extra = chord.length - innerW;
          widths[n - 1] += extra;
          cCells[n - 1] = pad(counts[n - 1], widths[n - 1]);
          dCells[n - 1] = pad(prettyDegree(bar.degrees[n - 1] || ''), widths[n - 1]);
          lCells[n - 1] = pad(bar.lyrics[n - 1] || '', widths[n - 1]);
          inner = cCells.join(' ');
          innerW = inner.length;
        }
        rows.chords += ' ' + pad(chord, innerW) + ' |';
        rows.counts += ' ' + inner + ' |';
        rows.degrees += ' ' + dCells.join(' ') + ' |';
        rows.lyrics += ' ' + lCells.join(' ') + ' |';
      });

      var block = [];
      if ((state.phrases || []).length > 1 || (phrase.label && phrase.label !== 'Phrase 1')) {
        block.push(phrase.label || ('Phrase ' + (pi + 1)));
      }
      block.push(rows.chords, rows.counts, rows.degrees, rows.lyrics);
      blocks.push(block.join('\n'));
    });

    return blocks.join('\n\n');
  }

  /* ===========================  EXPORTS  ================================ */

  function yamlStr(v) {
    v = String(v == null ? '' : v);
    if (v === '') return '""';
    return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function toJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  function toMarkdown(state) {
    var fm = [
      '---',
      'type: melody-incipit',
      'schema_version: ' + yamlStr(state.schema_version),
      'id: ' + yamlStr(state.id),
      'title: ' + yamlStr(state.title),
      'song_id: ' + yamlStr(state.song_id),
      'date_created: ' + yamlStr(state.date_created),
      'date_modified: ' + yamlStr(state.date_modified),
      'audio_ref: ' + yamlStr(state.audio_ref),
      'key: ' + yamlStr(state.key),
      'tonal_center: ' + yamlStr(state.tonal_center),
      'mode: ' + yamlStr(state.mode),
      'meter: ' + yamlStr(state.meter),
      'tempo: ' + yamlStr(state.tempo),
      'feel: ' + yamlStr(state.feel),
      'hook_function: ' + yamlStr(state.hook_function),
      'grid_unit: ' + yamlStr(state.default_grid_unit),
      'status: ' + yamlStr(state.status),
      'tags: [' + (state.tags || []).map(yamlStr).join(', ') + ']',
      '---'
    ].join('\n');

    var title = state.title || 'Untitled Incipit';
    var body = [
      '',
      '# Melody Incipit: ' + title,
      '',
      '## Audio Reference',
      state.audio_ref || '_none recorded_',
      '',
      '## Tonal Setup',
      '- **Key:** ' + (state.key || '—'),
      '- **Tonal center:** ' + (state.tonal_center || '—'),
      '- **Mode / Scale:** ' + (state.mode || '—'),
      '- **Meter:** ' + (state.meter || '—'),
      '- **Tempo:** ' + (state.tempo || '—'),
      '- **Feel:** ' + (state.feel || '—'),
      '',
      '## Incipit',
      '',
      '```text',
      alignedText(state),
      '```',
      '',
      '## Contour',
      state.contour || '_—_',
      '',
      '## Notes',
      state.notes || '_—_',
      ''
    ].join('\n');

    return fm + body;
  }

  function toPlainText(state) {
    var head = [
      'MELODY INCIPIT: ' + (state.title || 'Untitled'),
      'Key: ' + (state.key || '—') + '   Mode: ' + (state.mode || '—') +
        '   Meter: ' + (state.meter || '—') + '   Grid: ' + state.default_grid_unit +
        '   Feel: ' + (state.feel || '—'),
      'Audio: ' + (state.audio_ref || '—'),
      ''
    ];
    var tail = [
      '',
      'Contour: ' + (state.contour || '—'),
      'Notes: ' + (state.notes || '—'),
      'Tags: ' + ((state.tags || []).join(', ') || '—') + '   Status: ' + (state.status || '—')
    ];
    return head.join('\n') + alignedText(state) + tail.join('\n');
  }

  function exportFilename(state, ext) {
    return state.date_created + '-' + slugify(state.title) + '.' + ext;
  }

  /* =========================  PUBLIC (TESTABLE) API  ==================== */

  var MIT = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    METERS: METERS,
    GRID_UNITS: GRID_UNITS,
    VOCAB: VOCAB,
    parseMeter: parseMeter,
    slotsFor: slotsFor,
    countLabels: countLabels,
    remapCells: remapCells,
    prettyDegree: prettyDegree,
    pad: pad,
    slugify: slugify,
    parseTags: parseTags,
    newBar: newBar,
    newState: newState,
    exampleState: exampleState,
    validateIncipit: validateIncipit,
    alignedText: alignedText,
    toJSON: toJSON,
    toMarkdown: toMarkdown,
    toPlainText: toPlainText,
    exportFilename: exportFilename
  };

  root.MIT = MIT;
  if (typeof module !== 'undefined' && module.exports) module.exports = MIT;

  /* =========================================================================
     UI LAYER — runs only in a browser with the app markup present.
     ========================================================================= */
  if (typeof document === 'undefined') return;

  var state = null;
  var saveTimer = null;
  var previewTimer = null;
  var lastDeleted = null;     // { kind:'bar'|'state', payload..., for undo }
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ----------------------------- persistence --------------------------- */

  function save() {
    state.date_modified = todayISO();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flashSaved();
    } catch (e) {
      announceStatus('Could not save to browser storage. Download JSON to keep your work.');
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  function loadSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var v = validateIncipit(JSON.parse(raw));
      return v.ok ? v.state : null;
    } catch (e) { return null; }
  }

  var savedFlashTimer = null;
  function flashSaved() {
    var n = $('saved-indicator');
    if (!n) return;
    n.classList.add('visible');
    clearTimeout(savedFlashTimer);
    savedFlashTimer = setTimeout(function () { n.classList.remove('visible'); }, 1200);
  }

  /* ------------------------------- toast ------------------------------- */

  function showToast(message, actionLabel, actionFn) {
    var t = $('toast');
    t.innerHTML = '';
    t.appendChild(el('span', null, message));
    if (actionLabel) {
      var btn = el('button', 'toast-action', actionLabel);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        hideToast();
        actionFn();
      });
      t.appendChild(btn);
    }
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() {
    var t = $('toast');
    t.classList.remove('visible');
    clearTimeout(toastTimer);
  }

  function announceStatus(msg) {
    var n = $('status-announce');
    if (n) n.textContent = msg;
  }

  /* --------------------------- change pipeline ------------------------- */

  // Lightweight changes (typing in cells/metadata): update previews + save,
  // leave the editor DOM alone so focus is never lost.
  function changed() {
    schedulePreview();
    scheduleSave();
    renderReadSheet();
    updateEmptyState();
  }

  // Structural changes (bars/phrases/resolution/meter): rebuild the editor.
  function structureChanged() {
    renderPhrases();
    changed();
  }

  /* ----------------------------- metadata ------------------------------ */

  var META_FIELDS = [
    'title', 'song_id', 'key', 'tonal_center', 'mode', 'meter', 'tempo',
    'feel', 'hook_function', 'status', 'audio_ref', 'contour', 'notes'
  ];

  function bindMetadata() {
    META_FIELDS.forEach(function (f) {
      var input = $('meta-' + f);
      if (!input) return;
      input.addEventListener('input', function () {
        if (f === 'meter') return; // meter applies on change (remap) below
        state[f] = input.value;
        if (f === 'title') changed(); else changed();
      });
    });

    $('meta-meter').addEventListener('change', function () {
      applyMeterChange($('meta-meter').value);
    });

    var tagsInput = $('meta-tags');
    tagsInput.addEventListener('input', function () {
      state.tags = parseTags(tagsInput.value);
      renderTagChips();
      changed();
    });

    $('metadata-toggle').addEventListener('click', function () {
      var panel = $('metadata-body');
      var open = panel.classList.toggle('open');
      $('metadata-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function renderTagChips() {
    var box = $('tag-chips');
    box.innerHTML = '';
    (state.tags || []).forEach(function (t) {
      box.appendChild(el('span', 'chip', t));
    });
  }

  function fillMetadataInputs() {
    META_FIELDS.forEach(function (f) {
      var input = $('meta-' + f);
      if (input) input.value = state[f] || '';
    });
    $('meta-tags').value = (state.tags || []).join(', ');
    renderTagChips();
    $('meta-date').textContent = 'Created ' + state.date_created;
    updateMeterNotice();
  }

  function updateMeterNotice() {
    var notice = $('meter-notice');
    var m = parseMeter(state.meter);
    notice.hidden = m.known;
  }

  function applyMeterChange(newMeter) {
    var unit = state.default_grid_unit;
    var oldLost = [];
    state.phrases.forEach(function (p) {
      p.bars.forEach(function (b) {
        var n = slotsFor(newMeter, unit);
        var oldN = b.degrees.length;
        var rd = remapCells(b.degrees, oldN, n);
        var rl = remapCells(b.lyrics, oldN, n);
        oldLost = oldLost.concat(rd.lost, rl.lost);
      });
    });
    if (oldLost.length) {
      var ok = window.confirm(
        'Changing the meter to ' + newMeter + ' will drop ' + oldLost.length +
        ' entr' + (oldLost.length === 1 ? 'y' : 'ies') + ' that no longer fit the grid (' +
        oldLost.slice(0, 6).join(', ') + (oldLost.length > 6 ? ', …' : '') + ').\n\nContinue?'
      );
      if (!ok) { $('meta-meter').value = state.meter; return; }
    }
    state.meter = newMeter;
    state.phrases.forEach(function (p) {
      p.bars.forEach(function (b) {
        var n = slotsFor(newMeter, unit);
        b.degrees = remapCells(b.degrees, b.degrees.length, n).cells;
        b.lyrics = remapCells(b.lyrics, b.lyrics.length, n).cells;
        b.meter = newMeter;
        b.grid_unit = unit;
      });
    });
    updateMeterNotice();
    structureChanged();
  }

  /* --------------------------- grid resolution ------------------------- */

  function bindResolution() {
    var radios = document.querySelectorAll('input[name="grid-unit"]');
    Array.prototype.forEach.call(radios, function (r) {
      r.addEventListener('change', function () {
        if (r.checked) applyResolutionChange(r.value);
      });
    });
  }

  function reflectResolution() {
    var radios = document.querySelectorAll('input[name="grid-unit"]');
    Array.prototype.forEach.call(radios, function (r) {
      r.checked = (r.value === state.default_grid_unit);
    });
  }

  function applyResolutionChange(unit) {
    if (unit === state.default_grid_unit) return;
    var lost = [];
    state.phrases.forEach(function (p) {
      p.bars.forEach(function (b) {
        var n = slotsFor(b.meter, unit);
        lost = lost.concat(
          remapCells(b.degrees, b.degrees.length, n).lost,
          remapCells(b.lyrics, b.lyrics.length, n).lost
        );
      });
    });
    if (lost.length) {
      var ok = window.confirm(
        'Switching to the ' + unit + '-note grid will drop ' + lost.length +
        ' entr' + (lost.length === 1 ? 'y' : 'ies') + ' that sit between the new grid lines (' +
        lost.slice(0, 6).join(', ') + (lost.length > 6 ? ', …' : '') + ').\n\nContinue?'
      );
      if (!ok) { reflectResolution(); return; }
    }
    state.default_grid_unit = unit;
    state.phrases.forEach(function (p) {
      p.bars.forEach(function (b) {
        var n = slotsFor(b.meter, unit);
        b.degrees = remapCells(b.degrees, b.degrees.length, n).cells;
        b.lyrics = remapCells(b.lyrics, b.lyrics.length, n).cells;
        b.grid_unit = unit;
      });
    });
    structureChanged();
    announceStatus(unit + '-note grid applied.');
  }

  /* ------------------------- phrases & bar cards ----------------------- */

  function renderPhrases() {
    var host = $('phrases');
    host.innerHTML = '';
    state.phrases.forEach(function (phrase, pi) {
      host.appendChild(renderPhrase(phrase, pi));
    });
    reflectResolution();
  }

  function renderPhrase(phrase, pi) {
    var section = el('section', 'phrase');
    section.setAttribute('aria-label', phrase.label || ('Phrase ' + (pi + 1)));

    var head = el('div', 'phrase-head');
    var labelInput = el('input', 'phrase-label');
    labelInput.type = 'text';
    labelInput.value = phrase.label || '';
    labelInput.setAttribute('aria-label', 'Phrase ' + (pi + 1) + ' label');
    labelInput.addEventListener('input', function () {
      phrase.label = labelInput.value;
      changed();
    });
    head.appendChild(labelInput);

    if (state.phrases.length > 1) {
      var del = el('button', 'ghost-btn small', 'Delete phrase');
      del.type = 'button';
      del.addEventListener('click', function () {
        var hasContent = phrase.bars.some(function (b) {
          return (b.chords[0].symbol || '').trim() !== '' ||
            b.degrees.some(function (c) { return c !== ''; }) ||
            b.lyrics.some(function (c) { return c !== ''; });
        });
        if (hasContent && !window.confirm('Delete "' + (phrase.label || 'this phrase') + '" and its bars?')) return;
        state.phrases.splice(pi, 1);
        structureChanged();
        announceStatus('Phrase deleted.');
      });
      head.appendChild(del);
    }
    section.appendChild(head);

    var barsBox = el('div', 'bars');
    phrase.bars.forEach(function (bar, bi) {
      barsBox.appendChild(renderBarCard(phrase, pi, bar, bi));
    });
    section.appendChild(barsBox);

    var addBtn = el('button', 'add-bar-btn', '+ Add bar');
    addBtn.type = 'button';
    addBtn.addEventListener('click', function () {
      phrase.bars.push(newBar(state.meter, state.default_grid_unit));
      structureChanged();
      focusCell(pi, phrase.bars.length - 1, 'deg', 0);
      announceStatus('Bar added.');
    });
    section.appendChild(addBtn);

    return section;
  }

  function renderBarCard(phrase, pi, bar, bi) {
    var card = el('article', 'bar-card');
    card.setAttribute('aria-label', 'Bar ' + (bi + 1));
    card.dataset.phrase = pi;
    card.dataset.bar = bi;

    /* head: BAR n + chord */
    var head = el('div', 'bar-head');
    head.appendChild(el('span', 'bar-eyebrow', 'Bar ' + (bi + 1)));
    var chordWrap = el('label', 'chord-wrap');
    chordWrap.appendChild(el('span', 'chord-label', 'Chord'));
    var chordInput = el('input', 'chord-input');
    chordInput.type = 'text';
    chordInput.value = bar.chords[0].symbol;
    chordInput.placeholder = '—';
    chordInput.setAttribute('aria-label', 'Bar ' + (bi + 1) + ' chord');
    chordInput.addEventListener('input', function () {
      bar.chords[0].symbol = chordInput.value;
      changed();
    });
    chordWrap.appendChild(chordInput);
    head.appendChild(chordWrap);
    card.appendChild(head);

    /* lane grid */
    var counts = countLabels(bar.meter, bar.grid_unit);
    var n = counts.length;
    var grid = el('div', 'lane-grid unit-' + bar.grid_unit);
    grid.style.setProperty('--cols', n);

    grid.appendChild(el('span', 'lane-label', 'Counts'));
    counts.forEach(function (c, i) {
      var isBeat = /^[0-9]+$/.test(c);
      var cell = el('span', 'count-cell' + (isBeat ? ' beat' : ''), c);
      cell.setAttribute('aria-hidden', 'true');
      grid.appendChild(cell);
    });

    grid.appendChild(el('span', 'lane-label', 'Degrees'));
    for (var i = 0; i < n; i++) grid.appendChild(makeCellInput(pi, bi, 'deg', i, bar, counts));

    grid.appendChild(el('span', 'lane-label', 'Lyrics'));
    for (var j = 0; j < n; j++) grid.appendChild(makeCellInput(pi, bi, 'lyr', j, bar, counts));

    var scroller = el('div', 'lane-scroll');
    scroller.appendChild(grid);
    card.appendChild(scroller);

    /* actions */
    var actions = el('div', 'bar-actions');
    actions.appendChild(barActionBtn('Duplicate', 'Duplicate bar ' + (bi + 1), function () {
      phrase.bars.splice(bi + 1, 0, JSON.parse(JSON.stringify(bar)));
      structureChanged();
      announceStatus('Bar duplicated.');
    }));
    actions.appendChild(barActionBtn('Clear', 'Clear bar ' + (bi + 1), function () {
      bar.chords[0].symbol = '';
      bar.degrees = bar.degrees.map(function () { return ''; });
      bar.lyrics = bar.lyrics.map(function () { return ''; });
      structureChanged();
      announceStatus('Bar cleared.');
    }));
    actions.appendChild(barActionBtn('Delete', 'Delete bar ' + (bi + 1), function () {
      deleteBar(pi, bi);
    }));
    var spacer = el('span', 'spacer');
    actions.appendChild(spacer);
    var left = barActionBtn('\u25C0', 'Move bar ' + (bi + 1) + ' earlier', function () { moveBar(pi, bi, -1); });
    var right = barActionBtn('\u25B6', 'Move bar ' + (bi + 1) + ' later', function () { moveBar(pi, bi, 1); });
    left.disabled = bi === 0;
    right.disabled = bi === phrase.bars.length - 1;
    actions.appendChild(left);
    actions.appendChild(right);
    card.appendChild(actions);

    return card;
  }

  function barActionBtn(text, label, fn) {
    var b = el('button', 'ghost-btn small', text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', fn);
    return b;
  }

  function deleteBar(pi, bi) {
    var phrase = state.phrases[pi];
    if (state.phrases.length === 1 && phrase.bars.length === 1) {
      // Never leave the editor with nothing to type into.
      phrase.bars[0] = newBar(state.meter, state.default_grid_unit);
      structureChanged();
      announceStatus('Bar cleared.');
      return;
    }
    var removed = phrase.bars.splice(bi, 1)[0];
    lastDeleted = { kind: 'bar', phrase: pi, index: bi, bar: removed };
    structureChanged();
    showToast('Bar deleted.', 'Undo', function () {
      if (!lastDeleted || lastDeleted.kind !== 'bar') return;
      var p = state.phrases[Math.min(lastDeleted.phrase, state.phrases.length - 1)];
      p.bars.splice(Math.min(lastDeleted.index, p.bars.length), 0, lastDeleted.bar);
      lastDeleted = null;
      structureChanged();
      announceStatus('Bar restored.');
    });
    announceStatus('Bar deleted. Undo available.');
  }

  function moveBar(pi, bi, dir) {
    var bars = state.phrases[pi].bars;
    var ni = bi + dir;
    if (ni < 0 || ni >= bars.length) return;
    var tmp = bars[bi];
    bars[bi] = bars[ni];
    bars[ni] = tmp;
    structureChanged();
    announceStatus('Bar moved to position ' + (ni + 1) + '.');
  }

  /* --------------------------- cell inputs ----------------------------- */

  function makeCellInput(pi, bi, lane, idx, bar, counts) {
    var input = el('input', 'cell-input ' + (lane === 'deg' ? 'deg-cell' : 'lyr-cell'));
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.phrase = pi;
    input.dataset.bar = bi;
    input.dataset.lane = lane;
    input.dataset.cell = idx;
    var laneName = lane === 'deg' ? 'degree' : 'lyric';
    input.setAttribute('aria-label', 'Bar ' + (bi + 1) + ' ' + laneName + ' on ' + countDesc(counts, idx));
    input.value = lane === 'deg' ? prettyDegree(bar.degrees[idx]) : bar.lyrics[idx];

    input.addEventListener('input', function () {
      var v = input.value;
      if (lane === 'deg') {
        bar.degrees[idx] = uglyDegree(v);
      } else {
        bar.lyrics[idx] = v;
      }
      changed();
    });

    if (lane === 'deg') {
      // Render b3 -> ♭3 when leaving the cell; storage stays ASCII.
      input.addEventListener('blur', function () {
        input.value = prettyDegree(bar.degrees[idx]);
      });
    }

    input.addEventListener('keydown', cellKeydown);
    return input;
  }

  function countDesc(counts, idx) {
    var c = counts[idx];
    if (/^[0-9]+$/.test(c)) return 'beat ' + c;
    var beat = '';
    for (var i = idx; i >= 0; i--) {
      if (/^[0-9]+$/.test(counts[i])) { beat = counts[i]; break; }
    }
    var name = c === '&' ? 'and' : c;
    return 'the ' + name + ' of ' + beat;
  }

  // Store the ASCII form even if the user pasted pretty glyphs.
  function uglyDegree(s) {
    return String(s).replace(/\u266D/g, 'b').replace(/\u266F/g, '#');
  }

  /* ------------------------ keyboard navigation ------------------------ */

  function laneSequence() {
    // Lane-major order: every degree cell in document order, then every lyric
    // cell — so a whole melody can be typed with Tab alone.
    var degs = Array.prototype.slice.call(document.querySelectorAll('.deg-cell'));
    var lyrs = Array.prototype.slice.call(document.querySelectorAll('.lyr-cell'));
    return degs.concat(lyrs);
  }

  function focusCell(pi, bi, lane, idx) {
    var sel = '.cell-input[data-phrase="' + pi + '"][data-bar="' + bi + '"][data-lane="' + lane + '"][data-cell="' + idx + '"]';
    var n = document.querySelector(sel);
    if (n) { n.focus(); n.select && n.select(); }
    return !!n;
  }

  function cellKeydown(e) {
    var input = e.target;
    var pi = +input.dataset.phrase, bi = +input.dataset.bar, idx = +input.dataset.cell;
    var lane = input.dataset.lane;

    if (e.key === 'Tab') {
      e.preventDefault();
      var seq = laneSequence();
      var i = seq.indexOf(input);
      var next = seq[i + (e.shiftKey ? -1 : 1)];
      if (next) { next.focus(); next.select && next.select(); }
      return;
    }

    if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      var phrase = state.phrases[pi];
      phrase.bars.splice(bi + 1, 0, JSON.parse(JSON.stringify(phrase.bars[bi])));
      structureChanged();
      focusCell(pi, bi + 1, lane, idx);
      announceStatus('Bar duplicated.');
      return;
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      var ph = state.phrases[pi];
      ph.bars.push(newBar(state.meter, state.default_grid_unit));
      structureChanged();
      focusCell(pi, ph.bars.length - 1, 'deg', 0);
      announceStatus('Bar added.');
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // Jump to the next bar's first degree cell (capture flow).
      if (!focusCell(pi, bi + 1, 'deg', 0)) {
        // last bar of this phrase: try first bar of next phrase
        focusCell(pi + 1, 0, 'deg', 0);
      }
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(pi, bi, lane === 'deg' ? 'lyr' : 'deg', idx);
      return;
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      var atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      var atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      if ((e.key === 'ArrowRight' && atEnd) || (e.key === 'ArrowLeft' && atStart)) {
        e.preventDefault();
        var seqLane = Array.prototype.slice.call(
          document.querySelectorAll('.cell-input[data-lane="' + lane + '"]'));
        var pos = seqLane.indexOf(input);
        var tgt = seqLane[pos + (e.key === 'ArrowRight' ? 1 : -1)];
        if (tgt) { tgt.focus(); tgt.select && tgt.select(); }
      }
    }
  }

  /* ------------------------------ preview ------------------------------ */

  var previewTab = 'text';

  function bindPreview() {
    Array.prototype.forEach.call(document.querySelectorAll('.preview-tab'), function (btn) {
      btn.addEventListener('click', function () {
        previewTab = btn.dataset.tab;
        Array.prototype.forEach.call(document.querySelectorAll('.preview-tab'), function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        renderPreview();
      });
    });
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 150);
  }

  function renderPreview() {
    var out = $('preview-output');
    if (!out) return;
    if (previewTab === 'markdown') out.textContent = toMarkdown(state);
    else if (previewTab === 'json') out.textContent = toJSON(state);
    else out.textContent = toPlainText(state);
  }

  /* ----------------------------- read mode ----------------------------- */

  var mode = 'capture';

  function bindModeToggle() {
    $('mode-capture').addEventListener('click', function () { setMode('capture'); });
    $('mode-read').addEventListener('click', function () { setMode('read'); });
  }

  function setMode(m) {
    mode = m;
    document.body.classList.toggle('read-mode', m === 'read');
    $('mode-capture').setAttribute('aria-pressed', m === 'capture' ? 'true' : 'false');
    $('mode-read').setAttribute('aria-pressed', m === 'read' ? 'true' : 'false');
    if (m === 'read') renderReadSheet();
    announceStatus(m === 'read' ? 'Read mode.' : 'Capture mode.');
  }

  function renderReadSheet() {
    var sheet = $('read-sheet');
    if (!sheet) return;
    var metaBits = [];
    if (state.key) metaBits.push('Key ' + state.key);
    if (state.tonal_center && state.tonal_center !== state.key) metaBits.push('Center ' + state.tonal_center);
    if (state.mode) metaBits.push(state.mode);
    if (state.meter) metaBits.push(state.meter);
    if (state.tempo) metaBits.push(state.tempo);
    if (state.feel) metaBits.push(state.feel);

    sheet.innerHTML = '';
    var h = el('h2', 'read-title', state.title || 'Untitled Incipit');
    sheet.appendChild(h);
    if (metaBits.length) sheet.appendChild(el('p', 'read-meta', metaBits.join(' \u00B7 ')));
    if (state.audio_ref) sheet.appendChild(el('p', 'read-audio', 'Audio: ' + state.audio_ref));
    var pre = el('pre', 'read-grid');
    pre.textContent = alignedText(state);
    sheet.appendChild(pre);
    if (state.contour) {
      var c = el('p', 'read-note'); c.innerHTML = '<strong>Contour</strong> ';
      c.appendChild(document.createTextNode(state.contour));
      sheet.appendChild(c);
    }
    if (state.notes) {
      var nn = el('p', 'read-note'); nn.innerHTML = '<strong>Notes</strong> ';
      nn.appendChild(document.createTextNode(state.notes));
      sheet.appendChild(nn);
    }
    if ((state.tags || []).length || state.status) {
      sheet.appendChild(el('p', 'read-tags',
        ((state.tags || []).join(', ') || '') +
        (state.status ? ((state.tags || []).length ? ' \u00B7 ' : '') + 'status: ' + state.status : '')));
    }
  }

  /* --------------------------- export actions -------------------------- */

  function copyText(text, btn) {
    function done(ok) {
      var prev = btn.textContent;
      btn.textContent = ok ? 'Copied \u2713' : 'Copy failed';
      btn.disabled = true;
      setTimeout(function () { btn.textContent = prev; btn.disabled = false; }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    done(ok);
  }

  function downloadText(text, filename, mime) {
    var blob = new Blob([text], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function bindExports() {
    $('copy-md').addEventListener('click', function () { copyText(toMarkdown(state), this); });
    $('copy-json').addEventListener('click', function () { copyText(toJSON(state), this); });
    $('copy-txt').addEventListener('click', function () { copyText(toPlainText(state), this); });
    $('dl-md').addEventListener('click', function () {
      downloadText(toMarkdown(state), exportFilename(state, 'md'), 'text/markdown');
    });
    $('dl-json').addEventListener('click', function () {
      downloadText(toJSON(state), exportFilename(state, 'json'), 'application/json');
    });
    $('dl-txt').addEventListener('click', function () {
      downloadText(toPlainText(state), exportFilename(state, 'txt'), 'text/plain');
    });
    $('print-btn').addEventListener('click', function () {
      renderReadSheet();
      window.print();
    });
  }

  /* --------------------------- import / new ---------------------------- */

  function bindFileActions() {
    var fileInput = $('import-file');
    $('import-btn').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var parsed;
        try { parsed = JSON.parse(reader.result); }
        catch (e) {
          showToast('That file is not valid JSON.');
          fileInput.value = '';
          return;
        }
        var v = validateIncipit(parsed);
        if (!v.ok) {
          showToast('Import rejected: ' + v.errors[0]);
          announceStatus('Import rejected. ' + v.errors.join(' '));
          fileInput.value = '';
          return;
        }
        var previous = JSON.parse(JSON.stringify(state));
        loadState(v.state);
        showToast('Incipit imported.', 'Undo', function () {
          loadState(previous);
          announceStatus('Import undone.');
        });
        announceStatus('Incipit imported.');
        fileInput.value = '';
      };
      reader.readAsText(f);
    });

    $('new-btn').addEventListener('click', function () {
      if (!window.confirm('Start a new incipit? Your current one is kept as a one-step backup.')) return;
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)); } catch (e) { /* storage full */ }
      var previous = JSON.parse(JSON.stringify(state));
      loadState(newState());
      showToast('New incipit started.', 'Undo', function () {
        loadState(previous);
        announceStatus('Previous incipit restored.');
      });
    });

    $('example-btn').addEventListener('click', loadExample);
    var hintBtn = $('empty-example-btn');
    if (hintBtn) hintBtn.addEventListener('click', loadExample);

    $('keys-btn').addEventListener('click', function () {
      var pop = $('keys-pop');
      var open = !pop.hidden;
      pop.hidden = open;
      $('keys-btn').setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  }

  function loadExample() {
    var hasContent = stateHasContent();
    if (hasContent && !window.confirm('Load the example? It replaces the current incipit (kept as a one-step Undo).')) return;
    var previous = JSON.parse(JSON.stringify(state));
    loadState(exampleState());
    if (hasContent) {
      showToast('Example loaded.', 'Undo', function () { loadState(previous); });
    }
    announceStatus('Example loaded.');
  }

  function stateHasContent() {
    if ((state.title || '').trim()) return true;
    return state.phrases.some(function (p) {
      return p.bars.some(function (b) {
        return (b.chords[0].symbol || '').trim() !== '' ||
          b.degrees.some(function (c) { return c !== ''; }) ||
          b.lyrics.some(function (c) { return c !== ''; });
      });
    });
  }

  function updateEmptyState() {
    var hint = $('empty-hint');
    if (!hint) return;
    hint.hidden = stateHasContent();
  }

  /* ------------------------------ phrases ------------------------------ */

  function bindPhraseControls() {
    $('add-phrase-btn').addEventListener('click', function () {
      state.phrases.push({
        label: 'Phrase ' + (state.phrases.length + 1),
        bars: [newBar(state.meter, state.default_grid_unit)]
      });
      structureChanged();
      announceStatus('Phrase added.');
    });
  }

  /* ------------------------------- boot -------------------------------- */

  function loadState(s) {
    state = s;
    fillMetadataInputs();
    renderPhrases();
    renderPreview();
    renderReadSheet();
    updateEmptyState();
    scheduleSave();
  }

  var booted = false;
  function init() {
    if (booted) return;
    booted = true;
    bindMetadata();
    bindResolution();
    bindPreview();
    bindModeToggle();
    bindExports();
    bindFileActions();
    bindPhraseControls();
    document.addEventListener('click', function (e) {
      var pop = $('keys-pop');
      if (!pop.hidden && !pop.contains(e.target) && e.target !== $('keys-btn')) {
        pop.hidden = true;
        $('keys-btn').setAttribute('aria-expanded', 'false');
      }
    });
    loadState(loadSaved() || newState());
    setMode('capture');
  }

  MIT.app = {
    init: init,
    getState: function () { return state; },
    loadState: loadState,
    setMode: setMode,
    deleteBar: deleteBar,
    moveBar: moveBar,
    applyResolutionChange: applyResolutionChange,
    applyMeterChange: applyMeterChange,
    loadExample: loadExample
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.getElementById('phrases')) init();
    });
  } else if (document.getElementById('phrases')) {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);

/* Tests for the Melody Incipit Grid Tool's pure functions.
   Used by tests.html in the browser and by Node during development.
   No test framework — just assertions. */
function runMITTests(MIT) {
  'use strict';
  var results = [];
  function t(name, fn) {
    try {
      fn();
      results.push({ name: name, ok: true });
    } catch (e) {
      results.push({ name: name, ok: false, detail: e.message });
    }
  }
  function eq(a, b, msg) {
    var ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb) throw new Error((msg || 'not equal') + ': ' + ja + ' !== ' + jb);
  }
  function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

  /* ---------------- grid math: slots ---------------- */
  t('slots 4/4 quarter = 4', function () { eq(MIT.slotsFor('4/4', 'quarter'), 4); });
  t('slots 4/4 eighth = 8', function () { eq(MIT.slotsFor('4/4', 'eighth'), 8); });
  t('slots 4/4 sixteenth = 16', function () { eq(MIT.slotsFor('4/4', 'sixteenth'), 16); });
  t('slots 3/4 quarter = 3', function () { eq(MIT.slotsFor('3/4', 'quarter'), 3); });
  t('slots 3/4 eighth = 6', function () { eq(MIT.slotsFor('3/4', 'eighth'), 6); });
  t('slots 3/4 sixteenth = 12', function () { eq(MIT.slotsFor('3/4', 'sixteenth'), 12); });
  t('slots 2/4 quarter = 2', function () { eq(MIT.slotsFor('2/4', 'quarter'), 2); });
  t('slots 2/4 eighth = 4', function () { eq(MIT.slotsFor('2/4', 'eighth'), 4); });
  t('slots 2/4 sixteenth = 8', function () { eq(MIT.slotsFor('2/4', 'sixteenth'), 8); });
  t('slots 6/8 quarter (beat level) = 2', function () { eq(MIT.slotsFor('6/8', 'quarter'), 2); });
  t('slots 6/8 eighth = 6', function () { eq(MIT.slotsFor('6/8', 'eighth'), 6); });
  t('slots 6/8 sixteenth = 12', function () { eq(MIT.slotsFor('6/8', 'sixteenth'), 12); });
  t('unknown meter falls back to 4/4 shape and is flagged', function () {
    eq(MIT.slotsFor('7/8', 'eighth'), 8);
    eq(MIT.parseMeter('7/8').known, false);
    eq(MIT.parseMeter('4/4').known, true);
  });

  /* ---------------- grid math: count labels ---------------- */
  t('labels 4/4 quarter', function () { eq(MIT.countLabels('4/4', 'quarter'), ['1', '2', '3', '4']); });
  t('labels 4/4 eighth', function () {
    eq(MIT.countLabels('4/4', 'eighth'), ['1', '&', '2', '&', '3', '&', '4', '&']);
  });
  t('labels 4/4 sixteenth', function () {
    eq(MIT.countLabels('4/4', 'sixteenth'),
      ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a']);
  });
  t('labels 3/4 eighth', function () { eq(MIT.countLabels('3/4', 'eighth'), ['1', '&', '2', '&', '3', '&']); });
  t('labels 6/8 eighth', function () { eq(MIT.countLabels('6/8', 'eighth'), ['1', '2', '3', '4', '5', '6']); });
  t('labels 6/8 quarter', function () { eq(MIT.countLabels('6/8', 'quarter'), ['1', '2']); });
  t('labels 6/8 sixteenth', function () {
    eq(MIT.countLabels('6/8', 'sixteenth'), ['1', '&', '2', '&', '3', '&', '4', '&', '5', '&', '6', '&']);
  });
  t('label count always equals slot count', function () {
    ['4/4', '3/4', '2/4', '6/8', '7/8'].forEach(function (m) {
      MIT.GRID_UNITS.forEach(function (u) {
        eq(MIT.countLabels(m, u).length, MIT.slotsFor(m, u), m + ' x ' + u);
      });
    });
  });

  /* ---------------- remapping ---------------- */
  t('remap coarse->fine is lossless and lands on matching slots', function () {
    var r = MIT.remapCells(['3', '2', '1', '5'], 4, 8);
    eq(r.cells, ['3', '', '2', '', '1', '', '5', '']);
    eq(r.lost, []);
  });
  t('remap fine->coarse keeps on-grid cells, reports off-grid losses', function () {
    var r = MIT.remapCells(['3', 'x', '2', '', '1', '', '5', 'y'], 8, 4);
    eq(r.cells, ['3', '2', '1', '5']);
    eq(r.lost, ['x', 'y']);
  });
  t('remap fine->coarse with no off-grid data loses nothing', function () {
    var r = MIT.remapCells(['3', '', '2', '', '1', '', '5', ''], 8, 4);
    eq(r.lost, []);
  });
  t('remap round trip quarter->sixteenth->quarter preserves data', function () {
    var up = MIT.remapCells(['1', '2', '3', '4'], 4, 16);
    var down = MIT.remapCells(up.cells, 16, 4);
    eq(down.cells, ['1', '2', '3', '4']);
    eq(down.lost, []);
  });
  t('remap incompatible counts truncates and reports', function () {
    var r = MIT.remapCells(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 8, 6);
    eq(r.cells, ['a', 'b', 'c', 'd', 'e', 'f']);
    eq(r.lost, ['g', 'h']);
  });
  t('remap pads when growing to incompatible count', function () {
    var r = MIT.remapCells(['a', 'b', 'c'], 3, 8);
    eq(r.cells, ['a', 'b', 'c', '', '', '', '', '']);
    eq(r.lost, []);
  });

  /* ---------------- degree rendering ---------------- */
  t('prettyDegree renders flats and sharps', function () {
    eq(MIT.prettyDegree('b7'), '\u266D7');
    eq(MIT.prettyDegree('#4'), '\u266F4');
    eq(MIT.prettyDegree('3'), '3');
    eq(MIT.prettyDegree('-'), '-');
    eq(MIT.prettyDegree(''), '');
  });
  t('prettyDegree leaves non-degree b/# alone', function () {
    eq(MIT.prettyDegree('Bb'), 'Bb'); // chord letters untouched (b not before 1-7)
    eq(MIT.prettyDegree('ba'), 'ba');
  });

  /* ---------------- helpers ---------------- */
  t('slugify', function () {
    eq(MIT.slugify('Walking Home Hook'), 'walking-home-hook');
    eq(MIT.slugify('  Weird -- Title!! '), 'weird-title');
    eq(MIT.slugify(''), 'untitled-incipit');
  });
  t('parseTags', function () {
    eq(MIT.parseTags(' gospel, hook ,, flat-seven '), ['gospel', 'hook', 'flat-seven']);
    eq(MIT.parseTags(''), []);
  });

  /* ---------------- aligned text renderer ---------------- */
  t('alignedText: all four lanes have identical length per phrase', function () {
    var s = MIT.exampleState();
    var lines = MIT.alignedText(s).split('\n');
    eq(lines.length, 4);
    var w = lines[0].length;
    lines.forEach(function (l, i) { eq(l.length, w, 'line ' + i + ' width'); });
  });
  t('alignedText: lanes are labeled and bar-separated', function () {
    var s = MIT.exampleState();
    var text = MIT.alignedText(s);
    ok(text.indexOf('Chords: ') === 0, 'starts with Chords:');
    ok(text.indexOf('Counts:') > -1 && text.indexOf('Degrees:') > -1 && text.indexOf('Lyrics:') > -1, 'all lanes present');
    var bars = text.split('\n')[0].split('|').length - 2;
    eq(bars, 4, 'four bars in chord row');
  });
  t('alignedText: degree glyphs are pretty in output', function () {
    var text = MIT.alignedText(MIT.exampleState());
    ok(text.indexOf('\u266D7') > -1, 'flat-seven rendered');
    ok(text.indexOf('b7') === -1, 'no ascii b7 left in degree lane');
  });
  t('alignedText: column width follows the widest cell (long syllable)', function () {
    var s = MIT.newState();
    s.phrases[0].bars[0].degrees[0] = '3';
    s.phrases[0].bars[0].lyrics[0] = 'extraordinarily-long';
    var lines = MIT.alignedText(s).split('\n');
    var w = lines[0].length;
    lines.forEach(function (l) { eq(l.length, w, 'long syllable keeps lanes equal width'); });
    ok(lines[3].indexOf('extraordinarily-long') > -1);
  });
  t('alignedText: long chord widens the bar without breaking lanes', function () {
    var s = MIT.newState();
    s.default_grid_unit = 'quarter';
    s.phrases[0].bars[0] = MIT.newBar('4/4', 'quarter');
    s.phrases[0].bars[0].chords[0].symbol = 'Cmaj7add13/G';
    var lines = MIT.alignedText(s).split('\n');
    var w = lines[0].length;
    lines.forEach(function (l) { eq(l.length, w); });
    ok(lines[0].indexOf('Cmaj7add13/G') > -1);
  });
  t('alignedText: multiple phrases render labeled blocks', function () {
    var s = MIT.newState();
    s.phrases.push({ label: 'Phrase 2', bars: [MIT.newBar('4/4', 'eighth')] });
    var text = MIT.alignedText(s);
    ok(text.indexOf('Phrase 1') > -1 && text.indexOf('Phrase 2') > -1, 'phrase labels present');
    eq(text.split('\n\n').length, 2, 'two blocks');
  });

  /* ---------------- exports ---------------- */
  t('toMarkdown: valid frontmatter fence with required fields', function () {
    var md = MIT.toMarkdown(MIT.exampleState());
    ok(md.indexOf('---\n') === 0, 'starts with ---');
    var end = md.indexOf('\n---\n', 3);
    ok(end > 0, 'frontmatter closes');
    var fm = md.slice(4, end);
    ['type: melody-incipit', 'title: "Walking Home Hook"', 'key: "C"', 'status: "promising"',
      'tags: ["gospel", "melody", "hook", "flat-seven"]'].forEach(function (needle) {
      ok(fm.indexOf(needle) > -1, 'frontmatter contains ' + needle);
    });
    ok(md.indexOf('## Incipit') > -1 && md.indexOf('```text') > -1, 'body has incipit block');
    ok(md.indexOf(MIT.alignedText(MIT.exampleState())) > -1, 'embeds the exact aligned grid');
  });
  t('toMarkdown: quotes are escaped in YAML', function () {
    var s = MIT.newState();
    s.title = 'He said "hi"';
    var md = MIT.toMarkdown(s);
    ok(md.indexOf('title: "He said \\"hi\\""') > -1, 'escaped quotes');
  });
  t('toPlainText: contains header, grid, and footer', function () {
    var txt = MIT.toPlainText(MIT.exampleState());
    ok(txt.indexOf('MELODY INCIPIT: Walking Home Hook') === 0);
    ok(txt.indexOf('Chords: ') > -1);
    ok(txt.indexOf('Contour:') > -1 && txt.indexOf('Tags:') > -1);
    ok(txt.indexOf(MIT.alignedText(MIT.exampleState())) > -1, 'plain text embeds identical grid');
  });
  t('export filenames follow YYYY-MM-DD-slug.ext', function () {
    var s = MIT.exampleState();
    var name = MIT.exportFilename(s, 'md');
    ok(/^\d{4}-\d{2}-\d{2}-walking-home-hook\.md$/.test(name), name);
  });

  /* ---------------- validation & round trip ---------------- */
  t('validateIncipit accepts its own JSON export (round trip)', function () {
    var s = MIT.exampleState();
    var v = MIT.validateIncipit(JSON.parse(MIT.toJSON(s)));
    ok(v.ok, v.errors.join('; '));
    eq(v.state.phrases, s.phrases, 'phrases survive round trip');
    eq(v.state.title, s.title);
    eq(v.state.tags, s.tags);
  });
  t('validateIncipit rejects wrong type', function () {
    var v = MIT.validateIncipit({ type: 'something-else', schema_version: '1.0', phrases: [] });
    ok(!v.ok);
  });
  t('validateIncipit rejects non-object and arrays', function () {
    ok(!MIT.validateIncipit(null).ok);
    ok(!MIT.validateIncipit([1, 2]).ok);
    ok(!MIT.validateIncipit('hello').ok);
  });
  t('validateIncipit rejects mismatched lane lengths', function () {
    var s = MIT.exampleState();
    var obj = JSON.parse(MIT.toJSON(s));
    obj.phrases[0].bars[0].degrees.pop();
    var v = MIT.validateIncipit(obj);
    ok(!v.ok, 'should reject');
    ok(v.errors[0].indexOf('lengths differ') > -1, v.errors[0]);
  });
  t('validateIncipit rejects bad grid_unit', function () {
    var obj = JSON.parse(MIT.toJSON(MIT.exampleState()));
    obj.phrases[0].bars[0].grid_unit = 'thirty-second';
    ok(!MIT.validateIncipit(obj).ok);
  });
  t('validateIncipit fills missing optional metadata with defaults', function () {
    var v = MIT.validateIncipit({
      type: 'melody-incipit', schema_version: '1.0',
      phrases: [{ label: 'P', bars: [{ meter: '4/4', grid_unit: 'eighth', chords: [{ symbol: 'C', position: 0 }], degrees: ['1','','','','','','',''], lyrics: ['a','','','','','','',''] }] }]
    });
    ok(v.ok, v.errors.join('; '));
    eq(v.state.status, 'raw');
    eq(v.state.tags, []);
    eq(v.state.meter, '4/4');
  });

  /* ---------------- state constructors ---------------- */
  t('newState: one phrase, one 4/4 eighth bar, parallel empty lanes', function () {
    var s = MIT.newState();
    eq(s.schema_version, '1.0');
    eq(s.type, 'melody-incipit');
    eq(s.phrases.length, 1);
    eq(s.phrases[0].bars.length, 1);
    eq(s.phrases[0].bars[0].degrees.length, 8);
    eq(s.phrases[0].bars[0].lyrics.length, 8);
    eq(s.phrases[0].bars[0].chords, [{ symbol: '', position: 0 }]);
  });
  t('exampleState matches the source notes (4 bars, C/Bb/F/C, b7)', function () {
    var s = MIT.exampleState();
    var bars = s.phrases[0].bars;
    eq(bars.length, 4);
    eq(bars.map(function (b) { return b.chords[0].symbol; }), ['C', 'Bb', 'F', 'C']);
    eq(bars[1].degrees[0], 'b7');
    eq(bars[0].lyrics, ['I', '', 'was', 'walk-', 'ing', '', 'home', '']);
  });

  var passed = results.filter(function (r) { return r.ok; }).length;
  return { results: results, passed: passed, failed: results.length - passed };
}

if (typeof module !== 'undefined' && module.exports) module.exports = runMITTests;

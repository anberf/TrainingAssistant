'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Import = require('../js/import.js');
const Routine = require('../js/routine.js');
const Drafts = require('../js/drafts.js');

const root = path.join(__dirname, '..');
const HEAD = Import.COLUMNS;

function md(rows, head) {
  const h = head || HEAD;
  const line = (c) => '| ' + c.join(' | ') + ' |';
  return [line(h), line(h.map(() => '---'))].concat(rows.map(line)).join('\n');
}
function tsv(rows, head) {
  return [head || HEAD].concat(rows).map((r) => r.join('\t')).join('\n');
}

// SPEC 4c example (total 570 s, 13 steps)
const EXAMPLE = [
  ['Warm-up', '1', '0', 'Halo', 'exercise', '10', '', 'yes', '', 'Bell close around head', 'Ribs down, glutes tight', 'Slow, smooth circles'],
  ['', '', '', 'Pause', 'pause', '', '15', '', '', '', '', ''],
  ['Main', '3', '60', 'Two-hand swing', 'exercise', '15', '', '', '', "Hinge, don't squat", 'Snap hips to stand', 'Arms are ropes'],
  ['', '', '', 'Pause', 'pause', '', '20', '', '', '', '', ''],
  ['', '', '', 'Suitcase march', 'exercise', '', '30', 'yes', '', 'Stand tall, no lean', 'Knees to hip height', 'Brace your core']
];

function build(rows, opts) {
  return Import.toRoutine(Import.parseTable(md(rows)), opts || { name: 'Example', weight: '10 kg' });
}

test('Markdown and TSV versions of the same table give the same routine', () => {
  const a = Import.toRoutine(Import.parseTable(md(EXAMPLE)), { name: 'Example', weight: '10 kg' });
  const b = Import.toRoutine(Import.parseTable(tsv(EXAMPLE)), { name: 'Example', weight: '10 kg' });
  assert.deepStrictEqual(a.errors, []);
  assert.deepStrictEqual(b.errors, []);
  assert.deepStrictEqual(a.routine, b.routine);
});

test('text around the table is ignored; outer pipes optional; header case/spacing free', () => {
  const body = md(EXAMPLE).split('\n').map((l) => l.replace(/ \|$/, '').replace(/^\| (?=\S)/, '')).join('\n')
    .replace('Rest between rounds', '  REST   between  rounds ');
  const text = 'Here is your workout:\n\n' + body + '\n\nEnjoy!\n';
  const r = Import.toRoutine(Import.parseTable(text), { name: 'Example' });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(Routine.totalDuration(r.routine), 570);
});

test('SPEC example: validates, 570 s, 13 steps, ids and defaults', () => {
  const r = build(EXAMPLE);
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.routine.id, 'example');
  assert.strictEqual(r.routine.weight, '10 kg');
  assert.deepStrictEqual(r.routine.defaults, { secPerRep: 3 });
  assert.strictEqual(Routine.validateRoutine(r.routine).ok, true);
  assert.strictEqual(Routine.totalDuration(r.routine), 570);
  assert.strictEqual(Routine.expand(r.routine).length, 13);
  const pv = Import.preview(r.routine);
  assert.strictEqual(pv.total, 570);
  assert.strictEqual(pv.stepCount, 13);
});

test('blank Block cells keep the same block; rounds/rest read from the first row', () => {
  const r = build(EXAMPLE).routine;
  assert.strictEqual(r.blocks.length, 2);
  assert.deepStrictEqual(r.blocks.map((b) => [b.name, b.rounds, b.restBetweenRounds, b.steps.length]),
    [['Warm-up', 1, 0, 2], ['Main', 3, 60, 3]]);
});

test('pause / rest / per-side / sec per rep / weight omitted', () => {
  const rows = [
    ['A', '', '', 'Turkish get-up', 'Exercise', '3', '', 'Y', '20', 'Eyes on bell', 'Arm locked', 'Slow'],
    ['', '', '', 'Rest', 'rest', '', '30', '', '', '', '', ''],
    ['', '', '', 'Plank', 'exercise', '', '20', 'no', '', 'a', 'b', 'c']
  ];
  const r = build(rows, { name: 'T', weight: '  ' });
  assert.deepStrictEqual(r.errors, []);
  const s = r.routine.blocks[0].steps;
  assert.deepStrictEqual(s[0], { name: 'Turkish get-up', type: 'exercise', reps: 3, perSide: true, secPerRep: 20, cues: ['Eyes on bell', 'Arm locked', 'Slow'] });
  assert.deepStrictEqual(s[1], { name: 'Rest', type: 'pause', seconds: 30 });
  assert.strictEqual(s[2].perSide, undefined);
  assert.strictEqual('weight' in r.routine, false);
  assert.strictEqual(r.routine.blocks[0].rounds, 1);
  assert.strictEqual(r.routine.blocks[0].restBetweenRounds, 0);
  assert.strictEqual(Routine.totalDuration(r.routine), 3 * 20 * 2 + 30 + 20);
});

test('a table equivalent to routines/demo.json has the same totalDuration', () => {
  const demo = JSON.parse(fs.readFileSync(path.join(root, 'routines/demo.json'), 'utf8'));
  const rows = [
    ['Block A', '2', '5', 'Air squat', 'exercise', '', '10', '', '', 'Chest up', 'Knees out', 'Drive through heels'],
    ['', '', '', 'Pause', 'pause', '', '10', '', '', '', '', ''],
    ['', '', '', 'Halo', 'exercise', '5', '', 'yes', '1', 'Ribs down', 'Bell close to head', 'Smooth circles']
  ];
  const r = build(rows, { name: 'Demo' });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(Routine.totalDuration(r.routine), Routine.totalDuration(demo));
  assert.strictEqual(Routine.totalDuration(r.routine), 65);
  assert.strictEqual(Routine.expand(r.routine).length, Routine.expand(demo).length);
});

function errsFor(row, extra) {
  const base = ['A', '1', '0', 'Swing', 'exercise', '10', '', '', '', 'x', 'y', 'z'];
  const rows = [base.slice(), ['', '', '', 'Pause', 'pause', '', '5', '', '', '', '', ''], row];
  return build(rows.concat(extra || []), { name: 'T' }).errors;
}

test('errors carry row and column', () => {
  assert.ok(errsFor(['', '', '', 'Swing', 'exercise', 'ten', '', '', '', 'x', 'y', 'z']).includes('row 3, Reps: expected whole number'));
  assert.ok(errsFor(['', '', '', 'Swing', 'exercise', '0', '', '', '', 'x', 'y', 'z']).includes('row 3, Reps: expected whole number'));
  assert.ok(errsFor(['', '', '', 'Swing', 'exercise', '5', '20', '', '', 'x', 'y', 'z']).some((e) => /^row 3, Seconds: .*not both/.test(e)));
  assert.ok(errsFor(['', '', '', 'Swing', 'exercise', '', '', '', '', 'x', 'y', 'z']).some((e) => /^row 3, Reps: /.test(e)));
  assert.ok(errsFor(['', '', '', 'Swing', 'exercise', '5', '', '', '', 'x', '', 'z']).includes('row 3, Cue 2: required for an exercise'));
  assert.ok(errsFor(['', '', '', 'Swing', 'exercise', '5', '', '', '', 'x', 'y', 'q'.repeat(31)]).some((e) => /^row 3, Cue 3: too long/.test(e)));
  assert.ok(errsFor(['', '', '', 'Swing', 'jump', '5', '', '', '', 'x', 'y', 'z']).includes('row 3, Type: expected exercise or pause'));
  assert.ok(errsFor(['', '', '', 'Swing', 'exercise', '5', '', 'maybe', '', 'x', 'y', 'z']).some((e) => /^row 3, Per side: /.test(e)));
  assert.ok(errsFor(['', '', '', 'Swing', 'exercise', '5', '', '', '-1', 'x', 'y', 'z']).some((e) => /^row 3, Sec per rep: /.test(e)));
  assert.ok(errsFor(['', '', '', 'Swing', 'pause', '5', '', '', '', '', '', '']).includes('row 3, Reps: pause must use Seconds'));
  assert.ok(errsFor(['', '', '', '', 'exercise', '5', '', '', '', 'x', 'y', 'z']).includes('row 3, Exercise: required'));
  const bad = build([['A', 'x', '0', 'S', 'exercise', '5', '', '', '', 'a', 'b', 'c']], { name: 'T' }).errors;
  assert.ok(bad.some((e) => /^row 1, Rounds: /.test(e)));
  assert.ok(build([['', '', '', 'S', 'exercise', '5', '', '', '', 'a', 'b', 'c']], { name: 'T' }).errors
    .includes('row 1, Block: required on the first row'));
});

test('row numbers count data rows from 1 (separator and blank rows excluded)', () => {
  const rows = [
    ['A', '', '', 'S', 'exercise', '5', '', '', '', 'a', 'b', 'c'],
    ['', '', '', 'S', 'exercise', '5', '', '', '', 'a', 'b', 'c'],
    ['', '', '', 'S', 'exercise', 'bad', '', '', '', 'a', 'b', 'c']
  ];
  assert.deepStrictEqual(build(rows, { name: 'T' }).errors, ['row 3, Reps: expected whole number']);
});

test('missing required column, unknown column, no table, missing name', () => {
  const noReps = HEAD.filter((c) => c !== 'Reps');
  const r = Import.toRoutine(Import.parseTable(md([['A', '1', '0', 'S', 'exercise', '5', 'a', 'b', 'c', 'd', 'e']], noReps)), { name: 'T' });
  assert.strictEqual(r.routine, null);
  assert.ok(r.errors.includes('table: missing column "Reps"'));

  const extra = HEAD.concat(['Notes']);
  const rows = EXAMPLE.map((x) => x.concat(['n']));
  const ok = Import.toRoutine(Import.parseTable(md(rows, extra)), { name: 'T' });
  assert.deepStrictEqual(ok.errors, []);
  assert.ok(ok.warnings.some((w) => /Notes/.test(w)));

  // Sec per rep is optional
  const noSpr = HEAD.filter((c) => c !== 'Sec per rep');
  const rows2 = EXAMPLE.map((x) => x.filter((_, i) => HEAD[i] !== 'Sec per rep'));
  assert.deepStrictEqual(Import.toRoutine(Import.parseTable(md(rows2, noSpr)), { name: 'T' }).errors, []);

  assert.ok(Import.parseTable('just some words').errors.length > 0);
  assert.ok(Import.toRoutine(Import.parseTable(md(EXAMPLE)), { name: '  ' }).errors.includes('name: required'));
  assert.ok(Import.toRoutine(Import.parseTable(md(EXAMPLE)), { name: '!!!' }).errors.includes('name: needs letters or digits'));
  assert.ok(Import.toRoutine(null, { name: 'x' }).errors.length > 0);
});

test('fileName: id.json, then -2, -3 on collisions', () => {
  assert.strictEqual(Import.fileName('kb-new', []), 'kb-new.json');
  assert.strictEqual(Import.fileName('kb-new', ['demo.json']), 'kb-new.json');
  assert.strictEqual(Import.fileName('demo', ['demo.json']), 'demo-2.json');
  assert.strictEqual(Import.fileName('demo', ['demo.json', 'demo-2.json']), 'demo-3.json');
  assert.strictEqual(Import.fileName('demo', ['DEMO.json']), 'demo-2.json');
});

test('preview picture list: distinct exercises, naming rule, explicit clips skipped', () => {
  const rows = [
    ['A', '', '', 'Leg & hip stretch', 'exercise', '5', '', '', '', 'a', 'b', 'c'],
    ['', '', '', 'Leg & hip stretch', 'exercise', '5', '', '', '', 'a', 'b', 'c'],
    ['', '', '', 'Pause', 'pause', '', '5', '', '', '', '', '']
  ];
  const pv = Import.preview(build(rows, { name: 'T' }).routine);
  assert.deepStrictEqual(pv.pictures, [{ name: 'Leg & hip stretch', webp: 'clips/leg-hip-stretch.webp', mp4: 'clips/leg-hip-stretch.mp4' }]);
});

test('every COLUMNS entry appears in CHAT_PROMPT and the prompt matches SPEC 4c', () => {
  assert.strictEqual(HEAD.length, 12);
  for (const c of HEAD) assert.ok(Import.CHAT_PROMPT.includes(c), c);
  const spec = fs.readFileSync(path.join(root, 'docs/SPEC.md'), 'utf8');
  assert.ok(spec.includes(Import.CHAT_PROMPT), 'SPEC 4c prompt text differs from Import.CHAT_PROMPT');
});

test('Drafts.add stores a draft-only routine that apply() appends as unpublished', () => {
  const r = build(EXAMPLE).routine;
  const d0 = Drafts.normalize(null);
  const d = Drafts.add(d0, 'example.json', r);
  assert.deepStrictEqual(d0, { routines: {}, removed: [] });
  const out = Drafts.apply([], d);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].file, 'example.json');
  assert.strictEqual(out[0].unpublished, true);
  assert.deepStrictEqual(out[0].routine, r);
});

test('import UI wiring: ids used by app.js exist; import.js loaded before app.js and in APP_SHELL; panel guard', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const used = [...app.matchAll(/\$\('(import-[\w-]+)'\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 8);
  for (const id of used) assert.ok(ids.has(id), `missing #${id}`);
  for (const id of ['import-btn', 'import-panel', 'import-name', 'import-weight', 'import-text', 'import-copy', 'import-check', 'import-add', 'import-cancel', 'import-msg', 'import-result']) {
    assert.ok(ids.has(id), id);
  }
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.indexOf('js/import.js') !== -1 && srcs.indexOf('js/import.js') < srcs.indexOf('js/app.js'));
  assert.ok(srcs.indexOf('js/import.js') > srcs.indexOf('js/routine.js'));
  assert.ok(sw.includes("'js/import.js'"));
  assert.match(app, /closest\('#import-panel'\)/);
});

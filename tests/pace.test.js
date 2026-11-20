'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Routine = require('../js/routine.js');
const Pace = require('../js/pace.js');

const root = path.join(__dirname, '..');
const load = (f) => JSON.parse(fs.readFileSync(path.join(root, 'routines', f), 'utf8'));
const kb = load('kb-60-core-full-body.json');
const demo = load('demo.json');

function one(step, defaults) {
  return { name: 'T', defaults, blocks: [{ name: 'B', steps: [step] }] };
}
const swing = { name: 'Swing', type: 'exercise', reps: 15, cues: ['a', 'b', 'c'] };
const tgu = { name: 'Turkish get-up', type: 'exercise', reps: 3, perSide: true, secPerRep: 20, cues: ['a', 'b', 'c'] };

test('no pace: existing durations unchanged', () => {
  assert.strictEqual(Routine.totalDuration(kb), 3531);
  assert.strictEqual(Routine.totalDuration(kb, undefined), 3531);
  assert.strictEqual(Routine.totalDuration(kb, Pace.normalize(null)), 3531);
});

test('global pace changes steps without own secPerRep, not the TGU', () => {
  const pace = { secPerRep: 4, exercises: {} };
  assert.strictEqual(Routine.stepDuration(swing, {}, pace), 60);
  assert.strictEqual(Routine.stepDuration(tgu, {}, pace), 120);
});

test('exercise override applies to the TGU', () => {
  const pace = { secPerRep: null, exercises: { 'Turkish get-up': 30 } };
  assert.strictEqual(Routine.stepDuration(tgu, {}, pace), 180);
  assert.strictEqual(Routine.expand(one(tgu), pace)[0].durationSec, 180);
});

test('precedence: exercise > step > pace > routine default > 3', () => {
  const s = { name: 'X', type: 'exercise', reps: 10, cues: ['a', 'b', 'c'] };
  const withStep = Object.assign({}, s, { secPerRep: 5 });
  assert.strictEqual(Routine.stepDuration(s, {}, undefined), 30);
  assert.strictEqual(Routine.stepDuration(s, { secPerRep: 2 }, { secPerRep: null, exercises: {} }), 20);
  assert.strictEqual(Routine.stepDuration(s, { secPerRep: 2 }, { secPerRep: 4, exercises: {} }), 40);
  assert.strictEqual(Routine.stepDuration(withStep, { secPerRep: 2 }, { secPerRep: 4, exercises: {} }), 50);
  assert.strictEqual(Routine.stepDuration(withStep, {}, { secPerRep: 4, exercises: { X: 1 } }), 10);
  assert.strictEqual(Routine.totalDuration(one(s), { secPerRep: 4, exercises: {} }), 40);
});

test('normalize drops invalid values', () => {
  assert.deepStrictEqual(Pace.normalize(null), { secPerRep: null, exercises: {} });
  assert.deepStrictEqual(Pace.normalize('x'), { secPerRep: null, exercises: {} });
  assert.strictEqual(Pace.normalize({ secPerRep: '3' }).secPerRep, null);
  assert.strictEqual(Pace.normalize({ secPerRep: 0 }).secPerRep, null);
  assert.strictEqual(Pace.normalize({ secPerRep: -2 }).secPerRep, null);
  assert.strictEqual(Pace.normalize({ secPerRep: 0.5 }).secPerRep, null);
  assert.strictEqual(Pace.normalize({ secPerRep: 6.5 }).secPerRep, null);
  assert.strictEqual(Pace.normalize({ secPerRep: NaN }).secPerRep, null);
  assert.strictEqual(Pace.normalize({ secPerRep: 4.5 }).secPerRep, 4.5);
  const n = Pace.normalize({ exercises: { a: 20, b: 'x', c: 0, d: 61, e: 0.5, f: 60, g: 1 }, secPerRep: 2 });
  assert.deepStrictEqual(n.exercises, { a: 20, f: 60, g: 1 });
  assert.deepStrictEqual(Pace.normalize({ exercises: [5] }).exercises, {});
});

test('stepValue global: from routine, step 0.5, limits 1-6', () => {
  assert.strictEqual(Pace.stepValue(null, 1, 'global'), 3.5);
  assert.strictEqual(Pace.stepValue(null, -1, 'global'), 2.5);
  assert.strictEqual(Pace.stepValue(3, 1, 'global'), 3.5);
  assert.strictEqual(Pace.stepValue(3, -1, 'global'), 2.5);
  assert.strictEqual(Pace.stepValue(6, 1, 'global'), 6);
  assert.strictEqual(Pace.stepValue(1, -1, 'global'), 1);
});

test('stepValue exercise: 0.5 below 10, 5 from 10 up, limits 1-60', () => {
  assert.strictEqual(Pace.stepValue(1, 1, 'exercise'), 1.5);
  assert.strictEqual(Pace.stepValue(9.5, 1, 'exercise'), 10);
  assert.strictEqual(Pace.stepValue(10, 1, 'exercise'), 15);
  assert.strictEqual(Pace.stepValue(20, 1, 'exercise'), 25);
  assert.strictEqual(Pace.stepValue(20, -1, 'exercise'), 15);
  assert.strictEqual(Pace.stepValue(15, -1, 'exercise'), 10);
  assert.strictEqual(Pace.stepValue(10, -1, 'exercise'), 9.5);
  assert.strictEqual(Pace.stepValue(1, -1, 'exercise'), 1);
  assert.strictEqual(Pace.stepValue(60, 1, 'exercise'), 60);
});

test('overridable: KB 60 + demo gives Halo (1) and Turkish get-up (20)', () => {
  assert.deepStrictEqual(Pace.overridable([kb, demo]), [
    { name: 'Halo', value: 1 },
    { name: 'Turkish get-up', value: 20 },
  ]);
  assert.deepStrictEqual(Pace.overridable([]), []);
});

test('pace UI wiring: ids exist, pace.js loaded and in APP_SHELL', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const used = [...app.matchAll(/\$\('(pace-[\w-]+)'\)/g)].map((m) => m[1])
    .concat([...app.matchAll(/\['(pace-[\w-]+)'/g)].map((m) => m[1]));
  assert.ok(used.length >= 4);
  for (const id of used) assert.ok(ids.has(id), `missing #${id}`);
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.indexOf('js/pace.js') !== -1 && srcs.indexOf('js/pace.js') < srcs.indexOf('js/app.js'));
  assert.match(sw, /'js\/pace\.js'/);
  assert.match(app, /kb-timer-pace/);
});

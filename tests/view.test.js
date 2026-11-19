'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { toView, formatCountdown } = require('../js/view.js');
const Engine = require('../js/engine.js');

const cues = (p) => [p + '1', p + '2', p + '3'];
const steps = [
  { name: 'Swing', type: 'exercise', durationSec: 45, reps: 15, perSide: false, cues: cues('s'), block: 'Block A', round: 2, rounds: 3 },
  { name: 'Pause', type: 'pause', durationSec: 20, perSide: false, cues: [], block: 'Block A', round: 2, rounds: 3 },
  { name: 'Halo', type: 'exercise', durationSec: 60, reps: 10, perSide: true, cues: cues('h'), clip: 'clips/halo.mp4', block: 'Block A', round: 2, rounds: 3 },
  { name: 'March', type: 'exercise', durationSec: 30, perSide: true, cues: cues('m'), block: 'Block A', round: 2, rounds: 3 }
];
const at = (i, extra) => Object.assign({
  phase: 'step', paused: false, index: i, total: steps.length, step: steps[i], next: steps[i + 1] || null, remainingSec: 12
}, extra);

test('exercise shows own cues, reps target, badge/theme', () => {
  const v = toView(at(0));
  assert.strictEqual(v.title, 'Swing');
  assert.strictEqual(v.badge, 'EXERCISE');
  assert.strictEqual(v.theme, 'exercise');
  assert.deepStrictEqual(v.cues, cues('s'));
  assert.strictEqual(v.cuesFor, 'current');
  assert.strictEqual(v.target, '×15');
  assert.strictEqual(v.nextUp, 'Pause');
  assert.strictEqual(v.index, '1 / 4');
});
test('pause shows NEXT exercise name, target, cues, clip', () => {
  const v = toView(at(1));
  assert.strictEqual(v.badge, 'REST');
  assert.strictEqual(v.theme, 'rest');
  assert.strictEqual(v.cuesFor, 'next');
  assert.strictEqual(v.focusName, 'Halo');
  assert.strictEqual(v.target, '×10 / side');
  assert.deepStrictEqual(v.cues, cues('h'));
  assert.strictEqual(v.clip, 'clips/halo.mp4');
  assert.strictEqual(v.nextUp, 'Halo');
});
test('seconds steps have no target; exercise without clip has empty clip', () => {
  const v = toView(at(3));
  assert.strictEqual(v.target, '');
  assert.strictEqual(v.clip, '');
});
test('countdown format', () => {
  assert.strictEqual(formatCountdown(59), '59');
  assert.strictEqual(formatCountdown(60), '1:00');
  assert.strictEqual(formatCountdown(125), '2:05');
  assert.strictEqual(formatCountdown(0), '0');
  assert.strictEqual(toView(at(0, { remainingSec: 90 })).countdown, '1:30');
});
test('blockLabel and last-step nextUp = Finish', () => {
  assert.strictEqual(toView(at(0)).blockLabel, 'Block A · round 2/3');
  assert.strictEqual(toView(at(3)).nextUp, 'Finish');
});
test('paused flag', () => {
  assert.strictEqual(toView(at(0, { paused: true })).paused, true);
  assert.strictEqual(toView(at(0)).paused, false);
});
test('single-round block omits round; pause as last step has no cues', () => {
  const s = Object.assign({}, steps[1], { rounds: 1, round: 1 });
  const v = toView({ phase: 'step', paused: false, index: 0, total: 1, step: s, next: null, remainingSec: 5 });
  assert.strictEqual(v.blockLabel, 'Block A');
  assert.deepStrictEqual(v.cues, []);
  assert.strictEqual(v.nextUp, 'Finish');
});
test('ready, idle, finished phases', () => {
  const e = Engine.create(steps);
  assert.strictEqual(toView(e.getState()).theme, 'idle');
  e.start(0);
  const r = toView(e.getState());
  assert.strictEqual(r.badge, 'GET READY');
  assert.strictEqual(r.countdown, '5');
  assert.strictEqual(r.focusName, 'Swing');
  assert.deepStrictEqual(r.cues, cues('s'));
  e.tick(1e7);
  const f = toView(e.getState());
  assert.strictEqual(f.title, 'Done');
  assert.strictEqual(f.theme, 'done');
  assert.strictEqual(toView(null).theme, 'idle');
});
test('live engine state feeds the view', () => {
  const e = Engine.create(steps, { readySec: 0 });
  e.start(0);
  e.tick(46000);
  assert.strictEqual(toView(e.getState()).title, 'Pause');
});

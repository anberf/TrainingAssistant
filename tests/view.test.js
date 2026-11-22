'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { toView, formatCountdown, formatTotal } = require('../js/view.js');
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
  assert.strictEqual(v.target, '');
  assert.strictEqual(v.nextTarget, '×10 / side');
  assert.deepStrictEqual(v.cues, cues('h'));
  assert.deepStrictEqual(v.media, { src: 'clips/halo.mp4', kind: 'video' });
  assert.strictEqual(v.nextUp, 'Halo');
});
test('get-ready: no countdown-side target; next target exposed separately', () => {
  const v = toView({ phase: 'ready', paused: false, total: 4, step: null, next: steps[2], remainingSec: 5 });
  assert.strictEqual(v.target, '');
  assert.strictEqual(v.nextTarget, '×10 / side');
  assert.strictEqual(v.focusName, 'Halo');
});
test('exercise step has no nextTarget', () => {
  assert.strictEqual(toView(at(0)).nextTarget, '');
});
test('seconds steps have no target; exercise step has no media', () => {
  const v = toView(at(3));
  assert.strictEqual(v.target, '');
  assert.strictEqual(v.media, null);
});
test('T19 media: rest -> next exercise picture with kind; get-ready -> step 1; exercise -> null', () => {
  const own = { name: 'A', type: 'exercise', durationSec: 30, cues: cues('a'), clip: 'clips/a.svg' };
  const nxt = { name: 'B', type: 'exercise', durationSec: 30, cues: cues('b'), clip: 'clips/b.svg' };
  const vid = { name: 'V', type: 'exercise', durationSec: 30, cues: cues('v'), clip: 'clips/v.WEBM' };
  const none = { name: 'C', type: 'exercise', durationSec: 30, cues: cues('c') };
  const rest = { name: 'Rest', type: 'pause', durationSec: 10, cues: [] };
  const st = (step, next) => ({ phase: 'step', paused: false, index: 0, total: 3, step, next, remainingSec: 5 });
  assert.deepStrictEqual(toView(st(rest, nxt)).media, { src: 'clips/b.svg', kind: 'image' });
  assert.deepStrictEqual(toView(st(rest, vid)).media, { src: 'clips/v.WEBM', kind: 'video' });
  assert.strictEqual(toView(st(rest, null)).media, null);
  assert.strictEqual(toView(st(own, nxt)).media, null);
  assert.strictEqual(toView(st(own, none)).media, null);
  const ready = toView({ phase: 'ready', paused: false, total: 3, step: null, next: own, remainingSec: 5 });
  assert.deepStrictEqual(ready.media, { src: 'clips/a.svg', kind: 'image' });
});
test('T25 implicit media: no clip -> webp with mp4 fallback; explicit -> no fallback', () => {
  const none = { name: 'Leg & hip stretch', type: 'exercise', durationSec: 30, cues: cues('c') };
  const own = { name: 'A', type: 'exercise', durationSec: 30, cues: cues('a'), clip: 'clips/a.svg' };
  const rest = { name: 'Rest', type: 'pause', durationSec: 10, cues: [] };
  const st = (step, next) => ({ phase: 'step', paused: false, index: 0, total: 3, step, next, remainingSec: 5 });
  const implicit = {
    src: 'clips/leg-hip-stretch.webp', kind: 'image',
    fallback: { src: 'clips/leg-hip-stretch.mp4', kind: 'video' }
  };
  assert.deepStrictEqual(toView(st(rest, none)).media, implicit);
  assert.deepStrictEqual(toView({ phase: 'ready', paused: false, total: 3, step: null, next: none, remainingSec: 5 }).media, implicit);
  assert.strictEqual('fallback' in toView(st(rest, own)).media, false);
  assert.strictEqual(toView(st(none, own)).media, null); // exercise step: no media
  assert.strictEqual(toView(st(rest, rest)).media, null); // pause never gets an implicit clip
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

test('formatTotal: m:ss, h:mm:ss from 1 h', () => {
  assert.strictEqual(formatTotal(0), '0:00');
  assert.strictEqual(formatTotal(58), '0:58');
  assert.strictEqual(formatTotal(60), '1:00');
  assert.strictEqual(formatTotal(3531), '58:51');
  assert.strictEqual(formatTotal(3723), '1:02:03');
});

test('end screen uses View.formatTotal', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../js/app.js'), 'utf8');
  assert.ok(/done-elapsed[^\n]*View\.formatTotal\(/.test(src));
});

test('cardLabel: weight + duration, or duration only without weight', () => {
  const { cardLabel } = require('../js/view.js');
  assert.strictEqual(cardLabel('10 kg', 3531), '10 kg · 59 min');
  for (const w of [undefined, null, '', '  ', 'none']) assert.strictEqual(cardLabel(w, 600), '10 min');
  assert.strictEqual(cardLabel(undefined, 20), '20 s');
});

test('picker card uses View.cardLabel; routine-drafts removed', () => {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  assert.ok(/View\.cardLabel\(/.test(src));
  assert.ok(!fs.existsSync(path.join(__dirname, '../docs/routine-drafts')));
});

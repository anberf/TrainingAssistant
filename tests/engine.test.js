const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../js/engine.js');

function mk(durs) {
  return durs.map((d, i) => ({ name: 'S' + i, type: 'exercise', durationSec: d, cues: [], perSide: false }));
}
const types = (ev) => ev.map((e) => e.type + (e.second ? e.second : ''));

test('auto-advances through all steps with zero input', () => {
  const e = Engine.create(mk([4, 4]));
  const all = [];
  all.push(...e.start(0));
  for (let t = 100; t <= 20000; t += 100) all.push(...e.tick(t));
  const steps = all.filter((x) => x.type === 'step').map((x) => x.index);
  assert.deepStrictEqual(steps, [0, 1]);
  const fin = all.filter((x) => x.type === 'finished');
  assert.strictEqual(fin.length, 1);
  assert.strictEqual(fin[0].totalElapsedMs, 13000); // 5 ready + 4 + 4
  assert.strictEqual(e.getState().phase, 'finished');
});

test('idle -> ready (5 s) with next-up step 0', () => {
  const e = Engine.create(mk([10]));
  assert.strictEqual(e.getState().phase, 'idle');
  e.start(1000);
  let s = e.getState();
  assert.strictEqual(s.phase, 'ready');
  assert.strictEqual(s.remainingSec, 5);
  assert.strictEqual(s.next.name, 'S0');
  e.tick(5999);
  assert.strictEqual(e.getState().phase, 'ready');
  e.tick(6000);
  s = e.getState();
  assert.strictEqual(s.phase, 'step');
  assert.strictEqual(s.index, 0);
});

test('one big tick jump crosses steps correctly', () => {
  const e = Engine.create(mk([10, 10, 10]));
  e.start(0);
  const ev = e.tick(5000 + 10000 + 10000 + 3000);
  const s = e.getState();
  assert.strictEqual(s.index, 2);
  assert.strictEqual(s.elapsedInStepMs, 3000);
  assert.strictEqual(s.remainingSec, 7);
  assert.deepStrictEqual(ev.filter((x) => x.type === 'step').map((x) => x.index), [0, 1, 2]);
  assert.strictEqual(ev.filter((x) => x.type === 'final-beep').length, 3);
});

test('big jump past the end finishes once; elapsed excludes overshoot', () => {
  const e = Engine.create(mk([2]));
  e.start(0);
  const ev = e.tick(1000000);
  assert.strictEqual(ev.filter((x) => x.type === 'finished').length, 1);
  assert.strictEqual(e.getState().totalElapsedMs, 7000);
  assert.deepStrictEqual(e.tick(2000000), []);
});

test('pause/resume preserves remaining', () => {
  const e = Engine.create(mk([20]));
  e.start(0);
  e.tick(5000 + 8000);
  e.togglePause(13000);
  assert.strictEqual(e.getState().paused, true);
  e.tick(500000);
  const s = e.getState();
  assert.strictEqual(s.remainingSec, 12);
  assert.strictEqual(s.phase, 'step');
  e.togglePause(500000);
  assert.strictEqual(e.getState().paused, false);
  e.tick(502000);
  assert.strictEqual(e.getState().remainingMs, 10000);
  assert.strictEqual(e.getState().totalElapsedMs, 15000);
});

test('skip advances; skip from ready enters step 0; skip last finishes', () => {
  const e = Engine.create(mk([10, 10]));
  e.start(0);
  let ev = e.skip(100);
  assert.deepStrictEqual(types(ev), ['step']);
  assert.strictEqual(e.getState().index, 0);
  e.skip(200);
  assert.strictEqual(e.getState().index, 1);
  ev = e.skip(300);
  assert.deepStrictEqual(types(ev), ['finished']);
  assert.strictEqual(e.getState().phase, 'finished');
  assert.deepStrictEqual(e.skip(400), []);
  assert.deepStrictEqual(e.back(500), []);
});

test('back: >3 s restarts, <=3 s goes to previous, step 0 restarts', () => {
  const e = Engine.create(mk([20, 20]));
  e.start(0);
  e.tick(5000);
  e.skip(5000); // -> step 1
  e.tick(9000); // 4 s into step 1
  e.back(9000);
  assert.strictEqual(e.getState().index, 1);
  assert.strictEqual(e.getState().elapsedInStepMs, 0);
  e.tick(11000); // 2 s in
  e.back(11000);
  assert.strictEqual(e.getState().index, 0);
  assert.strictEqual(e.getState().elapsedInStepMs, 0);
  e.tick(12000); // 1 s in step 0
  e.back(12000);
  assert.strictEqual(e.getState().index, 0);
  assert.strictEqual(e.getState().elapsedInStepMs, 0);
  e.tick(15000);
  e.skip(15000);
  e.tick(18000); // exactly 3 s into step 1 -> previous
  e.back(18000);
  assert.strictEqual(e.getState().index, 0);
});

test('skip/back while paused stay paused', () => {
  const e = Engine.create(mk([20, 20, 20]));
  e.start(0);
  e.skip(0);
  e.togglePause(1000);
  e.skip(2000);
  let s = e.getState();
  assert.strictEqual(s.index, 1);
  assert.strictEqual(s.paused, true);
  assert.strictEqual(s.elapsedInStepMs, 0);
  e.back(3000);
  s = e.getState();
  assert.strictEqual(s.index, 0);
  assert.strictEqual(s.paused, true);
  e.tick(100000);
  assert.strictEqual(e.getState().elapsedInStepMs, 0);
});

test('beeps fire exactly once at 3,2,1 and final at 0', () => {
  const e = Engine.create(mk([10]), { readySec: 0 });
  const all = [...e.start(0)];
  for (let t = 50; t <= 11000; t += 50) all.push(...e.tick(t));
  const beeps = all.filter((x) => x.type === 'beep').map((x) => x.second);
  assert.deepStrictEqual(beeps, [3, 2, 1]);
  assert.strictEqual(all.filter((x) => x.type === 'final-beep').length, 2); // ready(0 s) + step
  const order = types(all);
  assert.ok(order.indexOf('beep3') < order.indexOf('beep2'));
  assert.ok(order.indexOf('beep1') < order.lastIndexOf('final-beep'));
  assert.ok(order.lastIndexOf('final-beep') < order.indexOf('finished'));
});

test('beep timing: 3 s remaining fires at remaining<=3000', () => {
  const e = Engine.create(mk([10]));
  e.start(0);
  e.tick(5000);
  assert.deepStrictEqual(e.tick(11999), []);
  assert.deepStrictEqual(types(e.tick(12000)), ['beep3']);
  assert.deepStrictEqual(e.tick(12500), []);
  assert.deepStrictEqual(types(e.tick(13000)), ['beep2']);
});

test('big jump emits each skipped beep once, in order', () => {
  const e = Engine.create(mk([10]), { readySec: 0 });
  e.start(0);
  const ev = e.tick(10000);
  assert.deepStrictEqual(types(ev), ['beep3', 'beep2', 'beep1', 'final-beep', 'finished']);
});

test('no beeps while paused; beeps resume after', () => {
  const e = Engine.create(mk([10]), { readySec: 0 });
  e.start(0);
  e.tick(6500);
  e.togglePause(6500);
  assert.deepStrictEqual(e.tick(9000), []);
  assert.deepStrictEqual(e.tick(50000), []);
  e.togglePause(50000);
  assert.deepStrictEqual(types(e.tick(50500)), ['beep3']);
});

test('short steps only beep for thresholds within duration; restart re-arms beeps', () => {
  const e = Engine.create(mk([2, 20]), { readySec: 0 });
  e.start(0);
  const ev = e.tick(2000);
  assert.deepStrictEqual(ev.filter((x) => x.type === 'beep').map((x) => x.second), [2, 1]);
  e.tick(2000 + 17500); // 2.5 s left in step 1, 3 beeped
  assert.strictEqual(e.getState().remainingMs, 2500);
  e.back(19500); // > 3 s elapsed -> restart
  const ev2 = e.tick(19500 + 17000);
  assert.deepStrictEqual(ev2.filter((x) => x.type === 'beep').map((x) => x.second), [3]);
});

test('ready phase beeps and hands off to step 0', () => {
  const e = Engine.create(mk([10]));
  const ev = e.start(0).concat(e.tick(5000));
  assert.deepStrictEqual(types(ev), ['ready', 'beep3', 'beep2', 'beep1', 'final-beep', 'step']);
});

test('finished reports total elapsed excluding paused time', () => {
  const e = Engine.create(mk([5]));
  e.start(0);
  e.tick(2000);
  e.togglePause(2000);
  e.togglePause(102000);
  const ev = e.tick(102000 + 8000);
  const fin = ev.find((x) => x.type === 'finished');
  assert.strictEqual(fin.totalElapsedMs, 10000);
});

test('empty routine finishes right after ready; onEvent callback receives events', () => {
  const seen = [];
  const e = Engine.create([], { onEvent: (x) => seen.push(x.type) });
  e.start(0);
  e.tick(5000);
  assert.strictEqual(e.getState().phase, 'finished');
  assert.ok(seen.includes('finished'));
});

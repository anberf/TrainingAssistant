'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createBeeper } = require('../js/audio.js');

function mockCtor(state) {
  const log = { oscs: [], created: 0, resumed: 0 };
  class Ctx {
    constructor() { log.created++; this.state = state || 'running'; this.currentTime = 10; this.destination = {}; }
    resume() { log.resumed++; return Promise.resolve(); }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
    }
    createOscillator() {
      const o = { frequency: {}, connect() {}, start(t) { o.startT = t; }, stop(t) { o.stopT = t; } };
      log.oscs.push(o);
      return o;
    }
  }
  return { Ctx, log };
}

test('beep: ~880 Hz for 120 ms', () => {
  const { Ctx, log } = mockCtor();
  const b = createBeeper(Ctx);
  assert.strictEqual(b.beep(), true);
  const o = log.oscs[0];
  assert.strictEqual(o.frequency.value, 880);
  assert.ok(Math.abs(o.stopT - o.startT - 0.12) < 1e-9);
});

test('finalBeep: ~1320 Hz for 400 ms', () => {
  const { Ctx, log } = mockCtor();
  const b = createBeeper(Ctx);
  b.finalBeep();
  const o = log.oscs[0];
  assert.strictEqual(o.frequency.value, 1320);
  assert.ok(Math.abs(o.stopT - o.startT - 0.4) < 1e-9);
});

test('unlock resumes a suspended context; not resumed if running', () => {
  let m = mockCtor('suspended');
  assert.strictEqual(createBeeper(m.Ctx).unlock(), true);
  assert.strictEqual(m.log.resumed, 1);
  m = mockCtor('running');
  createBeeper(m.Ctx).unlock();
  assert.strictEqual(m.log.resumed, 0);
});

test('context is created once and reused', () => {
  const { Ctx, log } = mockCtor();
  const b = createBeeper(Ctx);
  b.unlock(); b.beep(); b.finalBeep();
  assert.strictEqual(log.created, 1);
});

test('missing AudioContext: nothing throws', () => {
  for (const c of [undefined, null, 5]) {
    const b = createBeeper(c);
    assert.strictEqual(b.unlock(), false);
    assert.strictEqual(b.beep(), false);
    assert.strictEqual(b.finalBeep(), false);
    b.onEvent({ type: 'beep', second: 3 });
  }
});

test('throwing constructor / oscillator does not throw', () => {
  const b = createBeeper(class { constructor() { throw new Error('x'); } });
  assert.doesNotThrow(() => { b.unlock(); b.beep(); b.finalBeep(); });
  const b2 = createBeeper(class { createOscillator() { throw new Error('y'); } });
  assert.strictEqual(b2.beep(), false);
});

test('onEvent maps engine events to tones', () => {
  const { Ctx, log } = mockCtor();
  const b = createBeeper(Ctx);
  b.onEvent({ type: 'beep', second: 3 });
  b.onEvent({ type: 'final-beep' });
  b.onEvent({ type: 'step', index: 1 });
  b.onEvent({ type: 'ready' });
  assert.deepStrictEqual(log.oscs.map((o) => o.frequency.value), [880, 1320]);
});

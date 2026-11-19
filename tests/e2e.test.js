const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../js/routine.js');
const Engine = require('../js/engine.js');
const View = require('../js/view.js');

const root = path.join(__dirname, '..');
const kb = JSON.parse(fs.readFileSync(path.join(root, 'routines', 'kb-60-core-full-body.json'), 'utf8'));

test('E2E: KB 60 runs start to finish with zero input', () => {
  const steps = R.expand(kb);
  const events = [];
  const eng = Engine.create(steps, { onEvent: (e) => events.push(e) });
  let now = 1000;
  eng.start(now);
  assert.strictEqual(R.totalDuration(kb), 3531);
  const totalMs = (3531 + 5) * 1000;
  const end = now + totalMs;
  // 100 ms frames; no input other than start.
  while (eng.getState().phase !== 'finished') {
    now += 100;
    eng.tick(now);
    assert.ok(now <= end + 100, 'did not finish in time');
    View.toView(eng.getState()); // view-model must always build
  }
  assert.strictEqual(now, end, 'finish time');

  const stepEvents = events.filter((e) => e.type === 'step').map((e) => e.index);
  assert.deepStrictEqual(stepEvents, steps.map((_, i) => i));
  assert.strictEqual(events[0].type, 'ready');
  assert.strictEqual(events.filter((e) => e.type === 'finished').length, 1);
  assert.strictEqual(events[events.length - 1].type, 'finished');
  assert.strictEqual(events[events.length - 1].totalElapsedMs, totalMs);
  // 3 beeps + 1 final per segment (get-ready + every step)
  const segs = steps.length + 1;
  assert.strictEqual(events.filter((e) => e.type === 'final-beep').length, segs);
  assert.strictEqual(steps.filter((s) => s.durationSec < 3).length, 0);
  assert.strictEqual(events.filter((e) => e.type === 'beep').length, segs * 3);
});

test('E2E: one huge tick jump crosses every step in order', () => {
  const steps = R.expand(kb);
  const eng = Engine.create(steps);
  eng.start(0);
  const ev = eng.tick((3531 + 5) * 1000 + 5000);
  const idx = ev.filter((e) => e.type === 'step').map((e) => e.index);
  assert.deepStrictEqual(idx, steps.map((_, i) => i));
  assert.strictEqual(ev[ev.length - 1].type, 'finished');
});

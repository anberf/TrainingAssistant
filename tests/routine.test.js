const test = require('node:test');
const assert = require('node:assert');
const R = require('../js/routine.js');

const cues = ['a', 'b', 'c'];
function good() {
  return {
    id: 'x', name: 'X', defaults: { secPerRep: 3 },
    blocks: [{
      name: 'Block A', rounds: 3, restBetweenRounds: 120,
      steps: [
        { name: 'Swing', type: 'exercise', reps: 15, cues: cues.slice() },
        { name: 'Pause', type: 'pause', seconds: 20 },
        { name: 'TGU', type: 'exercise', reps: 3, perSide: true, secPerRep: 20, cues: cues.slice() },
        { name: 'March', type: 'exercise', seconds: 30, perSide: true, cues: cues.slice() }
      ]
    }]
  };
}
function errs(mut) {
  const r = good(); mut(r);
  const v = R.validateRoutine(r);
  assert.strictEqual(v.ok, false);
  return v.errors;
}
function has(list, text) {
  assert.ok(list.some((e) => e.includes(text)), 'expected "' + text + '" in ' + JSON.stringify(list));
}

test('valid routine', () => {
  assert.deepStrictEqual(R.validateRoutine(good()), { ok: true, errors: [], warnings: [] });
});
test('non-object', () => assert.strictEqual(R.validateRoutine(null).ok, false));
test('missing name', () => has(errs((r) => { delete r.name; }), 'name:'));
test('bad type', () => has(errs((r) => { r.blocks[0].steps[0].type = 'foo'; }), 'blocks[0].steps[0].type'));
test('both reps and seconds', () => has(errs((r) => { r.blocks[0].steps[0].seconds = 5; }), 'blocks[0].steps[0]: expected exactly one'));
test('neither reps nor seconds', () => has(errs((r) => { delete r.blocks[0].steps[0].reps; }), 'neither'));
test('pause with reps', () => has(errs((r) => {
  const s = r.blocks[0].steps[1]; delete s.seconds; s.reps = 5;
}), 'blocks[0].steps[1].reps'));
test('exercise cues != 3', () => {
  has(errs((r) => { r.blocks[0].steps[2].cues = ['a', 'b']; }), 'blocks[0].steps[2].cues: expected 3');
  has(errs((r) => { delete r.blocks[0].steps[2].cues; }), 'blocks[0].steps[2].cues: expected 3');
});
test('cue > 30 chars', () => has(errs((r) => { r.blocks[0].steps[0].cues[1] = 'x'.repeat(31); }), 'steps[0].cues[1]'));
test('empty cue', () => has(errs((r) => { r.blocks[0].steps[0].cues[0] = ' '; }), 'steps[0].cues[0]'));
test('pause without cues ok; pause with cues ok', () => {
  assert.ok(R.validateRoutine(good()).ok);
  const r = good(); r.blocks[0].steps[1].cues = ['one'];
  assert.ok(R.validateRoutine(r).ok);
});
test('bad secPerRep', () => {
  has(errs((r) => { r.blocks[0].steps[0].secPerRep = 0; }), 'steps[0].secPerRep');
  has(errs((r) => { r.defaults.secPerRep = -1; }), 'defaults.secPerRep');
});
test('bad rounds / restBetweenRounds', () => {
  has(errs((r) => { r.blocks[0].rounds = 0; }), 'blocks[0].rounds');
  has(errs((r) => { r.blocks[0].rounds = 1.5; }), 'blocks[0].rounds');
  has(errs((r) => { r.blocks[0].restBetweenRounds = -1; }), 'blocks[0].restBetweenRounds');
});
test('empty block / no blocks', () => {
  has(errs((r) => { r.blocks[0].steps = []; }), 'blocks[0].steps');
  has(errs((r) => { r.blocks = []; }), 'blocks:');
});
test('bad clip paths', () => {
  for (const c of ['http://x/a.mp4', 'https://x/a.mp4', '//cdn/a.mp4', '../a.mp4', 'clips/../../a.mp4', '/abs.mp4']) {
    has(errs((r) => { r.blocks[0].steps[0].clip = c; }), 'steps[0].clip');
  }
  const r = good(); r.blocks[0].steps[0].clip = 'clips/swing.mp4';
  assert.ok(R.validateRoutine(r).ok);
});
test('unknown field is warning only', () => {
  const r = good(); r.foo = 1; r.blocks[0].bar = 2; r.blocks[0].steps[0].baz = 3;
  const v = R.validateRoutine(r);
  assert.ok(v.ok);
  assert.strictEqual(v.warnings.length, 3);
  has(v.warnings, 'blocks[0].steps[0].baz');
});

test('durations', () => {
  const d = { secPerRep: 3 };
  assert.strictEqual(R.stepDuration({ reps: 10 }, d), 30);
  assert.strictEqual(R.stepDuration({ reps: 10 }, undefined), 30);
  assert.strictEqual(R.stepDuration({ reps: 10 }, { secPerRep: 2 }), 20);
  assert.strictEqual(R.stepDuration({ reps: 3, secPerRep: 20, perSide: true }, d), 120);
  assert.strictEqual(R.stepDuration({ reps: 5, perSide: true }, d), 30);
  assert.strictEqual(R.stepDuration({ seconds: 30 }, d), 30);
  assert.strictEqual(R.stepDuration({ seconds: 30, perSide: true }, d), 60);
});

test('expansion', () => {
  const flat = R.expand(good());
  assert.strictEqual(flat.length, 14); // 3 rounds x 4 steps + 2 rests
  assert.strictEqual(flat[0].name, 'Swing');
  assert.strictEqual(flat[0].durationSec, 45);
  assert.strictEqual(flat[0].reps, 15);
  assert.strictEqual(flat[2].durationSec, 120);
  assert.strictEqual(flat[3].durationSec, 60);
  assert.strictEqual(flat[3].perSide, true);
  assert.strictEqual(flat[4].name, 'Rest');
  assert.strictEqual(flat[4].type, 'pause');
  assert.strictEqual(flat[4].durationSec, 120);
  assert.strictEqual(flat[13].name, 'March'); // no Rest after last round
  assert.strictEqual(flat.filter((s) => s.name === 'Rest').length, 2);
  flat.forEach((s) => { assert.strictEqual(s.block, 'Block A'); assert.strictEqual(s.rounds, 3); });
  assert.strictEqual(flat[5].round, 2);
  assert.strictEqual(flat[13].round, 3);
  assert.deepStrictEqual(flat[0].cues, cues);
});
test('no rest when restBetweenRounds 0 or single round; defaults', () => {
  const r = good(); r.blocks[0].restBetweenRounds = 0;
  assert.strictEqual(R.expand(r).length, 12);
  const r2 = good(); r2.blocks[0].rounds = 1;
  assert.strictEqual(R.expand(r2).length, 4);
  const r3 = { name: 'n', blocks: [{ name: 'b', steps: [{ name: 'e', type: 'exercise', reps: 2, cues }] }] };
  assert.strictEqual(R.expand(r3)[0].durationSec, 6);
});
test('totalDuration', () => {
  assert.strictEqual(R.totalDuration(good()), 245 * 3 + 240); // 45+20+120+60 per round
});

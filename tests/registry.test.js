const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../js/routine.js');

const dir = path.join(__dirname, '..', 'routines');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const listed = index.routines;
const onDisk = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');

test('index.json has a routines array of unique .json names', () => {
  assert.ok(Array.isArray(listed), 'index.json must contain a "routines" array');
  listed.forEach((f) => assert.ok(typeof f === 'string' && /^[a-z0-9-]+\.json$/.test(f), 'bad entry in index.json: ' + f));
  assert.strictEqual(new Set(listed).size, listed.length, 'duplicate entries in index.json');
});

test('every listed routine file exists', () => {
  listed.forEach((f) => assert.ok(fs.existsSync(path.join(dir, f)), 'routines/index.json lists missing file: ' + f));
});

test('every routines/*.json file is listed in index.json', () => {
  onDisk.forEach((f) => assert.ok(listed.includes(f), 'routines/' + f + ' is not listed in routines/index.json - add it'));
});

test('every routine file is valid', () => {
  onDisk.forEach((f) => {
    const v = R.validateRoutine(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    assert.ok(v.ok, 'routines/' + f + ' invalid: ' + v.errors.join('; '));
  });
});

test('KB 60 routine: valid, listed, 3531 s, 78 steps, block order', () => {
  assert.ok(listed.includes('kb-60-core-full-body.json'), 'kb-60-core-full-body.json not listed');
  const kb = JSON.parse(fs.readFileSync(path.join(dir, 'kb-60-core-full-body.json'), 'utf8'));
  const v = R.validateRoutine(kb);
  assert.ok(v.ok, v.errors.join('; '));
  assert.strictEqual(R.totalDuration(kb), 3531);
  const flat = R.expand(kb);
  assert.strictEqual(flat.length, 78);
  assert.strictEqual(flat.reduce((a, s) => a + s.durationSec, 0), 3531);
  assert.deepStrictEqual(kb.blocks.map((b) => b.name), ['Warm-up', 'Block A', 'Transition', 'Block B', 'Cool-down']);
  const seen = [];
  flat.forEach((s) => { if (seen[seen.length - 1] !== s.block) seen.push(s.block); });
  assert.deepStrictEqual(seen, ['Warm-up', 'Block A', 'Transition', 'Block B', 'Cool-down']);
});

test('demo routine shape and durations', () => {
  const demo = JSON.parse(fs.readFileSync(path.join(dir, 'demo.json'), 'utf8'));
  assert.strictEqual(demo.blocks.length, 1);
  assert.strictEqual(demo.blocks[0].rounds, 2);
  assert.strictEqual(demo.blocks[0].steps.length, 3);
  assert.strictEqual(demo.blocks[0].steps.filter((s) => s.perSide).length, 1);
  assert.deepStrictEqual(R.expand(demo).map((s) => s.durationSec), [10, 10, 10, 5, 10, 10, 10]);
});

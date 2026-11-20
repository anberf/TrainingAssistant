'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const routineFiles = fs.readdirSync(path.join(root, 'routines')).filter((f) => f.endsWith('.json') && f !== 'index.json');
const routines = routineFiles.map((f) => ({ f, r: JSON.parse(fs.readFileSync(path.join(root, 'routines', f), 'utf8')) }));
const steps = (r) => r.blocks.flatMap((b) => b.steps);

test('every exercise step in KB 60 has a clip', () => {
  const kb = routines.find((x) => x.f === 'kb-60-core-full-body.json').r;
  for (const s of steps(kb).filter((s) => s.type === 'exercise')) {
    assert.ok(s.clip, 'missing clip: ' + s.name);
  }
});

test('every clip referenced by any routine exists', () => {
  for (const { f, r } of routines) {
    for (const s of steps(r)) {
      if (s.clip) assert.ok(fs.existsSync(path.join(root, s.clip)), f + ': missing file ' + s.clip);
    }
  }
});

test('clips/*: lowercase-kebab names, animated WebP or MP4 video, size <= 512 KB', () => {
  const files = fs.readdirSync(path.join(root, 'clips'));
  assert.ok(files.length >= 14);
  for (const f of files) {
    assert.match(f, /^[a-z0-9]+(-[a-z0-9]+)*\.(webp|mp4)$/, 'not a lowercase-kebab .webp/.mp4: ' + f);
    const buf = fs.readFileSync(path.join(root, 'clips', f));
    if (f.endsWith('.mp4')) {
      assert.strictEqual(buf.subarray(4, 8).toString('latin1'), 'ftyp', f + ' is not MP4');
    } else {
      assert.strictEqual(buf.subarray(0, 4).toString('latin1'), 'RIFF', f + ' is not RIFF');
      assert.strictEqual(buf.subarray(8, 12).toString('latin1'), 'WEBP', f + ' is not WebP');
      assert.ok(buf.includes(Buffer.from('ANIM')), f + ' is not animated');
    }
    assert.ok(buf.length <= 512 * 1024, f + ' > 512 KB');
  }
});

test('clip files are all used by some routine (no orphans)', () => {
  const used = new Set();
  for (const { r } of routines) for (const s of steps(r)) if (s.clip) used.add(s.clip);
  for (const f of fs.readdirSync(path.join(root, 'clips'))) {
    assert.ok(used.has('clips/' + f), 'unused clip ' + f);
  }
});

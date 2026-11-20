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

test('clips/*.svg: names, structure, no scripts/images/text/external refs, size', () => {
  const files = fs.readdirSync(path.join(root, 'clips')).filter((f) => f.endsWith('.svg'));
  assert.ok(files.length >= 14);
  for (const f of files) {
    assert.match(f, /^[a-z0-9]+(-[a-z0-9]+)*\.svg$/, 'not lowercase-kebab: ' + f);
    const buf = fs.readFileSync(path.join(root, 'clips', f));
    assert.ok(buf.length <= 8 * 1024, f + ' > 8 KB');
    const t = buf.toString('utf8');
    assert.ok(t.startsWith('<svg'), f + ' must start with <svg');
    assert.ok(t.includes('viewBox="0 0 200 200"'), f + ' viewBox');
    assert.ok(t.includes('<animate'), f + ' has no animation');
    // The standard SVG namespace declaration is the only allowed "http".
    const bare = t.replace('xmlns="http://www.w3.org/2000/svg"', '');
    for (const bad of ['<script', '<image', '<text', 'http', 'href=']) {
      assert.ok(!bare.includes(bad), f + ' contains ' + bad);
    }
    assert.ok(t.includes('repeatCount="indefinite"'), f + ' must loop');
    for (const m of t.matchAll(/stroke="#ffffff"[^>]*stroke-width="(\d+)"/g)) {
      assert.ok(Number(m[1]) >= 6, f + ' figure stroke < 6');
    }
    for (const m of t.matchAll(/ dur="([\d.]+)s"/g)) {
      assert.ok(Number(m[1]) >= 1.5 && Number(m[1]) <= 4, f + ' cycle ' + m[1]);
    }
  }
});

test('clip files are all used by some routine (no orphans)', () => {
  const used = new Set();
  for (const { r } of routines) for (const s of steps(r)) if (s.clip) used.add(s.clip);
  for (const f of fs.readdirSync(path.join(root, 'clips'))) {
    assert.ok(used.has('clips/' + f), 'unused clip ' + f);
  }
});

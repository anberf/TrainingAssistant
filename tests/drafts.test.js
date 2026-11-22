'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Drafts = require('../js/drafts.js');

const root = path.join(__dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'routines/demo.json'), 'utf8'));

test('rename keeps every field except name and does not mutate input', () => {
  const before = JSON.stringify(base);
  const d0 = Drafts.normalize(null);
  const d0Before = JSON.stringify(d0);
  const { drafts, error } = Drafts.rename(d0, 'demo.json', base, '  New name  ');
  assert.strictEqual(error, null);
  assert.strictEqual(JSON.stringify(base), before);
  assert.strictEqual(JSON.stringify(d0), d0Before);
  const r = drafts.routines['demo.json'];
  assert.strictEqual(r.name, 'New name');
  assert.deepStrictEqual({ ...r, name: base.name }, base);
});

test('rename rejects blank names', () => {
  for (const n of ['', '   ', null, undefined, 5]) {
    const res = Drafts.rename(null, 'demo.json', base, n);
    assert.ok(res.error);
    assert.ok(Drafts.isEmpty(res.drafts));
  }
});

test('remove + undo', () => {
  let d = Drafts.remove(null, 'a.json');
  d = Drafts.remove(d, 'a.json');
  assert.deepStrictEqual(d.removed, ['a.json']);
  assert.ok(!Drafts.isEmpty(d));
  d = Drafts.rename(d, 'a.json', base, 'X').drafts;
  d = Drafts.undo(d, 'a.json');
  assert.ok(Drafts.isEmpty(d));
});

test('apply marks unpublished/removed, appends draft-only files, does not mutate', () => {
  const entries = [
    { file: 'a.json', name: 'A', routine: { name: 'A' }, ok: true },
    { file: 'b.json', name: 'B', routine: { name: 'B' }, ok: true },
    { file: 'c.json', name: 'C', ok: true, routine: { name: 'C' } },
  ];
  const snap = JSON.stringify(entries);
  let d = Drafts.rename(null, 'a.json', entries[0].routine, 'A2').drafts;
  d = Drafts.remove(d, 'b.json');
  d = Drafts.rename(d, 'new.json', base, 'Brand new').drafts;
  const out = Drafts.apply(entries, d);
  assert.strictEqual(JSON.stringify(entries), snap);
  assert.strictEqual(out.length, 4);
  assert.strictEqual(out[0].name, 'A2');
  assert.strictEqual(out[0].routine.name, 'A2');
  assert.ok(out[0].unpublished && !out[0].removed);
  assert.ok(out[1].removed && out[1].unpublished);
  assert.ok(!out[2].unpublished && !out[2].removed);
  assert.strictEqual(out[3].file, 'new.json');
  assert.ok(out[3].unpublished && out[3].ok);
  assert.strictEqual(out[3].name, 'Brand new');
  assert.deepStrictEqual(Drafts.apply(entries, null).map((e) => e.file), ['a.json', 'b.json', 'c.json']);
});

test('normalize drops garbage', () => {
  for (const g of [null, undefined, 5, 'x', [], { routines: 3, removed: 'x' }]) {
    assert.deepStrictEqual(Drafts.normalize(g), { routines: {}, removed: [] });
  }
  const d = Drafts.normalize({ routines: { 'a.json': { name: 'A' }, 'b.json': 7, 'c.json': [] }, removed: ['x.json', 3, '', 'x.json'] });
  assert.deepStrictEqual(Object.keys(d.routines), ['a.json']);
  assert.deepStrictEqual(d.removed, ['x.json']);
});

test('UI wiring: drafts.js loaded before app.js and in APP_SHELL; app.js uses kb-timer-drafts', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.indexOf('js/drafts.js') !== -1 && srcs.indexOf('js/drafts.js') < srcs.indexOf('js/app.js'));
  assert.ok(sw.includes("'js/drafts.js'"));
  assert.match(app, /kb-timer-drafts/);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const id of new Set([...app.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]))) assert.ok(ids.has(id), id);
});

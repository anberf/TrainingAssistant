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

// ---- T27: publish files ----
const Routine = require('../js/routine.js');
const kebab = /^[a-z0-9]+(-[a-z0-9]+)*\.json$/;
const pubEntries = [
  { file: 'demo.json', name: base.name, routine: base, ok: true },
  { file: 'b.json', name: 'B', routine: base, ok: true },
  { file: 'c.json', name: 'C', routine: base, ok: true },
];
const byFile = (files) => Object.fromEntries(files.map((f) => [f.file, f.text]));
function checkFiles(files) {
  for (const f of files) {
    assert.match(f.file, kebab);
    assert.ok(f.text.endsWith('\n'));
    const o = JSON.parse(f.text);
    if (f.file === 'index.json') {
      assert.deepStrictEqual(Object.keys(o), ['routines']);
      for (const n of o.routines) assert.match(n, kebab);
    } else {
      assert.strictEqual(Routine.validateRoutine(o).errors.length, 0, f.file);
    }
  }
}

test('publishFiles: nothing for empty drafts', () => {
  assert.deepStrictEqual(Drafts.publishFiles(pubEntries, null), []);
});

test('publishFiles: rename-only writes the routine file, index unchanged (not included)', () => {
  const d = Drafts.rename(null, 'b.json', base, 'Renamed').drafts;
  const files = Drafts.publishFiles(pubEntries, d);
  assert.deepStrictEqual(files.map((f) => f.file), ['b.json']);
  assert.strictEqual(files[0].text, JSON.stringify({ ...base, name: 'Renamed' }, null, 2) + '\n');
  checkFiles(files);
});

test('publishFiles: remove-only writes index.json without the removed file, keeps order', () => {
  const files = Drafts.publishFiles(pubEntries, Drafts.remove(null, 'b.json'));
  assert.deepStrictEqual(files.map((f) => f.file), ['index.json']);
  assert.strictEqual(files[0].text, JSON.stringify({ routines: ['demo.json', 'c.json'] }, null, 2) + '\n');
  checkFiles(files);
});

test('publishFiles: new-only writes the file and appends it to index.json', () => {
  const d = Drafts.add(null, 'fresh.json', { ...base, id: 'fresh', name: 'Fresh' });
  const files = Drafts.publishFiles(pubEntries, d);
  assert.deepStrictEqual(files.map((f) => f.file), ['fresh.json', 'index.json']);
  assert.deepStrictEqual(JSON.parse(byFile(files)['index.json']).routines, ['demo.json', 'b.json', 'c.json', 'fresh.json']);
  checkFiles(files);
});

test('publishFiles: mixed drafts; removed+renamed file is not written; inputs not mutated', () => {
  let d = Drafts.rename(null, 'demo.json', base, 'Demo 2').drafts;
  d = Drafts.remove(d, 'b.json');
  d = Drafts.rename(d, 'b.json', base, 'Gone').drafts;
  d = Drafts.add(d, 'new-one.json', { ...base, id: 'new-one', name: 'New one' });
  d = Drafts.add(d, 'new-two.json', { ...base, id: 'new-two', name: 'New two' });
  const snapE = JSON.stringify(pubEntries), snapD = JSON.stringify(d);
  const files = Drafts.publishFiles(pubEntries, d);
  assert.strictEqual(JSON.stringify(pubEntries), snapE);
  assert.strictEqual(JSON.stringify(d), snapD);
  assert.deepStrictEqual(files.map((f) => f.file).sort(), ['demo.json', 'index.json', 'new-one.json', 'new-two.json']);
  assert.deepStrictEqual(JSON.parse(byFile(files)['index.json']).routines, ['demo.json', 'c.json', 'new-one.json', 'new-two.json']);
  assert.strictEqual(JSON.parse(byFile(files)['demo.json']).name, 'Demo 2');
  checkFiles(files);
});

test('changeCount counts draft routines and removals once', () => {
  assert.strictEqual(Drafts.changeCount(null), 0);
  let d = Drafts.rename(null, 'b.json', base, 'X').drafts;
  d = Drafts.remove(d, 'c.json');
  d = Drafts.remove(d, 'b.json');
  assert.strictEqual(Drafts.changeCount(d), 2);
});

test('UI: publish panel IDs used by app.js exist; keydown ignores the publish panel', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const used = [...app.matchAll(/\$\('(publish-[\w-]+)'\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 5);
  for (const id of used) assert.ok(ids.has(id), id);
  assert.match(app, /closest\('#publish-panel'\)/);
});

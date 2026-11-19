'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const rel = (f) => path.relative(root, f).split(path.sep).join('/');

function loadSw() {
  const src = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const listeners = {};
  const sandbox = { self: { addEventListener: (t, fn) => { listeners[t] = fn; } } };
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;this.__out = { CACHE_VERSION, APP_SHELL };', sandbox);
  return { ...sandbox.__out, listeners };
}

test('APP_SHELL lists exactly index.html, css/, js/, icons/ and the manifest', () => {
  const { APP_SHELL } = loadSw();
  const expected = [
    'index.html', 'manifest.webmanifest',
    ...['css', 'js', 'icons'].flatMap((d) => walk(path.join(root, d)).map(rel)),
  ].sort();
  const actual = Array.from(APP_SHELL).filter((p) => p !== './').slice().sort();
  assert.deepStrictEqual(actual, expected);
  assert.strictEqual(new Set(APP_SHELL).size, APP_SHELL.length, 'duplicate entries');
});

test('CACHE_VERSION is vN and SW registers install/activate/fetch', () => {
  const { CACHE_VERSION, listeners } = loadSw();
  assert.match(CACHE_VERSION, /^v\d+$/);
  for (const t of ['install', 'activate', 'fetch']) assert.strictEqual(typeof listeners[t], 'function', t);
  const src = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(/skipWaiting\(\)/.test(src) && /clients\.claim\(\)/.test(src));
});

test('manifest has required fields and existing icons incl. maskable', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.ok(m.name && m.short_name);
  assert.strictEqual(m.display, 'fullscreen');
  assert.strictEqual(m.orientation, 'landscape');
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some((i) => /maskable/.test(i.purpose || '')));
  for (const i of m.icons) {
    const f = path.join(root, i.src);
    assert.ok(fs.existsSync(f), 'missing ' + i.src);
    assert.deepStrictEqual([...fs.readFileSync(f).subarray(0, 4)], [137, 80, 78, 71]);
  }
});

test('index.html links manifest; app.js registers sw.js', () => {
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), /serviceWorker\.register\('sw\.js'\)/);
});

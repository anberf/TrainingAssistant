'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function topReleased(changelog) {
  const m = changelog.match(/^##\s+(v\d+)\b/m);
  return m ? m[1] : null;
}

test('CACHE_VERSION in sw.js equals top released CHANGELOG version', () => {
  const sw = read('sw.js').match(/const\s+CACHE_VERSION\s*=\s*["']([^"']+)["']/);
  assert.ok(sw, 'CACHE_VERSION not found in sw.js');
  const top = topReleased(read('docs/CHANGELOG.md'));
  assert.ok(top, 'no released version heading (## vN) in CHANGELOG');
  assert.strictEqual(sw[1], top);
});

test('topReleased ignores Unreleased and picks the first version', () => {
  assert.strictEqual(topReleased('## Unreleased\n- x\n## v3 (d)\n## v2 (d)\n'), 'v3');
  assert.strictEqual(topReleased('## Unreleased\n'), null);
});

test('README covers run locally, GitHub Pages, adding a routine', () => {
  const r = read('README.md');
  assert.match(r, /http\.server/);
  assert.match(r, /GitHub Pages/);
  assert.match(r, /routines\/index\.json/);
});

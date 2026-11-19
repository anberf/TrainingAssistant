'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('app-info exports name and version', () => {
  const info = require('../js/app-info.js');
  assert.strictEqual(typeof info.name, 'string');
  assert.ok(info.name.length > 0);
  assert.strictEqual(typeof info.version, 'string');
});

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

test('no external URLs in index.html, css/, js/', () => {
  const files = [path.join(root, 'index.html'), ...walk(path.join(root, 'css')), ...walk(path.join(root, 'js'))];
  const bad = /https?:\/\/|\/\/cdn/i;
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    assert.ok(!bad.test(text), 'external reference in ' + path.relative(root, f));
  }
});

test('index.html shows title and "No routine loaded", loads css and scripts', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /No routine loaded/);
  assert.match(html, /css\/app\.css/);
  assert.match(html, /<script src="js\/app-info\.js"><\/script>/);
});

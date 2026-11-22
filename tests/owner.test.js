'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Owner = require('../js/owner.js');
const SetPin = require('../tools/set-pin.js');

const root = path.join(__dirname, '..');
const ref = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

test('sha256Hex matches standard vectors', () => {
  assert.strictEqual(Owner.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.strictEqual(Owner.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sha256Hex equals Node crypto incl. non-ASCII and block boundaries', () => {
  const samples = ['1234', 'training-assistant:0000', 'héllo wörld', '日本語のテキスト', 'emoji 🏋️‍♂️ ok',
    'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(63), 'a'.repeat(64), 'a'.repeat(65), 'x'.repeat(1000)];
  for (const s of samples) assert.strictEqual(Owner.sha256Hex(s), ref(s), s.slice(0, 20));
});

test('hashPin is salted; checkPin true/false/empty hash', () => {
  assert.strictEqual(Owner.hashPin('1234'), ref('training-assistant:1234'));
  const h = Owner.hashPin('4821');
  assert.strictEqual(Owner.checkPin('4821', h), true);
  assert.strictEqual(Owner.checkPin('4822', h), false);
  assert.strictEqual(Owner.checkPin('4821', ''), false);
  assert.strictEqual(Owner.checkPin('4821', 'nothex'), false);
  assert.strictEqual(Owner.checkPin('4821', undefined), false);
});

test('set-pin: validPin', () => {
  assert.strictEqual(SetPin.validPin('1234'), true);
  assert.strictEqual(SetPin.validPin('123456789012'), true);
  assert.strictEqual(SetPin.validPin('123'), false);
  assert.strictEqual(SetPin.validPin('abcd'), false);
  assert.strictEqual(SetPin.validPin('1234567890123'), false);
  assert.strictEqual(SetPin.validPin(''), false);
});

test('set-pin: configText is valid JS setting OwnerConfig.pinHash', () => {
  const h = Owner.hashPin('1234');
  const sandbox = {};
  vm.runInNewContext(SetPin.configText(h) + '\n;this.out = OwnerConfig;', sandbox);
  assert.strictEqual(sandbox.out.pinHash, h);
});

test('committed owner-config.js has an EMPTY hash', () => {
  const cfg = require('../js/owner-config.js');
  assert.strictEqual(cfg.pinHash, '');
});

test('owner UI wiring: ids exist, scripts loaded before app.js, in APP_SHELL, keydown guard', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const used = [...app.matchAll(/\$\('(owner-[\w-]+)'\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 4);
  for (const id of used) assert.ok(ids.has(id), `missing #${id}`);
  assert.match(html, /<input id="owner-pin"[^>]*type="password"[^>]*inputmode="numeric"/);
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const appAt = srcs.indexOf('js/app.js');
  for (const s of ['js/owner.js', 'js/owner-config.js']) {
    assert.ok(srcs.indexOf(s) !== -1 && srcs.indexOf(s) < appAt, s);
    assert.ok(sw.includes("'" + s + "'"), s + ' in APP_SHELL');
  }
  assert.match(app, /kb-timer-owner/);
  assert.match(app, /data-owner/);
  assert.match(app, /document\.addEventListener\('keydown'[\s\S]*?'INPUT'[\s\S]*?'TEXTAREA'[\s\S]*?'SELECT'/);
});

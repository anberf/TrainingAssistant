'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

test('index.html contains every element ID app.js uses', () => {
  const used = new Set([
    ...[...appJs.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]),
    ...[...appJs.matchAll(/setText\('([\w-]+)'/g)].map((m) => m[1]),
  ]);
  assert.ok(used.size > 10, 'expected app.js to reference many ids');
  for (const id of used) assert.ok(htmlIds.has(id), `missing #${id} in index.html`);
});

test('three control buttons exist with accessible labels', () => {
  for (const [id, label] of [['btn-back', 'Back'], ['btn-toggle', 'Pause or resume'], ['btn-skip', 'Skip']]) {
    assert.match(html, new RegExp(`<button id="${id}"[^>]*aria-label="${label}"`), id);
  }
  assert.match(html, /<button id="btn-home"[^>]*>Back to routines<\/button>/);
});

test('index.html loads all scripts in dependency order, app.js last', () => {
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.strictEqual(srcs[srcs.length - 1], 'js/app.js');
  for (const s of ['js/routine.js', 'js/engine.js', 'js/keys.js', 'js/view.js']) {
    assert.ok(srcs.includes(s), s);
    assert.ok(fs.existsSync(path.join(root, s)));
  }
});

test('control buttons sized per SPEC section 5 in CSS', () => {
  const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
  assert.match(css, /#controls button\s*\{[^}]*min-width:\s*25vw/);
  assert.match(css, /#controls button\s*\{[^}]*min-height:\s*12vh/);
});

test('clip video: muted/loop/playsinline, hidden by default, hides on error', () => {
  assert.match(html, /<video id="run-clip" muted loop playsinline hidden><\/video>/);
  assert.match(appJs, /renderMedia\(v\.media\)/);
  assert.match(appJs, /vid\.onerror\s*=\s*function\s*\(\)\s*\{\s*vid\.hidden = true/);
});

test('T19: #run-img exists beside the countdown, hides on error; media CSS height >= 25vh', () => {
  assert.match(html, /<img id="run-img"[^>]*hidden>/);
  assert.ok(html.indexOf('id="run-img"') > html.indexOf('id="run-clock"') && html.indexOf('id="run-img"') < html.indexOf('id="run-focus"'));
  assert.match(appJs, /img\.onerror\s*=\s*function\s*\(\)\s*\{\s*img\.hidden = true/);
  const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
  const m = css.match(/#run-img, #run-clip\s*\{[^}]*height:\s*([0-9.]+)vh/);
  assert.ok(m && parseFloat(m[1]) >= 25);
});

test('T21: #run-countdown has a fixed ch width (>= 4ch) and tabular-nums so the media does not shift', () => {
  const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
  const rule = css.match(/#run-countdown\s*\{([^}]*)\}/)[1];
  const w = rule.match(/(?:^|[;\s])width:\s*([0-9.]+)ch/);
  assert.ok(w && parseFloat(w[1]) >= 4, 'fixed width in ch >= 4');
  assert.match(rule, /flex:\s*none/);
  assert.match(rule, /font-variant-numeric:\s*tabular-nums/);
});

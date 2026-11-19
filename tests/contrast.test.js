const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');

function token(name) {
  const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})\\b'));
  assert.ok(m, 'missing CSS token --' + name);
  return m[1];
}
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const l = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}

['fg', 'muted', 'accent-exercise', 'accent-rest'].forEach((t) => {
  test('contrast --' + t + ' on --bg >= 7:1', () => {
    const r = ratio(token(t), token('bg'));
    assert.ok(r >= 7, '--' + t + ' contrast ' + r.toFixed(2) + ' < 7');
  });
});

test('SPEC 6 size tokens: countdown >= 30vh, title >= 8vh, cue >= 5vh', () => {
  const vh = (n) => parseFloat(css.match(new RegExp('--size-' + n + ':\\s*([0-9.]+)vh'))[1]);
  assert.ok(vh('countdown') >= 30);
  assert.ok(vh('title') >= 8);
  assert.ok(vh('cue') >= 5);
});

test('long text on run screen is ellipsized', () => {
  ['#run-title', '#run-cues li', '#run-next', '#run-focus'].forEach((sel) => {
    const i = css.indexOf(sel + ' {');
    assert.ok(i >= 0, sel);
    const block = css.slice(i, css.indexOf('}', i));
    assert.match(block, /text-overflow:\s*ellipsis/, sel);
  });
});

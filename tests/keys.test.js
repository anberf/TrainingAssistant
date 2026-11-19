'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { mapKey } = require('../js/keys.js');

const SELECT = ['Enter', 'NumpadEnter', ' ', 'Space', 'MediaPlayPause'];
const NEXT = ['ArrowRight', 'MediaTrackNext'];
const PREV = ['ArrowLeft', 'MediaTrackPrevious'];

test('picker: select keys start', () => {
  for (const k of SELECT) assert.strictEqual(mapKey(k, 'picker'), 'start', k);
});
test('picker: next/prev and up/down move selection', () => {
  for (const k of [...NEXT, 'ArrowDown']) assert.strictEqual(mapKey(k, 'picker'), 'down', k);
  for (const k of [...PREV, 'ArrowUp']) assert.strictEqual(mapKey(k, 'picker'), 'up', k);
});
test('picker: other keys ignored', () => {
  for (const k of ['Escape', 'a', 'Tab', '']) assert.strictEqual(mapKey(k, 'picker'), null, k);
});
test('run: toggle / skip / back', () => {
  for (const k of SELECT) assert.strictEqual(mapKey(k, 'run'), 'toggle', k);
  for (const k of NEXT) assert.strictEqual(mapKey(k, 'run'), 'skip', k);
  for (const k of PREV) assert.strictEqual(mapKey(k, 'run'), 'back', k);
});
test('run: up/down and everything else ignored; no exit/menu action', () => {
  for (const k of ['ArrowUp', 'ArrowDown', 'Escape', 'Backspace', 'F11', 'f', 'm', 'Tab', 'Home', 'BrowserBack', 'ContextMenu', 'MediaStop', 'a', '']) {
    assert.strictEqual(mapKey(k, 'run'), null, k);
  }
  const actions = new Set();
  const keys = [...SELECT, ...NEXT, ...PREV, 'ArrowUp', 'ArrowDown', 'Escape', 'Backspace', 'F11', 'x'];
  for (const k of keys) actions.add(mapKey(k, 'run'));
  actions.delete(null);
  assert.deepStrictEqual([...actions].sort(), ['back', 'skip', 'toggle']);
});
test('done: only select keys act', () => {
  for (const k of SELECT) assert.strictEqual(mapKey(k, 'done'), 'start', k);
  for (const k of [...NEXT, ...PREV, 'ArrowUp', 'ArrowDown', 'Escape']) assert.strictEqual(mapKey(k, 'done'), null, k);
});
test('unknown screen / bad input -> null', () => {
  assert.strictEqual(mapKey('Enter', 'nope'), null);
  assert.strictEqual(mapKey('Enter'), null);
  assert.strictEqual(mapKey(undefined, 'run'), null);
  assert.strictEqual(mapKey(null, 'picker'), null);
});

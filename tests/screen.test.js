'use strict';
const test = require('node:test');
const assert = require('node:assert');
const ScreenCtl = require('../js/screen.js');

const tick = () => new Promise((r) => setImmediate(r));

function mocks(opts) {
  opts = opts || {};
  const log = { fs: 0, req: 0, rel: 0 };
  const listeners = {};
  const doc = {
    visibilityState: 'visible',
    documentElement: opts.noFs ? {} : { requestFullscreen() { log.fs++; return Promise.resolve(); } },
    addEventListener(t, f) { listeners[t] = f; }
  };
  const nav = opts.noWake ? {} : {
    wakeLock: {
      request(type) {
        log.req++; log.type = type;
        return Promise.resolve({ release() { log.rel++; return Promise.resolve(); }, addEventListener() {} });
      }
    }
  };
  return { doc, nav, log, listeners };
}

test('start enters fullscreen and acquires wake lock', async () => {
  const m = mocks();
  const s = ScreenCtl.create(m.doc, m.nav);
  s.start(); await tick();
  assert.strictEqual(m.log.fs, 1);
  assert.strictEqual(m.log.req, 1);
  assert.strictEqual(m.log.type, 'screen');
});

test('finish releases the lock; no re-acquire afterwards', async () => {
  const m = mocks();
  const s = ScreenCtl.create(m.doc, m.nav);
  s.start(); await tick();
  s.finish();
  assert.strictEqual(m.log.rel, 1);
  m.listeners.visibilitychange(); await tick();
  assert.strictEqual(m.log.req, 1);
});

test('re-acquires on visibilitychange after system release', async () => {
  const m = mocks();
  let sentinelListener;
  m.nav.wakeLock.request = () => {
    m.log.req++;
    return Promise.resolve({ release() { m.log.rel++; }, addEventListener(t, f) { sentinelListener = f; } });
  };
  const s = ScreenCtl.create(m.doc, m.nav);
  s.start(); await tick();
  m.doc.visibilityState = 'hidden';
  sentinelListener(); // browser released it on hide
  m.listeners.visibilitychange(); await tick();
  assert.strictEqual(m.log.req, 1); // hidden: no request
  m.doc.visibilityState = 'visible';
  m.listeners.visibilitychange(); await tick();
  assert.strictEqual(m.log.req, 2);
});

test('visibilitychange while lock still held does not double-request', async () => {
  const m = mocks();
  const s = ScreenCtl.create(m.doc, m.nav);
  s.start(); await tick();
  m.listeners.visibilitychange(); await tick();
  assert.strictEqual(m.log.req, 1);
});

test('graceful when APIs absent', () => {
  const m = mocks({ noFs: true, noWake: true });
  const s = ScreenCtl.create(m.doc, m.nav);
  assert.doesNotThrow(() => { s.start(); m.listeners.visibilitychange(); s.finish(); });
  assert.doesNotThrow(() => ScreenCtl.create(undefined, undefined).start());
});

test('graceful when requests reject or throw', async () => {
  const m = mocks();
  m.doc.documentElement.requestFullscreen = () => Promise.reject(new Error('no'));
  m.nav.wakeLock.request = () => Promise.reject(new Error('denied'));
  const s = ScreenCtl.create(m.doc, m.nav);
  s.start(); await tick();
  m.nav.wakeLock.request = () => { throw new Error('sync'); };
  assert.doesNotThrow(() => m.listeners.visibilitychange());
  s.finish();
});

test('finish before lock resolves releases it', async () => {
  const m = mocks();
  const s = ScreenCtl.create(m.doc, m.nav);
  s.start(); s.finish(); await tick();
  assert.strictEqual(m.log.rel, 1);
});

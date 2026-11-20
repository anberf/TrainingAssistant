'use strict';
const CACHE_VERSION = "v3";
const CACHE_NAME = 'kb-timer-' + CACHE_VERSION;

const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app-info.js',
  'js/app.js',
  'js/audio.js',
  'js/engine.js',
  'js/keys.js',
  'js/pace.js',
  'js/routine.js',
  'js/screen.js',
  'js/view.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

// Runtime precache: routines/index.json, every routine listed, and their clips. Best effort per file.
async function precacheRoutines(cache) {
  const idx = await fetch('routines/index.json', { cache: 'reload' });
  if (!idx.ok) return;
  await cache.put('routines/index.json', idx.clone());
  const list = (await idx.json()).routines || [];
  for (const file of list) {
    try {
      const res = await fetch('routines/' + file, { cache: 'reload' });
      if (!res.ok) continue;
      await cache.put('routines/' + file, res.clone());
      const r = await res.json();
      for (const b of (r.blocks || [])) {
        for (const s of (b.steps || [])) {
          if (!s || !s.clip) continue;
          try {
            const cr = await fetch(s.clip, { cache: 'reload' });
            if (cr.ok) await cache.put(s.clip, cr);
          } catch (e) { /* clips are optional */ }
        }
      }
    } catch (e) { /* skip bad routine */ }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    try { await precacheRoutines(cache); } catch (e) { /* best effort */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const hit = await caches.match(event.request, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(event.request);
    if (res.ok && new URL(event.request.url).origin === self.location.origin) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, res.clone());
    }
    return res;
  })());
});

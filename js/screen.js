(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScreenCtl = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function swallow(p) {
    if (p && typeof p.catch === 'function') p.catch(function () {});
  }

  // create(doc, nav) -> { start, finish, isActive }. Never throws; silently degrades.
  // doc = document-like, nav = navigator-like.
  function create(doc, nav) {
    var active = false;
    var lock = null;
    var pending = false;

    function enterFullscreen() {
      try {
        var el = doc && doc.documentElement;
        if (!el || doc.fullscreenElement) return false;
        var fn = el.requestFullscreen || el.webkitRequestFullscreen;
        if (typeof fn !== 'function') return false;
        swallow(fn.call(el));
        return true;
      } catch (e) { return false; }
    }

    function acquire() {
      try {
        if (!active || lock || pending) return false;
        if (doc && doc.visibilityState === 'hidden') return false;
        if (!nav || !nav.wakeLock || typeof nav.wakeLock.request !== 'function') return false;
        pending = true;
        Promise.resolve(nav.wakeLock.request('screen')).then(function (sentinel) {
          pending = false;
          if (!active) {
            try { if (sentinel && sentinel.release) swallow(sentinel.release()); } catch (e) {}
            return;
          }
          lock = sentinel || null;
          if (lock && typeof lock.addEventListener === 'function') {
            lock.addEventListener('release', function () { if (lock === sentinel) lock = null; });
          }
        }, function () { pending = false; });
        return true;
      } catch (e) { pending = false; return false; }
    }

    function release() {
      var l = lock;
      lock = null;
      try { if (l && typeof l.release === 'function') swallow(l.release()); } catch (e) {}
    }

    function onVisibility() {
      if (active && doc.visibilityState === 'visible') acquire();
    }

    if (doc && typeof doc.addEventListener === 'function') doc.addEventListener('visibilitychange', onVisibility);

    return {
      // Call from a user gesture (Start tap).
      start: function () { active = true; enterFullscreen(); acquire(); },
      finish: function () { active = false; release(); },
      isActive: function () { return active; }
    };
  }

  return { create: create };
});

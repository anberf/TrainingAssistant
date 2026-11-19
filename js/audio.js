(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Audio2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var BEEP = { freq: 880, dur: 0.12 };
  var FINAL = { freq: 1320, dur: 0.4 };

  // createBeeper(AudioContextCtor) -> { unlock, beep, finalBeep, onEvent }. Never throws.
  function createBeeper(Ctor) {
    var ctx = null;

    function getCtx() {
      if (ctx) return ctx;
      if (typeof Ctor !== 'function') return null;
      try { ctx = new Ctor(); } catch (e) { ctx = null; }
      return ctx;
    }

    function unlock() {
      var c = getCtx();
      if (!c) return false;
      try {
        if (c.state === 'suspended' && typeof c.resume === 'function') {
          var p = c.resume();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        }
        return true;
      } catch (e) { return false; }
    }

    function tone(spec) {
      var c = getCtx();
      if (!c) return false;
      try {
        var osc = c.createOscillator();
        var gain = c.createGain();
        var t = c.currentTime;
        osc.type = 'sine';
        osc.frequency.value = spec.freq;
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.setValueAtTime(0.4, t + spec.dur - 0.02);
        gain.gain.linearRampToValueAtTime(0, t + spec.dur);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + spec.dur);
        return true;
      } catch (e) { return false; }
    }

    return {
      unlock: unlock,
      beep: function () { return tone(BEEP); },
      finalBeep: function () { return tone(FINAL); },
      // Engine event handler: beep at 3/2/1, final-beep at 0.
      onEvent: function (ev) {
        if (!ev) return;
        if (ev.type === 'beep') tone(BEEP);
        else if (ev.type === 'final-beep') tone(FINAL);
      },
    };
  }

  return { createBeeper: createBeeper, BEEP: BEEP, FINAL: FINAL };
});

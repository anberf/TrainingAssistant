(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var BACK_RESTART_MS = 3000;
  var BEEP_SECONDS = [3, 2, 1];

  // Pure timer state machine over expanded flat steps. Time is passed in (ms);
  // the engine never reads a clock. Every mutator returns the events it produced.
  function create(flatSteps, opts) {
    opts = opts || {};
    var steps = flatSteps || [];
    var readyMs = (opts.readySec === undefined ? 5 : opts.readySec) * 1000;
    var onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null;

    var phase = 'idle'; // idle | ready | step | finished
    var paused = false;
    var index = -1;     // current step index (phase 'step')
    var segElapsed = 0; // ms elapsed in current segment (ready or step)
    var totalElapsed = 0;
    var lastNow = 0;
    var fired = {};
    var events = [];

    function emit(e) { events.push(e); if (onEvent) onEvent(e); }
    function segDur() { return phase === 'ready' ? readyMs : steps[index].durationSec * 1000; }
    function resetSeg() { segElapsed = 0; fired = {}; }

    function fireBeeps() {
      var durSec = segDur() / 1000;
      var remaining = segDur() - segElapsed;
      BEEP_SECONDS.forEach(function (t) {
        if (!fired[t] && t <= durSec && remaining <= t * 1000) {
          fired[t] = true;
          emit({ type: 'beep', second: t });
        }
      });
    }

    function enterStep(i) {
      if (i >= steps.length) {
        phase = 'finished';
        index = steps.length;
        paused = false;
        emit({ type: 'finished', totalElapsedMs: totalElapsed });
        return;
      }
      phase = 'step';
      index = i;
      resetSeg();
      emit({ type: 'step', index: i });
    }

    function advance(now) {
      var delta = now - lastNow;
      lastNow = now;
      if (phase !== 'ready' && phase !== 'step') return;
      if (paused || delta <= 0) return;
      totalElapsed += delta;
      while (phase === 'ready' || phase === 'step') {
        var remaining = segDur() - segElapsed;
        if (delta < remaining) {
          segElapsed += delta;
          fireBeeps();
          return;
        }
        delta -= remaining;
        segElapsed = segDur();
        fireBeeps();
        emit({ type: 'final-beep' });
        enterStep(phase === 'ready' ? 0 : index + 1);
      }
      totalElapsed -= delta; // time past the finish moment does not count
    }

    function run(now, fn) {
      events = [];
      advance(now);
      if (fn) fn();
      return events;
    }

    return {
      start: function (now) {
        events = [];
        if (phase !== 'idle') return events;
        lastNow = now;
        totalElapsed = 0;
        paused = false;
        phase = 'ready';
        resetSeg();
        emit({ type: 'ready' });
        if (readyMs <= 0) { emit({ type: 'final-beep' }); enterStep(0); }
        return events;
      },
      tick: function (now) { return run(now); },
      togglePause: function (now) {
        return run(now, function () {
          if (phase === 'ready' || phase === 'step') paused = !paused;
        });
      },
      skip: function (now) {
        return run(now, function () {
          if (phase === 'ready') enterStep(0);
          else if (phase === 'step') enterStep(index + 1);
        });
      },
      back: function (now) {
        return run(now, function () {
          if (phase === 'ready') resetSeg();
          else if (phase === 'step') {
            if (segElapsed > BACK_RESTART_MS || index === 0) resetSeg();
            else enterStep(index - 1);
          }
        });
      },
      getState: function () {
        var dur = (phase === 'ready' || phase === 'step') ? segDur() : 0;
        var remainingMs = Math.max(0, dur - segElapsed);
        return {
          phase: phase,
          paused: paused,
          index: index,
          total: steps.length,
          step: phase === 'step' ? steps[index] : null,
          next: phase === 'ready' ? (steps[0] || null)
            : phase === 'step' ? (steps[index + 1] || null) : null,
          durationMs: dur,
          elapsedInStepMs: segElapsed,
          remainingMs: remainingMs,
          remainingSec: Math.ceil(remainingMs / 1000),
          totalElapsedMs: totalElapsed
        };
      }
    };
  }

  return { create: create, BACK_RESTART_MS: BACK_RESTART_MS };
});

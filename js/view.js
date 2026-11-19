(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.View = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function formatCountdown(sec) {
    sec = Math.max(0, Math.ceil(sec || 0));
    if (sec < 60) return String(sec);
    var s = sec % 60;
    return Math.floor(sec / 60) + ':' + (s < 10 ? '0' : '') + s;
  }

  function targetLabel(step) {
    if (!step || step.reps === undefined || step.reps === null) return '';
    return '×' + step.reps + (step.perSide ? ' / side' : '');
  }

  function blockLabel(step) {
    if (!step || !step.block) return '';
    return step.rounds > 1 ? step.block + ' · round ' + step.round + '/' + step.rounds : step.block;
  }

  // Pure: engine.getState() -> everything the DOM layer needs to render.
  // `focusName` names the exercise the cues/target belong to
  // (the current step, or the NEXT step during a pause / get-ready).
  function toView(state) {
    var v = {
      title: '', badge: '', countdown: '', target: '', blockLabel: '', index: '',
      nextUp: '', nextTarget: '', cues: [], cuesFor: 'current', clip: '', theme: 'idle',
      paused: !!(state && state.paused), focusName: ''
    };
    if (!state) return v;
    var step = state.step, next = state.next;

    if (state.phase === 'ready') {
      v.title = 'Get ready';
      v.badge = 'GET READY';
      v.theme = 'rest';
      v.countdown = formatCountdown(state.remainingSec);
      v.index = '0 / ' + state.total;
      v.cuesFor = 'next';
      if (next) {
        v.focusName = next.name; v.nextTarget = targetLabel(next); v.cues = (next.cues || []).slice();
        v.clip = next.clip || ''; v.nextUp = next.name; v.blockLabel = blockLabel(next);
      }
    } else if (state.phase === 'step' && step) {
      var isPause = step.type === 'pause';
      var focus = isPause ? next : step;
      v.title = step.name;
      v.badge = isPause ? 'REST' : 'EXERCISE';
      v.theme = isPause ? 'rest' : 'exercise';
      v.countdown = formatCountdown(state.remainingSec);
      v.blockLabel = blockLabel(step);
      v.index = (state.index + 1) + ' / ' + state.total;
      v.nextUp = next ? next.name : 'Finish';
      v.cuesFor = isPause ? 'next' : 'current';
      if (focus) {
        v.focusName = focus.name; v.cues = (focus.cues || []).slice();
        // Rest: target belongs to the NEXT exercise, never beside the rest countdown.
        if (isPause) v.nextTarget = targetLabel(focus); else v.target = targetLabel(focus);
        v.clip = focus.clip || '';
      }
    } else if (state.phase === 'finished') {
      v.title = 'Done';
      v.badge = 'DONE';
      v.theme = 'done';
      v.index = state.total + ' / ' + state.total;
    }
    return v;
  }

  return { toView: toView, formatCountdown: formatCountdown, targetLabel: targetLabel };
});

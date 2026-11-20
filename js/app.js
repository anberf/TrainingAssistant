(function () {
  'use strict';
  // DOM wiring only. Logic lives in routine.js / engine.js / keys.js / view.js.
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var screen = 'picker';
  var engine = null;
  var rafId = 0;
  var entries = [];   // { file, name, routine, ok, error, total }
  var selected = 0;
  var cache = {};
  var screenCtl = ScreenCtl.create(document, navigator);
  var beeper = Audio2.createBeeper(window.AudioContext || window.webkitAudioContext);

  function setText(id, text) {
    if (cache[id] === text) return;
    cache[id] = text;
    $(id).textContent = text;
  }

  function showScreen(name) {
    screen = name;
    app.setAttribute('data-screen', name);
    $('screen-picker').hidden = name !== 'picker';
    $('screen-run').hidden = name !== 'run';
    $('screen-done').hidden = name !== 'done';
    if (name !== 'run') app.setAttribute('data-theme', name === 'done' ? 'done' : 'idle');
  }

  // ---- Pace settings (SPEC 4a) ----
  var PACE_KEY = 'kb-timer-pace';
  var pace = loadPace();

  function loadPace() {
    try { return Pace.normalize(JSON.parse(localStorage.getItem(PACE_KEY))); } catch (e) { return Pace.normalize(null); }
  }
  function savePace() {
    try { localStorage.setItem(PACE_KEY, JSON.stringify(pace)); } catch (e) { /* storage unavailable */ }
  }
  function fmtSec(v) { return v + ' s'; }

  function paceRow(label, valueText, onMinus, onPlus) {
    var row = document.createElement('div');
    row.className = 'pace-row';
    var l = document.createElement('span');
    l.className = 'pace-label';
    l.textContent = label;
    var v = document.createElement('span');
    v.className = 'pace-value';
    v.textContent = valueText;
    var m = document.createElement('button');
    m.type = 'button';
    m.textContent = '−';
    m.setAttribute('aria-label', 'Decrease ' + label);
    var p = document.createElement('button');
    p.type = 'button';
    p.textContent = '+';
    p.setAttribute('aria-label', 'Increase ' + label);
    [[m, onMinus], [p, onPlus]].forEach(function (x) {
      x[0].addEventListener('click', function () { x[0].blur(); x[1](); });
    });
    row.appendChild(l); row.appendChild(m); row.appendChild(v); row.appendChild(p);
    return row;
  }

  function renderPace() {
    $('pace-global-value').textContent = pace.secPerRep === null ? 'routine' : fmtSec(pace.secPerRep);
    var box = $('pace-exercises');
    box.textContent = '';
    var list = Pace.overridable(entries.filter(function (e) { return e.ok; }).map(function (e) { return e.routine; }));
    list.forEach(function (o) {
      var cur = Object.prototype.hasOwnProperty.call(pace.exercises, o.name) ? pace.exercises[o.name] : o.value;
      function change(dir) {
        pace.exercises[o.name] = Pace.stepValue(cur, dir, 'exercise');
        savePace(); renderPace(); renderPicker();
      }
      box.appendChild(paceRow(o.name, fmtSec(cur), function () { change(-1); }, function () { change(1); }));
    });
  }

  function changeGlobal(dir) {
    pace.secPerRep = Pace.stepValue(pace.secPerRep, dir, 'global');
    savePace(); renderPace(); renderPicker();
  }
  function resetPace() {
    pace = Pace.normalize(null);
    savePace(); renderPace(); renderPicker();
  }
  [['pace-global-minus', function () { changeGlobal(-1); }], ['pace-global-plus', function () { changeGlobal(1); }],
   ['pace-reset', resetPace]].forEach(function (x) {
    $(x[0]).addEventListener('click', function () { $(x[0]).blur(); x[1](); });
  });

  function renderPicker() {
    var ul = $('routine-list');
    ul.textContent = '';
    entries.forEach(function (e, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'card' + (i === selected ? ' selected' : '');
      var name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = e.name;
      b.appendChild(name);
      var sub = document.createElement('span');
      sub.className = 'card-sub';
      if (e.ok) {
        sub.textContent = View.cardLabel(e.routine.weight, Routine.totalDuration(e.routine, pace));
        b.addEventListener('click', function () { selected = i; startRoutine(i); });
      } else {
        b.disabled = true;
        b.classList.add('invalid');
        sub.textContent = e.error;
      }
      b.appendChild(sub);
      li.appendChild(b);
      ul.appendChild(li);
    });
    $('app-status').hidden = entries.length > 0;
    if (!entries.length) $('app-status').textContent = 'No routine loaded';
  }

  function loadRoutines() {
    return fetch('routines/index.json').then(function (r) { return r.json(); }).then(function (idx) {
      var files = (idx && idx.routines) || [];
      return Promise.all(files.map(function (f) {
        return fetch('routines/' + f).then(function (r) { return r.json(); }).then(function (obj) {
          var v = Routine.validateRoutine(obj);
          if (!v.ok) return { file: f, name: (obj && obj.name) || f, ok: false, error: v.errors[0] };
          return { file: f, name: obj.name, routine: obj, ok: true, total: Routine.totalDuration(obj) };
        }).catch(function (err) {
          return { file: f, name: f, ok: false, error: 'load failed: ' + ((err && err.message) || err) };
        });
      }));
    }).then(function (list) {
      entries = list;
      selected = Math.max(0, entries.findIndex(function (e) { return e.ok; }));
      renderPace();
      renderPicker();
    }).catch(function () {
      entries = [];
      renderPicker();
      $('app-status').hidden = false;
      $('app-status').textContent = 'Could not load routines';
    });
  }

  function moveSelection(dir) {
    if (!entries.length) return;
    var i = selected;
    for (var n = 0; n < entries.length; n++) {
      i = (i + dir + entries.length) % entries.length;
      if (entries[i].ok) { selected = i; break; }
    }
    renderPicker();
    var el = $('routine-list').querySelector('.selected');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function startRoutine(i) {
    var e = entries[i];
    if (!e || !e.ok) return;
    beeper.unlock();
    screenCtl.start();
    engine = Engine.create(Routine.expand(e.routine, pace), { onEvent: beeper.onEvent });
    cache = {};
    showScreen('run');
    engine.start(performance.now());
    render();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function frame() {
    if (!engine) return;
    engine.tick(performance.now());
    render();
    if (screen !== 'run') return;
    rafId = requestAnimationFrame(frame);
  }

  function renderCues(cues) {
    var key = cues.join('|');
    if (cache.cues === key) return;
    cache.cues = key;
    var ul = $('run-cues');
    ul.textContent = '';
    cues.forEach(function (c) {
      var li = document.createElement('li');
      li.textContent = c;
      ul.appendChild(li);
    });
  }

  // Optional picture beside the rest countdown: <img> or <video>; hidden when absent or on error.
  // src only changes when the path changes.
  function renderMedia(media) {
    var src = media ? media.src : '';
    var kind = media ? media.kind : '';
    var key = kind + ':' + src;
    if (cache.media === key) return;
    cache.media = key;
    var img = $('run-img'), vid = $('run-clip');
    img.hidden = true; vid.hidden = true;
    img.onload = img.onerror = vid.onloadeddata = vid.onerror = null;
    if (kind !== 'image') img.removeAttribute('src');
    if (kind !== 'video') { vid.pause(); vid.removeAttribute('src'); vid.load(); }
    if (!src) return;
    if (kind === 'image') {
      img.onload = function () { if (cache.media === key) img.hidden = false; };
      img.onerror = function () { img.hidden = true; };
      img.src = src;
    } else {
      vid.onloadeddata = function () { if (cache.media === key) vid.hidden = false; };
      vid.onerror = function () { vid.hidden = true; };
      vid.muted = true;
      vid.src = src;
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function render() {
    var state = engine.getState();
    if (state.phase === 'finished') {
      cancelAnimationFrame(rafId);
      screenCtl.finish();
      $('done-elapsed').textContent = 'Total time ' + View.formatTotal(state.totalElapsedMs / 1000);
      showScreen('done');
      return;
    }
    var v = View.toView(state);
    app.setAttribute('data-theme', v.theme);
    setText('run-badge', v.badge);
    setText('run-title', v.title);
    setText('run-countdown', v.countdown);
    setText('run-target', v.target);
    setText('run-block', v.blockLabel);
    setText('run-index', v.index);
    setText('run-next', v.nextUp ? 'NEXT UP: ' + v.nextUp : '');
    setText('run-focus', v.cuesFor === 'next' && v.focusName ? 'Next: ' + v.focusName + (v.nextTarget ? ' ' + v.nextTarget : '') : '');
    renderCues(v.cues);
    renderMedia(v.media);
    setText('btn-toggle-label', v.paused ? 'Resume' : 'Pause');
    $('paused-overlay').hidden = !v.paused;
  }

  function act(action) {
    var now = performance.now();
    if (screen === 'picker') {
      if (action === 'up') moveSelection(-1);
      else if (action === 'down') moveSelection(1);
      else if (action === 'start') startRoutine(selected);
    } else if (screen === 'run' && engine) {
      if (action === 'toggle') engine.togglePause(now);
      else if (action === 'skip') engine.skip(now);
      else if (action === 'back') engine.back(now);
      else return;
      render();
    } else if (screen === 'done') {
      if (action === 'start') goHome();
    }
  }

  function goHome() {
    engine = null;
    screenCtl.finish();
    cancelAnimationFrame(rafId);
    showScreen('picker');
    renderPicker();
  }

  function press(btn, action) {
    btn.addEventListener('click', function () { btn.blur(); act(action); });
  }
  press($('btn-back'), 'back');
  press($('btn-toggle'), 'toggle');
  press($('btn-skip'), 'skip');
  $('btn-home').addEventListener('click', goHome);

  document.addEventListener('keydown', function (ev) {
    if (ev.repeat) return;
    var action = Keys.mapKey(ev.key, screen);
    if (!action) return;
    ev.preventDefault();
    act(action);
  });

  showScreen('picker');
  loadRoutines();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();

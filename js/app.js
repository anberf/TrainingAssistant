(function () {
  'use strict';
  // DOM wiring only. Logic lives in routine.js / engine.js / keys.js / view.js.
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var screen = 'picker';
  var engine = null;
  var rafId = 0;
  var entries = [];   // displayed: { file, name, routine, ok, error, total, unpublished?, removed? }
  var baseEntries = []; // as loaded from routines/ (no drafts)
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
    var list = Pace.overridable(entries.filter(function (e) { return e.ok && !e.removed; }).map(function (e) { return e.routine; }));
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

  function usable(e) { return !!e && e.ok && !e.removed; }

  function smallBtn(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'owner-act';
    b.textContent = label;
    b.addEventListener('click', function () { b.blur(); onClick(); });
    return b;
  }

  function ownerRow(e) {
    var row = document.createElement('div');
    row.className = 'owner-row';
    if (e.removed) {
      row.appendChild(smallBtn('Undo', function () { saveDrafts(Drafts.undo(drafts, e.file)); refresh(); }));
    } else if (renamingFile === e.file) {
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'rename-input';
      inp.value = e.name;
      inp.maxLength = 60;
      inp.setAttribute('aria-label', 'New routine name');
      var msg = document.createElement('span');
      msg.className = 'rename-msg';
      var save = function () {
        var res = Drafts.rename(drafts, e.file, e.routine, inp.value);
        if (res.error) { msg.textContent = 'Name required'; return; }
        renamingFile = null;
        saveDrafts(res.drafts); refresh();
      };
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); save(); }
        else if (ev.key === 'Escape') { renamingFile = null; renderPicker(); }
      });
      row.appendChild(inp);
      row.appendChild(smallBtn('Save', save));
      row.appendChild(smallBtn('Cancel', function () { renamingFile = null; renderPicker(); }));
      row.appendChild(msg);
      setTimeout(function () { inp.focus(); }, 0);
    } else {
      if (e.routine) row.appendChild(smallBtn('Rename', function () { renamingFile = e.file; renderPicker(); }));
      row.appendChild(smallBtn('Remove', function () { saveDrafts(Drafts.remove(drafts, e.file)); refresh(); }));
    }
    return row;
  }

  // ---- Drafts (SPEC 4b, D42): owner-only, local to this device ----
  var DRAFTS_KEY = 'kb-timer-drafts';
  var drafts = loadDrafts();
  var renamingFile = null;

  function loadDrafts() {
    try { return Drafts.normalize(JSON.parse(localStorage.getItem(DRAFTS_KEY))); } catch (e) { return Drafts.normalize(null); }
  }
  function saveDrafts(d) {
    drafts = d;
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch (e) { /* storage unavailable */ }
  }
  // Recompute displayed entries from loaded routines (+ drafts while owner mode is on).
  function refresh() {
    var keep = entries[selected] ? entries[selected].file : null;
    entries = ownerOn ? Drafts.apply(baseEntries, drafts) : baseEntries;
    var i = entries.findIndex(function (e) { return e.file === keep && usable(e); });
    if (i < 0) i = entries.findIndex(usable);
    selected = Math.max(0, i);
    renderPace();
    renderPicker();
    renderPublishBtn();
  }

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
      if (e.removed) {
        b.disabled = true;
        b.classList.add('removed');
        sub.textContent = 'Removed — unpublished';
      } else if (e.ok) {
        sub.textContent = View.cardLabel(e.routine.weight, Routine.totalDuration(e.routine, pace));
        b.addEventListener('click', function () { selected = i; startRoutine(i); });
      } else {
        b.disabled = true;
        b.classList.add('invalid');
        sub.textContent = e.error;
      }
      b.appendChild(sub);
      if (e.unpublished && !e.removed) {
        var tag = document.createElement('span');
        tag.className = 'card-tag';
        tag.textContent = 'unpublished';
        b.appendChild(tag);
      }
      li.appendChild(b);
      if (ownerOn) li.appendChild(ownerRow(e));
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
      baseEntries = list;
      refresh();
    }).catch(function () {
      baseEntries = [];
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
      if (usable(entries[i])) { selected = i; break; }
    }
    renderPicker();
    var el = $('routine-list').querySelector('.selected');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function startRoutine(i) {
    var e = entries[i];
    if (!usable(e)) return;
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
    var fb = media && media.fallback ? media.fallback : null;
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
      img.onerror = function () {
        img.hidden = true;
        img.onerror = null; // no retry loop
        if (fb && fb.kind === 'video' && cache.media === key) startVideo(fb.src, key);
      };
      img.src = src;
    } else {
      startVideo(src, key);
    }
  }

  function startVideo(src, key) {
    var vid = $('run-clip');
    vid.onloadeddata = function () { if (cache.media === key) vid.hidden = false; };
    vid.onerror = function () { vid.hidden = true; vid.onerror = null; };
    vid.muted = true;
    vid.src = src;
    var p = vid.play();
    if (p && p.catch) p.catch(function () {});
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

  // ---- Owner mode (SPEC 4b): hides edit controls only; not security (D40, D41) ----
  var OWNER_KEY = 'kb-timer-owner';
  var ownerOn = false;

  function readOwner() {
    var h = OwnerConfig.pinHash;
    if (!h) return false;
    try { return localStorage.getItem(OWNER_KEY) === h; } catch (e) { return false; }
  }
  function writeOwner(on) {
    try {
      if (on) localStorage.setItem(OWNER_KEY, OwnerConfig.pinHash);
      else localStorage.removeItem(OWNER_KEY);
    } catch (e) { /* storage unavailable */ }
  }
  function renderOwner() {
    app.setAttribute('data-owner', ownerOn ? 'on' : 'off');
    $('owner-btn').textContent = ownerOn ? 'Lock' : 'Owner';
    if (ownerOn) $('owner-panel').hidden = true;
    $('import-btn').hidden = !ownerOn;
    if (!ownerOn) closeImport();
    renamingFile = null;
    refresh();
  }
  function closeOwnerPanel() {
    $('owner-panel').hidden = true;
    $('owner-pin').value = '';
    $('owner-msg').textContent = '';
  }
  function tryUnlock() {
    var pin = $('owner-pin').value;
    $('owner-pin').value = '';
    if (Owner.checkPin(pin, OwnerConfig.pinHash)) {
      ownerOn = true; writeOwner(true);
      $('owner-msg').textContent = '';
      renderOwner();
    } else {
      $('owner-msg').textContent = 'Wrong PIN';
    }
  }
  $('owner-btn').addEventListener('click', function () {
    $('owner-btn').blur();
    if (ownerOn) { ownerOn = false; writeOwner(false); closeOwnerPanel(); renderOwner(); return; }
    var panel = $('owner-panel');
    if (!panel.hidden) { closeOwnerPanel(); return; }
    panel.hidden = false;
    if (!OwnerConfig.pinHash) {
      $('owner-msg').textContent = 'No PIN set';
      $('owner-pin').disabled = true;
      $('owner-unlock').disabled = true;
    } else {
      $('owner-msg').textContent = '';
      $('owner-pin').focus();
    }
  });
  $('owner-unlock').addEventListener('click', function () { $('owner-unlock').blur(); tryUnlock(); });
  $('owner-cancel').addEventListener('click', function () { $('owner-cancel').blur(); closeOwnerPanel(); });
  $('owner-pin').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); tryUnlock(); }
  });
  // ---- Import a routine from a table (SPEC 4c, D44) ----
  var candidate = null; // { routine } once Check succeeded; cleared on any edit
  var chatPrompt = Import.CHAT_PROMPT;

  function closeImport() {
    $('import-panel').hidden = true;
    ['import-name', 'import-weight', 'import-text'].forEach(function (id) { $(id).value = ''; });
    $('import-prompt').hidden = true;
    $('import-msg').textContent = '';
    $('import-result').textContent = '';
    $('import-add').disabled = true;
    candidate = null;
  }
  function invalidateCandidate() {
    candidate = null;
    $('import-add').disabled = true;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function listOf(items, cls) {
    var ul = el('ul', cls);
    items.forEach(function (t) { ul.appendChild(el('li', '', t)); });
    return ul;
  }

  // Try the picture files like the run screen does: webp image, then mp4 video. Calls done('found'|'missing'|'unknown').
  function probePicture(pic, done) {
    if (typeof Image === 'undefined') { done('unknown'); return; }
    var img = new Image();
    img.onload = function () { done('found'); };
    img.onerror = function () {
      var v = document.createElement('video');
      if (!v || typeof v.load !== 'function') { done('unknown'); return; }
      v.preload = 'metadata';
      v.onloadedmetadata = function () { v.removeAttribute('src'); v.load(); done('found'); };
      v.onerror = function () { done('missing'); };
      v.src = pic.mp4;
    };
    img.src = pic.webp;
  }

  function renderPreview(box, routine) {
    var pv = Import.preview(routine, pace);
    box.appendChild(el('p', 'import-total', pv.stepCount + ' steps · total ' + View.formatTotal(pv.total)));
    pv.blocks.forEach(function (b) {
      box.appendChild(el('h3', 'import-block', b.name + ' · ' + b.rounds + (b.rounds === 1 ? ' round' : ' rounds') +
        (b.rounds > 1 && b.rest ? ' · rest ' + b.rest + ' s' : '')));
      box.appendChild(listOf(b.steps.map(function (s) { return s.name + (s.type === 'pause' ? ' (pause)' : '') + ' — ' + s.target; })));
    });
    if (pv.pictures.length) {
      box.appendChild(el('h3', 'import-block', 'Pictures'));
      var ul = el('ul', 'import-pics');
      pv.pictures.forEach(function (p) {
        var li = el('li', '', '? ' + p.name + ' — ' + p.webp + ' / ' + p.mp4);
        ul.appendChild(li);
        probePicture(p, function (st) {
          var mark = st === 'found' ? '✓' : st === 'missing' ? '✗' : '?';
          li.textContent = mark + ' ' + p.name + ' — ' + p.webp + ' / ' + p.mp4 + (st === 'missing' ? ' (missing)' : '');
          li.className = st;
        });
      });
      box.appendChild(ul);
    }
  }

  function checkImport() {
    var box = $('import-result');
    box.textContent = '';
    invalidateCandidate();
    var parsed = Import.parseTable($('import-text').value);
    var res = Import.toRoutine(parsed, { name: $('import-name').value, weight: $('import-weight').value });
    if (res.errors.length) {
      $('import-msg').textContent = 'Fix these ' + res.errors.length + ' problem(s):';
      box.appendChild(listOf(res.errors, 'import-errors'));
      return;
    }
    $('import-msg').textContent = 'Looks good.';
    if (res.warnings.length) box.appendChild(listOf(res.warnings, 'import-warnings'));
    renderPreview(box, res.routine);
    candidate = { routine: res.routine };
    $('import-add').disabled = false;
  }
  function addImport() {
    if (!candidate) return;
    var files = baseEntries.map(function (e) { return e.file; }).concat(Object.keys(drafts.routines));
    var file = Import.fileName(candidate.routine.id, files);
    saveDrafts(Drafts.add(drafts, file, candidate.routine));
    closeImport();
    refresh();
  }
  function copyPrompt() {
    var p = $('import-prompt');
    p.value = chatPrompt;
    var showIt = function () { p.hidden = false; p.focus(); p.select(); $('import-msg').textContent = 'Copy the prompt below.'; };
    try {
      navigator.clipboard.writeText(chatPrompt).then(function () {
        $('import-msg').textContent = 'Prompt copied.';
      }, showIt);
    } catch (e) { showIt(); }
  }
  $('import-btn').addEventListener('click', function () {
    $('import-btn').blur();
    var p = $('import-panel');
    if (p.hidden) { p.hidden = false; $('import-name').focus(); } else closeImport();
  });
  [['import-copy', copyPrompt], ['import-check', checkImport], ['import-add', addImport], ['import-cancel', closeImport]]
    .forEach(function (x) { $(x[0]).addEventListener('click', function () { $(x[0]).blur(); x[1](); }); });
  ['import-name', 'import-weight', 'import-text'].forEach(function (id) { $(id).addEventListener('input', invalidateCandidate); });

  // ---- Publish drafts (SPEC 4b, D45): download files; no network ----
  function renderPublishBtn() {
    var n = Drafts.changeCount(drafts);
    $('publish-btn').hidden = !(ownerOn && n > 0);
    $('publish-btn').textContent = 'Publish (' + n + ' change' + (n === 1 ? '' : 's') + ')';
    if ($('publish-btn').hidden) closePublish();
  }
  function closePublish() {
    $('publish-panel').hidden = true;
    $('publish-files').textContent = '';
    $('publish-msg').textContent = '';
  }
  function downloadFile(f) {
    try {
      var url = URL.createObjectURL(new Blob([f.text], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = f.file;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { $('publish-msg').textContent = 'Download failed.'; }
  }
  function openPublish() {
    var ul = $('publish-files');
    ul.textContent = '';
    Drafts.publishFiles(baseEntries, drafts).forEach(function (f) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Download';
      b.addEventListener('click', function () { b.blur(); downloadFile(f); });
      var span = document.createElement('span');
      span.textContent = ' routines/' + f.file;
      li.appendChild(b); li.appendChild(span);
      ul.appendChild(li);
    });
    $('publish-panel').hidden = false;
  }
  $('publish-btn').addEventListener('click', function () {
    $('publish-btn').blur();
    if ($('publish-panel').hidden) openPublish(); else closePublish();
  });
  $('publish-close').addEventListener('click', function () { $('publish-close').blur(); closePublish(); });
  $('publish-done').addEventListener('click', function () {
    $('publish-done').blur();
    var ok = true;
    try { ok = window.confirm('Clear all unpublished changes? Do this only after uploading the files to GitHub.'); } catch (e) { ok = true; }
    if (!ok) return;
    saveDrafts(Drafts.normalize(null));
    closePublish();
    refresh();
  });

  ownerOn = readOwner();
  renderOwner();

  document.addEventListener('keydown', function (ev) {
    if (ev.repeat) return;
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    if (ev.target && ev.target.closest && ev.target.closest('#import-panel')) return;
    if (ev.target && ev.target.closest && ev.target.closest('#publish-panel')) return;
    var action = Keys.mapKey(ev.key, screen);
    if (!action) return;
    ev.preventDefault();
    act(action);
  });

  $('app-version').textContent = 'Version ' + AppInfo.version;
  showScreen('picker');
  loadRoutines();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();

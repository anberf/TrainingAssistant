(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./routine.js'));
  else root.Import = factory(root.Routine);
})(typeof self !== 'undefined' ? self : this, function (Routine) {
  'use strict';
  // Table -> routine import (SPEC 4c, D44). Pure; no DOM.

  var COLUMNS = ['Block', 'Rounds', 'Rest between rounds', 'Exercise', 'Type', 'Reps', 'Seconds',
    'Per side', 'Sec per rep', 'Cue 1', 'Cue 2', 'Cue 3'];
  var OPTIONAL = ['Sec per rep'];

  var CHAT_PROMPT = 'Write my workout as ONE Markdown table with exactly these columns: ' + COLUMNS.join(' | ') +
    '. One row per step, in order. Fill Block, Rounds and Rest between rounds (seconds) only on the first row of each block.' +
    ' Type is "exercise" or "pause". Use either Reps or Seconds (whole numbers), never both; pauses use Seconds.' +
    ' Per side is "yes" when the exercise is done on each side, else blank.' +
    ' Sec per rep only for slow exercises (e.g. Turkish get-up 20).' +
    ' Every exercise needs 3 short cues of at most 30 characters; pauses have no cues.' +
    ' Use the same exercise names every time. Output only the table.';

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  var COL_KEYS = COLUMNS.map(norm);

  function splitPipe(line) {
    var t = line.trim();
    if (t.charAt(0) === '|') t = t.slice(1);
    if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
    return t.split('|').map(function (c) { return c.trim(); });
  }
  function splitTab(line) {
    return line.split('\t').map(function (c) { return c.trim(); });
  }
  function isSeparator(cells) {
    return cells.length > 0 && cells.every(function (c) { return /^:?-+:?$/.test(c); });
  }

  // Markdown pipe table or TSV. Text before/after the table is ignored.
  function parseTable(text) {
    var out = { header: [], rows: [], errors: [], warnings: [] };
    var lines = String(text === undefined || text === null ? '' : text).split(/\r?\n/);
    var tsv = lines.some(function (l) { return l.indexOf('\t') !== -1; });
    var split = tsv ? splitTab : splitPipe;
    var delim = tsv ? '\t' : '|';
    var started = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf(delim) === -1) {
        if (started && line.trim() === '') continue; // tolerate blank lines inside the table
        if (started) break;                          // text after the table
        continue;                                    // text before the table
      }
      var cells = split(line);
      if (!started) {
        started = true;
        out.header = cells.map(function (c) { return c.replace(/\s+/g, ' ').trim(); });
        continue;
      }
      if (isSeparator(cells)) continue;
      if (cells.every(function (c) { return c === ''; })) continue;
      out.rows.push(cells);
    }
    if (!started) { out.errors.push('table: no table found'); return out; }

    var seen = {};
    out.header.forEach(function (h) {
      var k = norm(h);
      if (COL_KEYS.indexOf(k) === -1) out.warnings.push('column "' + h + '": unknown column ignored');
      else if (seen[k]) out.warnings.push('column "' + h + '": duplicate column ignored');
      seen[k] = true;
    });
    COLUMNS.forEach(function (c, i) {
      if (OPTIONAL.indexOf(c) === -1 && !seen[COL_KEYS[i]]) out.errors.push('table: missing column "' + c + '"');
    });
    if (!out.errors.length && !out.rows.length) out.errors.push('table: no data rows');
    return out;
  }

  function whole(s, min) {
    if (!/^\d+$/.test(s)) return null;
    var n = parseInt(s, 10);
    return n >= min ? n : null;
  }

  function toRoutine(parsed, opts) {
    var errors = [];
    var warnings = [];
    opts = opts || {};
    var p = parsed || { header: [], rows: [], errors: ['table: no table found'], warnings: [] };
    (p.warnings || []).forEach(function (w) { warnings.push(w); });
    (p.errors || []).forEach(function (e) { errors.push(e); });

    var name = typeof opts.name === 'string' ? opts.name.trim() : '';
    var weight = typeof opts.weight === 'string' ? opts.weight.trim() : '';
    if (!name) errors.push('name: required');
    var id = Routine.clipName(name);
    if (name && !id) errors.push('name: needs letters or digits');
    if (errors.length) return { routine: null, errors: errors, warnings: warnings };

    var idx = {};
    p.header.forEach(function (h, i) {
      var k = norm(h);
      if (COL_KEYS.indexOf(k) !== -1 && idx[k] === undefined) idx[k] = i;
    });
    function cell(row, col) {
      var i = idx[norm(col)];
      return i === undefined || row[i] === undefined ? '' : row[i].trim();
    }

    var blocks = [];
    var cur = null;
    p.rows.forEach(function (row, ri) {
      var n = ri + 1;
      function bad(col, msg) { errors.push('row ' + n + ', ' + col + ': ' + msg); }

      var blockName = cell(row, 'Block');
      if (blockName && (!cur || norm(blockName) !== norm(cur.name))) {
        cur = { name: blockName, rounds: 1, restBetweenRounds: 0, steps: [] };
        var r = cell(row, 'Rounds');
        if (r !== '') {
          var rv = whole(r, 1);
          if (rv === null) bad('Rounds', 'expected whole number >= 1'); else cur.rounds = rv;
        }
        var rb = cell(row, 'Rest between rounds');
        if (rb !== '') {
          var rbv = whole(rb, 0);
          if (rbv === null) bad('Rest between rounds', 'expected whole number >= 0'); else cur.restBetweenRounds = rbv;
        }
        blocks.push(cur);
      } else if (!cur) {
        bad('Block', 'required on the first row');
        cur = { name: '?', rounds: 1, restBetweenRounds: 0, steps: [] };
        blocks.push(cur);
      }

      var step = {};
      var exName = cell(row, 'Exercise');
      if (!exName) bad('Exercise', 'required');
      step.name = exName;

      var type = norm(cell(row, 'Type'));
      if (type === 'rest') type = 'pause';
      if (type !== 'exercise' && type !== 'pause') { bad('Type', 'expected exercise or pause'); type = ''; }
      step.type = type;

      var reps = cell(row, 'Reps');
      var secs = cell(row, 'Seconds');
      if (reps !== '' && secs !== '') bad('Seconds', 'use either Reps or Seconds, not both');
      else if (reps === '' && secs === '') bad('Reps', 'Reps or Seconds required');
      else if (reps !== '') {
        var rpv = whole(reps, 1);
        if (rpv === null) bad('Reps', 'expected whole number');
        else if (type === 'pause') bad('Reps', 'pause must use Seconds');
        else step.reps = rpv;
      } else {
        var sv = whole(secs, 1);
        if (sv === null) bad('Seconds', 'expected whole number'); else step.seconds = sv;
      }

      var ps = norm(cell(row, 'Per side'));
      if (['yes', 'y', 'true', 'x'].indexOf(ps) !== -1) step.perSide = true;
      else if (['', 'no', 'n', 'false'].indexOf(ps) === -1) bad('Per side', 'expected yes or blank');

      var spr = cell(row, 'Sec per rep');
      if (spr !== '') {
        var sn = /^\d+(\.\d+)?$/.test(spr) ? parseFloat(spr) : NaN;
        if (!(sn > 0)) bad('Sec per rep', 'expected number > 0'); else step.secPerRep = sn;
      }

      if (type === 'exercise') {
        var cues = [];
        ['Cue 1', 'Cue 2', 'Cue 3'].forEach(function (c) {
          var v = cell(row, c);
          if (!v) bad(c, 'required for an exercise');
          else if (v.length > 30) bad(c, 'too long (' + v.length + ' > 30 chars)');
          cues.push(v);
        });
        step.cues = cues;
      }
      cur.steps.push(step);
    });
    if (errors.length) return { routine: null, errors: errors, warnings: warnings };

    var routine = { id: id, name: name };
    if (weight) routine.weight = weight;
    routine.defaults = { secPerRep: 3 };
    routine.blocks = blocks;
    var v = Routine.validateRoutine(routine);
    v.warnings.forEach(function (w) { warnings.push(w); });
    if (!v.ok) return { routine: null, errors: v.errors, warnings: warnings };
    return { routine: routine, errors: [], warnings: warnings };
  }

  // <id>.json, or <id>-2.json, -3 ... when taken (case-insensitive).
  function fileName(id, existingFiles) {
    var taken = {};
    (existingFiles || []).forEach(function (f) { taken[String(f).toLowerCase()] = true; });
    var base = id || 'routine';
    var f = base + '.json';
    for (var n = 2; taken[f.toLowerCase()]; n++) f = base + '-' + n + '.json';
    return f;
  }

  function target(s) {
    var t = s.reps !== undefined ? '×' + s.reps : s.seconds + ' s';
    return t + (s.perSide ? ' / side' : '');
  }

  // Preview model for the import panel: blocks with rounds/steps, total, and the picture list.
  function preview(routine, pace) {
    var pics = [];
    var seen = {};
    var blocks = routine.blocks.map(function (b) {
      return {
        name: b.name,
        rounds: b.rounds || 1,
        rest: b.restBetweenRounds || 0,
        steps: b.steps.map(function (s) {
          if (s.type === 'exercise' && !s.clip) {
            var cn = Routine.clipName(s.name);
            if (cn && !seen[cn]) {
              seen[cn] = true;
              pics.push({ name: s.name, webp: 'clips/' + cn + '.webp', mp4: 'clips/' + cn + '.mp4' });
            }
          }
          return { name: s.name, type: s.type, target: target(s) };
        })
      };
    });
    return {
      blocks: blocks,
      stepCount: Routine.expand(routine, pace).length,
      total: Routine.totalDuration(routine, pace),
      pictures: pics
    };
  }

  return {
    COLUMNS: COLUMNS,
    CHAT_PROMPT: CHAT_PROMPT,
    parseTable: parseTable,
    toRoutine: toRoutine,
    fileName: fileName,
    preview: preview
  };
});

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Routine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DEFAULT_SEC_PER_REP = 3;
  var TOP_KEYS = ['id', 'name', 'description', 'weight', 'defaults', 'blocks'];
  var DEFAULT_KEYS = ['secPerRep'];
  var BLOCK_KEYS = ['name', 'rounds', 'restBetweenRounds', 'steps'];
  var STEP_KEYS = ['name', 'type', 'reps', 'seconds', 'secPerRep', 'perSide', 'cues', 'clip'];

  var CLIP_EXTS = ['mp4', 'webm', 'svg', 'gif', 'webp', 'png', 'jpg', 'jpeg'];

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function posNum(v) { return typeof v === 'number' && isFinite(v) && v > 0; }
  function nonEmptyStr(v) { return typeof v === 'string' && v.trim().length > 0; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined; }

  function badClip(p) {
    if (!nonEmptyStr(p)) return 'expected non-empty relative path';
    if (/^[a-z][a-z0-9+.\-]*:/i.test(p)) return 'must not contain a URL scheme';
    if (p.indexOf('//') !== -1) return 'must not contain "//"';
    if (p.charAt(0) === '/' || p.charAt(0) === '\\') return 'must be relative';
    if (p.split(/[\/\\]/).indexOf('..') !== -1) return 'must not contain ".."';
    var ext = /\.([a-z0-9]+)$/i.exec(p.split(/[?#]/)[0]);
    if (!ext || CLIP_EXTS.indexOf(ext[1].toLowerCase()) === -1) return 'unsupported type';
    return null;
  }

  function validateRoutine(obj) {
    var errors = [];
    var warnings = [];
    function err(path, msg) { errors.push(path + ': ' + msg); }
    function unknown(o, keys, path) {
      Object.keys(o).forEach(function (k) {
        if (keys.indexOf(k) === -1) warnings.push((path ? path + '.' : '') + k + ': unknown field');
      });
    }

    if (!isObj(obj)) {
      return { ok: false, errors: ['routine: expected object'], warnings: warnings };
    }
    unknown(obj, TOP_KEYS, '');
    if (!nonEmptyStr(obj.name)) err('name', 'expected non-empty string');
    if (has(obj, 'id') && !nonEmptyStr(obj.id)) err('id', 'expected non-empty string');
    if (has(obj, 'defaults')) {
      if (!isObj(obj.defaults)) err('defaults', 'expected object');
      else {
        unknown(obj.defaults, DEFAULT_KEYS, 'defaults');
        if (has(obj.defaults, 'secPerRep') && !posNum(obj.defaults.secPerRep)) {
          err('defaults.secPerRep', 'expected number > 0');
        }
      }
    }

    if (!Array.isArray(obj.blocks) || obj.blocks.length === 0) {
      err('blocks', 'expected non-empty array');
    } else {
      obj.blocks.forEach(function (b, bi) {
        var bp = 'blocks[' + bi + ']';
        if (!isObj(b)) { err(bp, 'expected object'); return; }
        unknown(b, BLOCK_KEYS, bp);
        if (!nonEmptyStr(b.name)) err(bp + '.name', 'expected non-empty string');
        if (has(b, 'rounds') && !(isInt(b.rounds) && b.rounds >= 1)) err(bp + '.rounds', 'expected integer >= 1');
        if (has(b, 'restBetweenRounds') && !(isInt(b.restBetweenRounds) && b.restBetweenRounds >= 0)) {
          err(bp + '.restBetweenRounds', 'expected integer >= 0');
        }
        if (!Array.isArray(b.steps) || b.steps.length === 0) {
          err(bp + '.steps', 'expected non-empty array');
          return;
        }
        b.steps.forEach(function (s, si) {
          var sp = bp + '.steps[' + si + ']';
          if (!isObj(s)) { err(sp, 'expected object'); return; }
          unknown(s, STEP_KEYS, sp);
          if (!nonEmptyStr(s.name)) err(sp + '.name', 'expected non-empty string');
          if (s.type !== 'exercise' && s.type !== 'pause') err(sp + '.type', 'expected "exercise" or "pause"');
          var hasReps = has(s, 'reps');
          var hasSecs = has(s, 'seconds');
          if (hasReps && hasSecs) err(sp, 'expected exactly one of reps or seconds, got both');
          else if (!hasReps && !hasSecs) err(sp, 'expected exactly one of reps or seconds, got neither');
          if (hasReps && !(isInt(s.reps) && s.reps >= 1)) err(sp + '.reps', 'expected integer >= 1');
          if (hasSecs && !(isInt(s.seconds) && s.seconds >= 1)) err(sp + '.seconds', 'expected integer >= 1');
          if (s.type === 'pause' && hasReps) err(sp + '.reps', 'pause must use seconds');
          if (has(s, 'secPerRep') && !posNum(s.secPerRep)) err(sp + '.secPerRep', 'expected number > 0');
          if (has(s, 'perSide') && typeof s.perSide !== 'boolean') err(sp + '.perSide', 'expected boolean');
          if (has(s, 'cues')) {
            if (!Array.isArray(s.cues)) err(sp + '.cues', 'expected array');
            else if (s.type === 'exercise' && s.cues.length !== 3) err(sp + '.cues', 'expected 3');
            else {
              s.cues.forEach(function (c, ci) {
                if (!nonEmptyStr(c)) err(sp + '.cues[' + ci + ']', 'expected non-empty string');
                else if (c.length > 30) err(sp + '.cues[' + ci + ']', 'expected <= 30 chars, got ' + c.length);
              });
            }
          } else if (s.type === 'exercise') {
            err(sp + '.cues', 'expected 3');
          }
          if (has(s, 'clip')) {
            var why = badClip(s.clip);
            if (why) err(sp + '.clip', why);
          }
        });
      });
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function isSet(v) { return v !== undefined && v !== null; }

  // Precedence: pace exercise override > step secPerRep > pace secPerRep > routine default > 3.
  function stepDuration(step, defaults, pace) {
    var mult = step.perSide ? 2 : 1;
    if (step.reps !== undefined && step.reps !== null) {
      var spr = pace && pace.exercises && Object.prototype.hasOwnProperty.call(pace.exercises, step.name)
        ? pace.exercises[step.name] : undefined;
      if (!isSet(spr)) spr = step.secPerRep;
      if (!isSet(spr) && pace) spr = pace.secPerRep;
      if (!isSet(spr)) spr = defaults && defaults.secPerRep;
      if (!isSet(spr)) spr = DEFAULT_SEC_PER_REP;
      return step.reps * spr * mult;
    }
    return step.seconds * mult;
  }

  // Assumes a valid routine.
  function expand(routine, pace) {
    var out = [];
    var defaults = routine.defaults || {};
    routine.blocks.forEach(function (b) {
      var rounds = b.rounds === undefined ? 1 : b.rounds;
      var rest = b.restBetweenRounds || 0;
      for (var r = 1; r <= rounds; r++) {
        b.steps.forEach(function (s) {
          var f = {
            name: s.name,
            type: s.type,
            durationSec: stepDuration(s, defaults, pace),
            perSide: !!s.perSide,
            cues: s.cues ? s.cues.slice() : [],
            block: b.name,
            round: r,
            rounds: rounds
          };
          if (s.reps !== undefined) f.reps = s.reps;
          if (s.clip) f.clip = s.clip;
          out.push(f);
        });
        if (r < rounds && rest > 0) {
          out.push({
            name: 'Rest', type: 'pause', durationSec: rest, perSide: false,
            cues: [], block: b.name, round: r, rounds: rounds
          });
        }
      }
    });
    return out;
  }

  function totalDuration(routine, pace) {
    return expand(routine, pace).reduce(function (a, s) { return a + s.durationSec; }, 0);
  }

  return {
    DEFAULT_SEC_PER_REP: DEFAULT_SEC_PER_REP,
    validateRoutine: validateRoutine,
    stepDuration: stepDuration,
    expand: expand,
    totalDuration: totalDuration
  };
});

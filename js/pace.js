(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pace = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var GLOBAL_MIN = 1, GLOBAL_MAX = 6, GLOBAL_STEP = 0.5, GLOBAL_FROM_ROUTINE_UP = 3.5, GLOBAL_FROM_ROUTINE_DOWN = 2.5;
  var EX_MIN = 1, EX_MAX = 60;

  function num(v, min, max) { return typeof v === 'number' && isFinite(v) && v > 0 && v >= min && v <= max; }

  // pace = { secPerRep: number|null, exercises: { name: number } }; invalid values are dropped.
  function normalize(obj) {
    var out = { secPerRep: null, exercises: {} };
    if (!obj || typeof obj !== 'object') return out;
    if (num(obj.secPerRep, GLOBAL_MIN, GLOBAL_MAX)) out.secPerRep = obj.secPerRep;
    var ex = obj.exercises;
    if (ex && typeof ex === 'object' && !Array.isArray(ex)) {
      Object.keys(ex).forEach(function (k) {
        if (num(ex[k], EX_MIN, EX_MAX)) out.exercises[k] = ex[k];
      });
    }
    return out;
  }

  // kind: 'global' (value may be null = routine default) | 'exercise'. dir: +1 | -1.
  function stepValue(value, dir, kind) {
    var d = dir < 0 ? -1 : 1;
    if (kind === 'exercise') {
      var v = typeof value === 'number' && isFinite(value) ? value : EX_MIN;
      var r;
      if (d > 0) r = v < 10 ? v + 0.5 : Math.floor(v / 5) * 5 + 5;
      else r = v <= 10 ? v - 0.5 : Math.ceil(v / 5) * 5 - 5;
      return Math.min(EX_MAX, Math.max(EX_MIN, r));
    }
    if (value === null || value === undefined) return d > 0 ? GLOBAL_FROM_ROUTINE_UP : GLOBAL_FROM_ROUTINE_DOWN;
    return Math.min(GLOBAL_MAX, Math.max(GLOBAL_MIN, value + d * GLOBAL_STEP));
  }

  // Distinct exercise names with their own step secPerRep: [{ name, value }] sorted by name (value from first seen).
  function overridable(routines) {
    var seen = {};
    (routines || []).forEach(function (r) {
      ((r && r.blocks) || []).forEach(function (b) {
        ((b && b.steps) || []).forEach(function (s) {
          if (s && s.type === 'exercise' && typeof s.secPerRep === 'number' && s.secPerRep > 0 &&
              !Object.prototype.hasOwnProperty.call(seen, s.name)) seen[s.name] = s.secPerRep;
        });
      });
    });
    return Object.keys(seen).sort().map(function (n) { return { name: n, value: seen[n] }; });
  }

  return { normalize: normalize, stepValue: stepValue, overridable: overridable };
});

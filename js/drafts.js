(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Drafts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Owner drafts (SPEC 4b, D42): { routines: { "<file>": routineObj }, removed: ["<file>"] }. All pure.

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

  function empty() { return { routines: {}, removed: [] }; }

  function normalize(obj) {
    var out = empty();
    if (!isObj(obj)) return out;
    if (isObj(obj.routines)) {
      Object.keys(obj.routines).forEach(function (f) {
        if (f && isObj(obj.routines[f])) out.routines[f] = clone(obj.routines[f]);
      });
    }
    if (Array.isArray(obj.removed)) {
      obj.removed.forEach(function (f) {
        if (typeof f === 'string' && f && out.removed.indexOf(f) === -1) out.removed.push(f);
      });
    }
    return out;
  }

  // Returns { drafts, error }. Stores a copy of baseRoutine with only `name` changed (trimmed).
  function rename(drafts, file, baseRoutine, newName) {
    var d = normalize(drafts);
    var name = typeof newName === 'string' ? newName.trim() : '';
    if (!name) return { drafts: d, error: 'name: required' };
    if (!file || !isObj(baseRoutine)) return { drafts: d, error: 'routine: missing' };
    var r = clone(baseRoutine);
    r.name = name;
    d.routines[file] = r;
    return { drafts: d, error: null };
  }

  // Stores a draft-only (new) routine under `file` (T26). Returns the new drafts; input never mutated.
  function add(drafts, file, routine) {
    var d = normalize(drafts);
    if (file && isObj(routine)) {
      d.routines[file] = clone(routine);
      d.removed = d.removed.filter(function (f) { return f !== file; });
    }
    return d;
  }

  function remove(drafts, file) {
    var d = normalize(drafts);
    if (file && d.removed.indexOf(file) === -1) d.removed.push(file);
    return d;
  }

  function undo(drafts, file) {
    var d = normalize(drafts);
    delete d.routines[file];
    d.removed = d.removed.filter(function (f) { return f !== file; });
    return d;
  }

  function isEmpty(drafts) {
    var d = normalize(drafts);
    return Object.keys(d.routines).length === 0 && d.removed.length === 0;
  }

  // entries: [{ file, name, routine?, ok, ... }]. Draft routines replace loaded ones; removed are flagged;
  // draft-only files are appended. Inputs are never mutated.
  function apply(entries, drafts) {
    var d = normalize(drafts);
    var seen = {};
    var out = (entries || []).map(function (e) {
      var o = Object.assign({}, e);
      seen[e.file] = true;
      if (has(d.routines, e.file)) {
        var r = clone(d.routines[e.file]);
        o.routine = r; o.name = r.name; o.ok = true; o.error = undefined; o.unpublished = true;
      }
      if (d.removed.indexOf(e.file) !== -1) { o.removed = true; o.unpublished = true; }
      return o;
    });
    Object.keys(d.routines).forEach(function (f) {
      if (seen[f]) return;
      var r = clone(d.routines[f]);
      out.push({ file: f, name: r.name, routine: r, ok: true, unpublished: true });
    });
    return out;
  }

  return { normalize: normalize, rename: rename, add: add, remove: remove, undo: undo, apply: apply, isEmpty: isEmpty };
});

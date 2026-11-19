(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Keys = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var SELECT = { 'Enter': 1, 'NumpadEnter': 1, ' ': 1, 'Space': 1, 'Spacebar': 1, 'MediaPlayPause': 1 };
  var NEXT = { 'ArrowRight': 1, 'MediaTrackNext': 1 };
  var PREV = { 'ArrowLeft': 1, 'MediaTrackPrevious': 1 };

  // Pure mapping: key (KeyboardEvent.key or .code) + screen -> action or null.
  // Actions: start | toggle | skip | back | up | down. There is no exit/menu action.
  function mapKey(key, screen) {
    if (typeof key !== 'string') return null;
    if (screen === 'picker') {
      if (SELECT[key]) return 'start';
      if (NEXT[key] || key === 'ArrowDown') return 'down';
      if (PREV[key] || key === 'ArrowUp') return 'up';
      return null;
    }
    if (screen === 'run') {
      if (SELECT[key]) return 'toggle';
      if (NEXT[key]) return 'skip';
      if (PREV[key]) return 'back';
      return null;
    }
    if (screen === 'done') {
      // Activates the single "Back to routines" button.
      if (SELECT[key]) return 'start';
      return null;
    }
    return null;
  }

  return { mapKey: mapKey };
});

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AppInfo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return { name: 'Kettlebell TV Timer', version: 'v7' };
});

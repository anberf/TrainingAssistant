(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OwnerConfig = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return { pinHash: '' };
});

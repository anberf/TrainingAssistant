'use strict';
// Owner runs this locally: node tools/set-pin.js
// Asks for the PIN twice on stdin, writes only its salted hash to js/owner-config.js.
const fs = require('node:fs');
const path = require('node:path');
const Owner = require('../js/owner.js');

const CONFIG_PATH = path.join(__dirname, '..', 'js', 'owner-config.js');

function validPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4,12}$/.test(pin);
}

function configText(hash) {
  return [
    '(function (root, factory) {',
    "  if (typeof module === 'object' && module.exports) module.exports = factory();",
    '  else root.OwnerConfig = factory();',
    "})(typeof self !== 'undefined' ? self : this, function () {",
    '  return { pinHash: ' + JSON.stringify(String(hash)) + ' };',
    '});',
    ''
  ].join('\n');
}

async function main() {
  const readline = require('node:readline');
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const lines = [];
  let waiting = null;
  let closed = false;
  rl.on('line', (l) => { if (waiting) { const w = waiting; waiting = null; w(l); } else lines.push(l); });
  rl.on('close', () => { closed = true; if (waiting) { const w = waiting; waiting = null; w(null); } });
  const ask = (q) => new Promise((resolve) => {
    process.stdout.write(q);
    if (lines.length) resolve(lines.shift());
    else if (closed) resolve(null);
    else waiting = resolve;
  });
  const a = await ask('New PIN (4-12 digits): ');
  const b = await ask('Repeat PIN: ');
  rl.close();
  if (a === null || b === null) { console.error('\nNo input.'); process.exit(1); }
  if (!validPin(a)) { console.error('PIN must be 4-12 digits.'); process.exit(1); }
  if (a !== b) { console.error('PINs do not match.'); process.exit(1); }
  fs.writeFileSync(CONFIG_PATH, configText(Owner.hashPin(a)));
  console.log('Wrote js/owner-config.js (hash only; the PIN is not stored).');
  console.log('Next: git add js/owner-config.js && git commit -m "Set owner PIN" && git push');
  console.log('Devices unlocked with an older PIN lock again on their next open.');
}

module.exports = { validPin, configText };
if (require.main === module) main();

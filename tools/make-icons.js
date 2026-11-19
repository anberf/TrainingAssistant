'use strict';
// Dev-only: generates icons/*.png locally (no deps). Run: node tools/make-icons.js
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// Kettlebell glyph (handle ring + body circle) on a dark background. `scale` sizes the glyph.
function png(size, scale) {
  const bg = [10, 10, 10], fg = [255, 140, 0];
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  const cx = size / 2, R = size * scale * 0.5;
  const bodyC = [cx, cx + R * 0.18], bodyR = R * 0.38;
  const handleC = [cx, cx - R * 0.18], handleO = R * 0.30, handleI = R * 0.18;
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const inBody = Math.hypot(x - bodyC[0], y - bodyC[1]) <= bodyR;
      const d = Math.hypot(x - handleC[0], y - handleC[1]);
      const inHandle = d <= handleO && d >= handleI && y <= handleC[1] + handleO * 0.5;
      const c = inBody || inHandle ? fg : bg;
      const o = y * stride + 1 + x * 3;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), png(192, 1.6));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512, 1.6));
// maskable: glyph kept inside the central safe zone
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), png(512, 1.2));

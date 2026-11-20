'use strict';
// Generates clips/*.svg: original SMIL-animated stick figures (D32). Run: node tools/make-clips.js
const fs = require('node:fs');
const path = require('node:path');

// Pose: n=neck, p=hip, a/b=[elbow,hand] arms, l/m=[knee,foot] legs, k=[x,y] kettlebell centre (optional).
const stand = (extra) => Object.assign({
  n: [100, 66], p: [100, 112],
  a: [[100, 90], [100, 114]], b: [[96, 90], [96, 112]],
  l: [[98, 146], [96, 180]], m: [[102, 146], [106, 180]],
}, extra);
const lying = (extra) => Object.assign({
  n: [55, 172], p: [100, 172],
  l: [[135, 172], [170, 172]], m: [[135, 172], [170, 172]],
  a: [[35, 172], [15, 172]], b: [[35, 172], [15, 172]],
}, extra);

const CLIPS = {
  'two-hand-swing': { dur: 2, poses: [
    { n: [120, 92], p: [75, 118], a: [[116, 116], [104, 140]], b: [[112, 116], [100, 140]],
      l: [[92, 150], [86, 180]], m: [[96, 150], [92, 180]], k: [96, 150] },
    stand({ a: [[125, 68], [150, 70]], b: [[125, 72], [150, 74]], k: [160, 72] }),
  ] },
  'goblet-squat': { dur: 2.5, poses: [
    stand({ a: [[108, 92], [118, 80]], b: [[108, 94], [118, 82]], k: [123, 82] }),
    { n: [100, 104], p: [88, 150], a: [[115, 130], [126, 112]], b: [[115, 132], [126, 114]],
      l: [[122, 148], [100, 180]], m: [[124, 148], [106, 180]], k: [130, 110] },
  ] },
  'halo': { dur: 3, poses: [
    stand({ a: [[115, 85], [122, 64]], b: [[115, 87], [122, 66]], k: [128, 60] }),
    stand({ a: [[108, 46], [104, 22]], b: [[108, 48], [104, 24]], k: [104, 14] }),
    stand({ a: [[84, 84], [78, 62]], b: [[84, 86], [78, 64]], k: [72, 60] }),
    stand({ a: [[108, 46], [104, 22]], b: [[108, 48], [104, 24]], k: [104, 14] }),
  ] },
  'deadlift': { dur: 2.5, poses: [
    stand({ a: [[102, 92], [104, 116]], b: [[102, 92], [104, 116]], k: [104, 128] }),
    { n: [122, 90], p: [78, 116], a: [[122, 115], [118, 140]], b: [[122, 115], [118, 140]],
      l: [[92, 148], [100, 180]], m: [[96, 148], [104, 180]], k: [118, 152] },
  ] },
  'goblet-reverse-lunge': { dur: 3, poses: [
    stand({ a: [[108, 92], [118, 80]], b: [[108, 94], [118, 82]], k: [123, 82] }),
    { n: [100, 84], p: [100, 130], a: [[110, 106], [120, 92]], b: [[110, 108], [120, 94]],
      l: [[132, 142], [128, 180]], m: [[82, 162], [52, 178]], k: [125, 92] },
  ] },
  'single-arm-row': { dur: 2.5, poses: [
    { n: [125, 92], p: [70, 116], a: [[132, 116], [132, 142]], b: [[112, 112], [96, 134]],
      l: [[92, 146], [96, 180]], m: [[96, 148], [104, 180]], k: [132, 152] },
    { n: [125, 92], p: [70, 116], a: [[104, 102], [112, 118]], b: [[112, 112], [96, 134]],
      l: [[92, 146], [96, 180]], m: [[96, 148], [104, 180]], k: [112, 128] },
  ] },
  'single-arm-overhead-press': { dur: 2.5, poses: [
    stand({ a: [[106, 92], [112, 72]], k: [114, 64] }),
    stand({ a: [[106, 44], [104, 20]], k: [104, 10] }),
  ] },
  'turkish-get-up': { dur: 4, poses: [
    lying({ l: [[135, 148], [168, 170]], a: [[62, 143], [62, 118]], b: [[82, 172], [100, 174]], k: [62, 108] }),
    { n: [78, 128], p: [95, 172], a: [[80, 104], [80, 80]], b: [[72, 152], [66, 174]],
      l: [[120, 145], [135, 172]], m: [[125, 172], [155, 172]], k: [80, 70] },
    { n: [115, 66], p: [115, 112], a: [[120, 42], [118, 18]], b: [[115, 90], [115, 112]],
      l: [[115, 146], [115, 180]], m: [[118, 146], [124, 180]], k: [118, 8] },
  ] },
  'suitcase-march': { dur: 2, poses: [
    stand({ a: [[100, 90], [100, 114]], l: [[125, 110], [125, 146]], k: [100, 126] }),
    stand({ a: [[100, 90], [100, 114]], m: [[125, 110], [125, 146]], k: [100, 126] }),
  ] },
  'dead-bug': { dur: 3, poses: (() => {
    const tab = [[100, 134], [136, 134]];
    const up = [[55, 145], [55, 120]];
    const over = [[32, 160], [10, 155]];
    const ext = [[132, 160], [166, 168]];
    return [
      lying({ a: over, b: up, l: tab, m: ext }),
      lying({ a: up, b: up, l: tab, m: tab }),
      lying({ a: up, b: over, l: ext, m: tab }),
      lying({ a: up, b: up, l: tab, m: tab }),
    ];
  })() },
  'hollow-hold': { dur: 2.5, poses: [
    lying({}),
    lying({ n: [66, 150], l: [[134, 160], [168, 148]], m: [[134, 162], [168, 152]],
      a: [[48, 138], [30, 126]], b: [[48, 140], [30, 128]] }),
  ] },
  'plank-pull-through': { dur: 3, poses: [
    { n: [125, 118], p: [80, 142], a: [[146, 142], [162, 166]], b: [[127, 150], [128, 176]],
      l: [[55, 159], [30, 176]], m: [[55, 159], [30, 176]], k: [162, 168] },
    { n: [125, 118], p: [80, 142], a: [[110, 150], [95, 168]], b: [[127, 150], [128, 176]],
      l: [[55, 159], [30, 176]], m: [[55, 159], [30, 176]], k: [92, 168] },
  ] },
  'russian-twist': { dur: 3, poses: (() => {
    const base = { n: [78, 118], p: [100, 160], l: [[132, 136], [158, 158]], m: [[134, 138], [160, 160]] };
    const mid = Object.assign({ a: [[94, 130], [112, 138]], b: [[94, 132], [112, 140]], k: [116, 144] }, base);
    return [
      Object.assign({ a: [[100, 124], [122, 136]], b: [[100, 126], [122, 138]], k: [130, 142] }, base),
      mid,
      Object.assign({ a: [[64, 138], [80, 152]], b: [[64, 140], [80, 154]], k: [86, 160] }, base),
      mid,
    ];
  })() },
  'leg-hip-stretch': { dur: 4, poses: (() => {
    const hug = (side) => {
      const o = { a: [[80, 160], [110, 144]], b: [[80, 162], [110, 146]] };
      o[side] = [[116, 138], [148, 152]];
      return lying(o);
    };
    return [lying({}), hug('l'), lying({}), hug('m')];
  })() },
};

const f = (v) => String(Math.round(v * 10) / 10);
const pts = (a) => a.map((q) => f(q[0]) + ',' + f(q[1])).join(' ');
const limb = (key, pose) => (key === 'a' || key === 'b')
  ? [pose.n, pose[key][0], pose[key][1]]
  : [pose.p, pose[key][0], pose[key][1]];
const head = (pose) => {
  const dx = pose.n[0] - pose.p[0], dy = pose.n[1] - pose.p[1], d = Math.hypot(dx, dy);
  return [pose.n[0] + dx / d * 14, pose.n[1] + dy / d * 14];
};
const loop = (arr) => arr.concat([arr[0]]);

function build(def) {
  const P = def.poses, d = def.dur + 's';
  const anim = (attr, vals) =>
    '<animate attributeName="' + attr + '" dur="' + d + '" repeatCount="indefinite" values="' + loop(vals).join(';') + '"/>';
  const stroke = 'fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';
  let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n';
  out += '<line x1="10" y1="180" x2="190" y2="180" stroke="#b0b0b0" stroke-width="3" stroke-linecap="round"/>\n';
  const poly = (key, get) => '<polyline ' + stroke + ' points="' + pts(get(P[0])) + '">' +
    anim('points', P.map((q) => pts(get(q)))) + '</polyline>\n';
  for (const key of ['m', 'b']) out += poly(key, (q) => limb(key, q));
  out += poly('s', (q) => [q.n, q.p]);
  for (const key of ['l', 'a']) out += poly(key, (q) => limb(key, q));
  const h0 = head(P[0]);
  out += '<circle ' + stroke + ' r="11" cx="' + f(h0[0]) + '" cy="' + f(h0[1]) + '">' +
    anim('cx', P.map((q) => f(head(q)[0]))) + anim('cy', P.map((q) => f(head(q)[1]))) + '</circle>\n';
  if (P.every((q) => q.k)) {
    out += '<g transform="translate(' + P[0].k[0] + ' ' + P[0].k[1] + ')">' +
      '<path d="M-6-6C-6-18 6-18 6-6" fill="none" stroke="#ffb300" stroke-width="4" stroke-linecap="round"/>' +
      '<circle r="9" fill="#ffb300"/>' +
      '<animateTransform attributeName="transform" type="translate" dur="' + d +
      '" repeatCount="indefinite" values="' + loop(P.map((q) => q.k.join(' '))).join(';') + '"/>' +
      '</g>\n';
  }
  return out + '</svg>\n';
}

const dir = path.join(__dirname, '..', 'clips');
fs.mkdirSync(dir, { recursive: true });
for (const [name, def] of Object.entries(CLIPS)) {
  fs.writeFileSync(path.join(dir, name + '.svg'), build(def));
}
console.log('wrote ' + Object.keys(CLIPS).length + ' clips');

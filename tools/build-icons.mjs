// Builds the site's app icons (an 8-ball on the brand green) with no image libraries:
//   public/favicon.ico, public/icons/apple-touch-icon.png, public/icons/icon-192.png, public/icons/icon-512.png
// Run: node tools/build-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../src/png.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GREEN = [20, 75, 46], BLACK = [16, 16, 16], WHITE = [255, 255, 255];

// Coverage-based shapes, 4x4 supersampled so edges stay smooth at every size.
function render(size) {
  const px = Buffer.alloc(size * size * 3);
  const c = size / 2;
  const R = size * 0.42;                  // the ball
  const r = size * 0.21;                  // white spot
  const ring = (cx, cy, ro, ri) => (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= ro && d >= ri; };
  const top = ring(c, c - r * 0.42, r * 0.38, r * 0.17), bottom = ring(c, c + r * 0.38, r * 0.46, r * 0.22);
  const S = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const X = x + (sx + 0.5) / S, Y = y + (sy + 0.5) / S, d = Math.hypot(X - c, Y - c);
      let col = GREEN;
      if (d <= R) col = BLACK;
      if (d <= R && Math.hypot(X - (c - R * 0.38), Y - (c - R * 0.42)) < R * 0.12) col = [70, 70, 70];   // shine
      if (d <= r) col = (top(X, Y) || bottom(X, Y)) ? BLACK : WHITE;
      acc = acc.map((v, i) => v + col[i]);
    }
    const o = (y * size + x) * 3;
    px[o] = Math.round(acc[0] / (S * S)); px[o + 1] = Math.round(acc[1] / (S * S)); px[o + 2] = Math.round(acc[2] / (S * S));
  }
  return encodePng({ width: size, height: size, pixels: px });
}

// An .ico file is a small directory followed by the images; modern browsers accept PNG images inside it.
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head[e] = size >= 256 ? 0 : size; head[e + 1] = size >= 256 ? 0 : size; head[e + 2] = 0; head[e + 3] = 0;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map(p => p.data)]);
}

fs.mkdirSync(path.join(ROOT, 'public/icons'), { recursive: true });
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(ROOT, 'public/icons', name), render(size));
}
fs.writeFileSync(path.join(ROOT, 'public/favicon.ico'), ico([16, 32, 48].map(size => ({ size, data: render(size) }))));
console.log('icons written');

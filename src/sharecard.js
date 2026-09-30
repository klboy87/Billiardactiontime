// Tournament share cards: a designed, branded graphic for every tournament, drawn on the
// server with no npm packages. Fonts and emoji are pre-rendered by tools/build-card-assets.py.
//   landscape 1200x630  -> link previews on Facebook, X, iMessage, etc. (og:image)
//   square    1080x1080 -> Facebook / Instagram posts
//   story     1080x1920 -> TikTok, Reels, Stories
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
let ASSETS = null;
function assets() {
  if (!ASSETS) {
    ASSETS = JSON.parse(fs.readFileSync(path.join(DIR, 'card-assets.json'), 'utf8'));
    ASSETS.blob = zlib.inflateSync(fs.readFileSync(path.join(DIR, 'card-assets.bin')));
  }
  return ASSETS;
}

// ---------- canvas + drawing primitives (RGB, alpha-blended) ----------
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function canvas(w, h) { return { width: w, height: h, pixels: Buffer.alloc(w * h * 3) }; }
function blend(c, x, y, [r, g, b], a) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height || a <= 0) return;
  const i = (y * c.width + x) * 3, p = c.pixels;
  r = r > 255 ? 255 : r < 0 ? 0 : r; g = g > 255 ? 255 : g < 0 ? 0 : g; b = b > 255 ? 255 : b < 0 ? 0 : b;
  if (a >= 1) { p[i] = r; p[i + 1] = g; p[i + 2] = b; return; }
  p[i] = p[i] + (r - p[i]) * a; p[i + 1] = p[i + 1] + (g - p[i + 1]) * a; p[i + 2] = p[i + 2] + (b - p[i + 2]) * a;
}
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// felt-table background: radial glow + vignette + a little cloth grain
function background(c, glowX, glowY) {
  const inner = hex('#1a7a48'), mid = hex('#0d4a2c'), outer = hex('#041a10');
  const maxd = Math.hypot(c.width, c.height) * 0.75;
  let seed = 7;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const d = Math.hypot(x - glowX, y - glowY) / maxd;
    const col = d < 0.45 ? mix(inner, mid, d / 0.45) : mix(mid, outer, clamp01((d - 0.45) / 0.55));
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const n = ((seed >> 16) % 3) - 1;   // faint cloth grain
    const i = (y * c.width + x) * 3;
    c.pixels[i] = Math.max(0, Math.min(255, col[0] + n)); c.pixels[i + 1] = Math.max(0, Math.min(255, col[1] + n)); c.pixels[i + 2] = Math.max(0, Math.min(255, col[2] + n));
  }
}
function roundRect(c, x, y, w, h, r, color, alpha = 1) {
  for (let yy = Math.floor(y) - 1; yy <= y + h + 1; yy++) for (let xx = Math.floor(x) - 1; xx <= x + w + 1; xx++) {
    const px = xx + 0.5, py = yy + 0.5;
    const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r), qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    blend(c, xx, yy, color, clamp01(0.5 - d) * alpha);
  }
}
function polygon(c, pts, color, alpha = 1) {       // 4x4 supersampled fill
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
    let hit = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const px = x + (sx + 0.5) / 4, py = y + (sy + 0.5) / 4;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) hit++;
    }
    if (hit) blend(c, x, y, color, (hit / 16) * alpha);
  }
}
function arrow(c, x, y, size, color) {             // "→" at (x, middle y)
  const t = size * 0.13, head = size * 0.42;
  polygon(c, [[x, y - t / 2], [x + size - head * 0.7, y - t / 2], [x + size - head * 0.7, y - head / 2], [x + size, y],
    [x + size - head * 0.7, y + head / 2], [x + size - head * 0.7, y + t / 2], [x, y + t / 2]], color);
}

// ---------- text ----------
function font(weight, size) {
  const f = assets().fonts[weight];
  const sizes = Object.keys(f).map(Number).sort((a, b) => a - b);
  const s = sizes.reduce((best, v) => (v <= size ? v : best), sizes[0]);
  return { ...f[String(s)], size: s, weight };
}
function measure(fnt, str, tracking = 0) {
  let w = 0;
  for (const ch of str) { const g = fnt.glyphs[ch] || fnt.glyphs['?']; w += g[0] + tracking; }
  return Math.max(0, w - tracking);
}
function text(c, fnt, str, x, y, color, { tracking = 0, alpha = 1 } = {}) {   // y = top of the line box
  const blob = assets().blob;
  let pen = x;
  for (const ch of str) {
    const g = fnt.glyphs[ch] || fnt.glyphs['?'];
    const [adv, gx, gy, w, h, off] = g;
    const ox = Math.round(pen + gx), oy = Math.round(y + gy);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const a = blob[off + j * w + i];
      if (a) blend(c, ox + i, oy + j, color, (a / 255) * alpha);
    }
    pen += adv + tracking;
  }
  return pen;
}
// the biggest size (from the list) at which `str` fits on `maxLines` lines of `maxW`
function fit(weight, str, maxW, sizes, maxLines = 1, tracking = 0) {
  for (const size of sizes) {
    const f = font(weight, size);
    const lines = wrap(f, str, maxW, maxLines, tracking);
    if (lines && lines.every(l => measure(f, l, tracking) <= maxW)) return { f, lines };
  }
  const f = font(weight, sizes[sizes.length - 1]);
  return { f, lines: wrap(f, str, maxW, maxLines, tracking, true) };
}
function wrap(f, str, maxW, maxLines, tracking, force = false) {
  const words = String(str).split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(f, t, tracking) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  if (!force) return null;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] + '…';
  while (measure(f, last, tracking) > maxW && last.length > 2) last = last.slice(0, -2) + '…';
  kept[maxLines - 1] = last;
  return kept;
}
function emoji(c, key, x, y, size) {                // bilinear-scaled color emoji
  const a = assets(), [w, h, off] = a.emoji[key], blob = a.blob;
  const scale = size / Math.max(w, h), dw = Math.round(w * scale), dh = Math.round(h * scale);
  for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) {
    const sx = Math.min(w - 1.001, (i + 0.5) / scale - 0.5), sy = Math.min(h - 1.001, (j + 0.5) / scale - 0.5);
    const x0 = Math.max(0, Math.floor(sx)), y0 = Math.max(0, Math.floor(sy)), fx = sx - x0, fy = sy - y0;
    const px = (xx, yy) => off + (yy * w + xx) * 4;
    const acc = [0, 0, 0, 0];
    for (const [xx, yy, wt] of [[x0, y0, (1 - fx) * (1 - fy)], [x0 + 1, y0, fx * (1 - fy)], [x0, y0 + 1, (1 - fx) * fy], [x0 + 1, y0 + 1, fx * fy]]) {
      const k = px(Math.min(w - 1, xx), Math.min(h - 1, yy)), al = blob[k + 3] / 255 * wt;
      acc[0] += blob[k] * al; acc[1] += blob[k + 1] * al; acc[2] += blob[k + 2] * al; acc[3] += al;
    }
    if (acc[3] > 0.01) blend(c, Math.round(x + i + (size - dw) / 2), Math.round(y + j + (size - dh) / 2), [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]], acc[3]);
  }
}

function calendar(c, x, y, size, iso) {
  const [, m, d] = String(iso).split('-').map(Number);
  const r = size * 0.16, top = size * 0.34;
  roundRect(c, x + size * 0.02, y + size * 0.05, size * 0.96, size * 0.92, r, [0, 0, 0], 0.35);
  roundRect(c, x, y, size * 0.96, size * 0.92, r, [250, 250, 248]);
  roundRect(c, x, y, size * 0.96, top + r, r, hex('#d93b3f'));
  roundRect(c, x, y + top, size * 0.96, r, 0, [250, 250, 248]);
  const mf = font('black', size * 0.22), mon = MONTHS[m - 1].slice(0, 3);
  text(c, mf, mon, x + (size * 0.96 - measure(mf, mon, 1)) / 2, y + size * 0.035, [255, 255, 255], { tracking: 1 });
  const df = font('black', size * 0.46), day = String(d);
  text(c, df, day, x + (size * 0.96 - measure(df, day)) / 2, y + top + size * 0.02, [30, 30, 30]);
}

// ---------- the pool ball ----------
const BALLS = {
  '9-Ball': [9, '#e8b020', true], '8-Ball': [8, '#151515', false], '10-Ball': [10, '#1f5fd1', true], 'One Pocket': [1, '#f0c419', false],
  Banks: [6, '#1e8a3d', false], 'Straight Pool': [15, '#7a1f1f', true], 'Scotch Doubles': [3, '#d63a40', false]
};
function ball(c, cx, cy, r, game) {
  const [num, colHex, stripe] = BALLS[game] || [8, '#151515', false];
  const col = hex(colHex), white = [246, 244, 238];
  // soft shadow on the felt
  for (let y = Math.floor(cy + r * 0.6); y < cy + r * 1.35; y++) for (let x = Math.floor(cx - r * 1.1); x < cx + r * 1.3; x++) {
    const d = Math.hypot((x - cx - r * 0.15) / (r * 1.05), (y - cy - r * 0.95) / (r * 0.28));
    if (d < 1) blend(c, x, y, [0, 0, 0], (1 - d) * 0.45);
  }
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    const cover = clamp01(r - d + 0.5);
    if (!cover) continue;
    let base = stripe && Math.abs(dy) > r * 0.52 ? white : col;
    const lx = dx + r * 0.38, ly = dy + r * 0.42;                       // light from the upper left
    const shade = 1 - 0.55 * clamp01(Math.hypot(lx, ly) / (r * 1.55)) ** 1.6;
    base = base.map(v => v * (0.45 + 0.6 * shade));
    blend(c, x, y, base, cover);
  }
  // number circle + number
  const nr = r * 0.44;
  for (let y = Math.floor(cy - nr - 1); y <= cy + nr + 1; y++) for (let x = Math.floor(cx - nr - 1); x <= cx + nr + 1; x++)
    blend(c, x, y, [250, 249, 245], clamp01(nr - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
  const f = font('black', nr * 1.05), s = String(num);
  const tw = measure(f, s), th = f.ascent * 0.72;
  text(c, f, s, cx - tw / 2, cy - th / 2 - f.ascent * 0.2, [20, 20, 20]);
  // glossy highlight
  for (let y = Math.floor(cy - r); y < cy; y++) for (let x = Math.floor(cx - r); x < cx; x++) {
    const d = Math.hypot((x - (cx - r * 0.42)) / (r * 0.3), (y - (cy - r * 0.5)) / (r * 0.18));
    if (d < 1) blend(c, x, y, [255, 255, 255], (1 - d) ** 1.5 * 0.55);
  }
}

// ---------- the card ----------
const GOLD = hex('#f3c34a'), WHITE = [255, 255, 255], SOFT = hex('#cfe3d6'), INK = hex('#0b1a12');
const money = n => '$' + Number(n).toLocaleString('en-US');
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function when(t) {
  const [y, m, d] = String(t.date).split('-').map(Number);
  const dow = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  let s = `${dow}, ${MONTHS[m - 1]} ${d}`;
  if (t.time) { const [h, mi] = t.time.split(':').map(Number); s += ` · ${((h + 11) % 12) + 1}${mi ? ':' + String(mi).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; }
  return s;
}
const clean = s => String(s || '').replace(/[^\x20-\x7E’‘“”–—•…·éèáñ×]/g, '').replace(/\s+/g, ' ').trim();

// What goes on the card, from the tournament's data.
export function cardContent(t) {
  const game = t.game && t.game !== 'Other' ? t.game : '';
  const v = t.venue || {};
  const name = clean(t.name) || 'Pool Tournament';
  const headline = t.added ? `${money(t.added)} ADDED${game ? ' ' + game.toUpperCase() : ''}` : name.toUpperCase();
  // the room's name is already on the location row, so the subtitle is the event name or the game
  const mentionsGame = game && (name.toLowerCase().includes(game.toLowerCase()) || name.toLowerCase().includes(game.toLowerCase().replace('-', ' ')));
  const sub = t.added ? name : game && !mentionsGame ? `${game} tournament` : '';
  const rows = [['date', when(t), null, t.date], ['pin', `${clean(v.city).toUpperCase()}${v.state ? ', ' + v.state : ''}`, clean(v.name)]];
  if (t.entry != null) rows.push(['money', `${money(t.entry)} ENTRY`]);
  if (t.limit) rows.push(['trophy', `${t.limit} PLAYER MAX`]);
  else if (t.race) rows.push(['target', clean(t.race).toUpperCase()]);
  else if (t.format) rows.push(['trophy', clean(t.format).toUpperCase()]);
  return { headline, sub, rows: rows.slice(0, 4), game: t.game };
}

const LAYOUTS = {
  landscape: { w: 1200, h: 630, pad: 56, glow: [260, 140], ball: [1060, 200, 112], textW: 860, brand: 22, head: [84, 76, 68, 60, 52, 46], headLines: 2, subSize: 28, row: 32, rowGap: 68, icon: 46, cta: 26, grid: 2, colW: 520 },
  square: { w: 1080, h: 1080, pad: 72, glow: [300, 220], ball: [900, 220, 118], textW: 936, brand: 26, head: [104, 92, 82, 72, 64, 56], headLines: 2, subSize: 38, row: 48, rowGap: 88, icon: 60, cta: 38 },
  story: { w: 1080, h: 1920, pad: 80, glow: [540, 420], ball: [540, 420, 200], textW: 920, brand: 32, head: [124, 108, 94, 82, 72, 62], headLines: 3, subSize: 42, row: 54, rowGap: 104, icon: 68, cta: 46, centered: true }
};

export function renderShareCard(t, format = 'landscape', siteHost = 'billiardactiontime.com') {
  const L = LAYOUTS[format] || LAYOUTS.landscape;
  const c = canvas(L.w, L.h);
  background(c, ...L.glow);
  const k = cardContent(t);
  const P = L.pad;

  // gold rail along the top
  roundRect(c, 0, 0, L.w, 8, 0, GOLD);
  ball(c, L.ball[0], L.ball[1], L.ball[2], k.game);

  const center = s => (L.centered ? (L.w - s) / 2 : P);
  let y = L.centered ? L.ball[1] + L.ball[2] + 110 : P - 6;

  // brand line
  const bf = font('black', L.brand), brand = 'BILLIARD ACTION TIME', bt = 4;
  const bw = L.brand * 1.25 + 12 + measure(bf, brand, bt);
  if (!L.centered) { emoji(c, 'ball', P, y, L.brand * 1.25); text(c, bf, brand, P + L.brand * 1.25 + 12, y + 1, GOLD, { tracking: bt }); }
  else { const bx = center(bw); emoji(c, 'ball', bx, y - L.brand * 0.1, L.brand * 1.25); text(c, bf, brand, bx + L.brand * 1.25 + 12, y, GOLD, { tracking: bt }); }
  y += L.brand * 2.1;

  // headline
  const maxW = L.centered ? L.textW : L.textW - (format === 'square' ? 0 : 0);
  const headW = format === 'square' ? Math.min(maxW, L.ball[0] - L.ball[2] - P - 20) : maxW;
  const hFit = fit('black', k.headline, headW, L.head, L.headLines);
  // square: headline may run full width once it is below the ball
  for (const line of hFit.lines) {
    const lw = measure(hFit.f, line);
    text(c, hFit.f, line, center(lw), y, WHITE);
    y += hFit.f.size * 1.08;
  }
  if (k.sub) {
    const sFit = fit('medium', k.sub, L.centered ? L.textW : L.textW, [L.subSize, L.subSize - 4, L.subSize - 8], 1);
    y += L.subSize * 0.1;
    text(c, sFit.f, sFit.lines[0], center(measure(sFit.f, sFit.lines[0])), y, SOFT);
    y += L.subSize * 1.6;
  } else y += L.subSize * 0.6;

  // divider
  if (L.centered) roundRect(c, (L.w - 120) / 2, y, 120, 6, 3, GOLD); else roundRect(c, P, y, 90, 6, 3, GOLD);
  y += L.row * 0.9;

  // info rows
  const vf = font('medium', L.row * 0.62);
  const ctaTop = L.h - P - L.cta * 2.1 - (L.centered ? 60 : 0);
  const cols = L.grid || 1, colW = L.colW || L.textW;
  const rowsTop = y;
  k.rows.forEach(([icon, main, extra, iso], idx) => {
    const col = idx % cols, rowY = rowsTop + Math.floor(idx / cols) * L.rowGap + (cols === 1 ? 0 : 0);
    const yy = cols === 1 ? y : rowY;
    const need = L.icon + (extra && cols === 1 ? vf.size * 1.3 : 0);
    if (yy + need > ctaTop - 24) return;
    const avail = (cols === 1 ? L.textW : colW) - L.icon - 20 - 12;
    const mFit = fit('black', main, avail, [L.row, L.row - 4, L.row - 8, L.row - 12], 1);
    const mw = measure(mFit.f, mFit.lines[0]);
    const x0 = L.centered ? (L.w - (L.icon + 20 + mw)) / 2 : P + col * colW;
    const iy = yy + (mFit.f.size * 1.25 - L.icon) / 2 + (extra && cols > 1 ? -vf.size * 0.1 : 0);
    if (icon === 'date' && iso) calendar(c, x0, iy, L.icon, iso); else emoji(c, icon, x0, iy, L.icon);
    text(c, mFit.f, mFit.lines[0], x0 + L.icon + 20, yy + (extra && cols > 1 ? -vf.size * 0.35 : 0), WHITE);
    if (extra) {
      const eFit = wrap(vf, extra, avail, 1, 0, true);
      const ew = measure(vf, eFit[0]);
      const ey = yy + mFit.f.size * (cols > 1 ? 1.05 : 1.2) + (cols > 1 ? -vf.size * 0.35 : 0);
      text(c, vf, eFit[0], L.centered ? (L.w - ew) / 2 : x0 + L.icon + 20, ey, SOFT);
      if (cols === 1) y += vf.size * 1.25;
    }
    if (cols === 1) y += L.rowGap;
  });

  // call to action + address
  const cf = font('black', L.cta), label = 'VIEW EVENT';
  const lw = measure(cf, label, 1), aw = L.cta * 1.1, pw = lw + aw + L.cta * 1.9, ph = L.cta * 2.1;
  const px = L.centered ? (L.w - pw) / 2 : P, py = ctaTop;
  roundRect(c, px, py, pw, ph, ph / 2, GOLD);
  text(c, cf, label, px + L.cta * 0.95, py + (ph - cf.ascent * 1.08) / 2 + 2, INK, { tracking: 1 });
  arrow(c, px + L.cta * 0.95 + lw + L.cta * 0.4, py + ph / 2, aw, INK);
  const uf = font('medium', L.cta * 0.95), host = siteHost;
  const uw = measure(uf, host);
  if (L.centered) text(c, uf, host, (L.w - uw) / 2, py + ph + 26, SOFT);
  else text(c, uf, host, px + pw + 28, py + (ph - uf.ascent * 1.1) / 2 + 2, SOFT);
  roundRect(c, 0, L.h - 8, L.w, 8, 0, GOLD);
  return encodePng(c);
}

export function renderSiteShareCard(siteHost = 'billiardactiontime.com') {
  const L = LAYOUTS.landscape, c = canvas(L.w, L.h);
  background(c, 600, 250);
  roundRect(c, 0, 0, L.w, 8, 0, GOLD);
  ball(c, 1030, 300, 120, '9-Ball'); ball(c, 900, 420, 80, '8-Ball');
  const bf = font('black', 30);
  emoji(c, 'ball', 60, 70, 38); text(c, bf, 'BILLIARD ACTION TIME', 112, 72, GOLD, { tracking: 4 });
  const h = fit('black', 'FIND YOUR NEXT POOL TOURNAMENT', 760, [90, 78, 68, 60], 3);
  let y = 150;
  for (const l of h.lines) { text(c, h.f, l, 60, y, WHITE); y += h.f.size * 1.08; }
  const sf = font('medium', 34);
  text(c, sf, 'Every tournament, every state. Updated daily.', 60, y + 14, SOFT);
  const uf = font('medium', 30); text(c, uf, siteHost, 60, L.h - 100, SOFT);
  roundRect(c, 0, L.h - 8, L.w, 8, 0, GOLD);
  return encodePng(c);
}

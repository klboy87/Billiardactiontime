// Renders a 1200x630 social share card (PNG) for a tournament or the site, with zero
// external dependencies -- pure Node, so it needs no npm install step to work.
import { makeCanvas, fillRect, encodePng } from './png.js';
import { FONT5X7 } from './font5x7.js';

function drawChar(c, ch, x, y, scale, color) {
  const g = FONT5X7[ch];
  if (!g) return;
  for (let row = 0; row < 7; row++) {
    const bits = g[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) fillRect(c, x + col * scale, y + row * scale, scale, scale, color);
    }
  }
}
const CHAR_W = (scale) => 6 * scale; // 5 px glyph + 1 px space, times scale
function textWidth(text, scale) { return text.length * CHAR_W(scale); }
function drawText(c, text, x, y, scale, color) {
  let cx = x;
  for (const ch of text.toUpperCase()) { drawChar(c, ch, cx, y, scale, color); cx += CHAR_W(scale); }
  return cx;
}
function drawTextCentered(c, text, cx, y, scale, color) {
  drawText(c, text, cx - textWidth(text, scale) / 2, y, scale, color);
}
// Greedy word-wrap that only breaks on spaces, capped to maxLines (last line gets "..." if truncated).
function wrapText(text, scale, maxWidth, maxLines) {
  const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (textWidth(test, scale) > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (words.join(' ') !== lines.join(' ') && lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (textWidth(last + '...', scale) > maxWidth && last.length > 1) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '...';
  }
  return lines;
}

const NAVY = [10, 21, 37], BLUE = [43, 134, 255], WHITE = [237, 242, 249], MUTED = [155, 172, 194], GREEN = [34, 173, 77];

export function renderSiteCard() {
  const c = makeCanvas(1200, 630, NAVY);
  fillRect(c, 0, 0, 1200, 10, BLUE);
  drawTextCentered(c, 'BILLIARD ACTION TIME', 600, 250, 8, WHITE);
  drawTextCentered(c, 'FIND POOL & BILLIARDS TOURNAMENTS NEAR YOU', 600, 340, 4, MUTED);
  fillRect(c, 0, 620, 1200, 10, BLUE);
  return encodePng(c);
}

export function renderTournamentCard(t) {
  const c = makeCanvas(1200, 630, NAVY);
  fillRect(c, 0, 0, 1200, 10, BLUE);
  drawText(c, 'BILLIARD ACTION TIME', 60, 50, 4, MUTED);

  const nameLines = wrapText(t.name || 'Pool Tournament', 10, 1080, 2);
  let y = 145;
  for (const line of nameLines) { drawText(c, line, 60, y, 10, WHITE); y += 78; }

  y += 14;
  fillRect(c, 60, y, 50, 7, GREEN); // small accent rule
  y += 36;
  if (t.game) { drawText(c, t.game, 60, y, 5, GREEN); y += 48; }
  if (t.date) { drawText(c, t.date, 60, y, 5, MUTED); y += 45; }
  const venueLine = [t.venue, t.city, t.state].filter(Boolean).join(', ');
  if (venueLine) {
    const vLines = wrapText(venueLine, 5, 1080, 2);
    for (const line of vLines) { drawText(c, line, 60, y, 5, MUTED); y += 45; }
  }
  fillRect(c, 0, 620, 1200, 10, BLUE);
  return encodePng(c);
}

// Printable double-elimination brackets (/tools/brackets/8 … /64), drawn as SVG on the server.
// Winners side: N/2 matches, halving each round. Losers side: 2·(log2 N − 1) rounds, alternating a
// "drop-in" round (winners-side losers join) and a halving round. Drop-ins alternate their order so
// players who met on the winners side don't meet again straight away.
import { layout } from './seo.js';

export const BRACKET_SIZES = [8, 16, 32, 64];

const W = 150, H = 44, GAPX = 34, GAPY = 14, PAD = 16, HEAD = 26;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function box(x, y, label, top, bottom, slots) {
  return `<g><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="4" fill="#fff" stroke="#333" stroke-width="1.2"/>
<line x1="${x}" y1="${y + H / 2}" x2="${x + W}" y2="${y + H / 2}" stroke="#999" stroke-width="0.8"/>
<text x="${x + W - 5}" y="${y + 14}" font-size="10" font-weight="bold" text-anchor="end" fill="#1d5fd1" font-family="Arial">${esc(label)}</text>
${top ? `<text x="${x + 5}" y="${y + 15}" font-size="10" fill="#777" font-family="Arial"${slots ? ` data-slot="${slots[0]}"` : ''}>${esc(top)}</text>` : ''}
${bottom ? `<text x="${x + 5}" y="${y + H / 2 + 15}" font-size="10" fill="#777" font-family="Arial"${slots ? ` data-slot="${slots[1]}"` : ''}>${esc(bottom)}</text>` : ''}</g>`;
}
const elbow = (x1, y1, x2, y2) => { const mx = x1 + (x2 - x1) / 2; return `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}" fill="none" stroke="#333" stroke-width="1.2"/>`; };
const svg = (w, h, title, inner) => `<svg class="bracket-svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;max-width:100%;height:auto">
<text x="${PAD}" y="18" font-size="14" font-weight="bold" font-family="Arial" fill="#111" data-title="${esc(title)}">${esc(title)}</text>${inner}</svg>`;

export function bracketSvgs(n) {
  const R = Math.log2(n);
  // ---- winners side ----
  let num = 0, out = '';
  const win = [];                                   // win[r] = [{num, y}]
  for (let r = 0; r < R; r++) {
    const count = n / 2 ** (r + 1), col = [];
    for (let i = 0; i < count; i++) {
      const y = r === 0 ? HEAD + PAD + i * (H + GAPY) : (win[r - 1][2 * i].y + win[r - 1][2 * i + 1].y) / 2;
      col.push({ num: ++num, y });
    }
    win.push(col);
  }
  const wWidth = PAD * 2 + 40 + R * (W + GAPX) + W;
  const wHeight = HEAD + PAD * 2 + (n / 2) * (H + GAPY);
  win.forEach((col, r) => col.forEach((mt, i) => {
    const x = PAD + 40 + r * (W + GAPX);
    out += box(x, mt.y, String(mt.num), r === 0 ? `Player ${2 * i + 1}` : '', r === 0 ? `Player ${2 * i + 2}` : '', r === 0 ? [2 * i + 1, 2 * i + 2] : null);
    if (r < R - 1) { const nx = PAD + 40 + (r + 1) * (W + GAPX), nxt = win[r + 1][Math.floor(i / 2)]; out += elbow(x + W, mt.y + H / 2, nx, nxt.y + (i % 2 ? H * 0.75 : H * 0.25)); }
  }));
  const wfx = PAD + 40 + (R - 1) * (W + GAPX), wf = win[R - 1][0];
  out += `<text x="${wfx + W + 10}" y="${wf.y + H / 2 + 4}" font-size="11" font-family="Arial" fill="#111">→ Winner to Final</text>`;
  const winners = svg(wWidth, wHeight, `${n}-Player Double Elimination · Winners Side (losers drop to the losers side)`, out);

  // ---- losers side ----
  const LR = 2 * (R - 1), los = [];
  let lnum = 0; out = '';
  for (let k = 1; k <= LR; k++) {
    const count = n / 2 ** (Math.ceil(k / 2) + 1), col = [];
    for (let i = 0; i < count; i++) {
      let y, top = '', bottom = '';
      if (k === 1) { y = HEAD + PAD + i * (H + GAPY) * 2; top = `Loser of ${win[0][2 * i].num}`; bottom = `Loser of ${win[0][2 * i + 1].num}`; }
      else if (k % 2 === 0) {
        y = los[k - 2][i].y;
        const r = k / 2;                              // winners round (0-based) whose losers drop in here
        const src = win[r], j = r % 2 ? count - 1 - i : i;
        bottom = `Loser of ${src[j].num}`;
      } else y = (los[k - 2][2 * i].y + los[k - 2][2 * i + 1].y) / 2;
      col.push({ num: ++lnum, y, top, bottom });
    }
    los.push(col);
  }
  const lx = k => PAD + 40 + (k - 1) * (W + GAPX);
  los.forEach((col, ki) => col.forEach((mt, i) => {
    const k = ki + 1, x = lx(k);
    out += box(x, mt.y, 'L' + mt.num, mt.top, mt.bottom);
    if (k < LR) {
      const halving = (k + 1) % 2 === 1 && k + 1 > 1;   // next round halves when it is odd-numbered
      const nxt = halving ? los[k][Math.floor(i / 2)] : los[k][i];
      out += elbow(x + W, mt.y + H / 2, lx(k + 1), nxt.y + (halving ? (i % 2 ? H * 0.75 : H * 0.25) : H * 0.25));
    }
  }));
  const lf = los[LR - 1][0], gx = lx(LR) + W + GAPX, gy = lf.y;
  out += elbow(lx(LR) + W, lf.y + H / 2, gx, gy + H * 0.75);
  out += box(gx, gy, 'Final', `Winner of ${wf.num}`, `Winner of L${lf.num}`);
  out += box(gx, gy + H + 30, 'If needed', 'Final winner', 'Final loser');
  out += `<text x="${gx}" y="${gy + 2 * H + 46}" font-size="9" font-family="Arial" fill="#555">Only if the losers-side player wins the Final</text>`;
  out += `<text x="${gx}" y="${gy + 2 * H + 80}" font-size="12" font-weight="bold" font-family="Arial" fill="#111">Champion: ____________________</text>`;
  const lWidth = gx + W + PAD + 40;
  const lHeight = Math.max(HEAD + PAD * 2 + (n / 4) * (H + GAPY) * 2, gy + 2 * H + 100);
  const losers = svg(lWidth, lHeight, `${n}-Player Double Elimination · Losers Side and Final`, out);
  return { winners, losers, matches: num + lnum + 1 };
}

const PRINT_CSS = `<style>@media print{header,footer,nav,.crumbs,.no-print,.spn,.seo-cta{display:none!important}body{background:#fff}main,.wrap{max-width:none;padding:0;margin:0}.bracket-sheet{page-break-after:always;break-after:page;border:0;box-shadow:none;padding:0}@page{size:landscape;margin:10mm}}.bracket-sheet{background:#fff;padding:10px;border-radius:8px;margin:14px 0;overflow-x:auto}</style>`;
const crumbs = (last) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/tools/">Tools</a> <span>/</span> ${last ? `<a href="/tools/brackets/">Brackets</a> <span>/</span> <span>${last}</span>` : '<span>Brackets</span>'}</nav>`;
const btn = 'style="display:inline-block;padding:10px 18px;font-size:16px;font-weight:700;border-radius:6px;border:0;background:#144b2e;color:#fff;cursor:pointer"';

export function bracketsIndexPage(cfg) {
  const body = `${crumbs('')}
  <div class="pagehead"><h1>Free Printable Double Elimination Pool Brackets</h1><p>Blank double-elimination brackets for 8, 16, 32 and 64 players. Print them, pin them up by the counter, and run your tournament. Free, no sign-up.</p></div>
  <ul style="list-style:none;padding:0;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${BRACKET_SIZES.map(n => `<li class="card" style="padding:14px 18px"><a href="/tools/brackets/${n}"><b>${n}-player bracket</b></a><br><span class="muted">${n - 1} winners-side matches, ${n - 2} losers-side matches and the final. Up to ${2 * n - 1} matches in all.</span></li>`).join('')}</ul>
  <article class="card" style="padding:18px 20px;margin-top:16px;line-height:1.65">
  <h2>Which bracket do I need?</h2>
  <p>Pick the smallest size that fits everyone. With 12 players, use the 16-player bracket and give the top seeds byes: a player with a bye skips the first winners-side match, and the empty losers-side slot is a bye too. Draw names from a hat (or by rating) and write them in the Player lines.</p>
  <h2>How to read it</h2>
  <p>Every match has a number. When a player loses on the winners side, they drop into the losers-side match that says "Loser of" that number. Lose twice and you are out. The winner of the winners side meets the winner of the losers side in the Final. Because the winners-side player has not lost yet, the losers-side player has to beat them twice: if they win the Final, play the "If needed" match.</p>
  <p>New to brackets? Read our <a href="/guides/double-elimination-brackets">double-elimination guide</a>, work out the prize money with the <a href="/tools/payout-calculator">payout calculator</a>, and set fair races with the <a href="/tools/fargo-race-calculator">Fargo race calculator</a>.</p>
  </article>
  <p style="margin-top:14px"><a href="/tools/">All tools</a> · <a href="/guides/">Guides</a> · <a href="/post">Post your tournament free</a></p>`;
  return layout(cfg, { title: 'Free Printable Double Elimination Pool Brackets (8, 16, 32, 64 Players) | Billiard Action Time',
    description: 'Free printable double elimination brackets for pool tournaments: 8, 16, 32 and 64 players, with numbered matches and losers-side drop spots. Print or save as PDF.', path: '/tools/brackets/', body });
}

export function bracketPage(cfg, n) {
  n = Number(n);
  if (!BRACKET_SIZES.includes(n)) return null;
  const b = bracketSvgs(n);
  const others = BRACKET_SIZES.filter(x => x !== n).map(x => `<a href="/tools/brackets/${x}">${x} players</a>`).join(' · ');
  const body = `${PRINT_CSS}${crumbs(n + ' players')}
  <div class="pagehead no-print"><h1>${n}-Player Double Elimination Bracket (Printable)</h1><p>A blank ${n}-player double-elimination bracket for pool tournaments: ${b.matches - 1} numbered matches, the Final and an "if needed" match. Prints on two landscape pages, one for each side.</p></div>
  <p class="no-print"><button type="button" data-print ${btn}>🖨️ Print this bracket</button> <span class="muted" style="margin-left:8px">Tip: choose "Save as PDF" in the print window to keep a copy.</span></p>
  <p class="no-print muted">Other sizes: ${others}</p>
  <form id="bracketFill" class="card no-print" data-size="${n}" style="padding:14px 18px;margin:12px 0">
    <b>Fill in your players (optional)</b>
    <p class="muted" style="margin:4px 0 10px">Type one name per line, or paste your sign-up list. Leave it blank to print an empty bracket. Nothing you type is sent anywhere.</p>
    <label style="display:block">Event name and date<input name="event" maxlength="80" placeholder="Tuesday 8-Ball · Oct 21" style="display:block;width:100%;max-width:420px;padding:8px;font-size:16px;margin-top:4px"></label>
    <label style="display:block;margin-top:10px">Players<textarea name="names" rows="6" placeholder="One name per line" style="display:block;width:100%;max-width:420px;padding:8px;font-size:16px;margin-top:4px"></textarea></label>
    <label style="display:block;margin-top:8px"><input type="checkbox" name="shuffle" checked> Random draw (shuffle the names)</label>
    <p style="margin:10px 0 0"><button type="submit" ${btn}>Fill bracket</button> <button type="button" data-clear style="padding:10px 14px;font-size:15px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer">Clear</button></p>
    <p data-msg class="muted" style="margin:8px 0 0" aria-live="polite"></p>
  </form>
  <div class="bracket-sheet">${b.winners}</div>
  <div class="bracket-sheet">${b.losers}</div>
  <article class="card no-print" style="padding:18px 20px;margin-top:16px;line-height:1.65">
  <h2>Running a ${n}-player double elimination</h2>
  <p>Type your players into the form above to fill the bracket automatically, with a random draw if you like, or print it blank and write the names in. With fewer than ${n} players, the form spreads the byes out so no two byes meet.</p>
  <p>Write the players into the ${n} Player lines on the winners side. When someone loses a winners-side match, find the losers-side match that says "Loser of" that match number and write them in. The losers side is ordered so players who already met usually don't meet again right away. Lose twice and you are out.</p>
  <p>The winners-side champion and the losers-side champion meet in the Final. The losers-side player must win twice, so if they win the Final, play the "If needed" match. ${n < 16 ? 'Fewer than ' + n + ' players? Fill the empty lines with "Bye".' : `Fewer than ${n} players? Use byes, or use the ${n / 2}-player bracket if you have ${n / 2} or fewer.`}</p>
  <p>A ${n}-player field plays ${2 * n - 2} matches (${2 * n - 1} if the "if needed" match is played). At about 30 minutes per match and ${Math.max(2, Math.round(n / 4))} tables, plan on roughly ${Math.ceil((2 * n - 2) * 30 / Math.max(2, Math.round(n / 4)) / 60)}–${Math.ceil((2 * n - 2) * 30 / Math.max(2, Math.round(n / 4)) / 60) + 2} hours.</p>
  <p>Next: set the prize money with the <a href="/tools/payout-calculator">payout calculator</a>, read <a href="/guides/how-to-run-a-pool-tournament">how to run a pool tournament</a>, and <a href="/post">post your tournament free</a> so players can find it.</p>
  </article>`;
  const ld = { '@context': 'https://schema.org', '@type': 'CreativeWork', name: `${n}-Player Double Elimination Bracket`, url: `${cfg.publicUrl}/tools/brackets/${n}`, isAccessibleForFree: true, educationalUse: 'Tournament bracket' };
  return layout(cfg, { title: `Printable ${n}-Player Double Elimination Bracket for Pool | Billiard Action Time`,
    description: `Free printable ${n}-player double elimination bracket for pool tournaments, with numbered matches, losers-side drop spots and an if-needed final. Print or save as PDF.`,
    path: `/tools/brackets/${n}`, body, jsonld: [ld], scripts: ['/tools.js'] });
}

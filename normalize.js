// Turns messy source values into the clean values the site uses.

export const GAMES = ['9-Ball', '8-Ball', '10-Ball', 'One Pocket', 'Banks', 'Straight Pool', 'Scotch Doubles', 'Other'];

export function normalizeGame(...texts) {
  const s = texts.filter(Boolean).join(' ').toLowerCase().replace(/[-_/]/g, ' ');
  if (!s.trim()) return 'Other';
  if (/\b(one|1) pocket\b/.test(s)) return 'One Pocket';
  if (/\bbanks?\b/.test(s)) return 'Banks';
  if (/straight pool|14\.1/.test(s)) return 'Straight Pool';
  if (/scotch/.test(s)) return 'Scotch Doubles';
  const names = { 8: '8-Ball', 9: '9-Ball', 10: '10-Ball' };
  const balls = new Set();
  for (const m of s.matchAll(/\b(8|9|10)\s*(?:ball|bal)\b|\bfast\s*(8)\b/g)) balls.add(m[1] || m[2]);
  // Names like "Laggers choice 8, 9 or 10 ball" list several games: treat as Other.
  const listed = new Set([...s.matchAll(/\b(8|9|10)\b/g)].map(m => m[1]));
  if (balls.size === 1 && listed.size <= 1) return names[[...balls][0]];
  return 'Other';
}

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', GU: 'Guam',
  PR: 'Puerto Rico', VI: 'US Virgin Islands'
};
const NAME_TO_CODE = Object.fromEntries(Object.entries(STATE_NAMES).map(([k, v]) => [v.toLowerCase(), k]));
const ABBR = new Set(Object.keys(STATE_NAMES));

export function normalizeState(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (ABBR.has(s.toUpperCase())) return s.toUpperCase();
  return NAME_TO_CODE[s.toLowerCase()] || '';
}

export function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  if (/^\d{10,13}$/.test(s)) { const d = new Date(s.length === 10 ? +s * 1000 : +s); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
  return null;
}
function valid(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseTime(v) {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap]m?)?$/i);
  if (!m) return null;
  let h = +m[1]; const min = +(m[2] || 0);
  if (m[3]) { const pm = m[3][0].toLowerCase() === 'p'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parseMoney(v) {
  if (v === null || v === undefined || v === '') return null;
  if (!/\d/.test(String(v))) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(v) {
  const n = parseMoney(v);
  return n === null ? null : Math.round(n);
}

export function detectLevel(...texts) {
  const s = texts.filter(Boolean).join(' ').toLowerCase();
  if (/ladies|women/.test(s)) return 'womens';
  if (/junior|youth|kids/.test(s)) return 'juniors';
  if (/senior/.test(s)) return 'seniors';
  if (/fargo/.test(s)) return 'fargo';
  if (/amateur|beginner/.test(s)) return 'amateur';
  return 'open';
}

export function detectFormat(...texts) {
  const s = texts.filter(Boolean).join(' ').toLowerCase();
  if (/chip/.test(s)) return 'Chip Tournament';
  if (/double elim/.test(s)) return 'Double Elimination';
  if (/single elim/.test(s)) return 'Single Elimination';
  return null;
}

export const slugify = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const zip5 = z => (String(z || '').match(/\d{5}/) || [''])[0];
export const clean = v => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());

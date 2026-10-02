import { GAMES, TABLE_SIZES, parseDate, parseTime, parseMoney, parseInteger, normalizeState, clean, zip5 } from './normalize.js';

const PROMPT = today => `Read this pool tournament flyer. Today's date is ${today}.
Reply with ONLY a JSON object using these keys, and null for anything the flyer does not state (do not guess):
name, date (YYYY-MM-DD; if the year is not printed use the next upcoming occurrence), time (24-hour HH:MM), venue, address, city,
state (2-letter code), zip, game (one of: ${GAMES.join(', ')}), entry (number in dollars), added (added money, number), race, format,
tableSize (one of: ${TABLE_SIZES.join(', ')}), limit (max number of players/teams, if stated), directorName (tournament director or contact person),
directorPhone, notes (one short sentence).`;

export function cleanScan(o) {
  const s = (v, n) => clean(v).slice(0, n) || null;
  return {
    name: s(o.name, 120), date: parseDate(o.date), time: parseTime(o.time), venue: s(o.venue, 120), address: s(o.address, 120),
    city: s(o.city, 80), state: normalizeState(o.state) || null, zip: zip5(o.zip) || null,
    game: GAMES.includes(o.game) ? o.game : null, entry: parseMoney(o.entry), added: parseMoney(o.added),
    race: s(o.race, 40), format: s(o.format, 60), tableSize: TABLE_SIZES.includes(o.tableSize) ? o.tableSize : null,
    limit: parseInteger(o.limit), directorName: s(o.directorName, 80), directorPhone: s(o.directorPhone, 30), notes: s(o.notes, 300)
  };
}

const MONEY_PROMPT = today => `Read this pool (billiards) money match / challenge match flyer. Today's date is ${today}.
Reply with ONLY a JSON object using these keys, and null for anything the flyer does not state (do not guess):
player1, player2 (the two players' full names as printed), game (one of: ${GAMES.join(', ')}), race (the race number only, e.g. 21),
stakes (what is on the line exactly as printed, e.g. "$10,000+"), date (YYYY-MM-DD; if only a weekday like "Saturday" is printed, use the next upcoming one; if the year is not printed use the next upcoming occurrence),
time (24-hour HH:MM), room (pool room / venue name), address, city, state (2-letter code), streamUrl (a livestream link if printed), notes (one short sentence of anything else useful).`;

export function cleanMoneyScan(o) {
  const s = (v, n) => clean(v).slice(0, n) || null;
  return {
    player1: s(o.player1, 60), player2: s(o.player2, 60), game: GAMES.includes(o.game) ? o.game : null,
    race: parseInteger(o.race), stakes: s(o.stakes, 40), date: parseDate(o.date), time: parseTime(o.time),
    room: s(o.room, 120), address: s(o.address, 160), city: s(o.city, 80), state: normalizeState(o.state) || null,
    streamUrl: s(o.streamUrl, 300), notes: s(o.notes, 300)
  };
}

export async function readMoneyFlyer(dataUrl, cfg, { fetchFn = fetch } = {}) {
  return cleanMoneyScan(await askAboutImage(dataUrl, cfg, MONEY_PROMPT, fetchFn));
}

export async function readFlyer(dataUrl, cfg, { fetchFn = fetch } = {}) {
  return cleanScan(await askAboutImage(dataUrl, cfg, PROMPT, fetchFn));
}

async function askAboutImage(dataUrl, cfg, promptFor, fetchFn) {
  const m = String(dataUrl).match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error('Flyer must be a PNG, JPG, WebP or GIF image');
  const res = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: cfg.scanModel, max_tokens: 800,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
        { type: 'text', text: promptFor(new Date().toISOString().slice(0, 10)) }] }]
    })
  });
  if (!res.ok) throw new Error(`The flyer reader returned HTTP ${res.status}`);
  const j = await res.json();
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const raw = text.match(/\{[\s\S]*\}/);
  if (!raw) throw new Error('The flyer reader did not return details');
  try { return JSON.parse(raw[0]); } catch { throw new Error('The flyer reader returned something unreadable'); }
}

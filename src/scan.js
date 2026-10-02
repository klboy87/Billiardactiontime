import { GAMES, TABLE_SIZES, parseDate, parseTime, parseMoney, parseInteger, normalizeState, clean, zip5 } from './normalize.js';
// (GAMES, parseDate, parseTime, normalizeState, clean also used below for money-match flyer reading)

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

async function askClaude(dataUrl, cfg, prompt, { fetchFn = fetch } = {}) {
  const m = String(dataUrl).match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error('Flyer must be a PNG, JPG, WebP or GIF image');
  const res = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: cfg.scanModel, max_tokens: 800,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
        { type: 'text', text: prompt }] }]
    })
  });
  if (!res.ok) throw new Error(`The flyer reader returned HTTP ${res.status}`);
  const j = await res.json();
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const raw = text.match(/\{[\s\S]*\}/);
  if (!raw) throw new Error('The flyer reader did not return details');
  try { return JSON.parse(raw[0]); } catch { throw new Error('The flyer reader returned something unreadable'); }
}

export async function readFlyer(dataUrl, cfg, opts = {}) {
  return cleanScan(await askClaude(dataUrl, cfg, PROMPT(new Date().toISOString().slice(0, 10)), opts));
}

const MM_PROMPT = today => `Read this pool/billiards money-match (challenge match) flyer. Today's date is ${today}.
Reply with ONLY a JSON object using these keys, and null for anything the flyer does not state (do not guess):
player1, player2 (the two players' names), date (YYYY-MM-DD; if the year is not printed use the next upcoming occurrence),
time (24-hour HH:MM), game (one of: ${GAMES.join(', ')}), race (the race-to number, as a string like "21"),
stakes (the amount on the line, as printed, e.g. "$10,000"), room (the pool room/venue name), address, city,
state (2-letter code), notes (one short sentence, such as set format or sponsor).`;

export async function readMoneyMatchFlyer(dataUrl, cfg, opts = {}) {
  const o = await askClaude(dataUrl, cfg, MM_PROMPT(new Date().toISOString().slice(0, 10)), opts);
  const s = (v, n) => clean(v).slice(0, n) || null;
  return {
    player1: s(o.player1, 60), player2: s(o.player2, 60), date: parseDate(o.date), time: parseTime(o.time),
    game: GAMES.includes(o.game) ? o.game : null, race: s(o.race, 10), stakes: s(o.stakes, 40),
    room: s(o.room, 120), address: s(o.address, 160), city: s(o.city, 80), state: normalizeState(o.state) || null,
    notes: s(o.notes, 300)
  };
}

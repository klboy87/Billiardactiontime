import { GAMES, parseDate, parseTime, parseMoney, normalizeState, clean, zip5 } from './normalize.js';

const PROMPT = today => `Read this pool tournament flyer. Today's date is ${today}.
Reply with ONLY a JSON object using these keys, and null for anything the flyer does not state (do not guess):
name, date (YYYY-MM-DD; if the year is not printed use the next upcoming occurrence), time (24-hour HH:MM), venue, address, city,
state (2-letter code), zip, game (one of: ${GAMES.join(', ')}), entry (number in dollars), added (added money, number), race, format, notes (one short sentence).`;

export function cleanScan(o) {
  const s = (v, n) => clean(v).slice(0, n) || null;
  return {
    name: s(o.name, 120), date: parseDate(o.date), time: parseTime(o.time), venue: s(o.venue, 120), address: s(o.address, 120),
    city: s(o.city, 80), state: normalizeState(o.state) || null, zip: zip5(o.zip) || null,
    game: GAMES.includes(o.game) ? o.game : null, entry: parseMoney(o.entry), added: parseMoney(o.added),
    race: s(o.race, 40), format: s(o.format, 60), notes: s(o.notes, 300)
  };
}

export async function readFlyer(dataUrl, cfg, { fetchFn = fetch } = {}) {
  const m = String(dataUrl).match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error('Flyer must be a PNG, JPG, WebP or GIF image');
  const res = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: cfg.scanModel, max_tokens: 800,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
        { type: 'text', text: PROMPT(new Date().toISOString().slice(0, 10)) }] }]
    })
  });
  if (!res.ok) throw new Error(`The flyer reader returned HTTP ${res.status}`);
  const j = await res.json();
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const raw = text.match(/\{[\s\S]*\}/);
  if (!raw) throw new Error('The flyer reader did not return details');
  try { return cleanScan(JSON.parse(raw[0])); } catch { throw new Error('The flyer reader returned something unreadable'); }
}

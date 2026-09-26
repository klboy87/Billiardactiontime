import { normalizeGame, normalizeState, parseDate, parseTime, parseMoney, parseInteger, detectLevel, detectFormat, zip5, clean } from './normalize.js';

// For each field the site needs, the source keys we try (first non-empty wins).
// Override any of these with FIELD_MAP in .env, for example {"name":"tourney_title"}.
export const DEFAULT_KEYS = {
  id: ['id', 'tournament_id', 'tid', 'external_id', 'uuid'],
  name: ['name', 'title', 'tournament', 'tournament_name', 'event_name'],
  date: ['date', 'start_date', 'event_date', 'tournament_date', 'starts_at'],
  time: ['time', 'start_time', 'begin_time'],
  game: ['game', 'type', 'tournament_type', 'game_type'],
  entry: ['entry', 'entry_fee', 'fee', 'buy_in', 'buyin'],
  added: ['added', 'added_money', 'prize', 'payout'],
  race: ['race', 'race_to'],
  format: ['format'],
  playerLimit: ['player_limit', 'limit', 'max_players', 'max_entries'],
  level: ['level', 'skill_level'],
  tableSize: ['table_size', 'table'],
  directorName: ['director', 'director_name', 'contact_name', 'contact'],
  directorPhone: ['director_phone', 'contact_phone'],
  directorEmail: ['director_email', 'contact_email'],
  registrationUrl: ['registration_url', 'register_url', 'registration'],
  website: ['website', 'url', 'link'],
  notes: ['notes', 'description', 'details', 'comments'],
  flyerUrl: ['flyer_url', 'flyer', 'image', 'image_url'],
  venueName: ['venue', 'venue_name', 'location_name', 'hall', 'pool_hall'],
  address: ['address', 'venue_address', 'street', 'address1'],
  city: ['city', 'venue_city'],
  state: ['state', 'venue_state', 'state_code'],
  zip: ['zip', 'zipcode', 'zip_code', 'postal_code', 'venue_zip'],
  venuePhone: ['venue_phone', 'hall_phone', 'phone'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitude'],
  tables: ['tables', 'table_count', 'num_tables'],
  updatedAt: ['updated_at', 'modified', 'last_modified', 'updated'],
  status: ['status'],
  deleted: ['deleted', 'is_deleted', 'cancelled', 'canceled']
};

export function getPath(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function pick(rec, keys) {
  for (const k of keys) {
    const v = getPath(rec, k);
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

// Returns { ok: true, value } or { ok: false, reason }.
export function mapRecord(rec, fieldMap = {}) {
  const keys = { ...DEFAULT_KEYS };
  for (const [field, key] of Object.entries(fieldMap)) keys[field] = Array.isArray(key) ? key : [key];
  const get = f => pick(rec, keys[f] || []);

  const name = clean(get('name'));
  const dateSrc = get('date');
  const date = parseDate(dateSrc);
  const venueName = clean(get('venueName'));
  if (!name) return { ok: false, reason: 'missing name' };
  if (!date) return { ok: false, reason: 'missing or unreadable date' };
  if (!venueName) return { ok: false, reason: 'missing venue' };

  const gameRaw = clean(get('game'));
  const lat = get('lat') === undefined ? NaN : Number(get('lat'));
  const lng = get('lng') === undefined ? NaN : Number(get('lng'));
  const status = String(get('status') || '').toLowerCase();
  const timeFromDate = String(dateSrc).match(/[T ](\d{1,2}:\d{2})/);
  const value = {
    externalId: clean(get('id')) || null,
    name,
    date,
    time: parseTime(get('time')) || (timeFromDate ? parseTime(timeFromDate[1]) : null),
    game: normalizeGame(gameRaw, name),
    gameRaw: gameRaw || null,
    entry: parseMoney(get('entry')),
    added: parseMoney(get('added')),
    race: clean(get('race')) || null,
    format: clean(get('format')) || detectFormat(name, gameRaw),
    playerLimit: parseInteger(get('playerLimit')),
    level: clean(get('level')).toLowerCase().replace(/[^a-z]/g, ''),
    tableSize: clean(get('tableSize')) || null,
    directorName: clean(get('directorName')) || null,
    directorPhone: clean(get('directorPhone')) || null,
    directorEmail: clean(get('directorEmail')) || null,
    registrationUrl: safeUrl(get('registrationUrl')),
    website: safeUrl(get('website')),
    notes: clean(get('notes')) || null,
    flyerUrl: safeUrl(get('flyerUrl')),
    updatedAt: clean(get('updatedAt')) || null,
    removed: /^(1|true|yes)$/i.test(String(get('deleted') ?? '')) || /^(cancel|delet|remov)/.test(status),
    venue: {
      name: venueName,
      address: clean(get('address')),
      city: clean(get('city')),
      state: normalizeState(get('state')),
      zip: zip5(get('zip')),
      phone: clean(get('venuePhone')) || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      tables: parseInteger(get('tables'))
    }
  };
  if (!['open', 'amateur', 'pro', 'womens', 'juniors', 'seniors', 'fargo'].includes(value.level)) value.level = detectLevel(name, gameRaw);
  return { ok: true, value };
}

export function safeUrl(v) {
  const s = clean(v);
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? 'https://' + s : null;
  if (!withProto) return null;
  try { const u = new URL(withProto); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}

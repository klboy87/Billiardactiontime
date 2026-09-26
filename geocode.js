// Adds map coordinates to venues that have none.
// Uses the free US Census geocoder, then falls back to the average position of other venues in the same ZIP.
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function censusLookup(v, fetchFn = fetch) {
  const line = [v.address, v.city, v.state, v.zip].filter(Boolean).join(', ');
  const url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=' + encodeURIComponent(line);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetchFn(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const m = j?.result?.addressMatches?.[0]?.coordinates;
    return m && Number.isFinite(m.x) && Number.isFinite(m.y) ? { lat: m.y, lng: m.x } : null;
  } finally { clearTimeout(timer); }
}

export function zipCentroid(db, zip) {
  if (!zip) return null;
  const r = db.prepare('SELECT AVG(lat) lat, AVG(lng) lng, COUNT(*) n FROM venues WHERE zip=? AND lat IS NOT NULL').get(zip);
  return r && r.n > 0 ? { lat: r.lat, lng: r.lng } : null;
}

export async function geocodePending(db, cfg, { fetchFn = fetch, delayMs = 250, log = () => {} } = {}) {
  if (cfg.geocoder === 'off') return { tried: 0, located: 0, failed: 0 };
  const pending = db.prepare(`SELECT * FROM venues WHERE lat IS NULL AND (geocode_status IS NULL
    OR (geocode_status='failed' AND geocode_tried_at < datetime('now','-7 day'))) ORDER BY id LIMIT ?`).all(cfg.geocodePerRun);
  const set = db.prepare("UPDATE venues SET lat=?, lng=?, geocode_status=?, geocode_tried_at=datetime('now') WHERE id=?");
  const fail = db.prepare("UPDATE venues SET geocode_status='failed', geocode_tried_at=datetime('now') WHERE id=?");
  let located = 0, failed = 0, netErrors = 0;
  for (const v of pending) {
    if (!v.address && !v.zip && !v.city) { fail.run(v.id); failed++; continue; }
    try {
      const hit = v.address ? await censusLookup(v, fetchFn) : null;
      netErrors = 0;
      if (hit) { set.run(hit.lat, hit.lng, 'census', v.id); located++; }
      else {
        const z = zipCentroid(db, v.zip);
        if (z) { set.run(z.lat, z.lng, 'zip', v.id); located++; } else { fail.run(v.id); failed++; }
      }
    } catch (e) {
      if (++netErrors >= 3) { log('geocoder unreachable, stopping for now'); break; }
    }
    await sleep(delayMs);
  }
  log(`geocode: ${located} located, ${failed} failed, ${pending.length} tried`);
  return { tried: pending.length, located, failed };
}

import fs from 'node:fs';
import { STATE_NAMES } from './normalize.js';
import { venueCities } from './db.js';
import { STARTER_CITIES } from './places-data.js';

export const statesList = () => Object.entries(STATE_NAMES).map(([code, name]) => ({ code, name }));

let customCache = null;
function customCities(cfg) {
  if (customCache) return customCache;
  customCache = {};
  if (cfg.placesFile) {
    try { customCache = JSON.parse(fs.readFileSync(cfg.placesFile, 'utf8')); }
    catch (e) { customCache = {}; }
  }
  return customCache;
}

// The full city list for one state: the starter list, any bigger list dropped in via PLACES_FILE,
// and every city that a real venue is actually in (from the sync or a posted tournament) -- merged
// and de-duplicated, so a place with a venue always shows up even if it wasn't on the starter list.
export function citiesForState(db, cfg, state) {
  const code = String(state || '').toUpperCase();
  if (!STATE_NAMES[code]) return [];
  const seen = new Map(); // lowercase -> display name
  const add = name => { const n = String(name || '').trim(); if (n) seen.set(n.toLowerCase(), seen.get(n.toLowerCase()) || n); };
  (STARTER_CITIES[code] || []).forEach(add);
  (customCities(cfg)[code] || []).forEach(add);
  venueCities(db).filter(v => v.state === code).forEach(v => add(v.city));
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function placesPayload(db, cfg) {
  const states = statesList();
  const cities = {};
  for (const { code } of states) cities[code] = citiesForState(db, cfg, code);
  return { states, cities };
}

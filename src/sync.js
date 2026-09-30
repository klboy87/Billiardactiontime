import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
import { mapRecord, getPath } from './mapping.js';
import { tx, upsertSourceTournament, nowIso, todayIso } from './db.js';

// ---- reading the source -------------------------------------------------

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(x => x !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function parseItems(text, src) {
  if (src.format === 'csv') return parseCsv(text);
  const json = JSON.parse(text);
  if (src.itemsPath) {
    const v = getPath(json, src.itemsPath);
    if (!Array.isArray(v)) throw new Error(`SOURCE_ITEMS_PATH "${src.itemsPath}" did not point to a list`);
    return v;
  }
  if (Array.isArray(json)) return json;
  for (const k of ['tournaments', 'data', 'items', 'results', 'events']) if (Array.isArray(json?.[k])) return json[k];
  throw new Error('Could not find a list of tournaments in the response. Set SOURCE_ITEMS_PATH.');
}

async function load(src, { fetchFn, since, page, publicUrl }) {
  if (!/^https?:\/\//i.test(src.url)) return fs.readFileSync(src.url, 'utf8'); // local file, handy for testing
  // The feed is a file on this same site. Read it straight from disk: fetching our own
  // address while a new version is starting up returns an error (it failed that way before).
  if (publicUrl && src.url.startsWith(publicUrl + '/')) {
    const file = path.resolve(PUBLIC_DIR, decodeURIComponent(new URL(src.url).pathname).replace(/^\/+/, ''));
    if (file.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  }
  const url = new URL(src.url);
  if (since && src.mode === 'incremental') url.searchParams.set('updated_since', since);
  if (src.pageParam) { url.searchParams.set(src.pageParam, String(page)); url.searchParams.set('per_page', String(src.pageSize)); }
  const headers = { Accept: src.format === 'csv' ? 'text/csv' : 'application/json' };
  if (src.token) headers[src.authHeader || 'Authorization'] = src.authHeader ? src.token : `Bearer ${src.token}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetchFn(url, { headers, signal: ctl.signal });
    if (!res.ok) throw new Error(`Source returned HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

export async function fetchRecords(cfg, { fetchFn = fetch, since } = {}) {
  const src = cfg.source;
  if (!src.url) throw new Error('SOURCE_URL is not set');
  const all = [];
  for (let page = 1; page <= 500; page++) {
    const items = parseItems(await load(src, { fetchFn, since, page, publicUrl: cfg.publicUrl }), src);
    all.push(...items);
    if (!src.pageParam || !/^https?:/i.test(src.url) || items.length === 0 || items.length < src.pageSize) break;
  }
  return all;
}

// ---- writing to the database ------------------------------------------------

export function ingest(db, cfg, records, { runId = null } = {}) {
  const counts = { inserted: 0, updated: 0, unchanged: 0, removed: 0, skipped: 0 };
  const skips = [];
  tx(db, () => {
    for (const rec of records) {
      const m = mapRecord(rec, cfg.source.fieldMap);
      if (!m.ok) { counts.skipped++; if (skips.length < 20) skips.push(m.reason); continue; }
      counts[upsertSourceTournament(db, cfg.source.name, m.value, { runId, verified: cfg.source.verified })]++;
    }
  });
  return { counts, skips };
}

let running = false;

export async function runSync(db, cfg, { fetchFn = fetch, log = () => {} } = {}) {
  if (running) return { status: 'skipped', message: 'A sync is already running' };
  running = true;
  const src = cfg.source;
  const started = nowIso();
  const runId = Number(db.prepare('INSERT INTO sync_runs (source, mode, started_at) VALUES (?,?,?)').run(src.name, src.mode, started).lastInsertRowid);
  try {
    const state = db.prepare('SELECT last_success_at FROM sync_state WHERE source=?').get(src.name);
    const records = await fetchRecords(cfg, { fetchFn, since: state?.last_success_at });
    const { counts, skips } = ingest(db, cfg, records, { runId });
    const notes = [];
    if (skips.length) notes.push(`Skipped ${counts.skipped} unreadable rows (${[...new Set(skips)].join('; ')})`);

    if (src.mode === 'snapshot') {
      const today = todayIso();
      const q = "FROM tournaments WHERE source=? AND status='published' AND date>=?";
      const total = db.prepare(`SELECT COUNT(*) n ${q}`).get(src.name, today).n;
      const stale = db.prepare(`SELECT COUNT(*) n ${q} AND (last_seen_run IS NULL OR last_seen_run<>?)`).get(src.name, today, runId).n;
      if (records.length === 0) notes.push('Source returned no rows, so nothing was hidden');
      else if (total > 10 && stale > total * 0.5) notes.push(`Kept ${stale} tournaments that were missing from the source (over half of the list, so it looks like a partial export)`);
      else if (stale) {
        db.prepare(`UPDATE tournaments SET status='removed', updated_at=datetime('now') WHERE source=? AND status='published' AND date>=? AND (last_seen_run IS NULL OR last_seen_run<>?)`).run(src.name, today, runId);
        counts.removed += stale;
      }
    }
    db.prepare(`UPDATE sync_runs SET finished_at=?, status='ok', fetched=?, inserted=?, updated=?, unchanged=?, removed=?, skipped=?, message=? WHERE id=?`)
      .run(nowIso(), records.length, counts.inserted, counts.updated, counts.unchanged, counts.removed, counts.skipped, notes.join('. ') || null, runId);
    db.prepare(`INSERT INTO sync_state (source, last_success_at) VALUES (?,?) ON CONFLICT(source) DO UPDATE SET last_success_at=excluded.last_success_at`).run(src.name, started);
    log(`sync ok: ${records.length} fetched, ${counts.inserted} new, ${counts.updated} updated, ${counts.removed} removed`);
    return { status: 'ok', fetched: records.length, ...counts, message: notes.join('. ') };
  } catch (e) {
    db.prepare(`UPDATE sync_runs SET finished_at=?, status='error', message=? WHERE id=?`).run(nowIso(), String(e.message || e), runId);
    log(`sync failed: ${e.message}`);
    return { status: 'error', message: String(e.message || e) };
  } finally { running = false; }
}

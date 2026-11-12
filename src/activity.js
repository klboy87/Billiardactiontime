// Automation activity log: automation/activity-log.jsonl, read at request time. Malformed lines are skipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'automation', 'activity-log.jsonl');
const TYPES = new Set(['article', 'social_post', 'research', 'review', 'fix', 'error', 'suggestion', 'setup']);

export function readActivity(file = FILE) {
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const out = [];
  for (const line of txt.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      const t = Date.parse(o.time);
      if (!o || typeof o !== 'object' || Number.isNaN(t)) continue;
      out.push({ time: new Date(t).toISOString(), routine: String(o.routine || ''), type: TYPES.has(o.type) ? o.type : 'research',
        summary: String(o.summary || ''), links: (Array.isArray(o.links) ? o.links : []).map(String).filter(u => /^https?:\/\//.test(u)), status: o.status === 'failed' ? 'failed' : 'ok' });
    } catch { /* skip bad line */ }
  }
  return out.sort((a, b) => b.time.localeCompare(a.time));
}

export const dayDetroit = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

export function activityPayload(file) {
  const entries = readActivity(file).map(e => ({ ...e, day: dayDetroit(e.time) }));
  const days = [];
  for (const e of entries) {
    let d = days[days.length - 1];
    if (!d || d.day !== e.day) { d = { day: e.day, entries: [] }; days.push(d); }
    d.entries.push(e);
  }
  for (const d of days) {
    const n = t => d.entries.filter(e => e.type === t).length;
    const errs = d.entries.filter(e => e.type === 'error' || e.status === 'failed').length;
    const parts = [`${n('article')} article${n('article') === 1 ? '' : 's'} published`, `${n('social_post')} social post${n('social_post') === 1 ? '' : 's'}`, errs ? `${errs} error${errs === 1 ? '' : 's'}` : 'no errors'];
    d.summary = parts.join(', ') + '.';
  }
  return {
    days,
    suggestions: entries.filter(e => e.type === 'suggestion').slice(0, 5),
    problems: entries.filter(e => e.type === 'error' || e.status === 'failed').slice(0, 10),
    total: entries.length,
  };
}

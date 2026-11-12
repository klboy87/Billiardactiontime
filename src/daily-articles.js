// Daily articles (pool news, stories, how-tos) stored as one JSON file each in content/articles/.
// A scheduled task adds a new file every day and pushes it; the site picks it up on the next deploy.
// File shape: { "slug", "title", "desc", "date": "YYYY-MM-DD", "cat": "news"|"players"|"rules"|"directors",
//               "body": "<p>…html…</p>", "faq": [["question", "answer"], …] (optional) }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'articles');
const CATS = new Set(['news', 'players', 'rules', 'directors']);

function load() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.json')); } catch { return []; }
  const out = [], seen = new Set();
  for (const f of files) {
    try {
      const a = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      if (!/^[a-z0-9-]{2,80}$/.test(a.slug || '') || seen.has(a.slug)) continue;
      if (!a.title || !a.desc || !a.body || !/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) continue;
      seen.add(a.slug);
      out.push({ slug: a.slug, title: String(a.title), desc: String(a.desc), body: String(a.body), date: a.date,
        cat: CATS.has(a.cat) ? a.cat : 'news', ...(Array.isArray(a.faq) && a.faq.length ? { faq: a.faq } : {}) });
    } catch (e) { console.warn(`Skipping bad article file ${f}: ${e.message}`); }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

// Newest first.
export const DAILY_ARTICLES = load();

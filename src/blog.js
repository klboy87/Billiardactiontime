// Blog / news section (/blog/). One JSON file per post in content/blog/ -- see AUTOMATION.md.
// Shape: { "slug", "title", "date": "YYYY-MM-DD", "description", "body": "<p>html</p>",
//          "sources": [{"title","url"}] or ["https://..."], "image": "https://..." (optional) }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, shareStrip } from './seo.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'blog');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const niceDate = d => { const [y, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };
const httpUrl = u => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };

function load() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.json')); } catch { return []; }
  const out = [], seen = new Set();
  for (const f of files) {
    try {
      const a = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      if (!/^[a-z0-9-]{2,80}$/.test(a.slug || '') || seen.has(a.slug)) continue;
      if (!a.title || !a.description || !a.body || !/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) continue;
      seen.add(a.slug);
      const sources = (Array.isArray(a.sources) ? a.sources : []).map(s => typeof s === 'string' ? { title: s, url: s } : { title: s?.title || s?.url, url: s?.url })
        .map(s => ({ title: String(s.title || ''), url: httpUrl(s.url) })).filter(s => s.url);
      out.push({ slug: a.slug, title: String(a.title), description: String(a.description), body: String(a.body), date: a.date, sources, image: httpUrl(a.image) });
    } catch (e) { console.warn(`Skipping bad blog file ${f}: ${e.message}`); }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export const POSTS = load();

export function blogIndexPage(cfg) {
  const list = POSTS.length ? `<ul class="seo-list" style="list-style:none;padding:0;display:grid;gap:18px">${POSTS.map(p => `<li class="card" style="padding:14px 18px">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" style="max-width:100%;border-radius:8px;margin-bottom:8px">` : ''}<a href="/blog/${p.slug}"><b style="font-size:20px">${esc(p.title)}</b></a><br><small class="muted">${niceDate(p.date)}</small><br><span class="muted">${esc(p.description)}</span></li>`).join('')}</ul>` : '<p class="muted">No posts yet. Check back soon.</p>';
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>Blog</span></nav>
  <div class="pagehead"><h1>Pool News &amp; Blog</h1><p>Pool news, tournament recaps and stories from Billiard Action Time. Newest first.</p></div>${list}
  <p style="margin-top:18px"><a href="/guides/">Pool guides →</a> · <a href="/this-weekend/">Tournaments this weekend →</a></p>`;
  return layout(cfg, { title: 'Pool News & Blog | Billiard Action Time', description: 'Pool news, tournament recaps and stories from Billiard Action Time.', path: '/blog/', body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Billiard Action Time Blog', url: `${cfg.publicUrl}/blog/`, blogPost: POSTS.slice(0, 20).map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${cfg.publicUrl}/blog/${p.slug}`, datePublished: p.date })) }] });
}

export function blogPostPage(cfg, slug) {
  const p = POSTS.find(x => x.slug === slug);
  if (!p) return null;
  const url = `${cfg.publicUrl}/blog/${p.slug}`;
  const others = POSTS.filter(x => x.slug !== slug).slice(0, 4);
  const src = p.sources.length ? `<h2>Sources</h2><ul>${p.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.title)}</a></li>`).join('')}</ul>` : '';
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/blog/">Blog</a> <span>/</span> <span>${esc(p.title)}</span></nav>
  <article class="card guide"><h1>${esc(p.title)}</h1>
  <p class="guide-meta"><span>${niceDate(p.date)}</span><span>By Billiard Action Time</span></p>
  ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" style="max-width:100%;border-radius:8px;margin:0 0 14px">` : ''}${p.body}${src}${shareStrip(cfg, `/blog/${p.slug}`, p.title, p.title)}</article>
  ${others.length ? `<section class="sec seo-sec"><h2>More from the blog</h2><div class="guide-next">${others.map(x => `<a href="/blog/${x.slug}"><small>${niceDate(x.date)}</small><b>${esc(x.title)}</b></a>`).join('')}</div><p style="margin-top:12px"><a href="/blog/">All posts →</a></p></section>` : ''}`;
  const ld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description, url, datePublished: p.date, dateModified: p.date, ...(p.image ? { image: p.image } : {}),
    publisher: { '@type': 'Organization', name: 'Billiard Action Time', logo: { '@type': 'ImageObject', url: cfg.publicUrl + '/icons/icon-512.png' } }, author: { '@type': 'Organization', name: 'Billiard Action Time' } };
  let out = layout(cfg, { title: `${p.title} | Billiard Action Time`, description: p.description, path: `/blog/${p.slug}`, body, jsonld: [ld], ogImage: p.image || undefined });
  out = out.replace('<meta property="og:type" content="website">', `<meta property="og:type" content="article"><meta property="article:published_time" content="${p.date}">`);
  if (p.image) out = out.replace(/<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">/, '');
  return out;
}

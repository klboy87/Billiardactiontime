// The brand's social accounts, used for the header/footer links and the Organization schema (sameAs).
// Only brand accounts belong here, never a personal profile or name.
export const SOCIAL = [
  { name: 'Facebook', label: 'Billiard Action Time on Facebook', url: 'https://www.facebook.com/101659817843047' },
  { name: 'Instagram', label: 'Billiard Action Time on Instagram', url: 'https://www.instagram.com/timetoenjoynow/' },
  { name: 'TikTok', label: 'Billiard Action Time on TikTok', url: 'https://www.tiktok.com/@billiardactiontime' },
  { name: 'YouTube', label: 'Billiard Action Time on YouTube', url: 'https://www.youtube.com/@Billiardactiontime' }
];
export const SAME_AS = SOCIAL.map(s => s.url);
export const socialLinksHtml = (cls = 'social-links') => `<span class="${cls}">${SOCIAL.map(s => `<a href="${s.url}" target="_blank" rel="noopener me" aria-label="${s.label}">${s.name}</a>`).join('')}</span>`;
// Barlow (body) and Barlow Condensed (headings), the fonts styles.css asks for. display=swap shows text right away.
export const FONT_LINKS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap">';

// "Subscribe on YouTube" button. Goes through /youtube (counted as an outbound click, then 302 to the channel).
export const YOUTUBE_OUT = '/youtube';
export const youtubeCtaHtml = (text = 'Watch pool match recaps and trick shots on our YouTube channel.') => `<section class="card yt-cta" style="margin:18px 0;padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;justify-content:space-between">
    <p style="margin:0;flex:1;min-width:200px"><b>▶ Billiard Action Time on YouTube.</b> ${text}</p>
    <a class="btn" href="${YOUTUBE_OUT}" target="_blank" rel="noopener" style="background:#c4302b;color:#fff">Subscribe on YouTube</a></section>`;

// Click-to-load YouTube embed. The iframe's srcdoc is just a thumbnail + play link, so nothing from
// YouTube loads until the visitor clicks (page speed unchanged, no inline script needed under the CSP).
// Only our own channel's video IDs go here.
export const validYoutubeId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
const escA = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function youtubeEmbedHtml(id, title = '', credit = '') {
  id = validYoutubeId(id);
  if (!id) return '';
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  const doc = `<style>*{margin:0;padding:0}html,body{height:100%;overflow:hidden;background:#000}a{display:block;height:100%;position:relative}img{width:100%;height:100%;object-fit:cover}span{position:absolute;inset:0;margin:auto;width:68px;height:48px;border-radius:12px;background:rgba(200,0,0,.9);color:#fff;font:28px/48px sans-serif;text-align:center}</style><a href="${src}" title="Play: ${escA(title)}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="${escA(title)}"><span>▶</span></a>`;
  return `<figure class="yt-embed" style="margin:16px 0"><div style="position:relative;padding-top:56.25%;border-radius:8px;overflow:hidden;background:#000"><iframe src="${src}" srcdoc="${escA(doc)}" title="${escA(title || 'YouTube video')}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div>${credit ? `<figcaption class="muted" style="font-size:13px;margin-top:4px">${escA(credit)}</figcaption>` : ''}</figure>`;
}

// Featured long-form video shown near the top of /blog/ (our own channel's upload; click-to-load).
export const FEATURED_VIDEOS = [
  { id: 'to37QPkQJgk', title: 'Efren Reyes vs Lukas Fracasso-Verner: The Foul Nobody Saw' },
  { id: 'vkUgsGcMB18', title: "Efren Reyes' Big Cut: The Cue Ball Just Dies" },
  { id: 'Vo_qtjqsDpI', title: "Efren Reyes vs Mike Dechaine: Lucky or Genius? The Booth Can't Decide" }
];
export const FEATURED_VIDEO = FEATURED_VIDEOS[0];
export function featuredVideoHtml(list = FEATURED_VIDEOS) {
  const vids = (Array.isArray(list) ? list : [list]).filter(v => v && validYoutubeId(v.id));
  if (!vids.length) return '';
  const one = v => `<div style="flex:1 1 280px;min-width:0"><h3 style="margin:0 0 2px;font-size:1rem">${escA(v.title)}</h3>${youtubeEmbedHtml(v.id, v.title)}</div>`;
  return `<section class="card yt-featured" style="margin:18px 0;padding:14px 18px"><h2 style="margin:0 0 6px;font-size:1.2rem">▶ Featured ${vids.length > 1 ? 'videos' : 'video'}</h2><div style="display:flex;flex-wrap:wrap;gap:0 18px">${vids.map(one).join('')}</div><p style="margin:0"><a href="${YOUTUBE_OUT}" target="_blank" rel="noopener"><b>More on our YouTube channel →</b></a></p></section>`;
}

// Mosconi Cup "Pick the winner" link card (home page, Mosconi blog posts). Picks close 1 PM ET Nov 27;
// after that it links to the fan-picks result until Dec 1, then disappears.
export const MOSCONI_PICKS_CLOSE_MS = Date.UTC(2026, 10, 27, 18, 0, 0);
const MOSCONI_PROMO_END_MS = Date.UTC(2026, 11, 1, 5, 0, 0);
export function mosconiPickCardHtml(now = Date.now()) {
  if (now >= MOSCONI_PROMO_END_MS) return '';
  const open = now < MOSCONI_PICKS_CLOSE_MS;
  const text = open ? '🏆 Pick the Mosconi Cup winner: Europe or USA? →' : '🏆 See how fans picked the Mosconi Cup →';
  return `<p class="card mosconi-pick-card" style="margin:12px 0;padding:10px 14px;border:2px solid #1f4fa3;font-weight:700"><a href="/mosconi-cup-2026#pick-the-winner">${text}</a></p>`;
}

// "Latest Shorts" strip: click-to-load vertical facades (same approach as youtubeEmbedHtml, nothing loads
// from YouTube until a click). Our own channel's Shorts only, newest first. "after" (ISO UTC) hides a Short
// until it is public.
export const SHORTS = [
  { id: 'LcfBuB4x7ZE' }, { id: 'HZvK6-Qp-j0' },
  { id: 'dvmThoJc2rY', after: '2026-11-19T17:00:00Z' },
  { id: 'dhZK3qHdPRo' }, { id: '7A2xb9BhCCc' }, { id: 'TNU1jhBxPM4' }, { id: 'cu_NtTqX_pY' }
];
export function latestShorts(now = new Date(), max = 5) {
  return SHORTS.filter(s => validYoutubeId(s.id) && (!s.after || now >= new Date(s.after))).slice(0, max).map(s => s.id);
}
function shortFacade(id) {
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  const doc = `<style>*{margin:0;padding:0}html,body{height:100%;overflow:hidden;background:#000}a{display:block;height:100%;position:relative}img{width:100%;height:100%;object-fit:cover}span{position:absolute;inset:0;margin:auto;width:56px;height:40px;border-radius:10px;background:rgba(200,0,0,.9);color:#fff;font:22px/40px sans-serif;text-align:center}</style><a href="${src}" title="Play this Short"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="Billiard Action Time Short"><span>▶</span></a>`;
  return `<div style="flex:0 0 150px;scroll-snap-align:start"><div style="position:relative;padding-top:177.78%;border-radius:10px;overflow:hidden;background:#000"><iframe src="${src}" srcdoc="${escA(doc)}" title="Billiard Action Time Short" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div></div>`;
}
export function youtubeShortsHtml(now = new Date(), attrs = '') {
  const ids = latestShorts(now);
  if (!ids.length) return '';
  return `<section class="card yt-shorts" ${attrs} style="margin:18px 0;padding:14px 18px"><div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px"><h2 style="margin:0;font-size:1.2rem">▶ Latest Shorts</h2><a href="${YOUTUBE_OUT}" target="_blank" rel="noopener"><b>See all videos →</b></a></div>
    <div style="display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:10px 0 4px">${ids.map(shortFacade).join('')}</div></section>`;
}

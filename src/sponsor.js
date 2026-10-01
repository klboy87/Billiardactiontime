// Sponsor banner shown under the header on every page (app shell + server-rendered SEO pages).
// To change the link or swap sponsors, edit this file only.
export const SPONSOR_URL = 'https://lh-inventions.square.site/';

export function sponsorBannerHtml() {
  return `<a class="spn" href="${SPONSOR_URL}" target="_blank" rel="sponsored noopener" aria-label="BridgeMates — shop bridge heads and cue accessories (opens the LH Inventions store)">
  <span class="wrap spn-in">
    <img class="spn-logo" src="/sponsors/bm-logo.jpg" width="96" height="59" alt="LH BridgeMates logo">
    <span class="spn-txt"><span class="spn-tag">Sponsor</span><strong>BridgeMates</strong><span class="spn-sub">Bridge heads, cue holders &amp; rail tools</span></span>
    <span class="spn-pics" aria-hidden="true"><img src="/sponsors/bm-combo.jpg" width="56" height="56" alt="" loading="lazy"><img src="/sponsors/bm-x2.jpg" width="56" height="56" alt="" loading="lazy"><img src="/sponsors/bm-holder.jpg" width="56" height="56" alt="" loading="lazy"></span>
    <span class="spn-cta">Shop now →</span>
  </span>
</a>`;
}

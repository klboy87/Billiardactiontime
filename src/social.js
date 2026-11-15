// The brand's social accounts, used for the header/footer links and the Organization schema (sameAs).
// Only brand accounts belong here, never a personal profile or name.
export const SOCIAL = [
  { name: 'Facebook', label: 'Billiard Action Time on Facebook', url: 'https://www.facebook.com/101659817843047' },
  { name: 'Instagram', label: 'Billiard Action Time on Instagram', url: 'https://www.instagram.com/timetoenjoynow/' },
  { name: 'TikTok', label: 'Billiard Action Time on TikTok', url: 'https://www.tiktok.com/@billiardactiontime' }
];
export const SAME_AS = SOCIAL.map(s => s.url);
export const socialLinksHtml = (cls = 'social-links') => `<span class="${cls}">${SOCIAL.map(s => `<a href="${s.url}" target="_blank" rel="noopener me" aria-label="${s.label}">${s.name}</a>`).join('')}</span>`;
// Barlow (body) and Barlow Condensed (headings), the fonts styles.css asks for. display=swap shows text right away.
export const FONT_LINKS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap">';

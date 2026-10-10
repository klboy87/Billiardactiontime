// Minimal service worker: lets phones "Add to Home Screen" as an app. It does not cache pages,
// so visitors always see today's tournaments; when offline it shows a short notice instead of an error.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
    '<p style="font:18px system-ui;padding:24px">You are offline. Reconnect to see the latest pool tournaments.</p>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

/* Share buttons on tournament pages: native share sheet (with the card image when the phone
   supports it), copy link. Kept in its own file because the site's security policy blocks inline scripts. */
(function () {
  var box = document.querySelector('[data-share-url]');
  if (!box) return;
  var url = box.getAttribute('data-share-url'), title = box.getAttribute('data-share-title'), text = box.getAttribute('data-share-text');
  var card = box.getAttribute('data-share-card');
  var nativeBtn = box.querySelector('[data-share="native"]'), copyBtn = box.querySelector('[data-share="copy"]');
  if (nativeBtn && navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', function () {
      var plain = function () { navigator.share({ title: title, text: text, url: url }).catch(function () {}); };
      if (!card || !window.File || !navigator.canShare) return plain();
      fetch(card).then(function (r) { return r.blob(); }).then(function (b) {
        var f = new File([b], 'tournament.png', { type: 'image/png' });
        if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: title, text: text + ' ' + url }).catch(function () {});
        else plain();
      }).catch(plain);
    });
  }
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = 'Link copied'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
    else window.prompt('Copy this link:', url);
  });
})();

/* One-step weekly email signup (top bar and bottom of content pages). Subscribers don't see the top bar again. */
(function () {
  try { if (localStorage.getItem('bat_subscribed')) document.querySelectorAll('[data-sub-top]').forEach(function (el) { el.hidden = true; }); } catch (e) {}
  document.querySelectorAll('form[data-sub]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.fetch) return;
      e.preventDefault();
      var msg = f.parentNode.querySelector('.sub-msg'), btn = f.querySelector('button'), email = f.querySelector('input').value;
      btn.disabled = true;
      fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); }); })
        .then(function () { f.hidden = true; if (msg) msg.textContent = "✓ You're in! Watch for the daily email."; try { localStorage.setItem('bat_subscribed', '1'); } catch (e) {} })
        .catch(function (err) { if (msg) msg.textContent = '⚠ ' + err.message; btn.disabled = false; });
    });
  });
})();

/* Mosconi Cup "Pick the winner" box (/mosconi-cup-2026). */
(function () {
  var f = document.querySelector('form[data-pick]');
  if (!f || !window.fetch) return;
  var box = f.parentNode, msg = box.querySelector('.pick-msg'), bar = box.querySelector('[data-pick-bar]');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var team = f.querySelector('input[name="team"]:checked'), btn = f.querySelector('button');
    if (!team) { if (msg) msg.textContent = '⚠ Pick Europe or USA'; return; }
    var email = f.querySelector('input[name="email"]').value.trim();
    btn.disabled = true;
    fetch('/api/mosconi-pick', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: team.value, loser: f.querySelector('select[name="loser"]').value, email: email }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; }); })
      .then(function (j) {
        var who = team.value === 'usa' ? 'USA' : 'Europe', l = f.querySelector('select[name="loser"]').value;
        f.hidden = true;
        if (msg) msg.textContent = '✓ Pick saved: ' + who + ' 11–' + l + '.' + (j.subscribed ? " You'll get the daily results by email." : ' Check back here for the daily results.');
        if (bar && j.bar) bar.innerHTML = j.bar;
        if (j.subscribed) { try { localStorage.setItem('bat_subscribed', '1'); } catch (e) {} }
      })
      .catch(function (err) { if (msg) msg.textContent = '⚠ ' + err.message; btn.disabled = false; });
  });
})();

/* Mosconi Cup "Hosting a watch party?" box (/mosconi-cup-2026). */
(function () {
  var f = document.querySelector('form[data-watch-party]');
  if (!f || !window.fetch) return;
  var msg = f.parentNode.querySelector('.wp-msg');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var days = Array.prototype.map.call(f.querySelectorAll('input[name="days"]:checked'), function (c) { return c.value; });
    if (!days.length) { if (msg) msg.textContent = '⚠ Pick at least one day'; return; }
    var v = function (n) { return f.querySelector('[name="' + n + '"]').value.trim(); }, btn = f.querySelector('button');
    var sub = f.querySelector('input[name="subscribe"]').checked;
    if (sub && !v('email')) { if (msg) msg.textContent = '⚠ Add your email to get the daily email'; return; }
    btn.disabled = true;
    fetch('/api/watch-party', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hall: v('hall'), city: v('city'), state: v('state'), days: days, link: v('link'), email: v('email'), subscribe: sub }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; }); })
      .then(function (j) {
        f.hidden = true;
        if (msg) msg.textContent = "✓ Thanks! We'll check your watch party and add it to this page soon." + (j.subscribed ? " You're also on the daily email." : '');
      })
      .catch(function (err) { if (msg) msg.textContent = '⚠ ' + err.message; btn.disabled = false; });
  });
})();

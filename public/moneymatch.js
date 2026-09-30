/* Money match page: countdown to match time, "Who ya got?" fan vote, and comments.
   Kept in its own file because the site's security policy blocks inline scripts. */
(function () {
  var tape = document.querySelector('[data-mm]');
  if (!tape) return;
  var id = tape.getAttribute('data-mm');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var voter = '';
  try { voter = localStorage.getItem('bat_voter') || ''; if (!voter) { voter = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''); localStorage.setItem('bat_voter', voter); } } catch (e) { voter = ''; }
  var api = function (path, body) {
    return fetch(path, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, voter ? { 'X-Voter': voter } : {}, (function () { try { var t = localStorage.getItem('bat_admin_token'); return t ? { Authorization: 'Bearer ' + t } : {}; } catch (e) { return {}; } })()), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; }); });
  };

  // countdown (match time on the viewer's clock; 7 PM if no time was given)
  var box = document.getElementById('mmCount');
  if (box && tape.getAttribute('data-done') !== '1') {
    var d = tape.getAttribute('data-date').split('-').map(Number), t = (tape.getAttribute('data-time') || '19:00').split(':').map(Number);
    var at = new Date(d[0], d[1] - 1, d[2], t[0], t[1]).getTime();
    var tick = function () {
      var ms = at - Date.now();
      if (ms <= 0) { box.innerHTML = ms > -6 * 3600e3 ? '<span class="live">HAPPENING NOW</span>' : ''; box.hidden = !box.innerHTML; return; }
      var s = Math.floor(ms / 1000), parts = [[Math.floor(s / 86400), 'DAYS'], [Math.floor(s % 86400 / 3600), 'HRS'], [Math.floor(s % 3600 / 60), 'MIN'], [s % 60, 'SEC']];
      box.innerHTML = parts.map(function (p) { return '<div><b>' + (p[1] === 'DAYS' ? p[0] : String(p[0]).padStart(2, '0')) + '</b><span>' + p[1] + '</span></div>'; }).join('');
      box.hidden = false;
    };
    tick(); setInterval(tick, 1000);
  }

  // fan vote
  var names = [].map.call(document.querySelectorAll('.mm-pick b'), function (b) { return b.textContent; });
  var draw = function (tally, mine) {
    var pct = function (n) { return tally.total ? Math.round(n / tally.total * 100) : 0; };
    [1, 2].forEach(function (k) {
      var v = k === 1 ? tally.p1 : tally.p2;
      document.querySelector('[data-pct="' + k + '"]').textContent = pct(v) + '%';
      document.querySelector('[data-bar="' + k + '"]').style.width = pct(v) + '%';
      document.querySelector('[data-pick="' + k + '"]').classList.toggle('mine', mine === k);
    });
    document.getElementById('mmVotes').textContent = tally.total.toLocaleString('en-US') + ' fan' + (tally.total === 1 ? '' : 's') + ' voted';
    document.getElementById('mmMine').textContent = mine ? ' · ✓ You picked ' + names[mine - 1] : '';
  };
  api('/api/money-matches/' + id).then(function (r) { draw(r.tally, r.myPick); }).catch(function () {});
  document.querySelectorAll('[data-pick]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.disabled) return;
      api('/api/money-matches/' + id + '/vote', { pick: Number(b.getAttribute('data-pick')) })
        .then(function (r) { draw(r.tally, r.myPick); })
        .catch(function (e) { document.getElementById('mmMine').textContent = ' · ' + e.message; });
    });
  });

  // comments
  var form = document.getElementById('cForm'), list = document.getElementById('cList');
  if (!form) return;
  try { form.name.value = localStorage.getItem('bat_match_name') || ''; form.contact.value = localStorage.getItem('bat_match_contact') || ''; } catch (e) { /* ignore */ }
  var linkify = function (s) {
    var re = /((?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.com|fb\.me|m\.me|messenger\.com)\/[^\s<>"']+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|((?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b)/gi;
    var out = '', last = 0, m; s = String(s || '');
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index)); last = m.index + m[0].length;
      var href = m[1] ? (/^https?:/i.test(m[1]) ? m[1] : 'https://' + m[1]) : m[2] ? 'mailto:' + m[2] : 'tel:' + m[3].replace(/[^\d+]/g, '');
      out += '<a href="' + esc(href) + '"' + (m[1] ? ' target="_blank" rel="noopener nofollow ugc"' : '') + '>' + esc(m[0]) + '</a>';
    }
    return out + esc(s.slice(last));
  };
  var isAdmin = false; try { isAdmin = !!localStorage.getItem('bat_admin_token'); } catch (e) { /* ignore */ }
  var drawComments = function (cs) {
    document.getElementById('cCount').textContent = cs.length;
    list.innerHTML = cs.map(function (c) {
      return '<div class="mcomment"><div class="mcomment-top"><b>' + esc(c.name) + '</b>' + (isAdmin ? '<button type="button" class="btn btn-out btn-sm" data-cdel="' + c.id + '">Delete</button>' : '') + '</div><p>' + linkify(c.body) + '</p>' + (c.contact ? '<p class="mcontact">📞 ' + linkify(c.contact) + '</p>' : '') + '</div>';
    }).join('') || '<p class="muted">No comments yet. Start the conversation.</p>';
  };
  if (isAdmin) api('/api/money-matches/' + id).then(function (r) { drawComments(r.comments); }).catch(function () {});
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type=submit]'), msg = document.getElementById('cMsg');
    var body = { name: form.name.value, body: form.body.value, contact: form.contact.value };
    btn.disabled = true;
    api('/api/money-matches/' + id + '/comment', body).then(function (r) {
      try { localStorage.setItem('bat_match_name', body.name); localStorage.setItem('bat_match_contact', body.contact || ''); } catch (e2) { /* ignore */ }
      form.body.value = ''; msg.innerHTML = ''; drawComments(r.comments);
    }).catch(function (err) { msg.innerHTML = '<p class="aerr">' + esc(err.message) + '</p>'; }).then(function () { btn.disabled = false; });
  });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cdel]'); if (!b) return;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Tap again to delete'; setTimeout(function () { b.classList.remove('armed'); b.textContent = 'Delete'; }, 4000); return; }
    api('/api/money-matches/' + id + '/comments/' + b.getAttribute('data-cdel') + '/delete', {}).then(function (r) { drawComments(r.comments); }).catch(function (err) { b.textContent = err.message; });
  });
})();

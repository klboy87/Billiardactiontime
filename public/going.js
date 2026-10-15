/* "I'm going" on tournament pages: anonymous, one per browser, count shown on the button. Own file for the CSP. */
(function () {
  var btn = document.querySelector('[data-going]');
  if (!btn || !window.fetch) return;
  var id = btn.getAttribute('data-going'), voter = '';
  try { voter = localStorage.getItem('bat_voter') || ''; if (!voter) { voter = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now() + String(Math.random()).slice(2)).replace(/-/g, ''); localStorage.setItem('bat_voter', voter); } } catch (e) { voter = ''; }
  var mine = false;
  var paint = function (count) {
    btn.textContent = (mine ? "✅ You're going" : "👍 I'm going") + (count ? ' · ' + count : '');
    btn.classList.toggle('btn-green', mine); btn.classList.toggle('btn-out', !mine);
    btn.setAttribute('aria-pressed', String(mine));
  };
  var call = function (body) {
    return fetch('/api/tournaments/' + id + '/going', { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, voter ? { 'X-Voter': voter } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Error'); return j; }); });
  };
  call().then(function (j) { mine = !!j.mine; paint(j.count); }).catch(function () {});
  btn.addEventListener('click', function () {
    if (!voter) { btn.textContent = 'Turn on cookies/storage to use this'; return; }
    btn.disabled = true;
    call({ going: !mine }).then(function (j) { mine = !!j.mine; paint(j.count); }).catch(function (e) { btn.textContent = e.message; }).then(function () { btn.disabled = false; });
  });
})();

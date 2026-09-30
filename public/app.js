/* Billiard Action Time -- frontend application (vanilla JS, hash router) */
(() => {
  'use strict';

  const GAMES = ['9-Ball', '8-Ball', '10-Ball', 'One Pocket', 'Banks', 'Straight Pool', 'Scotch Doubles', 'Other'];
  const TABLE_SIZES = ['7-ft', '8-ft', '9-ft', 'Other'];
  const app = document.getElementById('app');
  document.getElementById('yr').textContent = new Date().getFullYear();

  // ---------------------------------------------------------------- utils
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => (n == null || n === '' ? null : '$' + Number(n).toLocaleString('en-US'));
  const fmtDate = iso => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };
  const fmtTime = t => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM', h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
  };
  const qs = obj => Object.entries(obj).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function adminToken() { return localStorage.getItem('bat_admin_token') || ''; }

  // ------------------------------------------------- local player data (device-only; no sign-in yet)
  const LS = { saved: 'bat_saved', submissions: 'bat_submissions', claims: 'bat_claims', alerts: 'bat_alerts', recent: 'bat_recent', memberSince: 'bat_member_since' };
  function lsGet(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage full or unavailable */ } }
  function memberSince() {
    let v = localStorage.getItem(LS.memberSince);
    if (!v) { v = new Date().toISOString(); try { localStorage.setItem(LS.memberSince, v); } catch { /* ignore */ } }
    return v;
  }
  function isSaved(id) { return lsGet(LS.saved).some(t => String(t.id) === String(id)); }
  function toggleSaved(t) {
    const list = lsGet(LS.saved);
    const i = list.findIndex(x => String(x.id) === String(t.id));
    if (i === -1) list.unshift(t); else list.splice(i, 1);
    lsSet(LS.saved, list.slice(0, 100));
    return i === -1;
  }
  function recordSubmission(rec) { const list = lsGet(LS.submissions); list.unshift(rec); lsSet(LS.submissions, list.slice(0, 300)); }
  function recordClaim(rec) { const list = lsGet(LS.claims); list.unshift(rec); lsSet(LS.claims, list.slice(0, 300)); }
  function recordAlert(email) {
    const list = lsGet(LS.alerts);
    if (!list.some(a => a.email === email)) list.unshift({ email, at: new Date().toISOString() });
    lsSet(LS.alerts, list.slice(0, 50));
  }
  function recordRecent(t) {
    const list = lsGet(LS.recent).filter(x => String(x.id) !== String(t.id));
    list.unshift(t);
    lsSet(LS.recent, list.slice(0, 20));
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (path.startsWith('/api/admin/')) headers.Authorization = 'Bearer ' + adminToken();
    const res = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  // ------------------------------------------------------ places (states/cities)
  let placesPromise = null;
  function loadPlaces() {
    if (!placesPromise) placesPromise = api('/api/places').catch(e => { placesPromise = null; throw e; });
    return placesPromise;
  }
  async function citiesForState(state) {
    if (!state) return [];
    const data = await api('/api/places?state=' + encodeURIComponent(state));
    return data.cities || [];
  }

  // Builds a linked "State" + "City" dropdown pair. Every US state is always listed,
  // even states or cities that have no tournament posted yet -- the city list comes
  // from /api/places, which merges known cities with any real venue cities on file.
  function stateCitySelects({ state = '', city = '', idPrefix = 'sc', onChange } = {}) {
    return `<div class="twosel" data-statecity="${idPrefix}">
      <div class="fg">
        <label for="${idPrefix}State">State</label>
        <select id="${idPrefix}State" data-role="state">
          <option value="">All states</option>
        </select>
      </div>
      <div class="fg">
        <label for="${idPrefix}City">City</label>
        <select id="${idPrefix}City" data-role="city" disabled>
          <option value="">${state ? 'All cities' : 'Choose a state first'}</option>
        </select>
      </div>
    </div>`;
  }

  async function wireStateCitySelects(root, idPrefix, { state = '', city = '', onChange } = {}) {
    const stateSel = root.querySelector(`#${idPrefix}State`);
    const citySel = root.querySelector(`#${idPrefix}City`);
    if (!stateSel || !citySel) return;
    let places;
    try { places = await loadPlaces(); }
    catch { stateSel.insertAdjacentHTML('beforeend', '<option value="">(states unavailable)</option>'); return; }
    for (const s of places.states) stateSel.insertAdjacentHTML('beforeend', `<option value="${esc(s.code)}">${esc(s.name)}</option>`);
    stateSel.value = state || '';

    async function fillCities(st, selected) {
      citySel.innerHTML = '';
      if (!st) {
        citySel.disabled = true;
        citySel.insertAdjacentHTML('beforeend', '<option value="">Choose a state first</option>');
        return;
      }
      citySel.disabled = true;
      citySel.insertAdjacentHTML('beforeend', '<option value="">Loading cities…</option>');
      const cities = places.cities && places.cities[st] ? places.cities[st] : await citiesForState(st).catch(() => []);
      citySel.innerHTML = '<option value="">All cities</option>';
      for (const c of cities) citySel.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`);
      citySel.disabled = false;
      if (selected && cities.includes(selected)) citySel.value = selected;
    }

    await fillCities(state, city);

    stateSel.addEventListener('change', async () => {
      await fillCities(stateSel.value, '');
      onChange && onChange({ state: stateSel.value, city: '' });
    });
    citySel.addEventListener('change', () => onChange && onChange({ state: stateSel.value, city: citySel.value }));
  }

  // ------------------------------------------------------------ small parts
  function gameChip(g) {
    const cls = { '8-Ball': 't-blue', '9-Ball': 't-green', '10-Ball': 't-purple' }[g] || 't-orange';
    return `<span class="chip ${cls}">${esc(g)}</span>`;
  }

  function saveButtonHtml(t) {
    const v = t.venue || {};
    const saved = isSaved(t.id);
    const tMini = { id: t.id, name: t.name, date: t.date, game: t.game, venue: { name: v.name, city: v.city, state: v.state } };
    return `<button type="button" class="savebtn${saved ? ' on' : ''}" data-t='${esc(JSON.stringify(tMini))}' aria-label="Save tournament">${saved ? '★' : '☆'}</button>`;
  }

  function tournamentCard(t) {
    const v = t.venue || {};
    return `<a class="tcard" href="#/t/${t.id}">
      ${saveButtonHtml(t)}
      <div class="badges">${gameChip(t.game || 'Other')}${t.verified ? '<span class="verified">✓ Verified</span>' : ''}</div>
      <h3>${esc(t.name)}</h3>
      <div class="muted">${esc(fmtDate(t.date))}${t.time ? ' · ' + esc(fmtTime(t.time)) : ''}</div>
      <div class="muted">${esc(v.name || '')}${v.city ? ' — ' + esc(v.city) + ', ' + esc(v.state || '') : ''}</div>
      <div class="facts">
        ${t.entry != null ? `<span>Entry ${esc(money(t.entry))}</span>` : ''}
        ${t.added ? `<span>Added ${esc(money(t.added))}</span>` : ''}
        ${t.format ? `<span>${esc(t.format)}</span>` : ''}
      </div>
    </a>`;
  }

  // ------------------------------------------------------------- game balls
  const BALL_META = {
    '9-Ball': { num: 9, color: '#e0ac1f', stripe: true, bgA: '#caa23a', bgB: '#4d3a0c' },
    '8-Ball': { num: 8, color: '#161616', stripe: false, bgA: '#3a3a3a', bgB: '#050505' },
    '10-Ball': { num: 10, color: '#1f5fd1', stripe: true, bgA: '#2b6fe0', bgB: '#0d2a66' },
    'One Pocket': { num: 1, color: '#f0c419', stripe: false, bgA: '#8a55f0', bgB: '#3d1c8a' },
    'Banks': { num: 6, color: '#1e8a3d', stripe: false, bgA: '#22ad4d', bgB: '#0d4f21' },
    'Straight Pool': { num: 15, color: '#7a1f1f', stripe: true, bgA: '#a3312f', bgB: '#4f1414' },
    'Scotch Doubles': { num: 3, color: '#d63a40', stripe: false, bgA: '#1e9c86', bgB: '#0d3f36' },
    'Other': { num: '?', color: '#666', stripe: false, bgA: '#4a5568', bgB: '#1c2431' }
  };
  function ballIcon(meta) {
    const bg = meta.stripe
      ? `linear-gradient(to bottom, ${meta.color} 0%, ${meta.color} 26%, #fff 26%, #fff 74%, ${meta.color} 74%, ${meta.color} 100%)`
      : meta.color;
    return `<div class="ball" style="background:${bg}"><span>${meta.num}</span></div>`;
  }
  function gameTile(game, count) {
    const meta = BALL_META[game] || BALL_META.Other;
    return `<a class="tile gametile" href="#/search?game=${encodeURIComponent(game)}" style="background:linear-gradient(160deg,${meta.bgA},${meta.bgB})">
      ${ballIcon(meta)}
      <h3>${esc(game.toUpperCase())}</h3>
      <span>${count} tournament${count === 1 ? '' : 's'}</span>
    </a>`;
  }

  function loading(msg = 'Loading…') { return `<div class="loadwrap"><p class="muted">${esc(msg)}</p></div>`; }
  function errorBox(msg) { return `<div class="loadwrap"><p class="muted">⚠ ${esc(msg)}</p></div>`; }

  // -------------------------------------------------------------- ROUTES
  const routes = {};

  routes['/'] = async () => {
    app.innerHTML = `
      <section class="hero">
        <div class="hero-in">
          <h1>Find your next pool tournament</h1>
          <p class="lead">Search pool tournaments by date, location, game, entry fee, and more.</p>
          <form class="hsearch" id="homeSearch">
            <input type="text" id="homeQuery" placeholder="Search tournaments, cities, venues, games…">
            <button type="submit" aria-label="Search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
          </form>
          <p class="eg">Example: 9-Ball Battle Creek</p>
          <div class="totalstat" id="totalStat"><span class="ic">🎱</span> <span id="totalStatText">Loading tournament count…</span></div>
        </div>
      </section>
      <section class="sec tiles">
        <a class="tile t-blue" href="#/search"><div class="ic">🔍</div><h3>Find a Tournament</h3></a>
        <a class="tile t-orange" href="#/calendar"><div class="ic">📅</div><h3>Find by Date</h3></a>
        <a class="tile t-pink" href="#/states"><div class="ic">🗺️</div><h3>Browse by State</h3></a>
        <button class="tile t-purple" id="homeFlyerBtn" type="button"><div class="ic">📷</div><h3>Scan a Flyer</h3></button>
        <a class="tile t-green" href="#/post"><span class="free">FREE</span><div class="ic">➕</div><h3>Post a Tournament</h3></a>
        <a class="tile t-gold" href="#/stakes"><span class="free">NEW</span><div class="ic">🐎</div><h3>Stake Horse Board</h3></a>
        <a class="tile t-red" href="#/auctions"><span class="free">NEW</span><div class="ic">🔨</div><h3>Calcutta Auctions</h3></a>
      </section>
      <input type="file" id="homeFlyerInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none">
      <p class="muted" id="homeFlyerStatus" style="text-align:center"></p>
      <section class="sec">
        <h2>This Weekend</h2>
        <div id="weekendStats" class="wk">${loading()}</div>
      </section>
      <section class="sec">
        <div class="sec-head"><h2>Tournaments Near You</h2></div>
        <div id="nearHome" class="loadwrap"><button class="btn btn-out" id="nearHomeBtn">📍 Show Tournaments Near Me</button></div>
      </section>
      <section class="sec">
        <div class="sec-head"><h2>Upcoming Tournaments</h2><a href="#/search">See all →</a></div>
        <div id="homeList" class="results">${loading()}</div>
      </section>
      <section class="sec featband on-dark">
        <h2>Why Players Use Billiard Action Time</h2>
        <div class="feat">
          <div class="card"><div class="ficon" style="background:var(--purple)">📷</div><h3>Scan, Don't Type</h3><p class="muted">Snap a photo of any flyer. We pull out the date, game, and entry fee so you can check it and post.</p></div>
          <div class="card"><div class="ficon" style="background:var(--blue)">🔔</div><h3>Never Miss a Game</h3><p class="muted">Set an alert for your game and your radius. We tell you the moment a match is posted.</p></div>
          <div class="card"><div class="ficon" style="background:var(--green)">🛡️</div><h3>Free for Directors</h3><p class="muted">Posting is free. Claim your listing to keep the details accurate and promote your event.</p></div>
        </div>
      </section>`;

    document.getElementById('homeSearch').addEventListener('submit', e => {
      e.preventDefault();
      location.hash = '#/search?' + qs({ q: document.getElementById('homeQuery').value.trim() });
    });

    document.getElementById('homeFlyerBtn').addEventListener('click', () => document.getElementById('homeFlyerInput').click());
    document.getElementById('homeFlyerInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      const status = document.getElementById('homeFlyerStatus');
      if (!file) return;
      let cfg;
      try { cfg = await api('/api/config'); } catch { cfg = { scan: false }; }
      if (!cfg.scan) { status.textContent = "Flyer scanning isn't turned on for this site yet."; e.target.value = ''; return; }
      status.textContent = 'Reading flyer…';
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = await api('/api/scan', { method: 'POST', body: { image: reader.result } });
          sessionStorage.setItem('bat_scanned_flyer', JSON.stringify(data.fields || {}));
          try { sessionStorage.setItem('bat_scanned_flyer_image', reader.result); } catch { /* too big, skip */ }
          status.textContent = 'Got it! Opening the post form…';
          location.hash = '#/post';
        } catch (err) { status.textContent = 'Could not read that flyer: ' + err.message; e.target.value = ''; }
      };
      reader.readAsDataURL(file);
    });

    // Total tournaments listed sitewide
    (async () => {
      const el = document.getElementById('totalStatText');
      try {
        const data = await api('/api/tournaments?limit=50000');
        const n = data.tournaments.length;
        el.innerHTML = `<b>${n.toLocaleString('en-US')}</b> tournament${n === 1 ? '' : 's'} listed right now`;
      } catch { el.textContent = 'Tournament count unavailable'; }
    })();

    // This Weekend
    (async () => {
      const wrap = document.getElementById('weekendStats');
      const today = new Date(); const dow = today.getDay();
      const friOffset = (5 - dow + 7) % 7;
      const days = [0, 1, 2].map(n => { const d = new Date(today); d.setDate(today.getDate() + friOffset + n); return d; });
      const iso = d => d.toISOString().slice(0, 10);
      const labels = ['Friday', 'Saturday', 'Sunday'];
      try {
        const data = await api('/api/tournaments?' + qs({ from: iso(days[0]), to: iso(days[2]), limit: 5000 }));
        const counts = [0, 0, 0];
        for (const t of data.tournaments) { const idx = days.findIndex(d => iso(d) === t.date); if (idx !== -1) counts[idx]++; }
        wrap.innerHTML = labels.map((lab, i) => `
          <a href="#/calendar">
            <small>${esc(lab).toUpperCase()}</small>
            <b>${counts[i]}</b>
            <span>Tournament${counts[i] === 1 ? '' : 's'}</span>
          </a>`).join('');
      } catch (e) { wrap.innerHTML = errorBox(e.message); }
    })();

    // Tournaments Near You (opt-in, since it needs location permission)
    document.getElementById('nearHomeBtn').addEventListener('click', () => {
      const box = document.getElementById('nearHome');
      if (!navigator.geolocation) { box.innerHTML = '<p class="muted">Location is not available in this browser.</p>'; return; }
      box.innerHTML = loading('Finding tournaments near you…');
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude, longitude } = pos.coords;
        try {
          const data = await api('/api/tournaments?limit=5000');
          const R = 3958.8;
          const withDist = data.tournaments.filter(t => t.venue.lat != null && t.venue.lng != null).map(t => {
            const dLat = (t.venue.lat - latitude) * Math.PI / 180, dLng = (t.venue.lng - longitude) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(latitude * Math.PI / 180) * Math.cos(t.venue.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
            return { t, dist: R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
          }).sort((a, b) => a.dist - b.dist).slice(0, 3);
          box.className = 'results';
          box.innerHTML = withDist.length ? withDist.map(({ t, dist }) => tournamentCard(t).replace('</h3>', `</h3><div class="dist">${dist.toFixed(1)} mi away</div>`)).join('')
            : '<div class="loadwrap"><p class="muted">No geocoded tournaments nearby yet.</p></div>';
        } catch (e) { box.className = 'loadwrap'; box.innerHTML = errorBox(e.message); }
      }, () => { box.innerHTML = '<p class="muted">Could not get your location. Check your browser\'s location permission and try again.</p>'; });
    });

    try {
      const data = await api('/api/tournaments?limit=9');
      document.getElementById('homeList').innerHTML = data.tournaments.length
        ? data.tournaments.map(tournamentCard).join('')
        : `<div class="loadwrap"><p class="muted">No tournaments posted yet. <a href="#/post">Post one</a> or turn on syncing from your source site.</p></div>`;
    } catch (e) { document.getElementById('homeList').innerHTML = errorBox(e.message); }
  };

  routes['/search'] = async (params) => {
    const state = params.get('state') || '', city = params.get('city') || '', game = params.get('game') || '', q = params.get('q') || '';
    app.innerHTML = `
      <div class="pagehead"><h1>Find Tournaments</h1></div>
      <div class="slayout">
        <form class="filters card" id="filters">
          <div class="fg"><label for="fQuery">Search</label><input type="text" id="fQuery" placeholder="Name, city, venue, game…" value="${esc(q)}"></div>
          ${stateCitySelects({ state, city, idPrefix: 'f' })}
          <div class="fg">
            <label for="fGame">Game</label>
            <select id="fGame">
              <option value="">All games</option>
              ${GAMES.map(g => `<option value="${esc(g)}" ${g === game ? 'selected' : ''}>${esc(g)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-blue" type="submit">Apply Filters</button>
        </form>
        <div>
          <div id="results" class="results">${loading()}</div>
        </div>
      </div>`;
    const filtersEl = document.getElementById('filters');
    await wireStateCitySelects(filtersEl, 'f', { state, city });
    document.getElementById('fGame').value = game;

    async function runSearch() {
      const qv = document.getElementById('fQuery').value.trim();
      const st = document.getElementById('fState').value, ct = document.getElementById('fCity').value, gm = document.getElementById('fGame').value;
      history.replaceState(null, '', '#/search?' + qs({ q: qv, state: st, city: ct, game: gm }));
      const results = document.getElementById('results');
      results.innerHTML = loading();
      try {
        const data = await api('/api/tournaments?' + qs({ state: st }));
        let list = data.tournaments;
        if (ct) list = list.filter(t => t.venue.city.toLowerCase() === ct.toLowerCase());
        if (gm) list = list.filter(t => t.game === gm);
        if (qv) {
          const needle = qv.toLowerCase();
          list = list.filter(t => [t.name, t.venue.name, t.venue.city, t.venue.state, t.game].filter(Boolean).some(v => v.toLowerCase().includes(needle)));
        }
        results.innerHTML = list.length ? list.map(tournamentCard).join('')
          : `<div class="loadwrap"><p class="muted">No tournaments found${qv ? ` for "${esc(qv)}"` : ''}${ct ? ` in ${esc(ct)}, ${esc(st)}` : st ? ` in ${esc(st)}` : ''} yet.
             You can still <a href="#/post">post one</a> so players know it's happening here.</p></div>`;
      } catch (e) { results.innerHTML = errorBox(e.message); }
    }
    filtersEl.addEventListener('submit', e => { e.preventDefault(); runSearch(); });
    runSearch();
  };

  routes['/states'] = async () => {
    app.innerHTML = `<div class="pagehead"><h1>Browse by State</h1></div><div id="stateGrid" class="results">${loading()}</div>`;
    try {
      const [places, data] = await Promise.all([api('/api/places'), api('/api/tournaments?limit=50000')]);
      const counts = {};
      for (const t of data.tournaments) counts[t.venue.state] = (counts[t.venue.state] || 0) + 1;
      const withCounts = places.states.map(s => ({ ...s, count: counts[s.code] || 0 }));
      const active = withCounts.filter(s => s.count > 0).sort((a, b) => b.count - a.count);
      const inactive = withCounts.filter(s => s.count === 0).sort((a, b) => a.name.localeCompare(b.name));
      const tile = s => `<a class="tile t-blue statecard" href="#/search?state=${esc(s.code)}"><h3>${esc(s.name)}</h3><span>${s.count} tournament${s.count === 1 ? '' : 's'}</span></a>`;
      document.getElementById('stateGrid').outerHTML = `
        <div id="stateGrid">
          <div class="tiles statetiles">${active.map(tile).join('')}</div>
          ${inactive.length ? `<h2 style="margin-top:24px">No tournaments posted yet</h2><div class="tiles statetiles">${inactive.map(tile).join('')}</div>` : ''}
        </div>`;
    } catch (e) { document.getElementById('stateGrid').innerHTML = errorBox(e.message); }
  };

  routes['/calendar'] = async (params) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    let view = ['month', 'week', 'day'].includes(params.get('view')) ? params.get('view') : 'month';
    let selected = /^\d{4}-\d{2}-\d{2}$/.test(params.get('d') || '') ? params.get('d') : todayIso;
    let [curYear, curMonth] = selected.split('-').map(Number); curMonth -= 1;

    app.innerHTML = `<div class="pagehead"><h1>Calendar</h1><p class="muted">Pick a day to see every tournament on it.</p></div><div id="calWrap">${loading()}</div>`;

    let all;
    try { all = (await api('/api/tournaments?limit=50000')).tournaments; }
    catch (e) { document.getElementById('calWrap').innerHTML = errorBox(e.message); return; }
    const byDate = {};
    for (const t of all) (byDate[t.date] ||= []).push(t);

    const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    const isoOf = d => d.toISOString().slice(0, 10);

    function dayCell(iso, label) {
      const has = (byDate[iso] || []).length;
      const cls = ['cday']; if (iso === todayIso) cls.push('today'); if (iso === selected) cls.push('sel');
      return `<button type="button" class="${cls.join(' ')}" data-d="${iso}"><span class="n">${label}</span>${has ? `<small>${has} tourney${has === 1 ? '' : 's'}</small>` : ''}</button>`;
    }

    function monthBody() {
      const first = new Date(curYear, curMonth, 1), startDow = first.getDay();
      const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
      const prevDays = new Date(curYear, curMonth, 0).getDate();
      let cells = '';
      for (let i = startDow - 1; i >= 0; i--) cells += `<div class="cday out">${prevDays - i}</div>`;
      for (let d = 1; d <= daysInMonth; d++) cells += dayCell(`${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, d);
      const trailing = (7 - ((startDow + daysInMonth) % 7)) % 7;
      for (let n = 1; n <= trailing; n++) cells += `<div class="cday out">${n}</div>`;
      return `
        <div class="calbar">
          <button class="btn btn-out btn-sm" id="calPrev">‹</button>
          <h2>${monthName(curYear, curMonth)}</h2>
          <button class="btn btn-out btn-sm" id="calNext">›</button>
        </div>
        <div class="cgrid">${DOW.map(d => `<div class="dh">${d}</div>`).join('')}${cells}</div>`;
    }

    function weekBody() {
      const d0 = new Date(selected + 'T00:00:00'); const start = new Date(d0); start.setDate(d0.getDate() - d0.getDay());
      const days = [...Array(7)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
      return `
        <div class="calbar">
          <button class="btn btn-out btn-sm" id="calPrev">‹</button>
          <h2>${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</h2>
          <button class="btn btn-out btn-sm" id="calNext">›</button>
        </div>
        <div class="cgrid">${DOW.map(d => `<div class="dh">${d}</div>`).join('')}${days.map(d => dayCell(isoOf(d), d.getDate())).join('')}</div>`;
    }

    function dayBody() {
      const d = new Date(selected + 'T00:00:00');
      return `<div class="calbar">
        <button class="btn btn-out btn-sm" id="calPrev">‹</button>
        <h2>${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
        <button class="btn btn-out btn-sm" id="calNext">›</button>
      </div>`;
    }

    function agendaBody() {
      const list = (byDate[selected] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      return `<div class="agenda">
        <h3>${new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
        <p class="muted">${list.length} tournament${list.length === 1 ? '' : 's'}</p>
        ${list.length ? list.map(t => `<a class="arow" href="#/t/${t.id}"><span class="tm">${t.time ? esc(fmtTime(t.time)) : 'TBD'}</span><span><b>${esc(t.name)}</b><small>${esc(t.venue.name)}, ${esc(t.venue.city)}, ${esc(t.venue.state)}</small></span></a>`).join('')
          : `<div class="loadwrap"><p class="muted">Nothing listed for this day yet. Know of one? <a href="#/post">Post a tournament</a> for free.</p></div>`}
      </div>`;
    }

    function paint() {
      const body = view === 'month' ? monthBody() : view === 'week' ? weekBody() : dayBody();
      document.getElementById('calWrap').innerHTML = `
        <div class="seg">
          <button data-v="month" class="${view === 'month' ? 'on' : ''}">Month</button>
          <button data-v="week" class="${view === 'week' ? 'on' : ''}">Week</button>
          <button data-v="day" class="${view === 'day' ? 'on' : ''}">Day</button>
        </div>
        ${body}
        ${agendaBody()}`;
      history.replaceState(null, '', '#/calendar?' + qs({ view, d: selected }));
      document.querySelectorAll('.seg button[data-v]').forEach(b => b.addEventListener('click', () => { view = b.dataset.v; paint(); }));
      const prevBtn = document.getElementById('calPrev'), nextBtn = document.getElementById('calNext');
      if (prevBtn) prevBtn.addEventListener('click', () => step(-1));
      if (nextBtn) nextBtn.addEventListener('click', () => step(1));
      document.querySelectorAll('.cday[data-d]').forEach(el => el.addEventListener('click', () => {
        selected = el.dataset.d; const [y, m] = selected.split('-').map(Number); curYear = y; curMonth = m - 1; paint();
      }));
    }

    function step(dir) {
      if (view === 'month') {
        curMonth += dir;
        if (curMonth < 0) { curMonth = 11; curYear--; }
        if (curMonth > 11) { curMonth = 0; curYear++; }
        selected = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`;
      } else {
        const d = new Date(selected + 'T00:00:00');
        d.setDate(d.getDate() + dir * (view === 'week' ? 7 : 1));
        selected = isoOf(d);
        const [y, m] = selected.split('-').map(Number); curYear = y; curMonth = m - 1;
      }
      paint();
    }

    paint();
  };

  routes['/near'] = async () => {
    app.innerHTML = `<div class="pagehead"><h1>Tournaments Near Me</h1></div>
      <div class="loadwrap"><p class="muted">Allow location access, or use <a href="#/search">Find Tournaments</a> to search by state and city instead.</p>
      <button class="btn btn-out" id="locBtn">Use My Location</button></div>
      <div id="nearList" class="results"></div>`;
    document.getElementById('locBtn').addEventListener('click', () => {
      if (!navigator.geolocation) return alert('Location is not available in this browser.');
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude, longitude } = pos.coords;
        const list = document.getElementById('nearList');
        list.innerHTML = loading('Finding nearby tournaments…');
        try {
          const data = await api('/api/tournaments?limit=5000');
          const R = 3958.8;
          const withDist = data.tournaments.filter(t => t.venue.lat != null && t.venue.lng != null).map(t => {
            const dLat = (t.venue.lat - latitude) * Math.PI / 180, dLng = (t.venue.lng - longitude) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(latitude * Math.PI / 180) * Math.cos(t.venue.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
            return { t, dist: R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
          }).sort((a, b) => a.dist - b.dist).slice(0, 30);
          list.innerHTML = withDist.length ? withDist.map(({ t, dist }) => tournamentCard(t).replace('</h3>', `</h3><div class="dist">${dist.toFixed(1)} mi away</div>`)).join('')
            : '<div class="loadwrap"><p class="muted">No geocoded tournaments nearby yet.</p></div>';
        } catch (e) { list.innerHTML = errorBox(e.message); }
      }, () => alert('Could not get your location.'));
    });
  };

  routes['/t'] = async (params, id) => {
    app.innerHTML = loading('Loading tournament…');
    let t;
    try { t = await api('/api/tournaments/' + id); }
    catch (e) { app.innerHTML = errorBox('Tournament not found.'); return; }
    recordRecent(t);
    app.innerHTML = `
      <div class="crumbs"><a href="#/search">Find Tournaments</a> / ${esc(t.name)}</div>
      <div class="card">
        ${saveButtonHtml(t)}
        <div class="badges">${gameChip(t.game)}${t.verified ? '<span class="verified">✓ Verified</span>' : ''}</div>
        <h1 class="dtitle">${esc(t.name)}</h1>
        <table class="t"><tbody>
          <tr><th>Date</th><td>${esc(fmtDate(t.date))}${t.time ? ' at ' + esc(fmtTime(t.time)) : ''}</td></tr>
          <tr><th>Venue</th><td>${esc(t.venue.name)}<br>${esc([t.venue.address, t.venue.city, t.venue.state, t.venue.zip].filter(Boolean).join(', '))}</td></tr>
          ${t.entry != null ? `<tr><th>Entry Fee</th><td>${esc(money(t.entry))}</td></tr>` : ''}
          ${t.added ? `<tr><th>Added Money</th><td>${esc(money(t.added))}</td></tr>` : ''}
          ${t.race ? `<tr><th>Race</th><td>${esc(t.race)}</td></tr>` : ''}
          ${t.format ? `<tr><th>Format</th><td>${esc(t.format)}</td></tr>` : ''}
          ${t.tableSize ? `<tr><th>Table Size</th><td>${esc(t.tableSize)}</td></tr>` : ''}
          ${t.limit ? `<tr><th>Player/Team Limit</th><td>${esc(t.limit)}</td></tr>` : ''}
          ${t.director.name ? `<tr><th>Director</th><td>${esc(t.director.name)} ${t.director.phone ? '· ' + esc(t.director.phone) : ''} ${t.director.email ? '· ' + esc(t.director.email) : ''}</td></tr>` : ''}
        </tbody></table>
        ${t.hasFlyer ? `<img class="previewimg" src="/api/tournaments/${t.id}/flyer" alt="Tournament flyer">` : ''}
        ${t.notes ? `<p>${esc(t.notes)}</p>` : ''}
        <div class="actbar">
          ${t.registrationUrl ? `<a class="btn btn-blue" href="${esc(t.registrationUrl)}" target="_blank" rel="noopener">Register</a>` : ''}
          ${t.website ? `<a class="btn btn-out" href="${esc(t.website)}" target="_blank" rel="noopener">Website</a>` : ''}
          ${t.pageUrl ? `<a class="btn btn-green" href="${esc(t.pageUrl)}#share">Share / Get Graphic</a>` : ''}
          <a class="btn btn-out" href="#/claim/${t.id}">Claim This Tournament</a>
          <a class="btn btn-out" href="#/report/${t.id}">Report a Problem</a>
        </div>
      </div>`;
  };

  routes['/venues'] = async () => {
    app.innerHTML = `<div class="pagehead"><h1>Venue Directory</h1></div><div id="vlist" class="vgrid">${loading()}</div>`;
    try {
      const data = await api('/api/tournaments?limit=5000');
      const venues = new Map();
      for (const t of data.tournaments) {
        const v = t.venue;
        if (!venues.has(v.id)) venues.set(v.id, { ...v, count: 0 });
        venues.get(v.id).count++;
      }
      const list = [...venues.values()].sort((a, b) => a.name.localeCompare(b.name));
      document.getElementById('vlist').innerHTML = list.length ? list.map(v => `
        <a class="vcard" href="#/venue/${v.id}">
          <h3>${esc(v.name)}</h3>
          <p class="muted">${esc(v.city)}, ${esc(v.state)}</p>
          <p class="muted">${v.count} upcoming tournament${v.count === 1 ? '' : 's'}</p>
        </a>`).join('') : `<div class="loadwrap"><p class="muted">No venues yet.</p></div>`;
    } catch (e) { document.getElementById('vlist').innerHTML = errorBox(e.message); }
  };

  routes['/venue'] = async (params, id) => {
    app.innerHTML = loading('Loading venue…');
    try {
      const data = await api('/api/tournaments?limit=5000');
      const list = data.tournaments.filter(t => String(t.venue.id) === String(id));
      if (!list.length) { app.innerHTML = errorBox('Venue not found or has no upcoming tournaments.'); return; }
      const v = list[0].venue;
      app.innerHTML = `
        <div class="crumbs"><a href="#/venues">Venues</a> / ${esc(v.name)}</div>
        <div class="vhero card">
          <h1>${esc(v.name)}</h1>
          <p class="muted">${esc([v.address, v.city, v.state, v.zip].filter(Boolean).join(', '))}</p>
          ${v.phone ? `<p>${esc(v.phone)}</p>` : ''}
          ${v.website ? `<a class="btn btn-out" href="${esc(v.website)}" target="_blank" rel="noopener">Website</a>` : ''}
        </div>
        <h2>Upcoming Tournaments</h2>
        <div class="results">${list.map(tournamentCard).join('')}</div>`;
    } catch (e) { app.innerHTML = errorBox(e.message); }
  };

  routes['/post'] = async () => {
    app.innerHTML = `
      <div class="pagehead"><h1>Post a Tournament</h1><p class="muted">Submitted tournaments are reviewed before they go live.</p></div>
      <form class="card" id="postForm">
        <div class="fg"><label>Tournament Name *</label><input name="name" required maxlength="120"></div>
        <div class="two">
          <div class="fg"><label>Date *</label><input name="date" type="date" required></div>
          <div class="fg"><label>Time</label><input name="time" type="time"></div>
        </div>
        <div class="fg"><label>Game</label><select name="game">${GAMES.map(g => `<option>${esc(g)}</option>`).join('')}</select></div>
        <div class="two">
          <div class="fg"><label>Entry Fee ($)</label><input name="entry" type="number" min="0" step="1"></div>
          <div class="fg"><label>Added Money ($)</label><input name="added" type="number" min="0" step="1"></div>
        </div>
        <div class="fg"><label>Venue Name *</label><input name="venueName" required maxlength="120"></div>
        <div class="fg"><label>Address</label><input name="address" maxlength="120"></div>
        <div class="two">
          <div class="fg"><label>City *</label><input name="city" required maxlength="80"></div>
          <div class="fg"><label>State *</label>
            <select name="state" required id="postState"><option value="">Select a state</option></select>
          </div>
        </div>
        <div class="fg"><label>Zip</label><input name="zip" maxlength="10"></div>
        <div class="two">
          <div class="fg"><label>Table Size</label><select name="tableSize"><option value="">Not specified</option>${TABLE_SIZES.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
          <div class="fg"><label>Player/Team Limit</label><input name="limit" type="number" min="0" step="1"></div>
        </div>
        <div class="fg"><label>Race To</label><input name="race" maxlength="40" placeholder="e.g. Race to 9"></div>
        <div class="fg"><label>Format</label><input name="format" maxlength="60" placeholder="e.g. Double Elimination"></div>
        <div class="fg"><label>Director Name</label><input name="directorName" maxlength="80"></div>
        <div class="two">
          <div class="fg"><label>Director Phone</label><input name="directorPhone" maxlength="30"></div>
          <div class="fg"><label>Director Email</label><input name="directorEmail" type="email" maxlength="120"></div>
        </div>
        <div class="fg"><label>Registration URL</label><input name="registrationUrl" type="url"></div>
        <div class="fg"><label>Description / Rules</label><textarea name="notes" maxlength="1000" rows="4"></textarea></div>
        <div class="fg" id="flyerFg"><label>Flyer Photo (optional)</label>
          <div id="flyerPreviewWrap"></div>
          <input type="file" id="flyerFile" accept="image/png,image/jpeg,image/webp,image/gif">
          <p class="muted" style="font-size:12.5px;margin-top:4px">Shown on the tournament's page once approved. Max 2 MB.</p>
        </div>
        <div id="postMsg"></div>
        <button class="btn btn-blue" type="submit">Submit for Review</button>
      </form>`;
    let flyerDataUrl = null;
    function showFlyerPreview(url) {
      flyerDataUrl = url;
      const wrap = document.getElementById('flyerPreviewWrap');
      wrap.innerHTML = url ? `<img class="previewimg" src="${url}" alt="Flyer preview" style="display:block;margin-bottom:8px">` : '';
    }
    document.getElementById('flyerFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2_000_000) { alert('That image is over 2 MB. Choose a smaller photo.'); e.target.value = ''; return; }
      const r = new FileReader();
      r.onload = () => showFlyerPreview(r.result);
      r.readAsDataURL(file);
    });
    loadPlaces().then(places => {
      const sel = document.getElementById('postState');
      for (const s of places.states) sel.insertAdjacentHTML('beforeend', `<option value="${esc(s.code)}">${esc(s.name)}</option>`);
      applyScannedFlyer();
    }).catch(() => { applyScannedFlyer(); });

    function applyScannedFlyer() {
      const raw = sessionStorage.getItem('bat_scanned_flyer');
      if (!raw) return;
      sessionStorage.removeItem('bat_scanned_flyer');
      let f;
      try { f = JSON.parse(raw); } catch { return; }
      const form = document.getElementById('postForm');
      const set = (name, val) => { const el = form.elements[name]; if (el && val != null && val !== '') el.value = val; };
      set('name', f.name);
      set('date', f.date);
      set('time', f.time);
      if (f.game && GAMES.includes(f.game)) set('game', f.game);
      set('entry', f.entry);
      set('added', f.added);
      set('venueName', f.venue);
      set('address', f.address);
      set('city', f.city);
      if (f.state) set('state', f.state);
      set('zip', f.zip);
      set('race', f.race);
      set('format', f.format);
      if (f.tableSize && TABLE_SIZES.includes(f.tableSize)) set('tableSize', f.tableSize);
      set('limit', f.limit);
      set('directorName', f.directorName);
      set('directorPhone', f.directorPhone);
      set('notes', f.notes);
      const img = sessionStorage.getItem('bat_scanned_flyer_image');
      if (img) { sessionStorage.removeItem('bat_scanned_flyer_image'); showFlyerPreview(img); }
      const banner = document.createElement('div');
      banner.className = 'loadwrap';
      banner.innerHTML = '<p class="muted">✓ Filled in from your scanned flyer. Review everything below before submitting.</p>';
      form.prepend(banner);
    }

    document.getElementById('postForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const body = {
        name: f.get('name'), date: f.get('date'), time: f.get('time') || null, game: f.get('game'),
        entry: f.get('entry') || null, added: f.get('added') || null, notes: f.get('notes') || null,
        race: f.get('race') || null, format: f.get('format') || null,
        tableSize: f.get('tableSize') || null, limit: f.get('limit') || null,
        registrationUrl: f.get('registrationUrl') || null,
        director: { name: f.get('directorName') || null, phone: f.get('directorPhone') || null, email: f.get('directorEmail') || null },
        venue: { name: f.get('venueName'), address: f.get('address') || null, city: f.get('city'), state: f.get('state'), zip: f.get('zip') || null },
        flyer: flyerDataUrl || null
      };
      const msg = document.getElementById('postMsg');
      msg.innerHTML = loading('Submitting…');
      try {
        const res = await api('/api/tournaments', { method: 'POST', body });
        recordSubmission({ id: res.id, name: body.name, date: body.date, venue: body.venue, status: res.status, submittedAt: new Date().toISOString() });
        msg.innerHTML = `<div class="loadwrap"><p class="muted">✓ Submitted! It will appear once an admin approves it. <a href="#/account">View it on your account</a>.</p></div>`;
        e.target.reset();
        showFlyerPreview(null);
      } catch (err) { msg.innerHTML = errorBox(err.message); }
    });
  };

  routes['/scan'] = async () => {
    app.innerHTML = `
      <div class="pagehead"><h1>Flyer Scanner</h1><p class="muted">Upload a photo of a tournament flyer and we'll read the details for you.</p></div>
      <div class="card bigflyer" id="scanCard">${loading('Checking flyer scanner status…')}</div>`;
    const card = document.getElementById('scanCard');
    let cfg;
    try { cfg = await api('/api/config'); } catch { cfg = { scan: false }; }
    if (!cfg.scan) {
      card.innerHTML = `<p class="muted">The flyer scanner isn't turned on for this site yet. The site owner needs to add an
        <code>ANTHROPIC_API_KEY</code> to the server's <code>.env</code> file to enable AI flyer reading.
        This is separate from tournament syncing -- syncing (pulling tournaments from a linked source site) runs automatically
        once <code>SOURCE_URL</code> is set and does not require this key.</p>
        <a class="btn btn-out" href="#/post">Post a tournament manually instead</a>`;
      return;
    }
    card.innerHTML = `
      <div class="upgrid">
        <input type="file" id="flyerInput" accept="image/png,image/jpeg,image/webp,image/gif">
        <button class="btn btn-blue upbtn" id="flyerBtn">Scan Flyer</button>
      </div>
      <div id="scanResult"></div>`;
    document.getElementById('flyerBtn').addEventListener('click', async () => {
      const input = document.getElementById('flyerInput');
      const result = document.getElementById('scanResult');
      if (!input.files[0]) { result.innerHTML = errorBox('Choose an image first.'); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        result.innerHTML = loading('Reading flyer…');
        try {
          const data = await api('/api/scan', { method: 'POST', body: { image: reader.result } });
          const f = data.fields || {};
          sessionStorage.setItem('bat_scanned_flyer', JSON.stringify(f));
          try { sessionStorage.setItem('bat_scanned_flyer_image', reader.result); } catch { /* image too big for storage, skip it */ }
          result.innerHTML = `<div class="loadwrap"><p class="muted">Got it! Taking you to the post form with these details filled in…</p></div>`;
          location.hash = '#/post';
        } catch (e) { result.innerHTML = errorBox(e.message); }
      };
      reader.readAsDataURL(input.files[0]);
    });
  };

  routes['/claim'] = async (params, id) => {
    app.innerHTML = `<div class="pagehead"><h1>Claim This Tournament</h1></div>
      <form class="card" id="claimForm">
        <div class="fg"><label>Your Name</label><input name="name" maxlength="80"></div>
        <div class="fg"><label>Email *</label><input name="email" type="email" required></div>
        <div id="claimMsg"></div>
        <button class="btn btn-blue" type="submit">Submit Claim</button>
      </form>`;
    document.getElementById('claimForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const msg = document.getElementById('claimMsg');
      try {
        await api('/api/claims', { method: 'POST', body: { tournamentId: Number(id), name: f.get('name'), email: f.get('email') } });
        recordClaim({ tournamentId: Number(id), name: f.get('name'), email: f.get('email'), at: new Date().toISOString() });
        msg.innerHTML = `<div class="loadwrap"><p class="muted">✓ Claim submitted. We'll follow up by email.</p></div>`;
        e.target.reset();
      } catch (err) { msg.innerHTML = errorBox(err.message); }
    });
  };

  routes['/report'] = async (params, id) => {
    app.innerHTML = `<div class="pagehead"><h1>Report a Problem</h1></div>
      <form class="card" id="reportForm">
        <div class="fg"><label>What's wrong? *</label><textarea name="message" required maxlength="1000" rows="4"></textarea></div>
        <div id="reportMsg"></div>
        <button class="btn btn-blue" type="submit">Submit Report</button>
      </form>`;
    document.getElementById('reportForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const msg = document.getElementById('reportMsg');
      try {
        await api('/api/reports', { method: 'POST', body: { tournamentId: Number(id), message: f.get('message') } });
        msg.innerHTML = `<div class="loadwrap"><p class="muted">✓ Thanks, we'll take a look.</p></div>`;
        e.target.reset();
      } catch (err) { msg.innerHTML = errorBox(err.message); }
    });
  };

  routes['/alerts'] = routes['/newsletter'] = async () => {
    app.innerHTML = `
      <div class="nl-band">
        <h1>Get Tournament Alerts</h1>
        <p>Get an email when new tournaments are posted near you.</p>
        <form class="nl-form" id="nlForm">
          <input name="email" type="email" required placeholder="you@example.com">
          <button class="btn btn-blue" type="submit">Subscribe</button>
        </form>
        <div id="nlMsg"></div>
      </div>`;
    document.getElementById('nlForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const msg = document.getElementById('nlMsg');
      try {
        await api('/api/subscribe', { method: 'POST', body: { email: f.get('email') } });
        recordAlert(f.get('email'));
        msg.innerHTML = `<p>✓ You're subscribed!</p>`;
        e.target.reset();
      } catch (err) { msg.innerHTML = `<p>⚠ ${esc(err.message)}</p>`; }
    });
  };

  routes['/admin'] = async () => {
    if (!adminToken()) {
      app.innerHTML = `
        <div class="pagehead"><h1>Admin Login</h1></div>
        <form class="card" id="loginForm" style="max-width:420px">
          <div class="fg"><label>Admin Token</label><input name="token" type="password" required></div>
          <div id="loginMsg"></div>
          <button class="btn btn-blue" type="submit">Log In</button>
        </form>`;
      document.getElementById('loginForm').addEventListener('submit', async e => {
        e.preventDefault();
        const token = new FormData(e.target).get('token');
        localStorage.setItem('bat_admin_token', token);
        try { await api('/api/admin/summary'); location.hash = '#/admin'; render(); }
        catch (err) { localStorage.removeItem('bat_admin_token'); document.getElementById('loginMsg').innerHTML = errorBox('Invalid token.'); }
      });
      return;
    }
    app.innerHTML = loading('Loading dashboard…');
    let summary;
    try { summary = await api('/api/admin/summary'); }
    catch { localStorage.removeItem('bat_admin_token'); app.innerHTML = errorBox('Session expired. Reloading login…'); setTimeout(() => { location.hash = '#/admin'; render(); }, 800); return; }
    let pending;
    try { pending = (await api('/api/admin/pending')).tournaments; } catch { pending = []; }
    let pendingStakes;
    try { pendingStakes = (await api('/api/admin/stakes/pending')).stakes; } catch { pendingStakes = []; }
    let stakeAdmin;
    try { stakeAdmin = await api('/api/admin/stakes/all'); } catch { stakeAdmin = { posts: [], archived: [] }; }
    let allAuctions;
    try { allAuctions = (await api('/api/admin/auctions')).auctions; } catch { allAuctions = []; }
    let pv;
    try { pv = await api('/api/admin/pageviews'); } catch { pv = { daily: 0, weekly: 0, monthly: 0, total: 0 }; }
    const tr = pv.traffic || { visitors: 0, sources: [], pages: [], daily: [] };
    const barRows = (rows, labelKey, countKey) => {
      const max = Math.max(1, ...rows.map(r => r[countKey]));
      return rows.map(r => `<tr><td>${esc(r[labelKey])}</td><td style="width:45%"><div style="background:currentColor;opacity:.35;height:10px;border-radius:5px;width:${Math.max(2, Math.round(r[countKey] / max * 100))}%"></div></td><td style="text-align:right">${r[countKey]}</td></tr>`).join('');
    };
    const dayLabel = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
    const trafficHtml = `
      <h2>Where Visitors Come From <span class="muted" style="font-size:.7em;font-weight:400">last ${tr.days || 30} days · ${tr.visitors} visitors</span></h2>
      ${tr.sources.length ? `<table class="t"><thead><tr><th>Source</th><th></th><th style="text-align:right">Visitors</th></tr></thead><tbody>${barRows(tr.sources, 'source', 'visitors')}</tbody></table>`
        : '<p class="muted">No visits recorded yet. Sources show up here as people visit.</p>'}
      <p class="muted" style="font-size:.85em">Tip: add <code>?utm_source=newsletter</code> to links in your newsletter (for example <code>billiardactiontime.com/?utm_source=newsletter</code>) so those visits show as Newsletter instead of Direct.</p>
      <h2>Most Viewed Pages <span class="muted" style="font-size:.7em;font-weight:400">last ${tr.days || 30} days</span></h2>
      ${tr.pages.length ? `<table class="t"><thead><tr><th>Page</th><th></th><th style="text-align:right">Views</th></tr></thead><tbody>${barRows(tr.pages, 'label', 'views')}</tbody></table>`
        : '<p class="muted">No page views recorded yet.</p>'}
      <h2>Visitors Per Day <span class="muted" style="font-size:.7em;font-weight:400">last ${tr.daily.length} days</span></h2>
      <table class="t"><tbody>${barRows(tr.daily.slice().reverse().map(d => ({ ...d, label: dayLabel(d.day) })), 'label', 'visitors')}</tbody></table>`;
    app.innerHTML = `
      <div class="pagehead"><h1>Admin Dashboard</h1>
        <button class="btn btn-out btn-sm" id="logoutBtn">Log Out</button></div>
      <h2 style="margin-top:0">Site Visitors</h2>
      <div class="stats">
        <div class="stat"><strong>${pv.daily}</strong><span>Today</span></div>
        <div class="stat"><strong>${pv.weekly}</strong><span>Last 7 Days</span></div>
        <div class="stat"><strong>${pv.monthly}</strong><span>Last 30 Days</span></div>
        <div class="stat"><strong>${pv.total}</strong><span>All-Time</span></div>
      </div>
      ${trafficHtml}
      <h2>Listings</h2>
      <div class="stats">
        <div class="stat"><strong>${summary.published}</strong><span>Published</span></div>
        <div class="stat"><strong>${summary.upcoming}</strong><span>Upcoming</span></div>
        <div class="stat"><strong>${summary.pending}</strong><span>Pending Review</span></div>
        <div class="stat"><strong>${summary.venues}</strong><span>Venues</span></div>
        <div class="stat"><strong>${summary.subscribers}</strong><span>Subscribers</span></div>
      </div>
      <div class="actbar"><button class="btn btn-blue" id="syncBtn">Sync Now</button><span id="syncMsg" class="muted"></span></div>
      <h2>Needs Review (${pending.length})</h2>
      <div id="pendingList" class="review">
        ${pending.length ? pending.map(t => `
          <div class="card" data-id="${t.id}">
            <h3>${esc(t.name)}</h3>
            <p class="muted">${esc(fmtDate(t.date))} · ${esc(t.venue.name)}, ${esc(t.venue.city)}, ${esc(t.venue.state)}</p>
            <div class="actbar">
              <button class="btn btn-blue btn-sm act-approve">Approve</button>
              <button class="btn btn-out btn-sm act-reject">Reject</button>
            </div>
          </div>`).join('') : '<p class="muted">Nothing waiting on review.</p>'}
      </div>
      <h2>Staking Board: Needs Review (${pendingStakes.length})</h2>
      <div id="pendingStakes" class="review">
        ${pendingStakes.length ? pendingStakes.map(s => `
          <div class="card" data-sid="${s.id}">
            <h3>${esc(s.player)}${s.opponent ? ' vs ' + esc(s.opponent) : ''}</h3>
            <p class="muted">${esc(fmtDate(s.date))} · ${esc(s.game)} · ${cash(s.bet)} a side · selling ${pct(s.offered)} at ${s.markup}x · held by ${esc(s.stakeholder)}${s.contact ? ' · ' + esc(s.contact) : ''}</p>
            ${s.notes ? `<p>${esc(s.notes)}</p>` : ''}
            <div class="actbar">
              <button class="btn btn-blue btn-sm act-approve">Approve</button>
              <button class="btn btn-out btn-sm act-reject">Reject</button>
              <a class="btn btn-out btn-sm" href="#/stakes/${s.id}">View</a>
            </div>
          </div>`).join('') : '<p class="muted">No staking posts waiting.</p>'}
      </div>
      <h2>Staking Board: All Approved Posts (${stakeAdmin.posts.length})</h2>
      ${stakeAdmin.posts.length ? `<div class="card" style="overflow-x:auto"><table class="t stakes-t" id="adminStakes"><thead><tr><th>Match</th><th>Status</th><th>Sold</th><th>Backers</th></tr></thead><tbody>
        ${stakeAdmin.posts.map(p => adminStakeRow(p, `<a class="btn btn-out btn-sm" href="#/stakes/${p.id}">View</a> <button type="button" class="btn btn-out btn-sm" data-sact="archive" data-sid="${p.id}">Delete</button>`)).join('')}
      </tbody></table></div>` : '<p class="muted">No approved posts yet.</p>'}
      <h2>Staking Board: Archived (${stakeAdmin.archived.length})</h2>
      ${stakeAdmin.archived.length ? `<div class="card" style="overflow-x:auto"><table class="t stakes-t" id="adminStakesArch"><thead><tr><th>Match</th><th>Was</th><th>Sold</th><th>Backers</th></tr></thead><tbody>
        ${stakeAdmin.archived.map(p => adminStakeRow(p, `<button type="button" class="btn btn-green btn-sm" data-sact="repost" data-sid="${p.id}">Repost</button> <a class="btn btn-out btn-sm" href="#/stakes/${p.id}">View</a> <button type="button" class="btn btn-out btn-sm" data-sact="purge" data-sid="${p.id}">Delete Forever</button>`, true)).join('')}
      </tbody></table></div>` : '<p class="muted">Nothing archived. Deleted posts land here so you can repost them.</p>'}
      ${(() => {
        const live = allAuctions.filter(a => a.status !== 'archived'), gone = allAuctions.filter(a => a.status === 'archived');
        const row = (a, buttons, st) => `<tr class="noline"><td><a href="#/a/${esc(a.code)}">${esc(a.title)}</a><br><small class="muted">${esc(a.code)} · ${a.mode === 'silent' ? 'Silent' : 'Live'}${a.listed ? ' · Public' : ''}</small></td>
          <td>${esc(aStatusLabel[st] || st || '')}</td><td>${a.players}</td><td>${a.bidders}</td><td>${cash(a.pot)}</td></tr>
          <tr><td colspan="5" style="padding-top:0"><div class="actbar">${buttons}</div></td></tr>`;
        const head = '<thead><tr><th>Auction</th><th>Status</th><th>Players</th><th>Bidders</th><th>Pot</th></tr></thead>';
        return `<h2>Calcutta Auctions (${live.length})</h2>
        ${live.length ? `<div class="card" style="overflow-x:auto"><table class="t stakes-t aadmin">${head}<tbody>${live.map(a => row(a,
          `<a class="btn btn-out btn-sm" href="#/a/${esc(a.code)}">Open</a> <button type="button" class="btn btn-out btn-sm" data-aact="delete" data-code="${esc(a.code)}">Delete</button>`, a.status)).join('')}</tbody></table></div>` : '<p class="muted">No auctions yet.</p>'}
        <h2>Calcutta Auctions: Archived (${gone.length})</h2>
        ${gone.length ? `<div class="card" style="overflow-x:auto"><table class="t stakes-t aadmin">${head.replace('Status', 'Was')}<tbody>${gone.map(a => row(a,
          `<button type="button" class="btn btn-green btn-sm" data-aact="restore" data-code="${esc(a.code)}">Restore</button> <a class="btn btn-out btn-sm" href="#/a/${esc(a.code)}">View</a> <button type="button" class="btn btn-out btn-sm" data-aact="purge" data-code="${esc(a.code)}">Delete Forever</button>`, a.prevStatus)).join('')}</tbody></table></div>`
          : '<p class="muted">Nothing archived. Deleted auctions land here so you can restore them.</p>'}`;
      })()}
      <h2>Recent Sync Runs</h2>
      <table class="t"><thead><tr><th>Started</th><th>Status</th><th>Fetched</th><th>Inserted</th><th>Updated</th><th>Removed</th></tr></thead>
      <tbody>${(summary.recentRuns || []).map(r => `<tr><td>${esc((r.started_at || '').replace('T', ' ').slice(0, 19))}</td><td>${esc(r.status)}</td><td>${r.fetched ?? 0}</td><td>${r.inserted ?? 0}</td><td>${r.updated ?? 0}</td><td>${r.removed ?? 0}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No sync runs yet.</td></tr>'}</tbody></table>`;

    document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.removeItem('bat_admin_token'); render(); });
    document.getElementById('syncBtn').addEventListener('click', async () => {
      const m = document.getElementById('syncMsg'); m.textContent = 'Syncing…';
      try { const r = await api('/api/admin/sync', { method: 'POST' }); m.textContent = `Done: ${r.status}${r.message ? ' — ' + r.message : ''}`; }
      catch (e) { m.textContent = 'Error: ' + e.message; }
    });
    document.getElementById('pendingList').addEventListener('click', async e => {
      const card = e.target.closest('[data-id]'); if (!card) return;
      const id = card.dataset.id;
      if (e.target.classList.contains('act-approve')) await api(`/api/admin/tournaments/${id}/approve`, { method: 'POST' }).catch(() => {});
      else if (e.target.classList.contains('act-reject')) await api(`/api/admin/tournaments/${id}/reject`, { method: 'POST' }).catch(() => {});
      else return;
      card.remove();
    });
    for (const tid of ['adminStakes', 'adminStakesArch']) {
      const tbl = document.getElementById(tid);
      if (tbl) tbl.addEventListener('click', async e => {
        const b = e.target.closest('[data-sact]'); if (!b) return;
        const act = b.dataset.sact;
        if (act !== 'repost' && !tapTwice(b, act + b.dataset.sid, act === 'purge' ? 'Tap again: gone for good' : 'Tap again to delete')) return;
        try { await api(`/api/admin/stakes/${b.dataset.sid}/${act}`, { method: 'POST' }); render(); } catch (err) { b.textContent = err.message; }
      });
    }
    document.querySelectorAll('.aadmin').forEach(tbl => tbl.addEventListener('click', async e => {
      const b = e.target.closest('[data-aact]'); if (!b) return;
      const act = b.dataset.aact;
      if (act !== 'restore' && !tapTwice(b, act + b.dataset.code, act === 'purge' ? 'Tap again: gone for good' : 'Tap again to delete')) return;
      try { await api(`/api/admin/auctions/${b.dataset.code}/${act}`, { method: 'POST' }); render(); } catch (err) { b.textContent = err.message; }
    }));
    document.getElementById('pendingStakes').addEventListener('click', async e => {
      const card = e.target.closest('[data-sid]'); if (!card) return;
      const act = e.target.classList.contains('act-approve') ? 'approve' : e.target.classList.contains('act-reject') ? 'reject' : null;
      if (!act) return;
      try { await api(`/api/admin/stakes/${card.dataset.sid}/${act}`, { method: 'POST' }); card.remove(); } catch (err) { alert(err.message); }
    });
  };

  // Two-tap confirm for risky buttons. Browser confirm() popups are silently blocked in some
  // browsers and in-app views, which made those buttons look dead, so confirm in the page instead.
  const armedAt = new Map();
  function tapTwice(btn, key, prompt) {
    const t = armedAt.get(key);
    if (t && Date.now() - t < 5000) { armedAt.delete(key); return true; }
    armedAt.set(key, Date.now());
    if (btn) {
      const old = btn.textContent;
      btn.textContent = prompt; btn.classList.add('armed');
      setTimeout(() => { if (btn.isConnected && btn.classList.contains('armed')) { btn.textContent = old; btn.classList.remove('armed'); } }, 5000);
    }
    return false;
  }

  // ------------------------------------------------------------ STAKING BOARD
  // Records only: the site never holds or moves money. Cash is held by the stakeholder named
  // on each match and paid between people directly.
  const STAKE_KEYS = 'bat_stake_keys';
  function stakeKey(id) { try { return JSON.parse(localStorage.getItem(STAKE_KEYS) || '{}')[id] || ''; } catch { return ''; } }
  function saveStakeKey(id, key) {
    try { const all = JSON.parse(localStorage.getItem(STAKE_KEYS) || '{}'); all[id] = key; localStorage.setItem(STAKE_KEYS, JSON.stringify(all)); } catch { /* ignore */ }
  }
  const pct = n => `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
  const cash = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const stakeWhere = s => [s.venue, [s.city, s.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const stakeTitle = s => `${esc(s.player)}${s.opponent ? ` <span class="muted">vs</span> ${esc(s.opponent)}` : ''}`;
  const STAKE_NOTE = `<p class="stake-note">Billiard Action Time keeps records only. It never holds or sends money: stakes are held by the stakeholder named on each match and paid between people directly. You must be 18+ and follow the laws where you play.</p>`;

  function stakeCard(s) {
    const settled = s.status === 'settled';
    const soldPct = s.offered ? Math.min(100, Math.round(s.sold / s.offered * 100)) : 0;
    const onePct = cash(s.bet * 0.01 * s.markup);
    return `<a class="card stakecard${settled ? ' done' : ''}" href="#/stakes/${s.id}">
      <div class="stake-top">
        <span class="stake-tag ${settled ? (s.result === 'won' ? 'won' : 'lost') : ''}">${settled ? (s.result === 'won' ? 'Won' : 'Lost') + (s.score ? ' ' + esc(s.score) : '') : 'Open'} · ${esc(s.game)}</span>
        <span class="muted">${esc(fmtDate(s.date))}${s.time ? ' · ' + esc(fmtTime(s.time)) : ''}</span>
      </div>
      <h3>${stakeTitle(s)}</h3>
      <div class="muted">${[s.race, cash(s.bet) + ' a side', stakeWhere(s)].filter(Boolean).map(esc).join(' · ')}</div>
      ${settled ? '' : `<div class="stake-nums">
        <div><small>Selling</small><b>${pct(s.offered)}</b></div>
        <div><small>Markup</small><b>${s.markup}x</b></div>
        <div><small>1% costs</small><b>${onePct}</b></div>
      </div>
      <div class="stake-bar-label"><span>${pct(s.sold)} of ${pct(s.offered)} sold</span><span class="muted">${s.pieces.length} backer${s.pieces.length === 1 ? '' : 's'}</span></div>
      <div class="stake-bar"><div style="width:${soldPct}%"></div></div>`}
      <div class="muted" style="font-size:14px">Stake held by: <b style="color:var(--text)">${esc(s.stakeholder)}</b></div>
    </a>`;
  }

  async function stakesBoard(params) {
    app.innerHTML = `
      <div class="pagehead"><h1>Staking Board</h1>
        <p>Back a player's action, see how much is sold, and keep a clear record of every piece from rack to payout.</p>
        <div class="actbar" style="margin-top:14px"><a class="btn btn-green" href="#/stakes/new">Post Your Action</a>
        <button class="btn btn-out" id="howBtn" type="button">How It Works</button></div>
      </div>
      <div class="card" id="howBox" hidden style="margin-bottom:18px">
        <ol class="steps3">
          <li><b>A player posts a match:</b> the bet a side, what percent of their action is for sale, any markup, and who is holding the stake money.</li>
          <li><b>Backers claim pieces.</b> A 10% piece of a $1,000-a-side match at 1.1x markup costs $110 and pays back $200 if the player wins.</li>
          <li><b>Pay the stakeholder directly</b> before the match, the way you always have.</li>
          <li><b>After the match</b> the player records the result, and the board shows what each backer is owed and who has been paid.</li>
        </ol>
        ${STAKE_NOTE}
      </div>
      <div class="chips" id="gameChips" style="margin-bottom:16px"></div>
      <div id="stakeList">${loading('Loading the board…')}</div>`;
    document.getElementById('howBtn').addEventListener('click', () => { const b = document.getElementById('howBox'); b.hidden = !b.hidden; });
    let board;
    try { board = await api('/api/stakes'); } catch (e) { document.getElementById('stakeList').innerHTML = errorBox(e.message); return; }
    const games = [...new Set(board.open.map(s => s.game))];
    let pick = params.get('game') || '';
    const draw = () => {
      document.getElementById('gameChips').innerHTML = games.length > 1 ? ['', ...games].map(g =>
        `<button type="button" class="chip stake-filter${g === pick ? ' on' : ''}" data-g="${esc(g)}">${esc(g || 'All')}</button>`).join('') : '';
      const open = board.open.filter(s => !pick || s.game === pick);
      document.getElementById('stakeList').innerHTML = `
        <h2 class="stake-h">Open Action</h2>
        ${open.length ? `<div class="stakegrid">${open.map(stakeCard).join('')}</div>`
          : `<div class="card"><p class="muted" style="margin:0">No open action right now. <a href="#/stakes/new">Post yours</a> and it will show here once approved.</p></div>`}
        ${board.settled.length ? `<h2 class="stake-h">Recent Results</h2><div class="stakegrid">${board.settled.map(stakeCard).join('')}</div>` : ''}
        ${STAKE_NOTE}`;
    };
    draw();
    document.getElementById('gameChips').addEventListener('click', e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      pick = b.dataset.g; draw();
    });
  }

  async function stakePostForm() {
    app.innerHTML = `
      <div class="crumbs"><a href="#/stakes">Staking Board</a> / Post Your Action</div>
      <div class="pagehead"><h1>Post Your Action</h1><p>Offer backers a piece of your match. Posts are reviewed before they go on the board.</p></div>
      <form class="card" id="stakeForm">
        <div class="two" style="margin-top:0">
          <div class="fg"><label class="f">Player (you) *</label><input name="player" required maxlength="60"></div>
          <div class="fg"><label class="f">Opponent</label><input name="opponent" maxlength="60"></div>
        </div>
        <div class="two" style="margin-top:0">
          <div class="fg"><label class="f">Game</label><select name="game">${GAMES.map(g => `<option>${esc(g)}</option>`).join('')}</select></div>
          <div class="fg"><label class="f">Race</label><input name="race" maxlength="40" placeholder="e.g. Race to 11"></div>
        </div>
        <div class="two" style="margin-top:0">
          <div class="fg"><label class="f">Date *</label><input name="date" type="date" required></div>
          <div class="fg"><label class="f">Time</label><input name="time" type="time"></div>
        </div>
        <div class="row3">
          <div class="fg"><label class="f">Bet a side ($) *</label><input name="bet" type="number" min="1" step="1" required inputmode="numeric"></div>
          <div class="fg"><label class="f">% for sale *</label><input name="offered" type="number" min="1" max="100" step="1" required inputmode="numeric"></div>
          <div class="fg"><label class="f">Markup</label><input name="markup" type="number" min="1" max="2" step="0.05" value="1"></div>
        </div>
        <p class="muted" id="stakeCalc" style="font-size:14px"></p>
        <div class="fg"><label class="f">Pool hall</label><input name="venue" maxlength="120"></div>
        <div class="two" style="margin-top:0">
          <div class="fg"><label class="f">City</label><input name="city" maxlength="80"></div>
          <div class="fg"><label class="f">State</label><select name="state" id="stakeState"><option value="">Select a state</option></select></div>
        </div>
        <div class="fg"><label class="f">Who is holding the stake money? *</label><input name="stakeholder" required maxlength="80" placeholder="e.g. the house man, or a friend both sides trust"></div>
        <div class="fg"><label class="f">How backers can reach you</label><input name="contact" maxlength="120" placeholder="Phone, Facebook, or Instagram handle (shown publicly)"></div>
        <div class="fg"><label class="f">Notes</label><textarea name="notes" maxlength="500" rows="3"></textarea></div>
        <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:12px;font-size:14px"><input type="checkbox" required style="margin-top:4px"> I understand this site only keeps records and does not hold or send money. I'm 18+ and follow the laws where I play.</label>
        <div id="stakeMsg"></div>
        <button class="btn btn-green" type="submit">Submit for Review</button>
      </form>`;
    loadPlaces().then(p => {
      const sel = document.getElementById('stakeState');
      if (sel) for (const s of p.states) sel.insertAdjacentHTML('beforeend', `<option value="${esc(s.code)}">${esc(s.name)}</option>`);
    }).catch(() => {});
    const form = document.getElementById('stakeForm');
    const calc = () => {
      const f = new FormData(form), bet = Number(f.get('bet')), mk = Number(f.get('markup')) || 1;
      document.getElementById('stakeCalc').textContent = bet > 0 ? `Each 1% costs a backer ${cash(bet * 0.01 * mk)} and pays back ${cash(bet * 0.02)} if you win.` : '';
    };
    form.addEventListener('input', calc);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(form));
      const msg = document.getElementById('stakeMsg');
      try {
        const r = await api('/api/stakes', { method: 'POST', body });
        saveStakeKey(r.id, r.manageKey);
        const link = `${location.origin}/#/stakes/${r.id}?key=${encodeURIComponent(r.manageKey)}`;
        app.innerHTML = `
          <div class="pagehead"><h1>Submitted</h1><p>Your match goes on the Staking Board as soon as it's approved.</p></div>
          <div class="card">
            <h3 style="margin-bottom:8px">Save your private link</h3>
            <p class="muted">You'll use it to record the result and mark backers paid. It's saved on this phone too, but keep a copy in case you switch devices. Don't share it.</p>
            <input id="mkLink" readonly value="${esc(link)}">
            <div class="actbar" style="margin-top:12px"><button class="btn btn-blue" id="copyLink" type="button">Copy Link</button><a class="btn btn-out" href="#/stakes/${r.id}">View Match</a></div>
          </div>`;
        document.getElementById('copyLink').addEventListener('click', async () => {
          const el = document.getElementById('mkLink'); el.select();
          try { await navigator.clipboard.writeText(link); } catch { document.execCommand && document.execCommand('copy'); }
          document.getElementById('copyLink').textContent = 'Copied';
        });
      } catch (err) { msg.innerHTML = errorBox(err.message); }
    });
  }

  async function stakeDetail(params, id) {
    const fromLink = params.get('key');
    if (fromLink) { saveStakeKey(id, fromLink); history.replaceState(null, '', `#/stakes/${id}`); }
    const key = fromLink || stakeKey(id);
    const headers = {};
    if (key) headers['X-Manage-Key'] = key;
    if (adminToken()) headers.Authorization = 'Bearer ' + adminToken();
    const call = (path, opts = {}) => api(path, { ...opts, headers });
    app.innerHTML = loading('Loading match…');
    let s;
    try { s = await call('/api/stakes/' + id); } catch { app.innerHTML = errorBox('Match not found.'); return; }
    const settled = s.status === 'settled';
    const won = settled && s.result === 'won';
    // One "paid" switch per backer. Before a win it tracks the backer paying for their piece;
    // after a win it tracks the backer's payout being sent.
    const isPaid = p => (won ? p.paid : p.paidIn);
    const paidChip = p => won ? (p.paid ? '<span class="chip g">Paid out</span>' : '<span class="chip gold">Owed</span>')
      : s.canManage ? (p.paidIn ? '<span class="chip g">Paid</span>' : '<span class="chip gold">Not paid yet</span>') : '';
    const pieceRows = s.pieces.map(p => `<tr data-pid="${p.id}">
        <td>${esc(p.backer)}${s.canManage && p.contact ? `<br><small class="muted">${esc(p.contact)}</small>` : ''}</td>
        <td>${pct(p.percent)}</td><td>${cash(p.cost)}</td>
        <td>${settled ? (won ? `<b>${cash(p.returnIfWon)}</b>` : '$0') : cash(p.returnIfWon)} ${paidChip(p)}
          ${s.canManage ? `<div class="actbar" style="margin-top:6px">
            <button type="button" class="btn ${isPaid(p) ? 'btn-out' : 'btn-green'} btn-sm" data-act="${won ? (p.paid ? 'unpaid' : 'paid') : (p.paidIn ? 'unpaidin' : 'paidin')}">${isPaid(p) ? 'Undo Paid' : won ? 'Mark Paid Out' : 'Mark Paid'}</button>
            ${settled ? '' : '<button type="button" class="btn btn-out btn-sm" data-act="remove">Remove</button>'}</div>` : ''}</td>
      </tr>`).join('');
    const allPaid = s.pieces.length && s.pieces.every(isPaid);
    app.innerHTML = `
      <div class="crumbs"><a href="#/stakes">Staking Board</a> / ${esc(s.player)}</div>
      <div class="card">
        <div class="stake-top"><span class="stake-tag ${settled ? (s.result === 'won' ? 'won' : 'lost') : ''}">${
          { pending: 'Waiting for approval', archived: 'Archived: hidden from the board', open: 'Open', settled: (s.result === 'won' ? 'Won' : 'Lost') + (s.score ? ' ' + esc(s.score) : ''), cancelled: 'Cancelled', rejected: 'Not approved' }[s.status] || esc(s.status)} · ${esc(s.game)}</span></div>
        <h1 class="dtitle" style="margin-top:8px">${stakeTitle(s)}</h1>
        <table class="t"><tbody>
          <tr><th>When</th><td>${esc(fmtDate(s.date))}${s.time ? ' at ' + esc(fmtTime(s.time)) : ''}</td></tr>
          ${stakeWhere(s) ? `<tr><th>Where</th><td>${esc(stakeWhere(s))}</td></tr>` : ''}
          ${s.race ? `<tr><th>Race</th><td>${esc(s.race)}</td></tr>` : ''}
          <tr><th>Bet</th><td>${cash(s.bet)} a side</td></tr>
          <tr><th>Selling</th><td>${pct(s.offered)} of the action at ${s.markup}x markup · each 1% costs ${cash(s.bet * 0.01 * s.markup)}</td></tr>
          <tr><th>Sold</th><td>${pct(s.sold)} · ${pct(s.remaining)} left</td></tr>
          <tr><th>Stake held by</th><td>${esc(s.stakeholder)}</td></tr>
          ${s.contact ? `<tr><th>Reach the player</th><td>${esc(s.contact)}</td></tr>` : ''}
        </tbody></table>
        ${s.notes ? `<p style="margin-top:12px">${esc(s.notes)}</p>` : ''}
      </div>

      <h2 class="stake-h">Backers</h2>
      ${s.pieces.length ? `<div class="card" style="overflow-x:auto"><table class="t stakes-t"><thead><tr><th>Backer</th><th>Piece</th><th>Cost</th><th>${settled ? 'Owed' : 'Pays if won'}</th></tr></thead><tbody id="pieceRows">${pieceRows}</tbody></table>
        ${s.canManage ? `<div class="actbar allpaid">${allPaid ? `<span class="chip g">✓ Everyone is paid</span>` : `<button type="button" class="btn btn-green" id="allPaidBtn">Everyone Is Paid</button><small class="muted">${won ? 'Marks every backer\'s payout as sent.' : 'Marks every backer as paid for their piece.'}</small>`}</div>` : ''}</div>`
        : '<div class="card"><p class="muted" style="margin:0">No backers yet.</p></div>'}

      ${s.status === 'open' && s.remaining > 0 ? `
      <h2 class="stake-h">Claim a Piece</h2>
      <form class="card" id="claimPiece">
        <div class="two" style="margin-top:0">
          <div class="fg"><label class="f">Your name *</label><input name="backer" required maxlength="60"></div>
          <div class="fg"><label class="f">Percent (1 to ${s.remaining}) *</label><input name="percent" type="number" min="1" max="${s.remaining}" step="1" required inputmode="numeric"></div>
        </div>
        <div class="fg"><label class="f">Phone or handle (only the player sees this)</label><input name="contact" maxlength="120"></div>
        <p class="muted" id="pieceCalc" style="font-size:14px"></p>
        <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:12px;font-size:14px"><input type="checkbox" required style="margin-top:4px"> I'll pay ${esc(s.stakeholder)} directly. This site doesn't hold or send money. I'm 18+.</label>
        <div id="pieceMsg"></div>
        <button class="btn btn-green" type="submit">Claim Piece</button>
      </form>` : ''}

      ${s.canManage && ['open', 'settled'].includes(s.status) ? `
      <h2 class="stake-h">Record the Result</h2>
      <form class="card" id="resultForm">
        <p class="muted">Only you can see this, because you posted the match${adminToken() ? ' (or you are logged in as Admin)' : ''}.</p>
        <div class="row3">
          <div class="fg"><label class="f">Result</label><select name="result"><option value="won"${s.result === 'won' ? ' selected' : ''}>Won</option><option value="lost"${s.result === 'lost' ? ' selected' : ''}>Lost</option><option value="cancelled">Cancelled / didn't play</option></select></div>
          <div class="fg"><label class="f">Score</label><input name="score" maxlength="20" placeholder="e.g. 11-7" value="${esc(s.score || '')}"></div>
        </div>
        <div id="resultMsg"></div>
        <button class="btn btn-blue" type="submit">Save Result</button>
      </form>` : ''}
      ${STAKE_NOTE}`;

    const claim = document.getElementById('claimPiece');
    if (claim) {
      claim.addEventListener('input', () => {
        const n = Number(new FormData(claim).get('percent'));
        document.getElementById('pieceCalc').textContent = n > 0 ? `${pct(n)} costs ${cash(s.bet * n / 100 * s.markup)} and pays back ${cash(s.bet * 2 * n / 100)} if ${s.player} wins.` : '';
      });
      claim.addEventListener('submit', async e => {
        e.preventDefault();
        try { await api(`/api/stakes/${id}/pieces`, { method: 'POST', body: Object.fromEntries(new FormData(claim)) }); render(); }
        catch (err) { document.getElementById('pieceMsg').innerHTML = errorBox(err.message); }
      });
    }
    const resultForm = document.getElementById('resultForm');
    if (resultForm) resultForm.addEventListener('submit', async e => {
      e.preventDefault();
      try { await call(`/api/stakes/${id}/result`, { method: 'POST', body: Object.fromEntries(new FormData(resultForm)) }); render(); }
      catch (err) { document.getElementById('resultMsg').innerHTML = errorBox(err.message); }
    });
    const allBtn = document.getElementById('allPaidBtn');
    if (allBtn) allBtn.addEventListener('click', async () => {
      if (!tapTwice(allBtn, 'allpaid' + id, 'Tap again to confirm')) return;
      try { await call(`/api/stakes/${id}/allpaid`, { method: 'POST' }); render(); } catch (err) { allBtn.textContent = err.message; }
    });
    const rows = document.getElementById('pieceRows');
    if (rows && s.canManage) rows.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const pid = b.closest('[data-pid]').dataset.pid;
      if (b.dataset.act === 'remove' && !tapTwice(b, 'rm' + pid, 'Tap again to remove')) return;
      try { await call(`/api/stakes/${id}/pieces/${pid}/${b.dataset.act}`, { method: 'POST' }); render(); } catch (err) { alert(err.message); }
    });
  }

  routes['/stakes'] = async (params, id) => {
    if (id === 'new') return stakePostForm();
    if (id && /^\d+$/.test(id)) return stakeDetail(params, id);
    return stakesBoard(params);
  };

  function adminStakeRow(p, buttons, archived = false) {
    const st = archived ? (p.prevStatus || '') : p.status;
    const today = new Date().toISOString().slice(0, 10);
    const label = p.status === 'settled' || (archived && p.result) ? (p.result === 'won' ? 'Won' : 'Lost') + (p.score ? ' ' + p.score : '')
      : st === 'cancelled' ? 'Cancelled' : p.date < today ? 'Open · date passed' : 'Open';
    const paid = p.pieces.length ? `${p.pieces.filter(x => (p.result === 'won' ? x.paid : x.paidIn)).length}/${p.pieces.length} paid` : '';
    return `<tr class="noline"><td><b>${esc(p.player)}${p.opponent ? ' vs ' + esc(p.opponent) : ''}</b><br><small class="muted">${esc(fmtDate(p.date))} · ${esc(p.game)} · ${cash(p.bet)} a side</small></td>
      <td>${esc(label)}</td><td>${pct(p.sold)} of ${pct(p.offered)}</td><td>${p.pieces.length}${paid ? `<br><small class="muted">${paid}</small>` : ''}</td></tr>
      <tr><td colspan="4" style="padding-top:0"><div class="actbar">${buttons}</div></td></tr>`;
  }

  // ------------------------------------------------------------ CALCUTTA / LIVE AUCTIONS
  // Records only, like the Staking Board: the site never takes, holds or pays out money.
  const AUCTION_NOTE = `<p class="stake-note">Billiard Action Time runs the auction and keeps the records only. It never takes, holds or pays out money: settle up with the host directly. You must be 18+ and follow the laws where you play.</p>`;
  function aStore(code) { try { return JSON.parse(localStorage.getItem('bat_auction_' + code) || '{}'); } catch { return {}; } }
  function aSave(code, patch) { try { localStorage.setItem('bat_auction_' + code, JSON.stringify({ ...aStore(code), ...patch })); } catch { /* ignore */ } }
  const aStatusLabel = { setup: 'Not started', running: 'Live', paused: 'Paused', done: 'Finished' };
  const fmtWhen = ms => new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const toLocalInput = ms => { const d = new Date(ms); return new Date(ms - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const fromLocalInput = v => (v ? new Date(v).getTime() : null);

  async function auctionsHome() {
    app.innerHTML = `
      <div class="pagehead"><h1>Calcutta Auctions</h1>
        <p>Run a live Calcutta for your tournament: bidders buy players on a countdown clock, everyone sees the bids in real time, and the payouts are worked out for you when the tournament ends.</p>
        <div class="actbar" style="margin-top:14px"><a class="btn btn-green" href="#/auctions/new">Create an Auction</a></div>
      </div>
      <form class="card" id="joinCode" style="max-width:460px">
        <label class="f" for="codeIn">Have a code? Join an auction</label>
        <div style="display:flex;gap:8px"><input id="codeIn" maxlength="10" placeholder="e.g. K7PQ2M" autocapitalize="characters" style="text-transform:uppercase"><button class="btn btn-blue" type="submit">Join</button></div>
      </form>
      <div class="card" style="margin-top:18px">
        <h3 style="margin-bottom:8px">How it works</h3>
        <ol class="steps3">
          <li><b>The host creates the auction</b> and lists the players, the opening bid, the bid increment, the clock and the payout split.</li>
          <li><b>Bidders join with the code</b> on their phones. No account needed.</li>
          <li><b>Live mode:</b> one player at a time on a countdown. A late bid adds time back so nobody gets sniped. <b>Silent mode:</b> every player is open at once until the clock runs out.</li>
          <li><b>After the tournament</b> the host enters where each player finished and the site shows what every owner is paid.</li>
        </ol>
      </div>
      <h2 class="stake-h">Auctions</h2>
      <div id="aList">${loading()}</div>
      ${AUCTION_NOTE}`;
    document.getElementById('joinCode').addEventListener('submit', e => {
      e.preventDefault();
      const c = document.getElementById('codeIn').value.trim().toUpperCase();
      if (c) location.hash = '#/a/' + encodeURIComponent(c);
    });
    try {
      const { auctions } = await api('/api/auctions');
      document.getElementById('aList').innerHTML = auctions.length ? `<div class="stakegrid">${auctions.map(a => `
        <a class="card stakecard" href="#/a/${esc(a.code)}">
          <div class="stake-top"><span class="stake-tag ${a.status === 'done' ? 'lost' : ''}">${esc(aStatusLabel[a.status] || a.status)} · ${a.mode === 'silent' ? 'Silent' : 'Live'}</span><span class="muted">Code ${esc(a.code)}</span></div>
          <h3>${esc(a.title)}</h3>
          <div class="muted">${a.players} players${a.pot ? ' · Pot ' + cash(a.pot) : ''}${a.startsMs && a.status === 'setup' ? ' · Opens ' + esc(fmtWhen(a.startsMs)) : a.startsAt && a.status === 'setup' ? ' · ' + esc(a.startsAt.replace('T', ' ')) : ''}${a.mode === 'silent' && a.endsMs && a.status !== 'done' ? ' · Ends ' + esc(fmtWhen(a.endsMs)) : ''}</div>
        </a>`).join('')}</div>` : '<div class="card"><p class="muted" style="margin:0">No public auctions right now. Most hosts share their code directly with bidders.</p></div>';
    } catch (e) { document.getElementById('aList').innerHTML = errorBox(e.message); }
  }

  async function auctionCreate() {
    app.innerHTML = `
      <div class="crumbs"><a href="#/auctions">Calcutta Auctions</a> / Create</div>
      <div class="pagehead"><h1>Create an Auction</h1><p>You'll get a code to share with bidders and a private host link to run it.</p></div>
      <form class="card" id="aForm">
        <div class="fg"><label class="f">Auction name *</label><input name="title" required maxlength="100" placeholder="e.g. Friday 9-Ball Calcutta"></div>
        <div class="two" style="margin-top:0">
          <div class="fg"><label class="f">Starts</label><input name="startsAt" type="datetime-local"><small class="muted" id="startHint">Leave blank and start it yourself from the host screen.</small></div>
          <div class="fg"><label class="f">Type</label><select name="mode" id="aMode"><option value="live">Live: one player at a time</option><option value="silent">Silent: all players at once</option></select></div>
        </div>
        <div class="row3">
          <div class="fg"><label class="f">Opening bid ($)</label><input name="minBid" type="number" min="1" step="1" value="20" inputmode="numeric"></div>
          <div class="fg"><label class="f">Bid increment ($)</label><input name="increment" type="number" min="1" step="1" value="5" inputmode="numeric"></div>
          <div class="fg"><label class="f">House cut (%)</label><input name="houseCut" type="number" min="0" max="50" step="0.5" value="0"></div>
        </div>
        <div class="row3" id="liveOpts">
          <div class="fg"><label class="f">Clock per player (sec)</label><input name="bidSeconds" type="number" min="10" max="300" value="30" inputmode="numeric"></div>
          <div class="fg"><label class="f">Late bid resets to (sec)</label><input name="resetSeconds" type="number" min="5" max="120" value="15" inputmode="numeric"></div>
        </div>
        <div id="silentOpts" hidden>
          <div class="two" style="margin-top:0">
            <div class="fg"><label class="f">Bidding ends *</label><input name="endsAt" type="datetime-local" id="aEnds"><small class="muted">Can be days or weeks away. You can change it later.</small></div>
            <div class="fg"><label class="f">Late bid adds (sec)</label><input name="silentReset" type="number" min="5" max="120" value="60" inputmode="numeric"><small class="muted">A bid in the final moments pushes that player's close back so nobody gets sniped.</small></div>
          </div>
        </div>
        <div class="fg"><label class="f">Payout split by finish (%)</label><input name="payouts" value="50, 25, 15, 10" placeholder="1st, 2nd, 3rd, ..."><small class="muted">1st, 2nd, 3rd… as percentages of the pot after any house cut.</small></div>
        <div class="fg"><label class="f">Players, one per line *</label><textarea name="items" rows="8" required placeholder="Player One&#10;Player Two&#10;Player Three"></textarea></div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px;font-size:14px"><input type="checkbox" name="listed"> Show this auction on the public Auctions page</label>
        <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:12px;font-size:14px"><input type="checkbox" required style="margin-top:4px"> I understand this site doesn't take, hold or pay out money, and I'm responsible for following the laws where the auction is held.</label>
        <div id="aMsg"></div>
        <button class="btn btn-green" type="submit">Create Auction</button>
      </form>`;
    const mode = document.getElementById('aMode');
    document.getElementById('aEnds').value = toLocalInput(Date.now() + 7 * 86_400_000);
    mode.addEventListener('change', () => {
      const silent = mode.value === 'silent';
      document.getElementById('liveOpts').hidden = silent;
      document.getElementById('silentOpts').hidden = !silent;
      document.getElementById('aEnds').required = silent;
      document.getElementById('startHint').textContent = silent ? 'Bidding opens by itself at this time. Leave blank to open bidding right away.' : 'You start it yourself from the host screen when everyone is ready.';
    });
    document.getElementById('aForm').addEventListener('submit', async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target));
      body.listed = !!body.listed;
      body.startsMs = fromLocalInput(body.startsAt);
      if (body.mode === 'silent') { body.endsMs = fromLocalInput(body.endsAt); body.resetSeconds = body.silentReset; }
      delete body.endsAt; delete body.silentReset;
      try {
        const r = await api('/api/auctions', { method: 'POST', body });
        aSave(r.code, { hostKey: r.hostKey });
        const hostLink = `${location.origin}/#/a/${r.code}?host=${encodeURIComponent(r.hostKey)}`;
        app.innerHTML = `
          <div class="pagehead"><h1>Auction Created</h1></div>
          <div class="card">
            <p>Bidders join with this code:</p>
            <div class="acode">${esc(r.code)}</div>
            <p class="muted">Or send them this link: <b>${esc(location.origin)}/#/a/${esc(r.code)}</b></p>
            <hr class="hr">
            <h3 style="margin-bottom:6px">Your private host link</h3>
            <p class="muted">Use it to start the auction and run it from any device. It's saved on this phone too. Don't share it.</p>
            <input id="hostLink" readonly value="${esc(hostLink)}">
            <div class="actbar" style="margin-top:12px"><button class="btn btn-blue" type="button" id="copyHost">Copy Host Link</button><a class="btn btn-green" href="#/a/${esc(r.code)}">Open the Auction Room</a></div>
          </div>`;
        document.getElementById('copyHost').addEventListener('click', async () => {
          document.getElementById('hostLink').select();
          try { await navigator.clipboard.writeText(hostLink); } catch { /* ignore */ }
          document.getElementById('copyHost').textContent = 'Copied';
        });
      } catch (err) { document.getElementById('aMsg').innerHTML = errorBox(err.message); }
    });
  }

  let auctionPoll = null;
  async function auctionRoom(params, rawCode) {
    const code = String(rawCode || '').toUpperCase();
    if (params.get('host')) { aSave(code, { hostKey: params.get('host') }); history.replaceState(null, '', '#/a/' + code); }
    if (auctionPoll) { clearInterval(auctionPoll); auctionPoll = null; }
    const route = '#/a/' + code;
    let st = null, offset = 0, tab = 'room', seenChat = 0, pendingRender = false;
    const creds = () => aStore(code);
    const call = (path, opts = {}) => {
      const c = creds(), headers = {};
      if (c.token) headers['X-Bidder'] = c.token;
      if (c.hostKey) headers['X-Host-Key'] = c.hostKey;
      return api(`/api/auctions/${code}${path}`, { ...opts, headers });
    };
    const now = () => Date.now() + offset;

    app.innerHTML = `
      <div class="crumbs"><a href="#/auctions">Calcutta Auctions</a> / ${esc(code)}</div>
      <div id="aHead">${loading('Loading auction…')}</div>
      <div id="aJoin"></div>
      <div id="aHostBar"></div>
      <div class="atabs" role="tablist">
        <button type="button" data-tab="room" class="on">Auction</button>
        <button type="button" data-tab="results">Results</button>
        <button type="button" data-tab="chat">Chat <span id="chatBadge" class="abadge" hidden></span></button>
      </div>
      <div id="aMain"></div>
      <div id="aChat" hidden>
        <div class="card achat"><div id="chatList" class="chatlist"></div>
          <form id="chatForm" style="display:flex;gap:8px;margin-top:10px"><input name="text" maxlength="300" placeholder="Say something…" autocomplete="off"><button class="btn btn-blue" type="submit">Send</button></form>
          <div id="chatMsg"></div></div>
      </div>
      <div id="aHost"></div>
      ${AUCTION_NOTE}`;

    const focusedIn = el => el && el.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);

    async function refresh(force = false) {
      if (!location.hash.startsWith(route)) { clearInterval(auctionPoll); auctionPoll = null; return; }
      try {
        const r = await call(force || !st ? '' : `?rev=${st.rev}`);
        offset = r.serverNow - Date.now();
        if (r.unchanged) return;
        st = r; draw();
      } catch (e) {
        if (!st) { document.getElementById('aHead').innerHTML = errorBox(e.message); clearInterval(auctionPoll); auctionPoll = null; }
      }
    }

    function secsLeft(endsAt) { return Math.max(0, Math.ceil((endsAt - now()) / 1000)); }
    const clock = s => s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h`
      : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m`
      : s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);

    function drawHead() {
      const a = st.auction;
      document.getElementById('aHead').innerHTML = `
        <div class="pagehead" style="margin-bottom:12px">
          <div class="stake-top" style="justify-content:flex-start"><span class="stake-tag ${a.status === 'running' ? 'live' : a.status === 'done' ? 'lost' : ''}">${esc(aStatusLabel[a.status])} · ${a.mode === 'silent' ? 'Silent auction' : 'One player at a time'}</span>
          <button type="button" class="chip" id="shareBtn" style="cursor:pointer">Code ${esc(a.code)} · Share</button></div>
          <h1 style="margin-top:8px">${esc(a.title)}</h1>
        </div>
        <div class="stake-nums" style="margin-bottom:14px">
          <div><small>Pot</small><b>${cash(st.pot)}</b></div>
          <div><small>Sold</small><b>${st.items.filter(i => i.status === 'sold').length}/${st.items.length}</b></div>
          <div><small>Bidders</small><b>${st.bidders}</b></div>
        </div>`;
      document.getElementById('shareBtn').addEventListener('click', async () => {
        const link = `${location.origin}/#/a/${a.code}`;
        try { if (navigator.share) await navigator.share({ title: a.title, text: `Join the ${a.title} Calcutta. Code ${a.code}`, url: link }); else { await navigator.clipboard.writeText(link); document.getElementById('shareBtn').textContent = 'Link copied'; } } catch { /* ignore */ }
      });
    }

    function drawJoin() {
      const el = document.getElementById('aJoin');
      if (st.you || st.auction.status === 'done') { el.innerHTML = st.you ? `<p class="muted" style="margin:-4px 0 12px">Bidding as <b style="color:var(--text)">${esc(st.you.name)}</b></p>` : ''; return; }
      if (focusedIn(el)) return;
      el.innerHTML = `<form class="card" id="joinForm" style="margin-bottom:14px">
          <label class="f">${st.host ? 'Want to bid too? Join with the name everyone will see' : 'Join to bid: pick the name everyone will see'}</label>
          <div style="display:flex;gap:8px"><input name="name" maxlength="30" required placeholder="Your name"><button class="btn btn-green" type="submit">Join</button></div>
          <div id="joinMsg"></div></form>`;
      document.getElementById('joinForm').addEventListener('submit', async e => {
        e.preventDefault();
        try {
          const r = await call('/join', { method: 'POST', body: { name: new FormData(e.target).get('name') } });
          aSave(code, { token: r.token, name: r.bidder.name });
          refresh(true);
        } catch (err) { document.getElementById('joinMsg').innerHTML = errorBox(err.message); }
      });
    }

    function bidButtons(item) {
      const a = st.auction, base = item.minNext;
      const opts = [base, base + a.increment * 2, base + a.increment * 5];
      return `<div class="abids" data-item="${item.id}">
          ${opts.map((v, i) => `<button type="button" class="btn ${i ? 'btn-out' : 'btn-green'}" data-bid="${v}">Bid ${cash(v)}</button>`).join('')}
        </div>
        <form class="abidform" data-item="${item.id}"><input name="amount" type="number" min="${base}" step="1" inputmode="numeric" placeholder="Other amount (${cash(base)}+)"><button class="btn btn-blue" type="submit">Bid</button></form>`;
    }

    function drawRoom() {
      const a = st.auction, main = document.getElementById('aMain');
      if (focusedIn(main)) { pendingRender = true; return; }
      pendingRender = false;
      const waiting = st.items.filter(i => i.status === 'waiting');
      const closed = st.items.filter(i => i.status === 'sold' || i.status === 'unsold');
      const soldList = closed.length ? `<h2 class="stake-h">Sold</h2><div class="card"><table class="t"><tbody>${closed.slice().reverse().map(i =>
        `<tr><td>${esc(i.name)}</td><td>${i.status === 'sold' ? `${esc(i.highBidder)}${i.mine ? ' <span class="chip g">You</span>' : ''}` : '<span class="muted">No sale</span>'}</td><td style="text-align:right">${i.status === 'sold' ? cash(i.highBid) : ''}</td></tr>`).join('')}</tbody></table></div>` : '';

      if (a.mode === 'silent') {
        const list = st.items.filter(i => i.status === 'open' || i.status === 'waiting');
        main.innerHTML = `
          ${a.status === 'setup' ? `<div class="card aup"><p class="muted" style="margin:0">${a.startsMs ? `Bidding opens <b style="color:var(--text)">${esc(fmtWhen(a.startsMs))}</b>.` : 'Waiting for the host to open bidding.'}${a.endsMs ? ` Bidding closes <b style="color:var(--text)">${esc(fmtWhen(a.endsMs))}</b>.` : ''} Every player is open at once. A bid in the last ${a.resetSeconds} seconds adds time to that player.</p></div>` : ''}
          ${a.status === 'running' && a.endsMs ? `<div class="card aup" style="margin-bottom:12px"><p style="margin:0">Bidding closes <b>${esc(fmtWhen(a.endsMs))}</b> <span class="aclock sm" data-ends="${a.endsMs}"></span></p><small class="muted">A bid in the last ${a.resetSeconds} seconds adds time to that player.</small></div>` : ''}
          <div class="silentgrid">${list.map(i => `
            <div class="card aitem${i.mine ? ' mine' : ''}">
              <div class="stake-top"><b style="font-size:18px">${esc(i.name)}</b>${i.status === 'open' ? `<span class="aclock sm" data-ends="${i.endsAt}"></span>` : ''}</div>
              <div class="muted" style="margin:4px 0 8px">${i.highBid != null ? `High bid <b style="color:var(--text)">${cash(i.highBid)}</b> · ${esc(i.highBidder)}${i.mine ? ' <span class="chip g">You</span>' : ''}` : `Opens at ${cash(a.minBid)}`}</div>
              ${i.status === 'open' ? bidButtons(i) : ''}
            </div>`).join('')}</div>
          ${soldList}`;
        return;
      }

      const cur = st.items.find(i => i.id === a.currentItem);
      let stage;
      if (a.status === 'setup') stage = `<div class="card aup"><small class="muted">Up first</small><h2>${esc(waiting[0]?.name || '—')}</h2><p class="muted" style="margin:0">Waiting for the host to start the auction. Opening bid ${cash(a.minBid)}, then ${cash(a.increment)} steps. Each player gets ${a.bidSeconds} seconds; a late bid resets the clock to ${a.resetSeconds}.</p></div>`;
      else if (a.status === 'done') stage = `<div class="card aup"><h2>Auction over</h2><p class="muted" style="margin:0">Pot: <b style="color:var(--text)">${cash(st.pot)}</b>. See the Results tab for owners and payouts.</p></div>`;
      else if (cur) {
        const open = cur.status === 'open';
        stage = `<div class="card aup${open ? ' live' : ''}">
            <div class="stake-top"><small class="muted">${open ? 'Now bidding' : cur.status === 'sold' ? 'Sold' : 'No sale'}</small>
              ${a.status === 'paused' ? '<span class="stake-tag">Paused</span>' : open ? `<span class="aclock" data-ends="${cur.endsAt}"></span>` : a.nextAt ? `<span class="muted">Next player in <b class="acount" data-ends="${a.nextAt}"></b></span>` : ''}</div>
            <h2>${esc(cur.name)}</h2>
            <div class="ahigh">${cur.highBid != null ? cash(cur.highBid) : cash(a.minBid)}</div>
            <div class="muted">${cur.highBid != null ? `${open ? 'High bid' : 'Sold to'}: <b style="color:var(--text)">${esc(cur.highBidder)}</b>${cur.mine ? ' <span class="chip g">You</span>' : ''}` : open ? 'No bids yet: opening bid' : 'Nobody bid on this player'}</div>
            ${open && a.status === 'running' ? `<div style="margin-top:12px">${cur.mine ? '<p class="amine">You have the high bid</p>' : bidButtons(cur)}</div>` : ''}
            <div id="bidErr"></div>
            ${st.currentBids.length ? `<div class="ahist">${st.currentBids.map(b => `<div><span>${esc(b.name)}</span><b>${cash(b.amount)}</b></div>`).join('')}</div>` : ''}
          </div>`;
      } else stage = `<div class="card aup"><p class="muted" style="margin:0">Getting the next player ready…</p></div>`;
      main.innerHTML = `${stage}
        ${waiting.length && a.status !== 'done' ? `<h2 class="stake-h">Up Next (${waiting.length})</h2><div class="card"><ol class="aqueue">${waiting.map(i => `<li>${esc(i.name)}${st.host ? ` <button type="button" class="linkbtn" data-remove="${i.id}">remove</button>` : ''}</li>`).join('')}</ol></div>` : ''}
        ${soldList}`;
    }

    function drawResults() {
      const a = st.auction, main = document.getElementById('aMain');
      if (focusedIn(main)) { pendingRender = true; return; }
      const sold = st.items.filter(i => i.status === 'sold');
      main.innerHTML = `
        <div class="card">
          <div class="stake-nums"><div><small>Pot</small><b>${cash(st.pot)}</b></div><div><small>House cut</small><b>${a.houseCut}%</b></div><div><small>To pay out</small><b>${cash(st.net)}</b></div></div>
          ${a.payouts.length ? `<table class="t" style="margin-top:12px"><thead><tr><th>Finish</th><th>Share</th><th style="text-align:right">Pays</th></tr></thead><tbody>${a.payouts.map((p, i) => `<tr><td>${ordinal(i + 1)}</td><td>${p}%</td><td style="text-align:right">${cash(st.placePay[i])}</td></tr>`).join('')}</tbody></table>` : ''}
        </div>
        <h2 class="stake-h">Players &amp; Owners</h2>
        ${sold.length ? `<div class="card" style="overflow-x:auto"><table class="t stakes-t"><thead><tr><th>Player</th><th>Owner</th><th>Price</th><th>Finish</th><th style="text-align:right">Won</th></tr></thead><tbody>${sold.map(i => `<tr>
            <td>${esc(i.name)}</td><td>${esc(i.highBidder)}${i.mine ? ' <span class="chip g">You</span>' : ''}</td><td>${cash(i.highBid)}</td>
            <td>${st.host ? `<select data-finish="${i.id}" aria-label="Finish for ${esc(i.name)}"><option value="">—</option>${Array.from({ length: Math.max(a.payouts.length, 8) }, (_, k) => `<option value="${k + 1}"${i.finish === k + 1 ? ' selected' : ''}>${ordinal(k + 1)}</option>`).join('')}</select>` : (i.finish ? ordinal(i.finish) : '—')}</td>
            <td style="text-align:right">${i.payout ? `<b>${cash(i.payout)}</b>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card"><p class="muted" style="margin:0">Nobody has been sold yet.</p></div>'}
        ${st.owners.length ? `<h2 class="stake-h">By Owner</h2><div class="card" style="overflow-x:auto"><table class="t stakes-t"><thead><tr><th>Owner</th><th>Players</th><th>Spent</th><th style="text-align:right">Won</th></tr></thead><tbody>${st.owners.map(o => `<tr><td>${esc(o.name)}</td><td>${o.players}</td><td>${cash(o.spent)}</td><td style="text-align:right">${o.won ? `<b>${cash(o.won)}</b>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${st.host ? '<p class="muted" style="font-size:14px">As host, set each player\'s finish after the tournament and the payouts fill in.</p>' : ''}`;
    }

    function drawChat() {
      const list = document.getElementById('chatList');
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      list.innerHTML = st.chat.length ? st.chat.map(c => `<div class="cmsg${c.host ? ' host' : ''}"><b>${esc(c.name)}</b> ${esc(c.text)}</div>`).join('') : '<p class="muted">No messages yet.</p>';
      if (atBottom || tab === 'chat') list.scrollTop = list.scrollHeight;
      const badge = document.getElementById('chatBadge');
      if (tab === 'chat') seenChat = st.chat.length;
      const unread = st.chat.length - seenChat;
      badge.hidden = unread <= 0; badge.textContent = unread > 9 ? '9+' : String(unread);
      document.getElementById('chatForm').hidden = !st.you && !st.host;
    }

    function drawHost() {
      const el = document.getElementById('aHost');
      if (!st.host) { el.innerHTML = ''; document.getElementById('aHostBar').innerHTML = ''; return; }
      if (focusedIn(el) || document.querySelector('#aHost .armed, #aHostBar .armed')) return;
      const a = st.auction, cur = st.items.find(i => i.id === a.currentItem);
      const btn = (act, label, cls = 'btn-out') => `<button type="button" class="btn ${cls} btn-sm" data-host="${act}">${label}</button>`;
      const controls = [];
      if (a.status === 'setup') controls.push(btn('start', a.mode === 'silent' ? 'Open Bidding Now' : 'Start Auction', 'btn-green'));
      if (a.status === 'running' && a.mode === 'live') controls.push(btn('pause', 'Pause'));
      if (a.status === 'paused') controls.push(btn('resume', 'Resume', 'btn-green'));
      if (a.mode === 'live' && cur && cur.status === 'open' && a.status !== 'done') controls.push(btn('sell', 'Sell Now', 'btn-blue'), btn('pass', 'Pass (No Sale)'));
      if (a.mode === 'live' && a.status === 'running' && (!cur || cur.status !== 'open')) controls.push(btn('next', 'Next Player Now'));
      if (a.status === 'running' || a.status === 'paused') controls.push(btn('end', 'End Auction'));
      document.getElementById('aHostBar').innerHTML = `
        <div class="card ahostbar">${a.status === 'setup' ? `<p style="margin:0 0 8px;font-weight:700">Bidding isn't open yet. Tap <span style="color:var(--green)">${a.mode === 'silent' ? 'Open Bidding Now' : 'Start Auction'}</span> when you're ready.</p>` : '<small class="muted">Host controls</small>'}
          <div class="actbar" style="margin-top:6px">${controls.join('') || '<span class="muted">The auction is over. Set finishes on the Results tab.</span>'}</div>
          <div id="hostMsg"></div></div>`;
      el.innerHTML = `
        <h2 class="stake-h">Host Tools</h2>
        <div class="card">
          ${a.mode === 'silent' && a.status !== 'done' ? `<form id="setEnd"><label class="f">Bidding ends</label><div style="display:flex;gap:8px"><input name="endsAt" type="datetime-local" required value="${a.endsMs ? toLocalInput(a.endsMs) : ''}"><button class="btn btn-out btn-sm" type="submit">Save</button></div>${a.endsMs ? `<small class="muted">Now: ${esc(fmtWhen(a.endsMs))}</small>` : ''}</form><hr class="hr">` : ''}
          ${a.status !== 'done' ? `<form id="addPlayers"><label class="f">Add players (one per line)</label><textarea name="items" rows="3"></textarea><button class="btn btn-out btn-sm" type="submit" style="margin-top:8px">Add</button></form><hr class="hr">` : ''}
          <button type="button" class="btn btn-sm btn-out" data-host="delete" style="color:var(--red)">Delete Auction</button>
        </div>`;
      const setEnd = document.getElementById('setEnd');
      if (setEnd) setEnd.addEventListener('submit', async e => {
        e.preventDefault();
        document.activeElement && document.activeElement.blur();
        await hostDo('setend', { endsMs: fromLocalInput(new FormData(setEnd).get('endsAt')) });
      });
      const add = document.getElementById('addPlayers');
      if (add) add.addEventListener('submit', async e => {
        e.preventDefault();
        await hostDo('add', { items: new FormData(add).get('items') });
        add.reset(); refresh(true);
      });
    }

    async function hostDo(action, extra = {}, btn = null) {
      if (action === 'end' && !tapTwice(btn, 'end', 'Tap again to end')) return;
      if (action === 'delete' && !tapTwice(btn, 'delete', 'Tap again to delete')) return;
      try {
        await call('/host', { method: 'POST', body: { action, ...extra } });
        if (action === 'delete') { location.hash = '#/auctions'; return; }
        refresh(true);
      } catch (err) { const m = document.getElementById('hostMsg'); if (m) m.innerHTML = errorBox(err.message); else alert(err.message); }
    }

    function draw() {
      if (!st) return;
      drawHead(); drawJoin();
      if (tab === 'room') drawRoom(); else if (tab === 'results') drawResults();
      drawChat(); drawHost(); tickClocks();
    }

    function tickClocks() {
      document.querySelectorAll('#aMain [data-ends]').forEach(el => {
        const s = secsLeft(Number(el.dataset.ends));
        el.textContent = el.classList.contains('acount') ? `${s}s` : clock(s);
        el.classList.toggle('urgent', !el.classList.contains('acount') && s <= 5);
      });
    }

    async function bid(itemId, amount) {
      const errBox = document.getElementById('bidErr');
      if (!st.you) {
        const input = document.querySelector('#joinForm [name=name]');
        const msg = document.getElementById('joinMsg');
        if (msg) msg.innerHTML = '<p class="aerr">Type your name and tap Join first, then place your bid.</p>';
        if (input) { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); input.focus(); }
        return;
      }
      try { await call('/bid', { method: 'POST', body: { itemId, amount } }); if (errBox) errBox.innerHTML = ''; refresh(true); }
      catch (err) { if (errBox) errBox.innerHTML = `<p class="aerr">${esc(err.message)}</p>`; else alert(err.message); refresh(true); }
    }

    document.querySelector('.atabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      tab = b.dataset.tab;
      document.querySelectorAll('.atabs button').forEach(x => x.classList.toggle('on', x === b));
      document.getElementById('aMain').hidden = tab === 'chat';
      document.getElementById('aChat').hidden = tab !== 'chat';
      draw();
    });
    const main = document.getElementById('aMain');
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-bid]');
      if (b) { bid(Number(b.closest('[data-item]').dataset.item), Number(b.dataset.bid)); return; }
      const r = e.target.closest('[data-remove]');
      if (r) hostDo('remove', { itemId: Number(r.dataset.remove) }, r);
    });
    main.addEventListener('submit', e => {
      const f = e.target.closest('.abidform'); if (!f) return;
      e.preventDefault();
      const amt = Number(new FormData(f).get('amount'));
      document.activeElement && document.activeElement.blur();
      if (amt > 0) bid(Number(f.dataset.item), amt);
    });
    main.addEventListener('change', e => {
      const s = e.target.closest('[data-finish]');
      if (s) { s.blur(); hostDo('finish', { itemId: Number(s.dataset.finish), finish: s.value }); }
    });
    main.addEventListener('focusout', () => setTimeout(() => { if (pendingRender && !focusedIn(main)) draw(); }, 50));
    for (const id of ['aHost', 'aHostBar']) document.getElementById(id).addEventListener('click', e => { const b = e.target.closest('[data-host]'); if (b) hostDo(b.dataset.host, {}, b); });
    document.getElementById('chatForm').addEventListener('submit', async e => {
      e.preventDefault();
      const input = e.target.elements.text;
      try { await call('/chat', { method: 'POST', body: { text: input.value } }); input.value = ''; refresh(true); }
      catch (err) { document.getElementById('chatMsg').innerHTML = errorBox(err.message); }
    });

    await refresh(true);
    auctionPoll = setInterval(() => { refresh(); tickClocks(); }, 1500);
    const clockTimer = setInterval(() => { if (!location.hash.startsWith(route)) clearInterval(clockTimer); else tickClocks(); }, 250);
  }
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

  routes['/auctions'] = async (params, id) => (id === 'new' ? auctionCreate() : auctionsHome());
  routes['/a'] = async (params, code) => (code ? auctionRoom(params, code) : auctionsHome());

  routes['/account'] = async () => {
    const since = memberSince();
    const sinceLabel = new Date(since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const saved = lsGet(LS.saved), submissions = lsGet(LS.submissions), claims = lsGet(LS.claims), alerts = lsGet(LS.alerts), recent = lsGet(LS.recent);
    app.innerHTML = `
      <div class="pagehead"><h1>Welcome back, Player!</h1>
        <p class="muted">Member since ${esc(sinceLabel)}. Sign-in isn't connected yet, so saves live on this device.</p></div>
      <div class="stats">
        <div class="stat"><b>${saved.length}</b><span>Saved tournaments</span></div>
        <div class="stat"><b>${submissions.length}</b><span>Submissions</span></div>
        <div class="stat"><b>${alerts.length}</b><span>Active alerts</span></div>
        <div class="stat"><b>${claims.length}</b><span>Claims</span></div>
      </div>
      <h2 style="margin-top:26px">Quick Actions</h2>
      <div class="qa">
        <a href="#/search"><span>🔍</span>Find a tournament</a>
        <a href="#/calendar"><span>📅</span>View calendar</a>
        <a href="#/alerts"><span>🔔</span>Manage alerts</a>
        <a href="#/post"><span>➕</span>Post a tournament</a>
      </div>
      <div class="tabs" id="acctTabs">
        <button class="on" data-tab="saved">Saved</button>
        <button data-tab="posts">My posts</button>
        <button data-tab="venues">My venues</button>
        <button data-tab="alerts">My alerts</button>
      </div>
      <div id="acctBody"></div>
      <h2 style="margin-top:26px">Recently Viewed</h2>
      <div id="acctRecent" class="results">
        ${recent.length ? recent.map(tournamentCard).join('') : '<div class="loadwrap"><p class="muted">Tournaments you open will show up here.</p></div>'}
      </div>`;

    function renderTab(tab) {
      const body = document.getElementById('acctBody');
      if (tab === 'saved') {
        body.innerHTML = saved.length ? `<div class="results">${saved.map(tournamentCard).join('')}</div>`
          : `<div class="loadwrap"><p class="muted">No saved tournaments yet. Tap the ☆ on any tournament to save it.</p></div>`;
      } else if (tab === 'posts') {
        body.innerHTML = submissions.length ? `<div class="results">${submissions.map(s => `
          <a class="tcard" href="#/t/${s.id}">
            <h3>${esc(s.name)}</h3>
            <div class="muted">${esc(fmtDate(s.date))}</div>
            <div class="muted">${esc(s.venue?.name || '')}${s.venue?.city ? ' — ' + esc(s.venue.city) + ', ' + esc(s.venue.state || '') : ''}</div>
            <div class="facts"><span>${s.status === 'pending' ? 'Pending review' : 'Submitted'}</span></div>
          </a>`).join('')}</div>`
          : `<div class="loadwrap"><p class="muted">Nothing posted yet. <a href="#/post">Post a tournament</a> for free.</p></div>`;
      } else if (tab === 'venues') {
        const uniq = new Map();
        for (const c of claims) if (!uniq.has(c.tournamentId)) uniq.set(c.tournamentId, c);
        body.innerHTML = uniq.size ? `<div class="results">${[...uniq.values()].map(c => `
          <a class="tcard" href="#/t/${c.tournamentId}"><h3>Claimed Tournament #${esc(c.tournamentId)}</h3>
          <div class="muted">Claimed ${esc(fmtDate((c.at || '').slice(0, 10)))}</div></a>`).join('')}</div>`
          : `<div class="loadwrap"><p class="muted">No claimed venues yet. Run a tournament? <a href="#/claim">Claim your listing</a>.</p></div>`;
      } else {
        body.innerHTML = alerts.length ? `<ul class="statelist">${alerts.map(a => `<li>${esc(a.email)}</li>`).join('')}</ul>`
          : `<div class="loadwrap"><p class="muted">No alerts set up on this device yet. <a href="#/alerts">Get alerts</a>.</p></div>`;
      }
    }
    document.getElementById('acctTabs').addEventListener('click', e => {
      const btn = e.target.closest('button[data-tab]'); if (!btn) return;
      document.querySelectorAll('#acctTabs button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      renderTab(btn.dataset.tab);
    });
    renderTab('saved');
  };

  routes['/games'] = async () => {
    app.innerHTML = `<div class="pagehead"><h1>Browse by Game</h1></div><div id="gameGrid" class="tiles gametiles">${loading()}</div>`;
    try {
      const data = await api('/api/tournaments?limit=50000');
      const counts = {};
      for (const t of data.tournaments) counts[t.game] = (counts[t.game] || 0) + 1;
      const order = GAMES.filter(g => g !== 'Other').concat('Other');
      document.getElementById('gameGrid').innerHTML = order.map(g => gameTile(g, counts[g] || 0)).join('');
    } catch (e) { document.getElementById('gameGrid').innerHTML = errorBox(e.message); }
  };

  routes['/results'] = async () => {
    app.innerHTML = `
      <div class="pagehead"><h1>Past Tournaments</h1>
        <p class="muted">A running archive of tournaments that have already happened.</p></div>
      <div id="pastList" class="results">${loading()}</div>
      <div class="actbar" id="pastMoreWrap" style="display:none">
        <button class="btn btn-out" id="pastMoreBtn">Load more</button>
      </div>`;
    let offset = 0;
    const limit = 30;
    let total = 0;
    const listEl = document.getElementById('pastList');
    const moreWrap = document.getElementById('pastMoreWrap');
    const moreBtn = document.getElementById('pastMoreBtn');
    async function loadMore() {
      try {
        const data = await api(`/api/tournaments/past?limit=${limit}&offset=${offset}`);
        total = data.total;
        if (offset === 0) listEl.innerHTML = data.tournaments.length ? '' : '<div class="loadwrap"><p class="muted">No past tournaments yet — check back once some have happened.</p></div>';
        listEl.insertAdjacentHTML('beforeend', data.tournaments.map(tournamentCard).join(''));
        offset += data.tournaments.length;
        moreWrap.style.display = offset < total ? '' : 'none';
      } catch (e) { listEl.innerHTML = errorBox(e.message); }
    }
    moreBtn.addEventListener('click', loadMore);
    await loadMore();
  };

  routes['/scout'] = async () => {
    const submissions = lsGet(LS.submissions);
    app.innerHTML = `
      <div class="pagehead"><h1>Tournament Scout</h1>
        <p class="muted">Report a tournament you spotted. Help Billiard Action Time keep the database growing.</p></div>
      <div class="card">
        <h2>How It Works</h2>
        <ol class="steps3">
          <li>Upload a flyer or screenshot.</li>
          <li>We read the information from it.</li>
          <li>We review and publish it.</li>
        </ol>
        <div class="actbar">
          <button class="btn btn-blue" id="scoutUploadBtn">⬆ Upload flyer</button>
          <a class="btn btn-out" href="#/account">View my scouts</a>
        </div>
        <input type="file" id="scoutFlyerInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none">
        <p class="muted" id="scoutStatus"></p>
      </div>
      <div class="card" style="margin-top:16px">
        <h2>Scout Badges</h2>
        <p class="muted">You have posted ${submissions.length} tournament${submissions.length === 1 ? '' : 's'}.</p>
        <div id="badgeGrid" class="badgegrid">${loading('Checking verified count…')}</div>
      </div>`;

    document.getElementById('scoutUploadBtn').addEventListener('click', () => document.getElementById('scoutFlyerInput').click());
    document.getElementById('scoutFlyerInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      const status = document.getElementById('scoutStatus');
      if (!file) return;
      let cfg;
      try { cfg = await api('/api/config'); } catch { cfg = { scan: false }; }
      if (!cfg.scan) { status.textContent = "Flyer scanning isn't turned on for this site yet. You can still post manually."; e.target.value = ''; return; }
      status.textContent = 'Reading flyer…';
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = await api('/api/scan', { method: 'POST', body: { image: reader.result } });
          sessionStorage.setItem('bat_scanned_flyer', JSON.stringify(data.fields || {}));
          try { sessionStorage.setItem('bat_scanned_flyer_image', reader.result); } catch { /* too big, skip */ }
          status.textContent = 'Got it! Opening the post form…';
          location.hash = '#/post';
        } catch (err) { status.textContent = 'Could not read that flyer: ' + err.message; e.target.value = ''; }
      };
      reader.readAsDataURL(file);
    });

    (async () => {
      const grid = document.getElementById('badgeGrid');
      let verified = 0;
      const toCheck = submissions.slice(0, 100);
      await Promise.all(toCheck.map(async s => {
        try { const t = await api('/api/tournaments/' + s.id); if (t.status === 'published') verified++; } catch { /* not visible / removed */ }
      }));
      const tiers = [1, 10, 25, 50, 100];
      grid.innerHTML = `
        <div class="badge on"><div class="hex">★</div><small>Tournament Scout</small></div>
        ${tiers.map(n => `<div class="badge${verified >= n ? ' on' : ''}"><div class="hex">${n}</div><small>${n} Verified</small></div>`).join('')}`;
    })();
  };

  function notFound() { app.innerHTML = `<div class="pagehead"><h1>Page not found</h1></div><a class="btn btn-out" href="#/">Go home</a>`; }

  // -------------------------------------------------------------- router
  function parseHash() {
    const raw = location.hash.slice(1) || '/';
    const [pathPart, queryPart] = raw.split('?');
    const params = new URLSearchParams(queryPart || '');
    const segs = pathPart.split('/').filter(Boolean);
    return { pathPart, params, segs };
  }

  // Tells the server which page was shown and where the visitor came from (the referring site
  // and any ?utm_source= tag on the link). Skipped on devices logged into Admin so the owner's
  // own browsing doesn't count. Never blocks or breaks the page if it fails.
  const landing = (() => {
    const fromSearch = new URLSearchParams(location.search).get('utm_source');
    const fromHash = new URLSearchParams((location.hash.split('?')[1]) || '').get('utm_source');
    return { ref: document.referrer || '', utm: fromSearch || fromHash || '' };
  })();
  function trackPage(pathPart) {
    if (adminToken() || pathPart.startsWith('/admin')) return;
    try {
      fetch('/api/track', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pathPart, ref: landing.ref, utm: landing.utm }) }).catch(() => {});
    } catch { /* ignore */ }
  }

  async function render() {
    const { pathPart, params, segs } = parseHash();
    window.scrollTo(0, 0);
    trackPage(pathPart);
    // exact match first
    if (routes[pathPart]) return routes[pathPart](params);
    // /prefix/:id style
    if (segs.length === 2 && routes['/' + segs[0]]) return routes['/' + segs[0]](params, segs[1]);
    if (segs.length === 0) return routes['/'](params);
    notFound();
  }

  app.addEventListener('click', e => {
    const btn = e.target.closest('.savebtn');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    let t; try { t = JSON.parse(btn.dataset.t); } catch { return; }
    const nowSaved = toggleSaved(t);
    btn.classList.toggle('on', nowSaved);
    btn.textContent = nowSaved ? '★' : '☆';
  });

  const ftrNlForm = document.getElementById('ftrNlForm');
  if (ftrNlForm) ftrNlForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = new FormData(e.target).get('email');
    const msg = document.getElementById('ftrNlMsg');
    try {
      await api('/api/subscribe', { method: 'POST', body: { email } });
      recordAlert(email);
      msg.textContent = "✓ You're subscribed!";
      e.target.reset();
    } catch (err) { msg.textContent = '⚠ ' + err.message; }
  });

  memberSince();
  window.addEventListener('hashchange', render);
  document.getElementById('menuBtn').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
})();

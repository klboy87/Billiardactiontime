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
          <p>Search pool tournaments by date, location, game, entry fee, and more.</p>
          <form class="hsearch" id="homeSearch">
            <input type="text" id="homeQuery" placeholder="Search tournaments, cities, venues, games…">
            <button type="submit" aria-label="Search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
          </form>
          <p class="eg">Example: 9-Ball Battle Creek</p>
        </div>
      </section>
      <section class="sec tiles">
        <a class="tile t-blue" href="#/search"><div class="ic">🔍</div><h3>Find a Tournament</h3></a>
        <a class="tile t-orange" href="#/calendar"><div class="ic">📅</div><h3>Find by Date</h3></a>
        <a class="tile t-pink" href="#/states"><div class="ic">🗺️</div><h3>Browse by State</h3></a>
        <button class="tile t-purple" id="homeFlyerBtn" type="button"><div class="ic">📷</div><h3>Scan a Flyer</h3></button>
        <a class="tile t-green" href="#/post"><span class="free">FREE</span><div class="ic">➕</div><h3>Post a Tournament</h3></a>
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
    app.innerHTML = `
      <div class="pagehead"><h1>Admin Dashboard</h1>
        <button class="btn btn-out btn-sm" id="logoutBtn">Log Out</button></div>
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
  };

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

  async function render() {
    const { pathPart, params, segs } = parseHash();
    window.scrollTo(0, 0);
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
})();

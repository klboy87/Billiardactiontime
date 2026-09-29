/* Billiard Action Time -- frontend application (vanilla JS, hash router) */
(() => {
  'use strict';

  const GAMES = ['9-Ball', '8-Ball', '10-Ball', 'One Pocket', 'Banks', 'Straight Pool', 'Scotch Doubles', 'Other'];
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

  function tournamentCard(t) {
    return `<a class="tcard" href="#/t/${t.id}">
      <div class="badges">${gameChip(t.game)}${t.verified ? '<span class="verified">✓ Verified</span>' : ''}</div>
      <h3>${esc(t.name)}</h3>
      <div class="muted">${esc(fmtDate(t.date))}${t.time ? ' · ' + esc(fmtTime(t.time)) : ''}</div>
      <div class="muted">${esc(t.venue.name)} — ${esc(t.venue.city)}, ${esc(t.venue.state)}</div>
      <div class="facts">
        ${t.entry != null ? `<span>Entry ${esc(money(t.entry))}</span>` : ''}
        ${t.added ? `<span>Added ${esc(money(t.added))}</span>` : ''}
        ${t.format ? `<span>${esc(t.format)}</span>` : ''}
      </div>
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
          <p>Search hundreds of 8-ball, 9-ball, 10-ball and one-pocket tournaments happening across the USA.</p>
          <form class="bigsearch" id="homeSearch">
            ${stateCitySelects({ idPrefix: 'home' })}
            <button class="btn btn-blue" type="submit">Search Tournaments</button>
          </form>
        </div>
      </section>
      <section class="sec">
        <div class="sec-head"><h2>Upcoming Tournaments</h2><a href="#/search">See all →</a></div>
        <div id="homeList" class="results">${loading()}</div>
      </section>
      <section class="sec tiles">
        <a class="tile" href="#/calendar"><h3>📅 Calendar</h3><p class="muted">Browse tournaments day by day</p></a>
        <a class="tile" href="#/near"><h3>📍 Near Me</h3><p class="muted">Find tournaments close to you</p></a>
        <a class="tile" href="#/venues"><h3>🏢 Venues</h3><p class="muted">Pool halls that run tournaments</p></a>
        <a class="tile" href="#/scan"><h3>📷 Flyer Scanner</h3><p class="muted">Snap a flyer, we'll fill in the details</p></a>
      </section>`;
    wireStateCitySelects(app, 'home', {});
    document.getElementById('homeSearch').addEventListener('submit', e => {
      e.preventDefault();
      const state = document.getElementById('homeState').value, city = document.getElementById('homeCity').value;
      location.hash = '#/search?' + qs({ state, city });
    });
    try {
      const data = await api('/api/tournaments?limit=9');
      document.getElementById('homeList').innerHTML = data.tournaments.length
        ? data.tournaments.map(tournamentCard).join('')
        : `<div class="loadwrap"><p class="muted">No tournaments posted yet. <a href="#/post">Post one</a> or turn on syncing from your source site.</p></div>`;
    } catch (e) { document.getElementById('homeList').innerHTML = errorBox(e.message); }
  };

  routes['/search'] = async (params) => {
    const state = params.get('state') || '', city = params.get('city') || '', game = params.get('game') || '';
    app.innerHTML = `
      <div class="pagehead"><h1>Find Tournaments</h1></div>
      <div class="slayout">
        <form class="filters card" id="filters">
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
      const st = document.getElementById('fState').value, ct = document.getElementById('fCity').value, gm = document.getElementById('fGame').value;
      history.replaceState(null, '', '#/search?' + qs({ state: st, city: ct, game: gm }));
      const results = document.getElementById('results');
      results.innerHTML = loading();
      try {
        const data = await api('/api/tournaments?' + qs({ state: st }));
        let list = data.tournaments;
        if (ct) list = list.filter(t => t.venue.city.toLowerCase() === ct.toLowerCase());
        if (gm) list = list.filter(t => t.game === gm);
        results.innerHTML = list.length ? list.map(tournamentCard).join('')
          : `<div class="loadwrap"><p class="muted">No tournaments found${ct ? ` in ${esc(ct)}, ${esc(st)}` : st ? ` in ${esc(st)}` : ''} yet.
             You can still <a href="#/post">post one</a> so players know it's happening here.</p></div>`;
      } catch (e) { results.innerHTML = errorBox(e.message); }
    }
    filtersEl.addEventListener('submit', e => { e.preventDefault(); runSearch(); });
    runSearch();
  };

  routes['/calendar'] = async () => {
    app.innerHTML = `<div class="pagehead"><h1>Tournament Calendar</h1></div><div id="cal" class="agenda">${loading()}</div>`;
    try {
      const data = await api('/api/tournaments?limit=500');
      const byDate = {};
      for (const t of data.tournaments) (byDate[t.date] ||= []).push(t);
      const dates = Object.keys(byDate).sort();
      document.getElementById('cal').innerHTML = dates.length ? dates.map(d => `
        <div class="cday">
          <h3>${esc(fmtDate(d))}</h3>
          <div class="results">${byDate[d].map(tournamentCard).join('')}</div>
        </div>`).join('') : `<div class="loadwrap"><p class="muted">No upcoming tournaments yet.</p></div>`;
    } catch (e) { document.getElementById('cal').innerHTML = errorBox(e.message); }
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
    app.innerHTML = `
      <div class="crumbs"><a href="#/search">Find Tournaments</a> / ${esc(t.name)}</div>
      <div class="card">
        <div class="badges">${gameChip(t.game)}${t.verified ? '<span class="verified">✓ Verified</span>' : ''}</div>
        <h1 class="dtitle">${esc(t.name)}</h1>
        <table class="t"><tbody>
          <tr><th>Date</th><td>${esc(fmtDate(t.date))}${t.time ? ' at ' + esc(fmtTime(t.time)) : ''}</td></tr>
          <tr><th>Venue</th><td>${esc(t.venue.name)}<br>${esc([t.venue.address, t.venue.city, t.venue.state, t.venue.zip].filter(Boolean).join(', '))}</td></tr>
          ${t.entry != null ? `<tr><th>Entry Fee</th><td>${esc(money(t.entry))}</td></tr>` : ''}
          ${t.added ? `<tr><th>Added Money</th><td>${esc(money(t.added))}</td></tr>` : ''}
          ${t.race ? `<tr><th>Race</th><td>${esc(t.race)}</td></tr>` : ''}
          ${t.format ? `<tr><th>Format</th><td>${esc(t.format)}</td></tr>` : ''}
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
        <div class="fg"><label>Director Name</label><input name="directorName" maxlength="80"></div>
        <div class="two">
          <div class="fg"><label>Director Phone</label><input name="directorPhone" maxlength="30"></div>
          <div class="fg"><label>Director Email</label><input name="directorEmail" type="email" maxlength="120"></div>
        </div>
        <div class="fg"><label>Registration URL</label><input name="registrationUrl" type="url"></div>
        <div class="fg"><label>Notes</label><textarea name="notes" maxlength="1000" rows="4"></textarea></div>
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
      const extras = [f.race ? `Race to ${f.race}` : '', f.format || ''].filter(Boolean).join(' · ');
      set('notes', extras || null);
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
        registrationUrl: f.get('registrationUrl') || null,
        director: { name: f.get('directorName') || null, phone: f.get('directorPhone') || null, email: f.get('directorEmail') || null },
        venue: { name: f.get('venueName'), address: f.get('address') || null, city: f.get('city'), state: f.get('state'), zip: f.get('zip') || null },
        flyer: flyerDataUrl || null
      };
      const msg = document.getElementById('postMsg');
      msg.innerHTML = loading('Submitting…');
      try {
        await api('/api/tournaments', { method: 'POST', body });
        msg.innerHTML = `<div class="loadwrap"><p class="muted">✓ Submitted! It will appear once an admin approves it.</p></div>`;
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
          render();
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
    app.innerHTML = `<div class="pagehead"><h1>My Account</h1></div>
      <div class="loadwrap"><p class="muted">Player accounts are coming soon. In the meantime you can
      <a href="#/claim">claim a tournament</a> you run, or <a href="#/alerts">subscribe to alerts</a>.</p></div>`;
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

  window.addEventListener('hashchange', render);
  document.getElementById('menuBtn').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));
  render();
})();

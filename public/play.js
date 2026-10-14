/* Aim trainer (/play/aim-trainer). Kept in its own file because the site's security policy blocks inline
   scripts. Units are diamonds on a 7-foot bar-box table: x 0–8 (long), y 0–4. A ball is about 0.23
   diamonds across on a bar box. Contact is computed with simple ball geometry (no throw or spin). */
(function () {
  var root = document.getElementById('aimGame');
  if (!root) return;
  var U = 50, R = 22, BALL = 0.23, NS = 'http://www.w3.org/2000/svg';
  var LEVELS = { easy: { tol: 0.2, side: 0.17, maxCut: 40, ghost: true }, normal: { tol: 0.14, side: 0.12, maxCut: 55, ghost: false }, pro: { tol: 0.1, side: 0.085, maxCut: 65, ghost: false } };
  var POCKETS = [[0, 0, 'c'], [4, -0.06, 's'], [8, 0, 'c'], [0, 4, 'c'], [4, 4.06, 's'], [8, 4, 'c']];
  var px = function (v) { return R + v * U; };
  var el = function (tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1]]; }, add = function (a, b) { return [a[0] + b[0], a[1] + b[1]]; };
  var mul = function (a, k) { return [a[0] * k, a[1] * k]; }, dot = function (a, b) { return a[0] * b[0] + a[1] * b[1]; };
  var len = function (a) { return Math.hypot(a[0], a[1]); }, norm = function (a) { var l = len(a); return [a[0] / l, a[1] / l]; };
  var deg = function (r) { return r * 180 / Math.PI; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

  // ---- table drawing ----
  var W = 8 * U + 2 * R, H = 4 * U + 2 * R;
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Pool table', style: 'width:100%;height:auto;display:block;touch-action:manipulation;cursor:crosshair;user-select:none' });
  root.querySelector('[data-table]').appendChild(svg);
  el('rect', { x: 0, y: 0, width: W, height: H, rx: 14, fill: '#5a3518' }, svg);
  el('rect', { x: R, y: R, width: 8 * U, height: 4 * U, fill: '#1f7a4a' }, svg);
  for (var i = 1; i < 8; i++) if (i !== 4) { el('circle', { cx: px(i), cy: R / 2, r: 2.2, fill: '#f4e7c4' }, svg); el('circle', { cx: px(i), cy: H - R / 2, r: 2.2, fill: '#f4e7c4' }, svg); }
  for (var j = 1; j < 4; j++) { el('circle', { cx: R / 2, cy: px(j), r: 2.2, fill: '#f4e7c4' }, svg); el('circle', { cx: W - R / 2, cy: px(j), r: 2.2, fill: '#f4e7c4' }, svg); }
  var pocketEls = POCKETS.map(function (p) { return el('circle', { cx: px(p[0]), cy: px(Math.min(4, Math.max(0, p[1]))), r: 12, fill: '#111', stroke: 'none', 'stroke-width': 3 }, svg); });
  var aimLine = el('line', { stroke: '#fff', 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0.85 }, svg);
  var ghostEl = el('circle', { r: BALL / 2 * U, fill: 'none', stroke: '#fff', 'stroke-width': 1.3, 'stroke-dasharray': '3 2', opacity: 0 }, svg);
  var answerEl = el('circle', { r: BALL / 2 * U, fill: 'none', stroke: '#ffd54a', 'stroke-width': 1.6, opacity: 0 }, svg);
  var trailEl = el('line', { stroke: '#ffd54a', 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0 }, svg);
  var objHalo = el('circle', { r: 13, fill: '#ffd54a', opacity: 0.22 }, svg), cueHalo = el('circle', { r: 13, fill: '#fff', opacity: 0.22 }, svg);
  var objEl = el('circle', { r: BALL / 2 * U, fill: '#f2c400', stroke: '#222', 'stroke-width': 0.8 }, svg);
  var cueEl = el('circle', { r: BALL / 2 * U, fill: '#fff', stroke: '#222', 'stroke-width': 0.8 }, svg);
  var place = function (e, p) { e.setAttribute('cx', px(p[0])); e.setAttribute('cy', px(p[1])); if (e === objEl) place(objHalo, p); if (e === cueEl) place(cueHalo, p); };

  // ---- game state ----
  var ui = { status: root.querySelector('[data-status]'), msg: root.querySelector('[data-msg]'), shoot: root.querySelector('[data-shoot]'), next: root.querySelector('[data-next]'), level: root.querySelector('[data-level]') };
  var level = ui.level.value || 'normal', S = null, shot = null, aim = null, busy = false;
  // Daily challenge: the same 5 shots for everyone on a given (local) date, from a seeded random generator.
  var today = (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
  var dayNo = Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse('2026-10-14T00:00:00Z')) / 864e5) + 1;
  var seeded = function (str) { var h = 1779033703 ^ str.length; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };
  var rnd = Math.random, daily = function () { return level === 'daily'; }, roundLen = function () { return daily() ? 5 : 10; };
  var rules = function () { return LEVELS[daily() ? 'normal' : level]; };
  var bestKey = function () { return 'bat-aim-best-' + level; };
  var newRound = function () { S = { n: 0, score: 0, streak: 0, made: 0, marks: '' }; rnd = daily() ? seeded('bat-daily-' + today) : Math.random; newShot(); };
  var rand = function (a, b) { return a + rnd() * (b - a); };
  function newShot() {
    var L = rules();
    for (var tries = 0; tries < 500; tries++) {
      var o = [rand(0.9, 7.1), rand(0.7, 3.3)], k = Math.floor(rnd() * 6), pk = POCKETS[k];
      var u = norm(sub([pk[0], pk[1]], o)), g = sub(o, mul(u, BALL));
      if (pk[2] === 's' && Math.abs(u[1]) < 0.55) continue;           // side pockets need a steep angle in
      var c = [rand(0.4, 7.6), rand(0.4, 3.6)];
      var toG = sub(g, c); if (len(toG) < 1 || len(sub(o, c)) < 1.2 || len(sub(o, [pk[0], pk[1]])) < 0.8) continue;
      var cut = deg(Math.acos(Math.max(-1, Math.min(1, dot(norm(toG), u)))));
      if (cut > L.maxCut || cut < 3) continue;
      shot = { o: o, c: c, k: k, u: u, g: g, cut: cut }; break;
    }
    aim = norm(sub(shot.g, shot.c));
    aim = rot(aim, (rnd() < 0.5 ? -1 : 1) * rand(6, 14) * Math.PI / 180);   // start off the right line
    place(objEl, shot.o); place(cueEl, shot.c); objEl.setAttribute('opacity', 1); objHalo.setAttribute('opacity', 0.22); objEl.setAttribute('r', BALL / 2 * U);
    pocketEls.forEach(function (p, idx) { p.setAttribute('stroke', idx === shot.k ? '#ffd54a' : 'none'); });
    answerEl.setAttribute('opacity', 0); trailEl.setAttribute('opacity', 0);
    ui.next.hidden = true; ui.shoot.hidden = false; busy = false;
    ui.msg.innerHTML = 'Pocket the yellow ball in the <b>highlighted pocket</b>. Tap the table to aim, fine-tune with the arrows, then shoot.';
    drawAim(); status();
  }
  function rot(v, a) { return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]; }
  // Where the cue ball's center is when it first touches the object ball, or null if it misses.
  function contact(c, d, o) {
    var f = sub(c, o), b = dot(f, d), cc = dot(f, f) - BALL * BALL, disc = b * b - cc;
    if (disc < 0) return null; var t = -b - Math.sqrt(disc); return t > 0 ? add(c, mul(d, t)) : null;
  }
  function railHit(p, d) {                       // distance until a ball center at p moving along d reaches a cushion
    var lo = BALL / 2, hiX = 8 - BALL / 2, hiY = 4 - BALL / 2, ts = [];
    if (d[0] > 0) ts.push((hiX - p[0]) / d[0]); if (d[0] < 0) ts.push((lo - p[0]) / d[0]);
    if (d[1] > 0) ts.push((hiY - p[1]) / d[1]); if (d[1] < 0) ts.push((lo - p[1]) / d[1]);
    return Math.max(0, Math.min.apply(null, ts));
  }
  function drawAim() {
    var hit = contact(shot.c, aim, shot.o), end = hit || add(shot.c, mul(aim, railHit(shot.c, aim)));
    aimLine.setAttribute('x1', px(shot.c[0])); aimLine.setAttribute('y1', px(shot.c[1])); aimLine.setAttribute('x2', px(end[0])); aimLine.setAttribute('y2', px(end[1]));
    if (rules().ghost && hit) { place(ghostEl, hit); ghostEl.setAttribute('opacity', 0.9); } else ghostEl.setAttribute('opacity', 0);
  }
  function status() {
    var best = Number(store.get(bestKey()) || 0);
    var dl = daily() ? store.get('bat-daily-' + today) : null;
    ui.status.textContent = (daily() ? 'Daily #' + dayNo + ' · ' : '') + 'Shot ' + Math.min(S.n + 1, roundLen()) + ' of ' + roundLen() + ' · Score ' + S.score + ' · Streak ' + S.streak + (daily() ? (dl ? ' · Today: ' + dl.split('|')[0] + '/5' : '') : ' · Best ' + best);
  }
  function animate(from, to, e, ms, done) {
    var t0 = null;
    var stepFn = function (ts) { if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / ms), ease = 1 - Math.pow(1 - k, 2); place(e, add(from, mul(sub(to, from), ease))); if (k < 1) requestAnimationFrame(stepFn); else done(); };
    requestAnimationFrame(stepFn);
  }
  function shoot() {
    if (busy) return; busy = true; ui.shoot.hidden = true; aimLine.setAttribute('opacity', 0); ghostEl.setAttribute('opacity', 0);
    var hit = contact(shot.c, aim, shot.o), L = rules(), pk = POCKETS[shot.k];
    var need = norm(sub(shot.g, shot.c)), errDeg = deg(Math.atan2(aim[0] * need[1] - aim[1] * need[0], dot(aim, need)));
    if (!hit) {
      var stop = add(shot.c, mul(aim, railHit(shot.c, aim)));
      animate(shot.c, stop, cueEl, 500, function () { finish(false, 'Missed the ball completely (' + Math.abs(errDeg).toFixed(1) + '° off).'); });
      return;
    }
    var u = norm(sub(shot.o, hit)), P = [pk[0], pk[1]], toP = sub(P, shot.o);
    var along = dot(toP, u), off = Math.abs(toP[0] * u[1] - toP[1] * u[0]);
    var made = along > 0 && off < (pk[2] === 's' ? L.side : L.tol);
    var cutNow = deg(Math.acos(Math.max(-1, Math.min(1, dot(aim, u))))), cutNeed = shot.cut;
    animate(shot.c, hit, cueEl, 380, function () {
      var end = made ? P : add(shot.o, mul(u, railHit(shot.o, u)));
      animate(shot.o, end, objEl, made ? 650 : 750, function () {
        if (made) { objEl.setAttribute('opacity', 0); objHalo.setAttribute('opacity', 0); }
        var how = Math.abs(cutNow - cutNeed) < 0.15 ? 'dead center' : (cutNow < cutNeed ? 'too thick (too full)' : 'too thin');
        finish(made, made ? (Math.abs(cutNow - cutNeed) < 0.6 ? 'Perfect, right in the heart of the pocket!' : 'Made it. You were ' + Math.abs(cutNow - cutNeed).toFixed(1) + '° ' + how + ', but it dropped.')
          : 'Missed: ' + Math.abs(cutNow - cutNeed).toFixed(1) + '° ' + how + '. The yellow circle shows the ghost ball you needed.');
      });
    });
  }
  function finish(made, text) {
    S.n++;
    if (made) { S.streak++; S.made++; S.score += 10 + (S.streak - 1) * 2; } else S.streak = 0;
    S.marks += made ? '✅' : '❌';
    place(answerEl, shot.g); answerEl.setAttribute('opacity', made ? 0 : 1);
    if (!made) { trailEl.setAttribute('x1', px(shot.c[0])); trailEl.setAttribute('y1', px(shot.c[1])); trailEl.setAttribute('x2', px(shot.g[0])); trailEl.setAttribute('y2', px(shot.g[1])); trailEl.setAttribute('opacity', 0.9); }
    ui.msg.innerHTML = (made ? '✅ ' : '❌ ') + text + ' <span class="muted">(Cut angle on this shot: ' + Math.round(shot.cut) + '°.)</span>';
    if (daily() && S.n >= roundLen()) {
      var prior = store.get('bat-daily-' + today), first = !prior;
      if (first) store.set('bat-daily-' + today, S.made + '|' + S.marks);
      var shown = first ? S.made + '|' + S.marks : prior;
      var share = 'Billiard Action Time Daily Aim #' + dayNo + ' 🎯 ' + shown.split('|')[0] + '/5\n' + shown.split('|')[1] + '\n' + location.origin + '/play/aim-trainer';
      ui.msg.innerHTML += '<div class="aim-final"><b>Daily challenge #' + dayNo + ': ' + S.made + ' of 5.</b> ' + S.marks + (first ? '' : ' <span class="muted">(Your first try today counts: ' + prior.split('|')[0] + '/5.)</span>') +
        '<p style="margin:8px 0 0">New shots tomorrow. <button type="button" data-share-daily style="padding:8px 14px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;font-size:15px">Copy result to share</button> <a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.origin + '/play/aim-trainer') + '">Share on Facebook</a></p></div>';
      var sb = ui.msg.querySelector('[data-share-daily]');
      sb.addEventListener('click', function () { if (navigator.clipboard) navigator.clipboard.writeText(share).then(function () { sb.textContent = 'Copied!'; }, function () { sb.textContent = 'Copy failed'; }); });
      ui.next.textContent = 'Play a regular round'; ui.next.onclick = function () { ui.level.value = 'normal'; level = 'normal'; newRound(); };
    } else if (S.n >= 10) {
      var best = Number(store.get(bestKey()) || 0), isBest = S.score > best;
      if (isBest) store.set(bestKey(), String(S.score));
      ui.msg.innerHTML += '<div class="aim-final"><b>Round over: ' + S.made + ' of 10 made, ' + S.score + ' points.</b> ' + (isBest ? '🏆 New personal best!' : 'Best: ' + best + '.') +
        ' ' + (S.made >= 9 ? (level === 'pro' ? 'Pro-level eye. Share your score!' : 'Sharp eye. Try a harder level.') : S.made >= 6 ? 'Solid shooting.' : 'Keep at it: aim at the ghost ball, not the object ball.') + '</div>';
      ui.next.textContent = 'Play another round'; ui.next.onclick = function () { newRound(); };
    } else { ui.next.textContent = 'Next shot →'; ui.next.onclick = function () { newShot(); }; }
    ui.next.hidden = false; aimLine.setAttribute('opacity', 0.85); status();
  }
  // ---- input ----
  var toTable = function (ev) { var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; var m = svg.getScreenCTM(); if (!m) return null; var q = pt.matrixTransform(m.inverse()); return [(q.x - R) / U, (q.y - R) / U]; };
  var setAim = function (ev) { if (busy) return; var p = toTable(ev); if (!p || len(sub(p, shot.c)) < 0.05) return; aim = norm(sub(p, shot.c)); drawAim(); };
  svg.addEventListener('pointerdown', setAim);
  svg.addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse' || ev.buttons) setAim(ev); });
  root.querySelectorAll('[data-nudge]').forEach(function (b) {
    b.addEventListener('click', function () { if (busy) return; aim = rot(aim, Number(b.getAttribute('data-nudge')) * Math.PI / 180); drawAim(); });
  });
  ui.shoot.addEventListener('click', shoot);
  ui.level.addEventListener('change', function () { level = ui.level.value; newRound(); });
  document.addEventListener('keydown', function (e) {
    if (!root.contains(document.activeElement) && document.activeElement !== document.body) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { if (busy) return; e.preventDefault(); aim = rot(aim, (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 0.2) * Math.PI / 180); drawAim(); }
    else if (e.key === ' ' || e.key === 'Enter') { if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return; e.preventDefault(); if (!ui.next.hidden) ui.next.click(); else shoot(); }
  });
  if (!store.get('bat-daily-' + today)) { ui.level.value = 'daily'; level = 'daily'; }   // open on today's challenge until it's played
  root.querySelector('[data-loading]').remove();
  newRound();
})();

/* Bank trainer (/play/bank-trainer): send the object ball off one long rail into the highlighted pocket.
   The ball is shot directly (no cue ball) so the game is only about reading the bank angle. */
(function () {
  var root = document.getElementById('bankGame');
  if (!root) return;
  var U = 50, R = 22, BALL = 0.23, NS = 'http://www.w3.org/2000/svg', LO = BALL / 2;
  var POCKETS = [[0, 0, 'c'], [4, -0.06, 's'], [8, 0, 'c'], [0, 4, 'c'], [4, 4.06, 's'], [8, 4, 'c']];
  var LEVELS = { easy: { tol: 0.2, side: 0.16, show: true }, normal: { tol: 0.15, side: 0.12, show: false } };
  var px = function (v) { return R + v * U; };
  var el = function (tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1]]; }, add = function (a, b) { return [a[0] + b[0], a[1] + b[1]]; }, mul = function (a, k) { return [a[0] * k, a[1] * k]; };
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1]; }, len = function (a) { return Math.hypot(a[0], a[1]); }, norm = function (a) { var l = len(a); return [a[0] / l, a[1] / l]; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  var W = 8 * U + 2 * R, H = 4 * U + 2 * R;
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Pool table', style: 'width:100%;height:auto;display:block;touch-action:manipulation;cursor:crosshair;user-select:none' });
  root.querySelector('[data-table]').appendChild(svg);
  el('rect', { x: 0, y: 0, width: W, height: H, rx: 14, fill: '#5a3518' }, svg); el('rect', { x: R, y: R, width: 8 * U, height: 4 * U, fill: '#1f7a4a' }, svg);
  for (var i = 1; i < 8; i++) if (i !== 4) { el('circle', { cx: px(i), cy: R / 2, r: 2.2, fill: '#f4e7c4' }, svg); el('circle', { cx: px(i), cy: H - R / 2, r: 2.2, fill: '#f4e7c4' }, svg); }
  for (var j = 1; j < 4; j++) { el('circle', { cx: R / 2, cy: px(j), r: 2.2, fill: '#f4e7c4' }, svg); el('circle', { cx: W - R / 2, cy: px(j), r: 2.2, fill: '#f4e7c4' }, svg); }
  var pocketEls = POCKETS.map(function (p) { return el('circle', { cx: px(p[0]), cy: px(Math.min(4, Math.max(0, p[1]))), r: 12, fill: '#111', 'stroke-width': 3 }, svg); });
  var railMark = el('rect', { height: 6, rx: 3, fill: '#ffd54a', opacity: 0 }, svg);
  var pathEl = el('polyline', { fill: 'none', stroke: '#fff', 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0.85 }, svg);
  var idealEl = el('polyline', { fill: 'none', stroke: '#ffd54a', 'stroke-width': 1.6, 'stroke-dasharray': '5 4', opacity: 0 }, svg);
  var halo = el('circle', { r: 13, fill: '#ffd54a', opacity: 0.22 }, svg);
  var ball = el('circle', { r: BALL / 2 * U, fill: '#e2462f', stroke: '#222', 'stroke-width': 0.8 }, svg);
  var place = function (p) { ball.setAttribute('cx', px(p[0])); ball.setAttribute('cy', px(p[1])); halo.setAttribute('cx', px(p[0])); halo.setAttribute('cy', px(p[1])); };
  var ui = { status: root.querySelector('[data-status]'), msg: root.querySelector('[data-msg]'), shoot: root.querySelector('[data-shoot]'), next: root.querySelector('[data-next]'), level: root.querySelector('[data-level]') };
  var level = ui.level.value, S, shot, dir, busy = false;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var rot = function (v, a) { return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]; };
  // Trace the ball from p along d through up to `rails` cushion hits. Returns points, the pocket it drops in
  // (index or -1) and how many rails it touched before that.
  function trace(p, d, rails) {
    var pts = [p], hits = 0, L = LEVELS[level];
    for (var seg = 0; seg <= rails; seg++) {
      var ts = [], hiX = 8 - LO, hiY = 4 - LO;
      if (d[0] > 0) ts.push([(hiX - p[0]) / d[0], 0]); if (d[0] < 0) ts.push([(LO - p[0]) / d[0], 0]);
      if (d[1] > 0) ts.push([(hiY - p[1]) / d[1], 1]); if (d[1] < 0) ts.push([(LO - p[1]) / d[1], 1]);
      ts.sort(function (a, b) { return a[0] - b[0]; }); var t = Math.max(0, ts[0][0]), axis = ts[0][1];
      var best = null;
      POCKETS.forEach(function (pk, k) {                    // closest approach to each pocket along this segment
        var v = sub([pk[0], pk[1]], p), s = Math.max(0, Math.min(t + 0.4, dot(v, d))), off = len(sub(v, mul(d, s)));   // pockets open past the cushion line
        if (off < (pk[2] === 's' ? L.side : L.tol) && (!best || s < best.s)) best = { k: k, s: s };
      });
      if (best) { pts.push(add(p, mul(d, best.s))); return { pts: pts, pocket: best.k, rails: hits }; }
      p = add(p, mul(d, t)); pts.push(p);
      if (seg === rails) break;
      d = axis === 0 ? [-d[0], d[1]] : [d[0], -d[1]]; hits++;
    }
    return { pts: pts, pocket: -1, rails: hits };
  }
  function newRound() { S = { n: 0, made: 0, streak: 0, score: 0 }; newShot(); }
  function newShot() {
    for (var tries = 0; tries < 800; tries++) {
      var top = Math.random() < 0.5, o = [rand(1, 7), top ? rand(1.4, 3.3) : rand(0.7, 2.6)];
      var row = top ? [3, 4, 5] : [0, 1, 2], k = row[Math.floor(Math.random() * 3)], pk = POCKETS[k];
      var railY = top ? LO : 4 - LO, mirror = [pk[0], 2 * railY - pk[1]];
      var d = norm(sub(mirror, o)), t = (railY - o[1]) / d[1], hitX = o[0] + d[0] * t;
      if (hitX < 0.6 || hitX > 7.4 || Math.abs(hitX - 4) < 0.35) continue;
      var tr = trace(o, d, 1); if (tr.pocket !== k || tr.rails !== 1) continue;
      shot = { o: o, k: k, ideal: d, railY: railY, hitX: hitX, top: top }; break;
    }
    dir = rot(shot.ideal, (Math.random() < 0.5 ? -1 : 1) * rand(5, 12) * Math.PI / 180);
    place(shot.o); ball.setAttribute('opacity', 1); halo.setAttribute('opacity', 0.22);
    pocketEls.forEach(function (p, idx) { p.setAttribute('stroke', idx === shot.k ? '#ffd54a' : 'none'); });
    idealEl.setAttribute('opacity', 0); railMark.setAttribute('opacity', 0);
    ui.next.hidden = true; ui.shoot.hidden = false; busy = false;
    ui.msg.innerHTML = 'Bank the red ball off the <b>' + (shot.top ? 'top' : 'bottom') + ' rail</b> into the <b>highlighted pocket</b>. Tap the rail where it should hit, fine-tune, and shoot.';
    draw(); status();
  }
  function draw() {
    var tr = trace(shot.o, dir, LEVELS[level].show ? 1 : 0);
    pathEl.setAttribute('points', tr.pts.map(function (p) { return px(p[0]) + ',' + px(p[1]); }).join(' '));
  }
  function status() { var best = Number(store.get('bat-bank-best-' + level) || 0); ui.status.textContent = 'Bank ' + Math.min(S.n + 1, 10) + ' of 10 · Score ' + S.score + ' · Streak ' + S.streak + ' · Best ' + best; }
  function shoot() {
    if (busy) return; busy = true; ui.shoot.hidden = true; pathEl.setAttribute('opacity', 0);
    var tr = trace(shot.o, dir, 2), pts = tr.pts, total = 0, segs = [];
    for (var a = 1; a < pts.length; a++) { var l = len(sub(pts[a], pts[a - 1])); segs.push(l); total += l; }
    var t0 = null, ms = 450 + total * 140;
    var stepFn = function (ts) {
      if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / ms), dist = total * (1 - Math.pow(1 - k, 2)), acc = 0;
      for (var s = 0; s < segs.length; s++) { if (acc + segs[s] >= dist || s === segs.length - 1) { var f = segs[s] ? Math.min(1, (dist - acc) / segs[s]) : 1; place(add(pts[s], mul(sub(pts[s + 1], pts[s]), f))); break; } acc += segs[s]; }
      if (k < 1) requestAnimationFrame(stepFn); else done(tr);
    };
    requestAnimationFrame(stepFn);
  }
  function done(tr) {
    var made = tr.pocket === shot.k && tr.rails >= 1;
    if (tr.pocket >= 0) { ball.setAttribute('opacity', 0); halo.setAttribute('opacity', 0); }
    var t = (shot.railY - shot.o[1]) / dir[1], hitX = shot.o[0] + dir[0] * t, off = hitX - shot.hitX;
    var where = Math.abs(off) < 0.05 ? 'right on the spot' : Math.abs(off).toFixed(2) + ' diamonds too far ' + (off > 0 ? 'right' : 'left');
    S.n++; if (made) { S.streak++; S.made++; S.score += 10 + (S.streak - 1) * 2; } else S.streak = 0;
    var why = made ? '' : tr.pocket === shot.k ? 'It went in, but without a bank. Banks only!' : tr.pocket >= 0 ? 'It dropped in the wrong pocket.' : 'Missed.';
    idealEl.setAttribute('points', [shot.o, [shot.hitX, shot.railY], [POCKETS[shot.k][0], POCKETS[shot.k][1]]].map(function (p) { return px(p[0]) + ',' + px(Math.min(4, Math.max(0, p[1]))); }).join(' '));
    idealEl.setAttribute('opacity', made ? 0 : 0.95);
    railMark.setAttribute('x', px(shot.hitX) - 8); railMark.setAttribute('width', 16); railMark.setAttribute('y', shot.top ? R - 8 : px(4) + 2); railMark.setAttribute('opacity', made ? 0 : 1);
    ui.msg.innerHTML = (made ? '✅ Banked it! ' : '❌ ' + why + ' ') + 'You hit the rail ' + where + '.' + (made ? '' : ' <span class="muted">The yellow line shows the bank that works.</span>');
    if (S.n >= 10) {
      var key = 'bat-bank-best-' + level, best = Number(store.get(key) || 0), isBest = S.score > best; if (isBest) store.set(key, String(S.score));
      ui.msg.innerHTML += '<div class="aim-final"><b>Round over: ' + S.made + ' of 10 banked, ' + S.score + ' points.</b> ' + (isBest ? '🏆 New personal best!' : 'Best: ' + best + '.') + '</div>';
      ui.next.textContent = 'Play another round'; ui.next.onclick = newRound;
    } else { ui.next.textContent = 'Next bank →'; ui.next.onclick = newShot; }
    ui.next.hidden = false; pathEl.setAttribute('opacity', 0.85); status();
  }
  var toTable = function (ev) { var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; var m = svg.getScreenCTM(); if (!m) return null; var q = pt.matrixTransform(m.inverse()); return [(q.x - R) / U, (q.y - R) / U]; };
  var setDir = function (ev) { if (busy) return; var p = toTable(ev); if (!p || len(sub(p, shot.o)) < 0.05) return; dir = norm(sub(p, shot.o)); draw(); };
  svg.addEventListener('pointerdown', setDir);
  svg.addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse' || ev.buttons) setDir(ev); });
  root.querySelectorAll('[data-nudge]').forEach(function (b) { b.addEventListener('click', function () { if (busy) return; dir = rot(dir, Number(b.getAttribute('data-nudge')) * Math.PI / 180); draw(); }); });
  ui.shoot.addEventListener('click', shoot);
  ui.level.addEventListener('change', function () { level = ui.level.value; newRound(); });
  root.querySelector('[data-loading]').remove();
  newRound();
})();

/* Lag challenge (/play/lag-challenge): stop the power meter, roll the ball to the foot rail and back, and
   finish as close to the head rail as you can. Constant rolling friction: distance grows with speed squared. */
(function () {
  var root = document.getElementById('lagGame');
  if (!root) return;
  var U = 50, R = 22, BALL = 0.23, NS = 'http://www.w3.org/2000/svg', LO = BALL / 2, HI = 8 - BALL / 2, START = 1.6, IN_PER_DIAMOND = 12.5, DMAX = 26;
  var px = function (v) { return R + v * U; };
  var el = function (tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  var W = 8 * U + 2 * R, H = 4 * U + 2 * R;
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Pool table', style: 'width:100%;height:auto;display:block;user-select:none' });
  root.querySelector('[data-table]').appendChild(svg);
  el('rect', { x: 0, y: 0, width: W, height: H, rx: 14, fill: '#5a3518' }, svg); el('rect', { x: R, y: R, width: 8 * U, height: 4 * U, fill: '#1f7a4a' }, svg);
  for (var i = 1; i < 8; i++) if (i !== 4) { el('circle', { cx: px(i), cy: R / 2, r: 2.2, fill: '#f4e7c4' }, svg); el('circle', { cx: px(i), cy: H - R / 2, r: 2.2, fill: '#f4e7c4' }, svg); }
  for (var j = 1; j < 4; j++) { el('circle', { cx: R / 2, cy: px(j), r: 2.2, fill: '#f4e7c4' }, svg); el('circle', { cx: W - R / 2, cy: px(j), r: 2.2, fill: '#f4e7c4' }, svg); }
  [[0, 0], [4, 0], [8, 0], [0, 4], [4, 4], [8, 4]].forEach(function (p) { el('circle', { cx: px(p[0]), cy: px(p[1]), r: 12, fill: '#111' }, svg); });
  el('line', { x1: px(2), y1: R, x2: px(2), y2: H - R, stroke: '#fff', 'stroke-opacity': 0.25 }, svg);
  for (var z = 1; z <= 3; z++) el('line', { x1: px(z * 0.4), y1: px(1.4), x2: px(z * 0.4), y2: px(2.6), stroke: '#fff', 'stroke-opacity': 0.12, 'stroke-dasharray': '2 3' }, svg);
  var marks = el('g', {}, svg);
  var halo = el('circle', { r: 13, fill: '#fff', opacity: 0.22, cy: px(2) }, svg), ball = el('circle', { r: BALL / 2 * U, fill: '#fff', stroke: '#222', 'stroke-width': 0.8, cy: px(2) }, svg);
  var place = function (x) { ball.setAttribute('cx', px(x)); halo.setAttribute('cx', px(x)); };
  var ui = { status: root.querySelector('[data-status]'), msg: root.querySelector('[data-msg]'), go: root.querySelector('[data-go]'), meter: root.querySelector('[data-meter]'), fill: root.querySelector('[data-fill]') };
  var S, phase = 'idle', t0 = 0, power = 0, raf;
  // Where a ball ends up after rolling `d` diamonds from START toward the foot rail, bouncing off both end rails.
  function endAt(d) { var x = START, dir = 1, left = d; for (var k = 0; k < 20 && left > 0; k++) { var room = dir > 0 ? HI - x : x - LO; if (left <= room) { x += dir * left; left = 0; } else { x += dir * room; left -= room; dir = -dir; } } return x; }
  function status() { var best = store.get('bat-lag-best'); ui.status.textContent = 'Lag ' + Math.min(S.n + 1, 5) + ' of 5 · Total ' + S.total.toFixed(1) + '"' + (best ? ' · Best ' + Number(best).toFixed(1) + '"' : ''); }
  function newRound() { S = { n: 0, total: 0, results: [] }; while (marks.firstChild) marks.removeChild(marks.firstChild); reset(); }
  function reset() { place(START); phase = 'idle'; ui.go.textContent = 'Start power meter'; ui.fill.style.width = '0%'; ui.msg.innerHTML = 'Roll the ball to the far rail and back. <b>Closest to the head rail (left) wins.</b> It must touch the foot rail.'; status(); }
  function meterLoop(ts) { if (phase !== 'meter') return; var k = ((ts - t0) / 1400) % 2; power = k < 1 ? k : 2 - k; ui.fill.style.width = (power * 100).toFixed(1) + '%'; raf = requestAnimationFrame(meterLoop); }
  function roll() {
    phase = 'rolling'; ui.go.disabled = true;
    var d = DMAX * power * power, T = 900 + 2600 * power, start = null;
    var anim = function (ts) {
      if (!start) start = ts; var k = Math.min(1, (ts - start) / T), s = d * (1 - Math.pow(1 - k, 2)); place(endAt(s));
      if (k < 1) raf = requestAnimationFrame(anim); else finish(d);
    };
    raf = requestAnimationFrame(anim);
  }
  function finish(d) {
    var x = endAt(d), reached = d >= HI - START, inches = Math.max(0, (x - LO) * IN_PER_DIAMOND), penalty = reached ? 0 : 50;
    var score = inches + penalty; S.n++; S.total += score; S.results.push(score);
    el('circle', { cx: px(x), cy: px(2) + (S.n - 3) * 9, r: 3, fill: reached ? '#ffd54a' : '#e2462f' }, marks);
    var verdict = !reached ? 'Short! It never reached the foot rail. That adds a 50" penalty.' : inches < 2 ? 'Perfect lag, frozen to the rail!' : inches < 6 ? 'Great lag.' : inches < 15 ? 'Not bad.' : inches < 40 ? 'Too far out.' : 'Way off. Find your speed.';
    ui.msg.innerHTML = (reached && inches < 6 ? '✅ ' : '') + verdict + (reached ? ' <b>' + inches.toFixed(1) + '"</b> from the head rail.' : '');
    if (S.n >= 5) {
      var best = Number(store.get('bat-lag-best') || 0), isBest = !best || S.total < best; if (isBest) store.set('bat-lag-best', S.total.toFixed(1));
      ui.msg.innerHTML += '<div class="aim-final"><b>Round over: ' + S.total.toFixed(1) + '" total over 5 lags</b> (lower is better). ' + (isBest ? '🏆 New personal best!' : 'Best: ' + best.toFixed(1) + '".') + '</div>';
      phase = 'done'; ui.go.textContent = 'Play again';
    } else { phase = 'shown'; ui.go.textContent = 'Next lag →'; }
    ui.go.disabled = false; status();
  }
  ui.go.addEventListener('click', function () {
    if (phase === 'idle') { phase = 'meter'; t0 = performance.now(); ui.go.textContent = 'Stop! (shoot)'; raf = requestAnimationFrame(meterLoop); }
    else if (phase === 'meter') { cancelAnimationFrame(raf); roll(); }
    else if (phase === 'shown') reset();
    else if (phase === 'done') newRound();
  });
  document.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') { e.preventDefault(); if (!ui.go.disabled) ui.go.click(); } });
  root.querySelector('[data-loading]').remove();
  newRound();
})();

/* Which-game quiz (/play/which-game). */
(function () {
  var root = document.getElementById('whichGame'), out = document.getElementById('whichOut');
  if (!root || !out) return;
  var games = JSON.parse(root.getAttribute('data-games')), picks = {};
  var qs = root.querySelectorAll('.quiz-q');
  qs.forEach(function (q, qi) {
    q.querySelectorAll('[data-pts]').forEach(function (b) {
      b.addEventListener('click', function () {
        picks[qi] = JSON.parse(b.getAttribute('data-pts'));
        q.querySelectorAll('[data-pts]').forEach(function (x) { var on = x === b; x.style.background = on ? '#d8f3e0' : ''; x.style.borderColor = on ? '#148a38' : ''; x.style.color = on ? '#0f1b2d' : ''; });
        if (Object.keys(picks).length < qs.length) { out.innerHTML = '<p class="muted" style="margin:0">' + (qs.length - Object.keys(picks).length) + ' to go.</p>'; return; }
        var tally = {}; Object.keys(picks).forEach(function (k) { var p = picks[k]; for (var g in p) tally[g] = (tally[g] || 0) + p[g]; });
        var ranked = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }), top = ranked[0], g = games[top], second = ranked[1];
        var url = location.origin + location.pathname;
        out.innerHTML = '<p style="margin:0 0 4px" class="muted">Your game is</p><p style="font-size:1.6em;margin:0 0 6px"><b>' + top + '</b></p><p style="margin:0 0 10px">' + g.blurb + '</p>' +
          (second ? '<p class="muted" style="margin:0 0 10px">Runner-up: <a href="' + games[second].guide + '">' + second + '</a></p>' : '') +
          '<p style="margin:0;display:flex;flex-wrap:wrap;gap:8px"><a href="' + g.guide + '" style="padding:8px 14px;border-radius:6px;background:#144b2e;color:#fff;text-decoration:none;font-weight:700">Learn the rules</a>' +
          '<a href="' + g.list + '" style="padding:8px 14px;border-radius:6px;background:#1c6fe6;color:#fff;text-decoration:none;font-weight:700">Find ' + top + ' tournaments</a>' +
          '<a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '" style="padding:8px 4px">Share the quiz</a></p>';
      });
    });
  });
})();

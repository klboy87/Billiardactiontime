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

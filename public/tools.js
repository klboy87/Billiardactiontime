/* Calculators on /tools/ pages. Kept in its own file because the site's security policy blocks inline scripts. */
(function () {
  document.querySelectorAll('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var num = function (form, name) { var v = parseFloat(form.elements[name].value); return isFinite(v) && v > 0 ? v : 0; };

  // ---------- pool table room size ----------
  var roomForm = document.getElementById('roomForm');
  if (roomForm) {
    var roomOut = document.getElementById('roomOut');
    var TABLES = [['7-foot (bar size)', 39, 78], ['8-foot', 44, 88], ['Oversized 8-foot', 46, 92], ['9-foot (tournament)', 50, 100]];
    var ftin = function (inches) { var f = Math.floor(inches / 12), i = Math.round(inches - f * 12); if (i === 12) { f++; i = 0; } return f + "' " + i + '"'; };
    var roomCalc = function () {
      var L = num(roomForm, 'len') * 12, W = num(roomForm, 'wid') * 12, cue = parseFloat(roomForm.elements.cue.value);
      if (!L || !W) { roomOut.innerHTML = '<p style="margin:0">Enter your room length and width.</p>'; return; }
      var big = Math.max(L, W), small = Math.min(L, W), best = null;
      var rows = TABLES.map(function (t) {
        var needL = t[2] + 2 * cue, needW = t[1] + 2 * cue, fits = big >= needL && small >= needW;
        var shortL = t[2] + 2 * 48, shortW = t[1] + 2 * 48, withShort = !fits && big >= shortL && small >= shortW;
        if (fits) best = t[0];
        return '<tr><td><b>' + t[0] + '</b></td><td>' + ftin(needL) + ' x ' + ftin(needW) + '</td><td>' + (fits ? '✅ Fits' : withShort ? '⚠️ Tight: OK with a short cue on some shots' : '❌ Too small') + '</td></tr>';
      }).join('');
      roomOut.innerHTML = '<p style="font-size:1.1em;margin-top:0">' + (best ? 'Best fit for your room: <b>' + best + '</b> table with ' + cue + '-inch cues.' : 'None of the standard tables fit with ' + cue + '-inch cues. Try a shorter cue, or look at a smaller or convertible table.') + '</p>' +
        '<div style="overflow-x:auto"><table class="t"><thead><tr><th>Table</th><th>Room needed</th><th>Your room</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="muted" style="margin:10px 0 0">Next: <a href="/gear/home-pool-table">how to buy a home pool table</a> · <a href="/gear/game-room-setup">set up the game room</a></p>';
    };
    roomForm.addEventListener('input', roomCalc); roomForm.addEventListener('change', roomCalc); roomCalc();
  }

  // ---------- payout calculator ----------
  var SPLITS = {
    2: [70, 30], 3: [50, 30, 20], 4: [45, 25, 15, 15], 5: [40, 25, 15, 10, 10], 6: [40, 24, 14, 10, 6, 6],
    7: [33, 21, 14, 10, 8, 7, 7], 8: [32, 20, 13, 10, 7.5, 7.5, 5, 5],
    12: [27, 17, 11, 9, 6, 6, 4, 4, 4, 4, 4, 4], 16: [25, 15, 10, 8, 5, 5, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3]
  };
  var placeLabel = function (i) { var n = i + 1, s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  var payoutForm = document.getElementById('payoutForm');
  if (payoutForm) {
    var out = document.getElementById('payoutOut');
    var calc = function () {
      var players = Math.floor(num(payoutForm, 'players')), entry = num(payoutForm, 'entry'), greens = num(payoutForm, 'greens');
      var added = num(payoutForm, 'added'), cut = Math.min(num(payoutForm, 'cut'), 50), sel = payoutForm.elements.places.value;
      if (players < 2) { out.innerHTML = '<p>Enter at least 2 players.</p>'; return; }
      var pool = Math.max(0, (entry - greens) * players + added);
      var houseCut = pool * cut / 100; pool -= houseCut;
      var places = sel !== 'auto' ? parseInt(sel, 10) : players <= 8 ? 2 : players <= 16 ? 3 : players <= 24 ? 4 : players <= 32 ? 6 : players <= 64 ? 8 : players <= 96 ? 12 : 16;
      if (!SPLITS[places]) places = [2, 3, 4, 5, 6, 7, 8, 12, 16].filter(function (n) { return n <= places; }).pop();
      places = Math.min(places, players);
      while (!SPLITS[places]) places--;
      var pct = SPLITS[places], amounts = pct.map(function (p) { return Math.floor(pool * p / 100); });
      amounts[0] += Math.round(pool) - amounts.reduce(function (a, b) { return a + b; }, 0);
      var rows = amounts.map(function (a, i) { return '<tr><td>' + placeLabel(i) + '</td><td>' + pct[i] + '%</td><td style="text-align:right"><b>' + money(a) + '</b></td></tr>'; }).join('');
      out.innerHTML = '<p style="font-size:1.1em;margin-top:0">Prize pool: <b>' + money(pool) + '</b>' +
        (greens ? ' <span class="muted">· greens fees ' + money(greens * players) + '</span>' : '') +
        (houseCut ? ' <span class="muted">· house cut ' + money(houseCut) + '</span>' : '') + '</p>' +
        '<table class="t"><thead><tr><th>Place</th><th>Share</th><th style="text-align:right">Payout</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p class="muted" style="font-size:13px">Paying ' + places + ' places for ' + players + ' players.</p>';
    };
    payoutForm.addEventListener('input', calc); payoutForm.addEventListener('submit', function (e) { e.preventDefault(); calc(); }); calc();
  }

  // ---------- Fargo race calculator ----------
  // Single-game win chance from the ratings gap (100 points = 2:1), then the chance to win a race.
  var gameP = function (ra, rb) { return 1 / (1 + Math.pow(2, -(ra - rb) / 100)); };
  var matchP = function (p, a, b) {          // P(player with game-win chance p reaches a wins before opponent reaches b)
    var total = 0, c = 1;                      // c = C(a-1+k, k)
    for (var k = 0; k < b; k++) { if (k > 0) c = c * (a - 1 + k) / k; total += c * Math.pow(p, a) * Math.pow(1 - p, k); }
    return total;
  };
  var raceForm = document.getElementById('raceForm');
  if (raceForm) {
    var rout = document.getElementById('raceOut');
    var rcalc = function () {
      var ra = num(raceForm, 'a'), rb = num(raceForm, 'b'), base = parseInt(raceForm.elements.base.value, 10);
      if (!ra || !rb) { rout.innerHTML = '<p>Enter both ratings.</p>'; return; }
      var hiA = ra >= rb, hi = Math.max(ra, rb), lo = Math.min(ra, rb), p = gameP(hi, lo);
      var best = base, bestGap = 2, opts = [];
      for (var r = base; r <= base + 12; r++) {
        var m = matchP(p, r, base); opts.push([r, m]);
        if (Math.abs(m - 0.5) < bestGap) { bestGap = Math.abs(m - 0.5); best = r; }
      }
      var nameHi = hiA ? 'Player A' : 'Player B', nameLo = hiA ? 'Player B' : 'Player A';
      var pct = function (x) { return Math.round(x * 100) + '%'; };
      var rows = opts.filter(function (o) { return o[0] >= best - 2 && o[0] <= best + 2; }).map(function (o) {
        return '<tr' + (o[0] === best ? ' style="font-weight:700"' : '') + '><td>' + o[0] + ' to ' + base + '</td><td>' + pct(o[1]) + '</td><td>' + pct(1 - o[1]) + '</td></tr>';
      }).join('');
      rout.innerHTML = (ra === rb ? '<p style="margin-top:0">Even ratings: play an even race, for example race to ' + base + ' each.</p>' :
        '<p style="font-size:1.1em;margin-top:0">Suggested race: <b>' + nameHi + ' (' + hi + ') to ' + best + '</b>, <b>' + nameLo + ' (' + lo + ') to ' + base + '</b>.</p>') +
        '<p class="muted">Single-game chance: ' + nameHi + ' wins about ' + pct(p) + ' of games.</p>' +
        '<table class="t"><thead><tr><th>Race (' + nameHi + ' to ' + nameLo + ')</th><th>' + nameHi + ' wins match</th><th>' + nameLo + ' wins match</th></tr></thead><tbody>' + rows + '</tbody></table>';
    };
    raceForm.addEventListener('input', rcalc); raceForm.addEventListener('submit', function (e) { e.preventDefault(); rcalc(); }); rcalc();
  }
})();

/* Printable bracket name fill (/tools/brackets/N). Everything stays in the browser. */
(function () {
  var form = document.getElementById('bracketFill');
  if (!form) return;
  var n = Number(form.getAttribute('data-size')), msg = form.querySelector('[data-msg]');
  var slots = document.querySelectorAll('[data-slot]'), titles = document.querySelectorAll('[data-title]');
  var setSlots = function (names) {
    slots.forEach(function (el) {
      var i = Number(el.getAttribute('data-slot')) - 1, v = names ? names[i] : null;
      el.textContent = v || ('Player ' + (i + 1));
      el.setAttribute('fill', v ? (v === 'Bye' ? '#999' : '#111') : '#777');
      el.setAttribute('font-size', v ? '11' : '10');
    });
  };
  var setTitle = function (ev) {
    titles.forEach(function (el) { var base = el.getAttribute('data-title'); el.textContent = ev ? ev + ' · ' + base.replace(/ \(losers drop to the losers side\)/, '') : base; });
  };
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var names = form.elements.names.value.split(/\r?\n/).map(function (s) { return s.trim().slice(0, 24); }).filter(Boolean);
    var ev = form.elements.event.value.trim();
    setTitle(ev);
    if (!names.length) { setSlots(null); msg.textContent = ev ? 'Event name added. No players entered.' : ''; return; }
    if (names.length > n) { msg.innerHTML = names.length + ' players is too many for this bracket. Use the <a href="/tools/brackets/' + (names.length <= 16 ? 16 : names.length <= 32 ? 32 : 64) + '">' + (names.length <= 16 ? 16 : names.length <= 32 ? 32 : 64) + '-player bracket</a>.'; return; }
    if (names.length <= n / 2 && n > 8) { msg.innerHTML = 'Tip: ' + names.length + ' players fit the <a href="/tools/brackets/' + n / 2 + '">' + n / 2 + '-player bracket</a>, which needs fewer byes. Filled this one anyway.'; }
    else msg.textContent = '';
    if (form.elements.shuffle.checked) for (var i = names.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = names[i]; names[i] = names[j]; names[j] = t; }
    // Spread the byes: each bye goes in the bottom slot of a different first-round match, in bit-reversed
    // (standard seeding) order so they land in different quarters of the draw before they double up.
    var matches = n / 2, byes = n - names.length, byeAt = {}, out = [], k = 0;
    if (byes > matches) { msg.innerHTML = n === 8 ? 'A double-elimination bracket needs at least 4 players.' : 'Too few players for this bracket. Use the <a href="/tools/brackets/' + n / 2 + '">' + n / 2 + '-player bracket</a>.'; return; }
    var bits = Math.log2(matches), order = [];
    for (var q = 0; q < matches; q++) { var r = 0; for (var z = 0; z < bits; z++) if (q & (1 << z)) r |= 1 << (bits - 1 - z); order.push(r); }
    for (var b = 0; b < byes; b++) byeAt[order[b]] = true;
    for (var m = 0; m < matches; m++) { out.push(names[k++]); out.push(byeAt[m] ? 'Bye' : names[k++]); }
    setSlots(out);
    if (!msg.textContent) msg.textContent = 'Filled ' + names.length + ' players' + (byes ? ' with ' + byes + ' bye' + (byes > 1 ? 's' : '') : '') + '. Press Print when ready.';
  });
  form.querySelector('[data-clear]').addEventListener('click', function () { form.reset(); setSlots(null); setTitle(''); msg.textContent = ''; });
})();

/* Round robin schedule (/tools/round-robin-generator): circle method, table numbers, standings sheet. */
(function () {
  var form = document.getElementById('rrForm'), out = document.getElementById('rrOut');
  if (!form || !out) return;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var order = null, lastKey = '';
  var build = function () {
    var names = form.elements.names.value.split(/\r?\n/).map(function (s) { return s.trim().slice(0, 40); }).filter(Boolean);
    var tables = Math.max(1, Math.min(40, parseInt(form.elements.tables.value, 10) || 1));
    var ev = form.elements.event.value.trim();
    if (names.length < 3) { out.innerHTML = '<p>Enter at least 3 players or teams.</p>'; return; }
    if (names.length > 40) { out.innerHTML = '<p>Up to 40 players. For bigger fields, use a <a href="/tools/brackets/">bracket</a>.</p>'; return; }
    var key = names.join('\n') + form.elements.shuffle.checked;
    if (key !== lastKey) {                     // keep the same shuffle while only tables or the name change
      lastKey = key; order = names.slice();
      if (form.elements.shuffle.checked) for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
    }
    var list = order.slice(); if (list.length % 2) list.push(null);
    var n = list.length, rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var games = [], bye = null;
      for (var k = 0; k < n / 2; k++) {
        var a = list[k], b = list[n - 1 - k];
        if (a === null || b === null) { bye = a === null ? b : a; continue; }
        games.push(r % 2 && k === 0 ? [b, a] : [a, b]);   // swap the fixed player's side so breaks/home alternate
      }
      rounds.push({ games: games, bye: bye });
      list.splice(1, 0, list.pop());                       // rotate everyone but the first
    }
    var total = rounds.reduce(function (s, x) { return s + x.games.length; }, 0);
    var html = '<h2 style="margin:0 0 4px">' + esc(ev || 'Round Robin Schedule') + '</h2><p class="muted" style="margin:0 0 12px">' + order.length + ' players · ' + rounds.length + ' rounds · ' + total + ' matches · ' + tables + ' table' + (tables > 1 ? 's' : '') + '</p>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">';
    rounds.forEach(function (rd, i) {
      html += '<div class="rr-round" style="border:1px solid var(--line);border-radius:8px;padding:10px 12px"><b>Round ' + (i + 1) + '</b><table class="t" style="margin-top:4px"><tbody>' +
        rd.games.map(function (g, gi) { return '<tr><td style="width:1%;white-space:nowrap;color:var(--muted)">' + (gi < tables ? 'Table ' + (gi + 1) : 'Next free') + '</td><td>' + esc(g[0]) + ' <span class="muted">vs</span> ' + esc(g[1]) + '</td><td style="width:22%;border-bottom:1px solid var(--line)"></td></tr>'; }).join('') +
        '</tbody></table>' + (rd.bye ? '<p class="muted" style="margin:6px 0 0">Bye: ' + esc(rd.bye) + '</p>' : '') + '</div>';
    });
    html += '</div><h2 style="margin:22px 0 8px">Standings</h2><div style="overflow-x:auto"><table class="t"><thead><tr><th>Player</th><th>Wins</th><th>Losses</th><th>Games won</th><th>Place</th></tr></thead><tbody>' +
      order.map(function (p) { return '<tr><td>' + esc(p) + '</td><td></td><td></td><td></td><td></td></tr>'; }).join('') + '</tbody></table></div>';
    out.innerHTML = html;
  };
  form.addEventListener('input', build); form.addEventListener('change', build); form.addEventListener('submit', function (e) { e.preventDefault(); build(); });
  build();
})();

/* Pool rules quiz (/tools/pool-rules-quiz). */
(function () {
  var quiz = document.getElementById('quiz'), out = document.getElementById('quizScore');
  if (!quiz || !out) return;
  // Show a random set of questions from the bank (all of them are in the page for readers without JavaScript).
  var pick = Number(quiz.getAttribute('data-pick')) || 0, all = Array.prototype.slice.call(quiz.querySelectorAll('.quiz-q'));
  if (pick && all.length > pick) {
    for (var s = all.length - 1; s > 0; s--) { var r = Math.floor(Math.random() * (s + 1)), t = all[s]; all[s] = all[r]; all[r] = t; }
    all.slice(pick).forEach(function (q) { q.remove(); });
    quiz.querySelectorAll('.quiz-q').forEach(function (q, n) { var t = q.querySelector('p'); if (t) t.textContent = t.textContent.replace(/^\d+\./, (n + 1) + '.'); });
  }
  var qs = quiz.querySelectorAll('.quiz-q'), answered = 0, right = 0;
  qs.forEach(function (q) {
    var ok = Number(q.getAttribute('data-ok')), done = false;
    q.querySelectorAll('[data-i]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (done) return; done = true; answered++;
        var i = Number(b.getAttribute('data-i'));
        if (i === ok) right++;
        q.querySelectorAll('[data-i]').forEach(function (x) {
          var xi = Number(x.getAttribute('data-i'));
          x.disabled = true; x.style.cursor = 'default';
          if (xi === ok) { x.style.background = '#d8f3e0'; x.style.borderColor = '#148a38'; x.style.color = '#0f1b2d'; x.textContent = '✓ ' + x.textContent; }
          else if (xi === i) { x.style.background = '#fbdada'; x.style.borderColor = '#d63a40'; x.style.color = '#0f1b2d'; x.textContent = '✗ ' + x.textContent; }
        });
        var d = q.querySelector('details'); if (d) d.open = true;
        if (answered === qs.length) show();
        else out.innerHTML = '<p class="muted" style="margin:0">' + right + ' right so far, ' + (qs.length - answered) + ' to go.</p>';
      });
    });
  });
  var show = function () {
    var n = qs.length, verdict = right === n ? 'Perfect. You could run the tournament.' : right >= n - 2 ? 'Rules expert. Nobody is sneaking a foul past you.' : right >= n / 2 ? 'Solid. A quick read of the rules guides will finish the job.' : 'Time to hit the rule books before your next tournament.';
    var url = location.origin + location.pathname, text = 'I got ' + right + '/' + n + ' on the Billiard Action Time pool rules quiz. Can you beat it?';
    out.innerHTML = '<p style="font-size:1.4em;margin:0 0 4px"><b>You scored ' + right + ' out of ' + n + '</b></p><p style="margin:0 0 12px">' + verdict + '</p>' +
      '<p style="margin:0;display:flex;flex-wrap:wrap;gap:8px"><a class="btn" style="padding:8px 14px;border-radius:6px;background:#1877f2;color:#fff;text-decoration:none;font-weight:700" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '">Share on Facebook</a>' +
      '<button type="button" data-copy style="padding:8px 14px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;font-size:15px">Copy my score</button>' +
      '<a href="/guides/" style="padding:8px 4px">Read the rules guides →</a> <a href="' + location.pathname + '" style="padding:8px 4px">🔄 New questions</a></p>';
    var c = out.querySelector('[data-copy]');
    c.addEventListener('click', function () {
      var t = text + ' ' + url;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { c.textContent = 'Copied!'; }, function () { c.textContent = t; });
      else c.textContent = t;
    });
  };
})();

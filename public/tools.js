/* Calculators on /tools/ pages. Kept in its own file because the site's security policy blocks inline scripts. */
(function () {
  document.querySelectorAll('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var num = function (form, name) { var v = parseFloat(form.elements[name].value); return isFinite(v) && v > 0 ? v : 0; };

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

/* "Sort by distance" on list pages (tonight, this weekend): uses the visitor's location and each row's venue
   coordinates to put the closest tournaments first and show the miles. Kept in its own file for the CSP. */
(function () {
  var btn = document.querySelector('[data-near-sort]');
  var rows = document.querySelectorAll('tr[data-lat]');
  if (!btn || !rows.length || !navigator.geolocation) return;
  btn.hidden = false;
  var fb = document.querySelector('[data-near-fallback]'); if (fb) fb.hidden = true;
  var miles = function (a, b, c, d) {
    var R = 3958.8, r = Math.PI / 180, dLat = (c - a) * r, dLng = (d - b) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  btn.addEventListener('click', function () {
    btn.disabled = true; btn.textContent = 'Finding you…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      document.querySelectorAll('table.t tbody').forEach(function (tb) {
        if (!tb.querySelector('tr[data-lat]')) return;              // e.g. the weekly schedule table: leave it alone
        var list = Array.prototype.slice.call(tb.querySelectorAll('tr'));
        list.forEach(function (tr) {
          var la = parseFloat(tr.getAttribute('data-lat')), lo = parseFloat(tr.getAttribute('data-lng'));
          var d = isFinite(la) && isFinite(lo) ? miles(lat, lng, la, lo) : Infinity;
          tr.setAttribute('data-mi', d);
          var cell = tr.querySelector('.seo-date'), tag = cell && cell.querySelector('.mi-tag');
          if (cell && isFinite(d)) { if (!tag) { tag = document.createElement('small'); tag.className = 'mi-tag muted'; cell.appendChild(document.createElement('br')); cell.appendChild(tag); } tag.textContent = (d < 10 ? d.toFixed(1) : Math.round(d)) + ' mi'; }
        });
        list.map(function (tr, i) { return [parseFloat(tr.getAttribute('data-mi')), i, tr]; })
          .sort(function (a, b) { return a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1; })   // stable; rows without coordinates keep their order at the end
          .forEach(function (x) { tb.appendChild(x[2]); });
      });
      btn.textContent = '📍 Sorted by distance'; 
    }, function () { btn.disabled = false; btn.textContent = '📍 Sort by Distance'; alert('Location is off. Allow location access, or browse by state.'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
})();

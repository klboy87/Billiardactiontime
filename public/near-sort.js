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
        var list = Array.prototype.slice.call(tb.querySelectorAll('tr'));
        list.forEach(function (tr) {
          var la = parseFloat(tr.getAttribute('data-lat')), lo = parseFloat(tr.getAttribute('data-lng'));
          var d = isFinite(la) && isFinite(lo) ? miles(lat, lng, la, lo) : Infinity;
          tr.setAttribute('data-mi', d);
          var cell = tr.querySelector('.seo-date'), tag = cell && cell.querySelector('.mi-tag');
          if (cell && isFinite(d)) { if (!tag) { tag = document.createElement('small'); tag.className = 'mi-tag muted'; cell.appendChild(document.createElement('br')); cell.appendChild(tag); } tag.textContent = (d < 10 ? d.toFixed(1) : Math.round(d)) + ' mi'; }
        });
        list.sort(function (a, b) { return parseFloat(a.getAttribute('data-mi')) - parseFloat(b.getAttribute('data-mi')); }).forEach(function (tr) { tb.appendChild(tr); });
      });
      btn.textContent = '📍 Sorted by distance'; 
    }, function () { btn.disabled = false; btn.textContent = '📍 Sort by Distance'; alert('Location is off. Allow location access, or browse by state.'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
})();

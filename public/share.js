/* Share buttons on tournament pages: native share sheet (with the card image when the phone
   supports it), copy link. Kept in its own file because the site's security policy blocks inline scripts. */
(function () {
  var box = document.querySelector('[data-share-url]');
  if (!box) return;
  var url = box.getAttribute('data-share-url'), title = box.getAttribute('data-share-title'), text = box.getAttribute('data-share-text');
  var card = box.getAttribute('data-share-card');
  var nativeBtn = box.querySelector('[data-share="native"]'), copyBtn = box.querySelector('[data-share="copy"]');
  if (nativeBtn && navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', function () {
      var plain = function () { navigator.share({ title: title, text: text, url: url }).catch(function () {}); };
      if (!card || !window.File || !navigator.canShare) return plain();
      fetch(card).then(function (r) { return r.blob(); }).then(function (b) {
        var f = new File([b], 'tournament.png', { type: 'image/png' });
        if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: title, text: text + ' ' + url }).catch(function () {});
        else plain();
      }).catch(plain);
    });
  }
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = 'Link copied'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
    else window.prompt('Copy this link:', url);
  });
})();

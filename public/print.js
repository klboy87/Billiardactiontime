/* Print button on the venue poster page. Own file for the CSP. */
document.querySelectorAll('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });

/* Applies the saved theme and motion preference before first paint to avoid a flash.
   This is a separate file (not inline) so the Content-Security-Policy can stay strict. */
(function () {
  try {
    var root = document.documentElement;
    var theme = localStorage.getItem('firefly.theme');
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    var motion = localStorage.getItem('firefly.motion');
    if (motion === 'reduce') root.setAttribute('data-motion', 'reduce');
  } catch (_error) {
    /* storage may be unavailable; the defaults apply */
  }
})();

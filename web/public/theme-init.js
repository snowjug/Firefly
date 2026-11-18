/* Applies the saved theme and motion preference before first paint to avoid a flash.
   This is a separate file (not inline) so the Content-Security-Policy can stay strict.
   The app saves each preference as JSON (so "dark" is stored with its quotes); this reads it the
   same way, and also accepts a bare value. */
(function () {
  function saved(key) {
    var raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return raw;
    }
  }
  try {
    var root = document.documentElement;
    var theme = saved('firefly.theme');
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    var motion = saved('firefly.motion');
    if (motion === 'reduce') root.setAttribute('data-motion', 'reduce');
  } catch (_error) {
    /* storage may be unavailable; the defaults apply */
  }
})();

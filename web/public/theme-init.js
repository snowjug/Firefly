/* Sets the theme before the first paint, so a person who chose dark (or whose system is dark) never
   sees a flash of the light page. It is a classic script loaded from <head>, because the page's
   content security policy allows scripts from this origin only. Keep it small and dependency free:
   it mirrors web/src/design/theme/theme.ts, and a test runs both against the same inputs. It sets the
   data-theme attributes and the browser chrome colour, and never `color-scheme`: the stylesheet owns
   that, for screens only, because an inline value would also turn the system colours dark in print. */
(function () {
  var root = document.documentElement;
  var preference = 'system';
  try {
    var stored = window.localStorage.getItem('firefly.theme');
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch (_error) {
    /* Storage can be blocked: the system preference decides. */
  }
  var systemDark = false;
  try {
    systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (_error) {
    /* No media queries: light. */
  }
  var dark = preference === 'dark' || (preference === 'system' && systemDark);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-theme-preference', preference);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#161a22' : '#ffffff');
})();

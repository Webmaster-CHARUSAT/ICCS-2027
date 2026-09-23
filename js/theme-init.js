// Applies the stored/preferred theme before first paint, to avoid a flash of the wrong theme
// (FOUC). Loaded synchronously in <head>, before the stylesheet, so data-theme is already set
// on <html> by the time CSS starts applying. Must be an external file (not an inline <script>)
// to satisfy the backend's script-src 'self' Content-Security-Policy.
(function () {
  try {
    var stored = localStorage.getItem('iccs-theme');
    var theme = (stored === 'dark' || stored === 'light')
      ? stored
      : ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();

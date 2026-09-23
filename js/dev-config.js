// Local-development convenience only: when this page is served from a local static dev server
// (python -m http.server, VS Code Live Server, etc.) on a different port than the backend,
// point API calls at the backend directly. In any real deployment this file either isn't
// included or never matches, and js/api.js falls back to its same-origin default ('/api').
(function () {
  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  // The backend's port lives in a <meta> tag rather than hardcoded here, so changing PORT in
  // backend/.env only means updating one place (index.html) instead of also editing this file.
  var meta = document.querySelector('meta[name="iccs-api-port"]');
  var apiPort = (meta && meta.content) || '8080';
  if (isLocal && window.location.port && window.location.port !== apiPort) {
    window.ICCS_API_URL = 'http://' + host + ':' + apiPort + '/api';
  }
})();

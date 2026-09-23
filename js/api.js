// Centralized API client for the ICCS-CIRCLE 2027 site.
// Same-origin deployment expects the backend mounted at /api; override with
// window.ICCS_API_URL for local development against a separately-hosted backend.
//
// No `credentials` mode is set: the API is entirely public (no cookies, sessions or auth), so
// there is nothing to send. Requesting credentials:'include' would additionally oblige the
// server to return Access-Control-Allow-Credentials:true on every cross-origin response, and a
// browser rejects the preflight outright when it doesn't — which the page can only report as a
// generic "could not reach the server", indistinguishable from the backend being down.
(function (global) {
  var API_BASE_URL = global.ICCS_API_URL || '/api';

  function apiRequest(endpoint, options) {
    options = options || {};
    var config = {
      method: options.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {})
    };
    if (options.body !== undefined) config.body = JSON.stringify(options.body);

    return fetch(API_BASE_URL + endpoint, config)
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (payload) {
          return { status: res.status, payload: payload };
        });
      })
      .then(function (result) {
        if (!result.payload || result.payload.success !== true) {
          var message = (result.payload && result.payload.error && result.payload.error.message) ||
            'Request failed (' + result.status + ').';
          var err = new Error(message);
          err.status = result.status;
          err.code = result.payload && result.payload.error && result.payload.error.code;
          throw err;
        }
        return result.payload;
      })
      .catch(function (err) {
        if (err instanceof TypeError) {
          // fetch itself failed: network error / backend unreachable.
          var offlineErr = new Error('Could not reach the server. Please check your connection and try again.');
          offlineErr.status = 0;
          throw offlineErr;
        }
        throw err;
      });
  }

  global.ICCS_API = { request: apiRequest, baseUrl: API_BASE_URL };
})(window);

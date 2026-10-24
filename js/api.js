// Client for the website's forms. There is no server of our own: requests go straight to the
// Google Apps Script Web App attached to the conference spreadsheet (google-apps-script/Code.gs),
// whose URL is set in js/config.js.
//
// js/script.js still calls ICCS_API.request('/registrations', …) etc.; each of those paths is
// mapped to the script's matching action below, so the forms didn't need to change.
//
// The body is sent as text/plain on purpose: that makes it a "simple" cross-origin request with
// no CORS preflight, which Apps Script cannot answer. The script parses the JSON itself.
(function (global) {
  var ACTIONS = {
    '/registrations': 'register',
    '/registrations/verify': 'verifyRegistration',
    '/contact': 'contact'
  };

  function apiRequest(endpoint, options) {
    options = options || {};
    var url = global.ICCS_CONFIG && global.ICCS_CONFIG.appsScriptUrl;
    var action = ACTIONS[endpoint];
    if (!url || !action) {
      return Promise.reject(new Error('The online forms are not available right now. Please contact the organizers.'));
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action }, options.body || {})),
      redirect: 'follow'
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (payload) {
          return { status: res.status, payload: payload };
        });
      })
      .then(function (result) {
        var payload = result.payload;
        if (!payload || payload.success !== true) {
          var error = (payload && payload.error) || {};
          var err = new Error(error.message || 'Request failed (' + result.status + ').');
          // Apps Script always answers HTTP 200, so the real status travels inside the payload.
          err.status = error.status || result.status;
          err.code = error.code;
          throw err;
        }
        return payload;
      })
      .catch(function (err) {
        if (err instanceof TypeError) {
          // fetch itself failed: offline, blocked, or the script URL is wrong.
          var offlineErr = new Error('Could not reach the server. Please check your connection and try again.');
          offlineErr.status = 0;
          throw offlineErr;
        }
        throw err;
      });
  }

  global.ICCS_API = { request: apiRequest };
})(window);

const config = require('../config/config');

// Verifies a Google Identity Services ID token (the `credential` the "Sign in with Google"
// button hands the dashboard) and returns the verified identity, or null if it isn't valid for
// this app. Uses Google's tokeninfo endpoint rather than a client library: Google checks the
// signature and expiry, and we check that the token was issued for OUR client ID, by Google,
// for a verified email. Only the Client ID is needed — never the client secret.
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

async function verifyIdToken(credential, options) {
  options = options || {};
  const clientId = options.clientId || config.googleClientId;
  const fetchImpl = options.fetch || fetch;
  const now = options.now || Date.now();
  if (!clientId || typeof credential !== 'string' || !credential) return null;

  let res;
  try {
    res = await fetchImpl(TOKENINFO_URL + encodeURIComponent(credential), { signal: AbortSignal.timeout(10000) });
  } catch (err) {
    // Network failure reaching Google is an outage, not a bad login — let the caller 503.
    const e = new Error('Could not reach Google to verify the sign-in: ' + err.message);
    e.unavailable = true;
    throw e;
  }
  if (!res.ok) return null; // Google rejected the token (malformed, bad signature, expired)

  const claims = await res.json();
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  if (claims.aud !== clientId) return null;
  if (ISSUERS.indexOf(claims.iss) === -1) return null;
  if (!claims.email || !emailVerified) return null;
  if (!(Number(claims.exp) * 1000 > now)) return null;

  return { email: String(claims.email).toLowerCase(), name: claims.name || '' };
}

module.exports = { verifyIdToken };

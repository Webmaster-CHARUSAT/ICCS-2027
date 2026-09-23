const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const config = require('./config/config');
const { baselineLimiter } = require('./middleware/rateLimiter');
const response = require('./utils/response');
const { AppError } = require('./utils/errors');

const abstractRoutes = require('./routes/abstracts');
const registrationRoutes = require('./routes/registrations');
const contactRoutes = require('./routes/contact');

const app = express();

// Render/Railway/most PaaS put exactly one reverse proxy in front of the app. Trusting it lets
// express-rate-limit (and req.ip generally) see the real client IP from X-Forwarded-For instead
// of the proxy's — without this, every visitor is bucketed under one IP for rate limiting.
// Only enabled in production: trusting X-Forwarded-For from an untrusted source (e.g. a local
// dev request that sets its own header) would let a client spoof its own rate-limit bucket.
if (config.isProduction) {
  app.set('trust proxy', config.trustProxy);
}

/*
 * CSP is explicit rather than helmet's defaults, matching exactly what this site loads:
 * same-origin scripts/styles/images, Google Fonts (stylesheet from googleapis, font files from
 * gstatic), and API calls back to this same origin. `useDefaults: false` so nothing is merged
 * in beyond what's listed here. The inline theme-init script was moved to js/theme-init.js
 * specifically so script-src can be 'self' with no 'unsafe-inline' — the JSON-LD block in
 * index.html is unaffected, since a <script type="application/ld+json"> is inert data, not
 * something CSP's script-src governs.
 *
 * connect-src is relaxed to include the backend's own loopback origins outside production only:
 * 'self' would otherwise block a browser fetch() to a differently-ported backend even after
 * CORS allows it (CSP and CORS are enforced independently) — which would break the alternate
 * "separate static dev server on :5500" workflow documented in the README. Production is always
 * same-origin (this server serves the frontend too), so 'self' alone is correct there.
 */
const connectSrc = config.isProduction
  ? ["'self'"]
  : ["'self'", 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://[::1]:8080'];

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'data:'],
  connectSrc: connectSrc,
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"]
};
if (config.isProduction) {
  cspDirectives.upgradeInsecureRequests = [];
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: cspDirectives
  }
}));

// In development the static site may be served from localhost:5500, 127.0.0.1:5500 or another
// local port depending on the dev server used, and browsers treat each of those as a distinct
// origin. A rejected origin is invisible to the page — fetch just throws a generic TypeError,
// which looks identical to the backend being down — so accept any loopback origin outside
// production rather than making that a debugging exercise. Production stays restricted to the
// configured FRONTEND_URL/ADMIN_URL.
const allowedOrigins = [config.frontendUrl, config.adminUrl];
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;

app.use(cors({
  origin: function (origin, callback) {
    // No Origin header: same-origin navigation, curl, or another server — nothing to gate.
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    if (!config.isProduction && LOOPBACK_ORIGIN.test(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', baselineLimiter);

app.get('/api/health', (req, res) => {
  response.ok(res, { status: 'ok', googleSheetsConfigured: config.sheetsConfigured, emailConfigured: config.emailConfigured });
});

app.use('/api/abstracts', abstractRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/contact', contactRoutes);

// 404 for unmatched API routes.
app.use('/api', (req, res) => {
  response.fail(res, 404, 'NOT_FOUND', 'This endpoint does not exist.');
});

/*
 * Serve the public site from this same origin, so the browser never makes a cross-origin
 * request at all: no CORS, no port mismatch, and nothing for privacy-focused browsers to block
 * (Brave's Shields refuse a page's requests to localhost on another port, which surfaces in the
 * page as an indistinguishable "failed to fetch"). js/api.js then falls back to its same-origin
 * '/api' default. Open http://localhost:PORT/ — a separate static server is no longer needed.
 *
 * Only the frontend's own directories are mounted, never the project root: that would publish
 * backend/.env, which holds the Apps Script secret and SMTP password.
 */
const FRONTEND_ROOT = path.join(__dirname, '..');

// Long-cached in production (filenames are cache-busted with a ?v= query string that a new
// deploy bumps — see index.html); no caching at all in dev, so local edits show up immediately
// without a hard refresh.
const staticOptions = config.isProduction ? { maxAge: '7d' } : {};
app.use('/css', express.static(path.join(FRONTEND_ROOT, 'css'), staticOptions));
app.use('/js', express.static(path.join(FRONTEND_ROOT, 'js'), staticOptions));
app.use('/assets', express.static(path.join(FRONTEND_ROOT, 'assets'), staticOptions));
app.use('/robots.txt', express.static(path.join(FRONTEND_ROOT, 'robots.txt')));

function sendIndex(req, res) {
  // The page itself is never long-cached — it's what references the cache-busted asset URLs,
  // so a stale cached copy of it would keep pointing at an old (possibly-removed) ?v=.
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
}
app.get(['/', '/index.html'], sendIndex);

// Fallback: any other non-API GET (a bookmarked/typed path, a stale link, etc.) gets the page
// instead of a bare 404, since this is a single-page site with in-page anchors rather than
// real sub-routes. Trade-off: a genuinely missing static asset (e.g. a mistyped image path)
// also returns index.html with 200 rather than a real 404 — acceptable here since there is no
// asset manifest to validate against, and the alternative (a broken image icon) is equally
// silent to the visitor either way.
app.get(/^(?!\/api).*/, sendIndex);

// Centralized error handler — never leaks stack traces or raw upstream errors to clients (§35).
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  // express.json() rejects malformed/oversized bodies by calling next(err) with these before
  // any route handler runs — without mapping them here they fall through to the generic 500
  // below, which is misleading (the request never reached application logic at all).
  if (err && err.type === 'entity.parse.failed') {
    return response.fail(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
  if (err && err.type === 'entity.too.large') {
    return response.fail(res, 413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  }
  if (err instanceof AppError) {
    return response.fail(res, err.statusCode, err.code, err.message);
  }
  console.error('Unhandled error:', err);
  const message = config.isProduction ? 'An unexpected error occurred.' : err.message;
  return response.fail(res, 500, 'INTERNAL_ERROR', message);
});

// Explicit '0.0.0.0' so the process accepts connections from outside its own container/VM —
// required on most PaaS platforms (Render, Railway, etc.), where the health checker and
// external traffic don't originate from localhost.
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log('ICCS-CIRCLE backend listening on port ' + config.port);
  if (!config.sheetsConfigured) {
    console.warn('Google Sheets is NOT configured — set APPS_SCRIPT_URL and APPS_SCRIPT_SECRET in .env. Requests touching Sheets will fail with 503 until this is done.');
  }
  if (!config.emailConfigured) {
    console.warn('SMTP is NOT configured — set SMTP_HOST/SMTP_USER/SMTP_PASS in .env. Confirmation emails will be skipped until this is done.');
  }
});

// PaaS platforms send SIGTERM to signal a deploy/restart and expect the process to finish
// in-flight requests and exit promptly — without this, in-flight requests can be cut off
// mid-response, and the platform may escalate to SIGKILL after its own grace period.
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed, exiting.');
    process.exit(0);
  });
});

module.exports = app;

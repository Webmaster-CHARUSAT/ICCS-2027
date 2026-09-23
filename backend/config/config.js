require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    return '';
  }
  return value;
}

const config = {
  env: required('NODE_ENV', 'development'),
  port: parseInt(required('PORT', '8080'), 10),
  frontendUrl: required('FRONTEND_URL', 'http://localhost:5500'),
  adminUrl: required('ADMIN_URL', 'http://localhost:5500'),

  // How many hops of X-Forwarded-* to trust in front of this process (Render/Railway/most PaaS
  // put exactly one reverse proxy in front of the app). Only applied when isProduction — see
  // server.js. Needed so express-rate-limit and req.ip see the real client IP instead of the
  // proxy's, which would otherwise bucket every visitor together (or reject the request).
  trustProxy: parseInt(required('TRUST_PROXY', '1'), 10),

  // Google Sheets is accessed through a Google Apps Script Web App bound to the spreadsheet
  // (see google-apps-script/Code.gs) instead of the googleapis/service-account route.
  appsScript: {
    url: required('APPS_SCRIPT_URL'),
    secret: required('APPS_SCRIPT_SECRET'),
    // Apps Script Web Apps can be slow on a cold start; without a timeout a hung request would
    // hold the connection (and the caller) indefinitely instead of failing cleanly.
    timeoutMs: parseInt(required('APPS_SCRIPT_TIMEOUT_MS', '15000'), 10)
  },

  // Outgoing mail (registration/abstract confirmations). Works with any standard SMTP provider
  // (Gmail with an App Password, SendGrid, Mailgun, Amazon SES, etc.).
  smtp: {
    host: required('SMTP_HOST'),
    port: parseInt(required('SMTP_PORT', '587'), 10),
    secure: required('SMTP_SECURE', 'false') === 'true',
    user: required('SMTP_USER'),
    // Gmail App Passwords are shown as "abcd efgh ijkl mnop" and are very commonly copy-pasted
    // with those spaces intact, which silently breaks SMTP auth — strip all whitespace rather
    // than let that be a recurring support issue.
    pass: required('SMTP_PASS').replace(/\s+/g, ''),
    from: required('EMAIL_FROM', 'ICCS-CIRCLE 2027 <no-reply@iccs-circle.org>')
  }
};

config.isProduction = config.env === 'production';
config.sheetsConfigured = Boolean(config.appsScript.url && config.appsScript.secret);
config.emailConfigured = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

// Fail loudly and immediately in production rather than serving traffic with a broken or
// accidentally-still-pointed-at-localhost configuration — the kind of misconfiguration that
// otherwise surfaces later as a confusing 503/CORS error instead of an obvious boot failure.
if (config.isProduction) {
  const problems = [];
  if (!config.appsScript.url) problems.push('APPS_SCRIPT_URL is not set.');
  if (!config.appsScript.secret) problems.push('APPS_SCRIPT_SECRET is not set.');
  if (!config.frontendUrl) problems.push('FRONTEND_URL is not set.');
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(config.frontendUrl)) {
    problems.push('FRONTEND_URL is still a localhost address (' + config.frontendUrl + ') in production.');
  }
  if (problems.length) {
    console.error('FATAL: invalid production configuration:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
}

module.exports = config;

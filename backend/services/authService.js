const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config/config');

// Faculty session tokens for the /admin dashboard. Deliberately tiny rather than pulling in a
// JWT library: base64url(JSON payload) + "." + base64url(HMAC-SHA256 of that payload), signed
// with AUTH_SECRET. Sent as "Authorization: Bearer <token>" and kept in sessionStorage — no
// cookies, so there is no CSRF surface and CORS stays credential-free (see js/api.js).
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const BCRYPT_COST = 12;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hmac(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function sign(user, options) {
  options = options || {};
  const secret = options.secret || config.authSecret;
  const now = options.now || Date.now();
  const payload = base64url(JSON.stringify({
    sub: user.user_id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: now + (options.ttlMs || TOKEN_TTL_MS)
  }));
  return payload + '.' + hmac(payload, secret);
}

// Returns the decoded payload, or null for anything malformed, tampered with, or expired —
// callers turn null into a 401 without needing to know which of those it was.
function verify(token, options) {
  options = options || {};
  const secret = options.secret || config.authSecret;
  const now = options.now || Date.now();
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const expected = Buffer.from(hmac(parts[0], secret));
  const actual = Buffer.from(parts[1]);
  // timingSafeEqual throws on unequal lengths, so check that first (length isn't secret).
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp <= now) return null;
  return payload;
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

function checkPassword(password, hash) {
  return bcrypt.compare(password, hash || '');
}

// A real bcrypt hash (of a random throwaway string) compared against when the email isn't
// found, so "unknown email" takes the same time as "wrong password" and can't be told apart.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

module.exports = { sign, verify, hashPassword, checkPassword, DUMMY_HASH, TOKEN_TTL_MS };

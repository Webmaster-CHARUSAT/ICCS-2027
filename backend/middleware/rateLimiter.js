const rateLimit = require('express-rate-limit');

// General-purpose limiter for public submission endpoints (abstracts/registrations/contact).
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } }
});

// Permissive baseline covering every /api route (§32) — the tighter submissionLimiter above
// still applies on top of this for its specific endpoints.
const baselineLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests from this address. Please try again later.' } }
});

module.exports = { submissionLimiter: submissionLimiter, baselineLimiter: baselineLimiter };

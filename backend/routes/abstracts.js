const express = require('express');
const router = express.Router();
const abstractController = require('../controllers/abstractController');
const { validate, abstractSchema, abstractStatusSchema } = require('../middleware/validation');
const { submissionLimiter } = require('../middleware/rateLimiter');

// Public submission — no auth required, matches the existing open call-for-abstracts flow.
router.post('/', submissionLimiter, validate(abstractSchema), abstractController.create);

// Public — a registrant checks their abstract's review status (and, once Accepted, gets the
// payment instructions). Identity = Registration ID + registered email, same as /verify.
router.post('/status', submissionLimiter, validate(abstractStatusSchema), abstractController.status);

module.exports = router;

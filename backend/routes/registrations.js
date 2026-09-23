const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const { validate, registrationSchema, registrationVerifySchema } = require('../middleware/validation');
const { submissionLimiter } = require('../middleware/rateLimiter');

// Public — this is the prerequisite step before abstract submission (backend/controllers/
// abstractController.js verifies the resulting registration_id server-side).
router.post('/', submissionLimiter, validate(registrationSchema), registrationController.create);

// Public — lets a returning registrant re-unlock the abstract form on a new device/session by
// proving they know both the Registration ID and the email it was registered under.
router.post('/verify', submissionLimiter, validate(registrationVerifySchema), registrationController.verify);

module.exports = router;

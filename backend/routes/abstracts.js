const express = require('express');
const router = express.Router();
const abstractController = require('../controllers/abstractController');
const { validate, abstractSchema } = require('../middleware/validation');
const { submissionLimiter } = require('../middleware/rateLimiter');

// Public submission — no auth required, matches the existing open call-for-abstracts flow.
router.post('/', submissionLimiter, validate(abstractSchema), abstractController.create);

module.exports = router;

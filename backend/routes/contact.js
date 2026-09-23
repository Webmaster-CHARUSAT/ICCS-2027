const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { validate, contactSchema } = require('../middleware/validation');
const { submissionLimiter } = require('../middleware/rateLimiter');

router.post('/', submissionLimiter, validate(contactSchema), contactController.create);

module.exports = router;

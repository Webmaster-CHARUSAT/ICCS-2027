const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const adminAbstractController = require('../controllers/adminAbstractController');
const { validate, loginSchema, decisionSchema } = require('../middleware/validation');
const { loginLimiter } = require('../middleware/rateLimiter');
const { requireAuth, requireRole } = require('../middleware/auth');

// Faculty review dashboard API (the page itself is /admin — see server.js). Everything except
// login requires a valid faculty session token.
router.post('/login', loginLimiter, validate(loginSchema), adminAuthController.login);

router.use(requireAuth, requireRole('admin', 'reviewer'));
router.get('/me', adminAuthController.me);
router.get('/abstracts', adminAbstractController.list);
router.get('/abstracts/:id', adminAbstractController.get);
router.patch('/abstracts/:id/decision', validate(decisionSchema), adminAbstractController.decide);

module.exports = router;

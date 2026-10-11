const userModel = require('../models/user');
const authService = require('../services/authService');
const googleAuth = require('../services/googleAuth');
const config = require('../config/config');
const response = require('../utils/response');
const { UnauthorizedError, ServiceUnavailableError } = require('../utils/errors');

// One message for every failure (unknown email, wrong password, disabled account, wrong role)
// so the login form can't be used to find out which faculty emails exist.
const LOGIN_FAILED = 'Incorrect email or password.';

// Public (rate-limited by loginLimiter): faculty log in to the /admin dashboard.
async function login(req, res, next) {
  try {
    const email = req.validated.email.toLowerCase();
    const user = await userModel.repository.findOne(function (u) {
      return String(u.email || '').toLowerCase() === email;
    });

    // Always run one bcrypt comparison (against a dummy hash when the user doesn't exist) so
    // both failure paths take the same time.
    const passwordOk = await authService.checkPassword(req.validated.password, user ? user.password_hash : authService.DUMMY_HASH);
    const usable = user && passwordOk && user.status === 'active' && userModel.ROLES.indexOf(user.role) !== -1;
    if (!usable) {
      throw new UnauthorizedError(LOGIN_FAILED);
    }

    return response.ok(res, { token: authService.sign(user), user: userModel.toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

// Public (rate-limited by loginLimiter): "Sign in with Google". Google proves who the person
// is; the Users tab decides whether they may use the dashboard — the verified Google email must
// match an active admin/reviewer row (password_hash is not needed for these accounts).
async function googleLogin(req, res, next) {
  try {
    if (!config.googleClientId) {
      throw new ServiceUnavailableError('Google sign-in is not configured on this server.');
    }
    let identity;
    try {
      identity = await googleAuth.verifyIdToken(req.validated.credential);
    } catch (err) {
      if (err.unavailable) throw new ServiceUnavailableError('Could not reach Google to verify your sign-in. Please try again.');
      throw err;
    }
    if (!identity) {
      throw new UnauthorizedError('Google sign-in could not be verified. Please try again.');
    }

    const user = await userModel.repository.findOne(function (u) {
      return String(u.email || '').toLowerCase() === identity.email;
    });
    if (!user || user.status !== 'active' || userModel.ROLES.indexOf(user.role) === -1) {
      throw new UnauthorizedError('The Google account ' + identity.email + ' is not authorised to use the review dashboard.');
    }

    return response.ok(res, { token: authService.sign(user), user: userModel.toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

// Public: what the login page needs to render the Google button (the Client ID is public).
function publicConfig(req, res) {
  return response.ok(res, { googleClientId: config.googleClientId || null });
}

// The token already carries name/email/role, so this needs no sheet round trip — it just
// confirms the stored session is still valid when the dashboard reloads.
function me(req, res) {
  return response.ok(res, { user: { name: req.user.name, email: req.user.email, role: req.user.role } });
}

module.exports = { login, googleLogin, publicConfig, me };

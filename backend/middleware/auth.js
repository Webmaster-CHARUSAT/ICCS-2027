const authService = require('../services/authService');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

// Guards every /api/admin route except login. Reads "Authorization: Bearer <token>" and puts
// the verified token payload ({sub, email, name, role}) on req.user.
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const payload = match ? authService.verify(match[1].trim()) : null;
  if (!payload) {
    return next(new UnauthorizedError('Your session has expired or is invalid. Please log in again.'));
  }
  req.user = payload;
  next();
}

function requireRole() {
  const roles = Array.prototype.slice.call(arguments);
  return function (req, res, next) {
    if (!req.user || roles.indexOf(req.user.role) === -1) return next(new ForbiddenError());
    next();
  };
}

module.exports = { requireAuth, requireRole };

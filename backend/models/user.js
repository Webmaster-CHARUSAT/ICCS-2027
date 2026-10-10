const SheetsRepository = require('../repositories/sheetsRepository');

// Faculty accounts for the /admin review dashboard. Created only via
// `npm run create-faculty` (backend/scripts/createFaculty.js), never through a public endpoint.
// password_hash must never be returned by any API response — see toPublicUser below.
const SHEET_NAME = 'Users';
const HEADERS = ['user_id', 'name', 'email', 'password_hash', 'role', 'status', 'created_at', 'updated_at'];
const ID_FIELD = 'user_id';
const ROLES = ['admin', 'reviewer'];
const STATUSES = ['active', 'disabled'];

function toPublicUser(user) {
  return { name: user.name, email: user.email, role: user.role };
}

const repository = new SheetsRepository(SHEET_NAME, HEADERS, ID_FIELD);

module.exports = { SHEET_NAME, HEADERS, ID_FIELD, ROLES, STATUSES, toPublicUser, repository };

const SheetsRepository = require('../repositories/sheetsRepository');

const SHEET_NAME = 'ContactMessages';
const HEADERS = ['message_id', 'name', 'email', 'subject', 'message', 'status', 'created_at'];
const ID_FIELD = 'message_id';
const STATUSES = ['unread', 'read', 'resolved'];

const repository = new SheetsRepository(SHEET_NAME, HEADERS, ID_FIELD);

module.exports = { SHEET_NAME, HEADERS, ID_FIELD, STATUSES, repository };

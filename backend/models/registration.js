const SheetsRepository = require('../repositories/sheetsRepository');

const SHEET_NAME = 'Registrations';
const HEADERS = [
  'registration_id', 'name', 'email', 'phone', 'institution', 'designation', 'category',
  'country', 'presentation_type', 'payment_status', 'registration_status', 'created_at', 'updated_at'
];
const ID_FIELD = 'registration_id';
const CATEGORIES = ['Faculty / Scientist', 'Research Scholar', 'Student', 'Industry Participant', 'International Participant'];
const STATUSES = ['Submitted', 'Confirmed', 'Cancelled'];
// registration_status values that a registration must be in for its ID to be usable for
// abstract submission — see abstractController.create. Cancelled registrations cannot submit.
const ABSTRACT_ELIGIBLE_STATUSES = ['Submitted', 'Confirmed'];

const repository = new SheetsRepository(SHEET_NAME, HEADERS, ID_FIELD);

module.exports = { SHEET_NAME, HEADERS, ID_FIELD, CATEGORIES, STATUSES, ABSTRACT_ELIGIBLE_STATUSES, repository };

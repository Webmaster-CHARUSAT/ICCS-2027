const SheetsRepository = require('../repositories/sheetsRepository');

const SHEET_NAME = 'Abstracts';
const HEADERS = [
  'abstract_id', 'submission_id', 'registration_id', 'title', 'authors', 'corresponding_author', 'email',
  'affiliation', 'keywords', 'presentation_category', 'abstract_text', 'word_count',
  'submission_status', 'reviewer', 'review_comments', 'created_at', 'updated_at'
];
const ID_FIELD = 'abstract_id';
const CATEGORIES = ['Oral Presentation', 'Poster Presentation', 'Invited Presentation'];
const STATUSES = ['Submitted', 'Under Review', 'Accepted', 'Rejected', 'Revision Required'];

const repository = new SheetsRepository(SHEET_NAME, HEADERS, ID_FIELD);

module.exports = { SHEET_NAME, HEADERS, ID_FIELD, CATEGORIES, STATUSES, repository };

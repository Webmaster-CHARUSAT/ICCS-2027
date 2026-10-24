/**
 * ICCS-CIRCLE 2027 — Google Apps Script Web App: the website's only "backend".
 *
 * The website is static (hosted on Vercel) and its forms post straight to this script, which
 * lives inside the conference spreadsheet. There is no Node.js server. Everything that has to
 * be trusted therefore happens here, never in the browser: input validation, ID generation,
 * duplicate checks, writing rows, confirmation emails, and deciding when an author may see the
 * payment details.
 *
 * PUBLIC ACTIONS (POST, JSON body with an "action" field — see js/api.js):
 *   register            new conference registration          -> { registration_id, ... }
 *   verifyRegistration  registered-email check; the website shows the payment details or sends the author on to
 *                       Microsoft CMT for abstract submission only when this succeeds
 *   contact             contact-form message
 *
 * DORMANT (kept, but the website no longer calls them — abstracts are submitted on
 * Microsoft CMT): submitAbstract, abstractStatus, and the acceptance-email trigger below. They still answer if called directly; delete them if the in-page abstract
 * flow is not coming back.
 * Every response is { success: true, data } or { success: false, error: { code, message, status } }.
 *
 * FACULTY REVIEW happens directly in the Abstracts tab: set submission_status to Accepted /
 * Rejected (and optionally review_comments / reviewer). An installable trigger
 * (onAbstractStatusEdit) emails the author when an abstract becomes Accepted.
 *
 * SETUP / UPDATING
 * 1. Spreadsheet -> Extensions -> Apps Script. Replace Code.gs with this whole file. Save.
 * 2. Run installTriggers once (pick it in the toolbar's function list, click Run, authorize).
 *    Then run testEmail once: it grants the "send email" permission and sends a test email.
 * 3. Deploy -> Manage deployments -> (your existing Web app) -> Edit (pencil) ->
 *    Version: "New version" -> Deploy. Editing the EXISTING deployment keeps the same /exec URL
 *    that js/config.js uses. Execute as: Me. Who has access: Anyone.
 * Every later edit to this file needs step 3 again, or the website keeps running the old code.
 *
 * Emails are sent from the Google account that deploys the script (Gmail daily quota applies:
 * about 100 recipients/day on a personal account, 1,500 on Google Workspace).
 */

/* ============================== Configuration ============================== */

var SHEET = { REG: 'Registrations', ABS: 'Abstracts', MSG: 'ContactMessages' };

// Columns each tab must have (row 1). Checked on every request, so a missing column fails loudly
// instead of silently dropping data. Extra columns are fine; order does not matter.
var REQUIRED_HEADERS = {
  Registrations: ['registration_id', 'name', 'email', 'phone', 'institution', 'category',
    'payment_status', 'registration_status', 'created_at', 'updated_at'],
  Abstracts: ['abstract_id', 'registration_id', 'title', 'authors', 'corresponding_author', 'email',
    'affiliation', 'keywords', 'presentation_category', 'abstract_text', 'word_count',
    'submission_status', 'reviewer', 'review_comments', 'created_at', 'updated_at'],
  ContactMessages: ['message_id', 'name', 'email', 'subject', 'message', 'status', 'created_at']
};

var REG_CATEGORIES = ['Faculty / Scientist', 'Research Scholar', 'Student', 'Industry Participant', 'International Participant'];
var ABSTRACT_CATEGORIES = ['Oral Presentation', 'Poster Presentation', 'Invited Presentation'];
var ABSTRACT_ELIGIBLE_STATUSES = ['Submitted', 'Confirmed']; // registration_status values that may submit
var DECIDED_STATUSES = ['Accepted', 'Rejected', 'Revision Required']; // reviewer comments shown after these

var ORGANIZER_EMAIL = 'iccscircle@gmail.com';
var SITE_URL = 'https://iccs-circle2027.charusat.ac.in/#abstracts';
var MAIL_SENDER_NAME = 'ICCS-CIRCLE 2027';

// Links in the registration confirmation email's "next steps". Keep in step with index.html and
// js/config.js (cmtUrl) — change them together.
var NEXT_STEP_LINKS = {
  cmt: 'https://cmt3.research.microsoft.com/ICCS2027',
  payOnline: 'https://rzp.io/rzp/GT56wXc',
  howToPay: 'https://iccs-circle2027.charusat.ac.in/#how-to-pay',
  receiptForm: 'https://forms.gle/63zxH7gfd6zvusk76'
};

// Shown to an author ONLY once their abstract is Accepted (abstractStatus). Payment itself is
// handled entirely by CHARUSAT — this script never tracks or verifies payments.
var PAYMENT_INFO = {
  disclaimer: 'Payments are processed directly by Charotar University of Science and Technology. ' +
    'This portal cannot confirm payment status — for payment queries, contact the organizers.',
  indian: {
    title: 'Indian Participants',
    description: 'Pay the registration fee online through the conference payment link.',
    payUrl: 'https://rzp.io/rzp/GT56wXc'
  },
  international: {
    title: 'Participants from Outside India',
    bankDetails: [
      ['Bank A/c Name', 'Charotar University of Science & Technology'],
      ['Bank A/c Number', '30875081005'],
      ['Bank A/c Type', 'Current A/c'],
      ['Bank Branch Address', 'Darshan Hostel, Changa-Valetva Road, Changa, Dist. Anand'],
      ['Bank Branch Code', '10961'],
      ['Bank MICR Code', '388002502'],
      ['Bank IFSC Code', 'SBIN0010961'],
      ['Bank SWIFT Code', 'SBININBB718'],
      ['PAN No', 'AABTC1178Q'],
      ['Bank Telephone No.', '(02692) 248540'],
      ['Bank Email ID', 'sbi10961@sbi.co.in']
    ]
  }
};

// Per-email throttle for public writes (the script has no IP addresses to limit on).
var RATE_LIMIT = { max: 5, windowSeconds: 600 };

/* ============================== Entry points ============================== */

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_({ success: false, error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.', status: 400 } });
  }
  if (!body || typeof body !== 'object') {
    return json_({ success: false, error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.', status: 400 } });
  }

  var handlers = {
    register: register_,
    verifyRegistration: verifyRegistration_,
    submitAbstract: submitAbstract_,
    abstractStatus: abstractStatus_,
    contact: contact_
  };
  var handler = handlers[body.action];
  if (!handler) {
    return json_({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown action.', status: 404 } });
  }

  try {
    return json_({ success: true, data: handler(body) });
  } catch (err) {
    if (err && err.appError) return json_({ success: false, error: err.appError });
    console.error('Unhandled error in ' + body.action + ': ' + (err && err.stack ? err.stack : err));
    return json_({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.', status: 500 } });
  }
}

// Health check: open the /exec URL in a browser to confirm the deployment is live.
function doGet() {
  return json_({ success: true, data: { status: 'ok', service: 'ICCS-CIRCLE 2027 forms' } });
}

/* ============================== Actions ============================== */

function register_(b) {
  checkHoneypot_(b);
  var name = text_(b.name, 'name', 3, 120, 'Please enter your full name.');
  var email = email_(b.email);
  var phoneRaw = text_(b.phone, 'phone', 7, 20, 'Please enter a valid phone number.');
  if (!/^[0-9+\-\s()]+$/.test(phoneRaw) || phoneRaw.replace(/\D/g, '').length < 7) {
    throw fail_(400, 'VALIDATION_ERROR', 'phone: Please enter a valid phone number.');
  }
  var category = oneOf_(b.category, REG_CATEGORIES, 'category', 'Please select a valid registration category.');
  var affiliation = text_(b.affiliation, 'affiliation', 2, 200, 'Please enter your affiliation.');
  var phone = normalizePhone_(phoneRaw);
  rateLimit_('register', email);

  var now = new Date().toISOString();
  var record = withLock_(function () {
    var sheet = sheet_(SHEET.REG);
    var all = readAll_(sheet);
    // One registration per person: the same email OR the same phone number counts as a duplicate.
    var duplicate = all.rows.some(function (r) {
      return (r.email && String(r.email).trim().toLowerCase() === email) ||
        (r.phone && normalizePhone_(r.phone) === phone);
    });
    if (duplicate) {
      throw fail_(409, 'ALREADY_REGISTERED', 'You are already registered using this email address or phone number.');
    }
    var rec = {
      registration_id: uniqueId_('REG', all.rows, 'registration_id'),
      name: name,
      email: email,
      phone: phone,
      institution: affiliation,
      designation: '',
      category: category,
      country: '',
      presentation_type: '',
      payment_status: 'Not Required',
      registration_status: 'Submitted',
      created_at: now,
      updated_at: now
    };
    append_(sheet, all.headers, rec);
    return rec;
  });

  var emailSent = sendMail_(record.email, 'ICCS-CIRCLE 2027 — Registration Confirmed (' + record.registration_id + ')',
    'Registration Confirmed', 'Thank you for registering for ICCS-CIRCLE 2027. Your conference registration is complete. ' +
      'To finish taking part, please complete the steps below.',
    [['Registration ID', record.registration_id], ['Name', record.name], ['Email', record.email],
      ['Institution', record.institution], ['Category', record.category], ['Registration Status', record.registration_status]],
    'Please keep this Registration ID for your records — quote it in all correspondence with the organizers.',
    '', '',
    [{ title: 'Submit your abstract on Microsoft CMT (by 5 December 2026)',
        text: 'Sign in to Microsoft CMT, or create a free CMT account if you do not have one, then select "Create new submission" and complete the form.',
        url: NEXT_STEP_LINKS.cmt, label: 'Go to Microsoft CMT' },
      { title: 'Pay the registration fee (Early Bird till 25 November 2026)',
        text: 'Indian participants: pay online through the conference payment link. Participants from outside India: the bank transfer details are under "How to pay" on the conference website — enter your registered email to see them.',
        url: NEXT_STEP_LINKS.payOnline, label: 'Pay Online', url2: NEXT_STEP_LINKS.howToPay, label2: 'Bank transfer details' },
      { title: 'Upload your payment receipt (compulsory)',
        text: 'After paying, upload the payment receipt or a screenshot of the payment through this form. You will need to sign in with a Google account to upload the file.',
        url: NEXT_STEP_LINKS.receiptForm, label: 'Upload Payment Receipt' }]);

  return { registration_id: record.registration_id, registration_status: record.registration_status, email_queued: emailSent };
}

function verifyRegistration_(b) {
  var email = email_(b.email);
  rateLimit_('verify', email);
  var reg = findRegistrationByEmail_(email);
  if (ABSTRACT_ELIGIBLE_STATUSES.indexOf(String(reg.registration_status || 'Submitted')) === -1) {
    throw fail_(403, 'REGISTRATION_INVALID', 'This registration is not currently valid for abstract submission. Please contact the organizers.');
  }
  return { registration_id: String(reg.registration_id), email: String(reg.email).toLowerCase() };
}

function submitAbstract_(b) {
  if (!String(b.registrationId || '').trim()) {
    throw fail_(400, 'REGISTRATION_REQUIRED', 'Please complete conference registration before submitting an abstract.');
  }
  var title = text_(b.title, 'title', 5, 300, 'Title must be at least 5 characters.');
  var authors = text_(b.authors, 'authors', 3, 500, 'Please enter the author name(s).');
  var category = oneOf_(b.category, ABSTRACT_CATEGORIES, 'category', 'Please select a valid presentation category.');
  var abstractText = text_(b.abstractText, 'abstractText', 1, 5000, 'Abstract text is required.');
  var keywords = optionalText_(b.keywords, 'keywords', 300);
  var wc = abstractText.split(/\s+/).filter(String).length;
  if (wc < 50 || wc > 350) {
    throw fail_(400, 'VALIDATION_ERROR', 'Abstract must be between 50 and 350 words (currently ' + wc + ').');
  }

  var reg = findRegistration_(b.registrationId, b.email);
  if (ABSTRACT_ELIGIBLE_STATUSES.indexOf(String(reg.registration_status || 'Submitted')) === -1) {
    throw fail_(403, 'REGISTRATION_INVALID', 'Your conference registration is not currently valid for abstract submission. Please contact the organizers.');
  }
  var regId = String(reg.registration_id);
  var email = String(reg.email).toLowerCase();
  rateLimit_('submitAbstract', email);

  var now = new Date().toISOString();
  var record = withLock_(function () {
    var sheet = sheet_(SHEET.ABS);
    var all = readAll_(sheet);
    // One abstract per registration. Rows written before registration_id existed fall back to email.
    var existing = all.rows.some(function (a) { return belongsTo_(a, regId, email); });
    if (existing) {
      throw fail_(409, 'ABSTRACT_ALREADY_SUBMITTED', 'An abstract has already been submitted for registration ' + regId + '.');
    }
    var id = uniqueId_('ABS', all.rows, 'abstract_id');
    var rec = {
      abstract_id: id,
      submission_id: id,
      registration_id: regId,
      title: title,
      authors: authors,
      corresponding_author: authors,
      email: email,
      affiliation: String(reg.institution || ''),
      keywords: keywords,
      presentation_category: category,
      abstract_text: abstractText,
      word_count: String(wc),
      submission_status: 'Submitted',
      reviewer: '',
      review_comments: '',
      created_at: now,
      updated_at: now
    };
    append_(sheet, all.headers, rec);
    return rec;
  });

  var emailSent = sendMail_(record.email, 'ICCS-CIRCLE 2027 — Abstract Submission Received (' + record.abstract_id + ')',
    'Abstract Submission Received', 'Thank you for submitting your abstract to ICCS-CIRCLE 2027. Here is a copy of the details you submitted.',
    [['Submission ID', record.abstract_id], ['Registration ID', record.registration_id], ['Title', record.title],
      ['Authors', record.authors], ['Presentation Category', record.presentation_category],
      ['Keywords', record.keywords], ['Word Count', record.word_count], ['Status', record.submission_status]],
    'Please keep this Submission ID for your records. The Organizing Committee will contact you regarding the review outcome.',
    record.abstract_text);

  return { abstract_id: record.abstract_id, registration_id: record.registration_id, submission_status: record.submission_status, email_queued: emailSent };
}

function abstractStatus_(b) {
  var reg = findRegistration_(b.registrationId, b.email);
  var regId = String(reg.registration_id);
  var email = String(reg.email).toLowerCase();
  var matches = readAll_(sheet_(SHEET.ABS)).rows.filter(function (a) { return belongsTo_(a, regId, email); });
  matches.sort(function (a, b2) { return String(b2.created_at).localeCompare(String(a.created_at)); });
  var a = matches[0];
  if (!a) return { registration_id: regId, abstract: null, payment: null };

  var status = String(a.submission_status || 'Submitted').trim();
  return {
    registration_id: regId,
    abstract: {
      abstract_id: String(a.abstract_id),
      title: String(a.title),
      presentation_category: String(a.presentation_category || ''),
      submission_status: status,
      review_comments: DECIDED_STATUSES.indexOf(status) !== -1 ? String(a.review_comments || '') : ''
    },
    payment: status === 'Accepted' ? PAYMENT_INFO : null
  };
}

function contact_(b) {
  checkHoneypot_(b);
  var name = text_(b.name, 'name', 2, 120, 'Please enter your name.');
  var email = email_(b.email);
  var subject = text_(b.subject, 'subject', 2, 200, 'Please enter a subject.');
  var message = text_(b.message, 'message', 5, 5000, 'Please enter a message.');
  rateLimit_('contact', email);

  var rec = withLock_(function () {
    var sheet = sheet_(SHEET.MSG);
    var all = readAll_(sheet);
    var r = {
      message_id: uniqueId_('MSG', all.rows, 'message_id'),
      name: name, email: email, subject: subject, message: message,
      status: 'unread', created_at: new Date().toISOString()
    };
    append_(sheet, all.headers, r);
    return r;
  });

  // Let the organizers know straight away; replying to this email answers the sender.
  sendMail_(ORGANIZER_EMAIL, 'ICCS-CIRCLE 2027 — New contact message: ' + subject,
    'New Contact Message', 'A new message was sent through the conference website.',
    [['From', name], ['Email', email], ['Subject', subject], ['Message ID', rec.message_id]],
    'Reply to this email to answer ' + name + ' directly.', message, email);

  return { message_id: rec.message_id };
}

/* ============================== Faculty review trigger ============================== */

/**
 * Installable "on edit" trigger: when a reviewer sets submission_status to "Accepted" in the
 * Abstracts tab, email the author that their abstract was accepted and that the payment details
 * are now visible on the website. Each abstract is emailed at most once (remembered in Script
 * Properties), so re-selecting "Accepted" or editing other cells never re-sends it.
 * Installed by installTriggers() — a simple onEdit() cannot send email.
 */
function onAbstractStatusEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET.ABS) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var statusCol = headers.indexOf('submission_status') + 1;
  if (!statusCol) return;
  var firstCol = e.range.getColumn();
  var lastCol = firstCol + e.range.getNumColumns() - 1;
  if (statusCol < firstCol || statusCol > lastCol) return;

  var props = PropertiesService.getScriptProperties();
  var startRow = Math.max(e.range.getRow(), 2);
  var endRow = e.range.getRow() + e.range.getNumRows() - 1;
  if (endRow < startRow) return;
  var values = sheet.getRange(startRow, 1, endRow - startRow + 1, headers.length).getValues();
  values.forEach(function (row) {
    var a = {};
    headers.forEach(function (h, i) { a[h] = row[i]; });
    if (String(a.submission_status).trim() !== 'Accepted' || !a.abstract_id || !a.email) return;
    var key = 'accepted-mail:' + a.abstract_id;
    if (props.getProperty(key)) return;
    var comments = String(a.review_comments || '').trim();
    var sent = sendMail_(String(a.email), 'ICCS-CIRCLE 2027 — Abstract Accepted (' + a.abstract_id + ')',
      'Abstract Accepted', 'Congratulations! Your abstract submitted to ICCS-CIRCLE 2027 has been accepted.',
      [['Abstract ID', a.abstract_id], ['Registration ID', a.registration_id], ['Title', a.title],
        ['Presentation Category', a.presentation_category]],
      'Next step — registration fee payment: visit ' + SITE_URL + ' and enter your Registration ID and registered email ' +
      'under "Call for Abstracts" to view the payment details. ' + PAYMENT_INFO.disclaimer,
      comments ? 'Reviewer comments:\n' + comments : '');
    if (sent) props.setProperty(key, new Date().toISOString());
  });
}

// Run ONCE from the Apps Script editor (and again only if you delete the trigger).
function installTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onAbstractStatusEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onAbstractStatusEdit').forSpreadsheet(ss).onEdit().create();
  return 'Acceptance-email trigger installed.';
}

// Run from the Apps Script editor when confirmation emails are not arriving: it asks for the
// "send email" permission if it is missing, logs the remaining daily quota, and sends a test
// email to ORGANIZER_EMAIL. An error here is the same error registrations hit.
function testEmail() {
  console.log('Remaining daily email quota: ' + MailApp.getRemainingDailyQuota());
  MailApp.sendEmail({ to: ORGANIZER_EMAIL, subject: 'ICCS-CIRCLE 2027 — test email', name: MAIL_SENDER_NAME,
    body: 'If you can read this, the website script can send confirmation emails.' });
  console.log('Test email sent to ' + ORGANIZER_EMAIL);
}

/* ============================== Helpers ============================== */

function fail_(status, code, message) {
  var e = new Error(message);
  e.appError = { code: code, message: message, status: status };
  return e;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// A hidden "website" field real visitors never see or fill in; bots that fill every field are
// rejected before anything is written.
function checkHoneypot_(b) {
  if (String(b.website || '').trim()) throw fail_(400, 'VALIDATION_ERROR', 'Your submission could not be accepted.');
}

function text_(value, field, min, max, message) {
  var s = String(value === undefined || value === null ? '' : value).trim();
  if (s.length < min) throw fail_(400, 'VALIDATION_ERROR', field + ': ' + message);
  if (s.length > max) throw fail_(400, 'VALIDATION_ERROR', field + ': Must be ' + max + ' characters or fewer.');
  return s;
}

function optionalText_(value, field, max) {
  var s = String(value === undefined || value === null ? '' : value).trim();
  if (s.length > max) throw fail_(400, 'VALIDATION_ERROR', field + ': Must be ' + max + ' characters or fewer.');
  return s;
}

function email_(value) {
  var s = String(value || '').trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw fail_(400, 'VALIDATION_ERROR', 'email: Please enter a valid email address.');
  }
  return s;
}

function oneOf_(value, allowed, field, message) {
  var s = String(value || '').trim();
  if (allowed.indexOf(s) === -1) throw fail_(400, 'VALIDATION_ERROR', field + ': ' + message);
  return s;
}

// "+91 98765 43210", "09876543210" and "9876543210" are the same number for duplicate checks.
function normalizePhone_(phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
  else if (digits.length === 11 && digits.indexOf('0') === 0) digits = digits.slice(1);
  return digits;
}

function rateLimit_(action, email) {
  var cache = CacheService.getScriptCache();
  var key = 'rl:' + action + ':' + email;
  var count = Number(cache.get(key) || 0) + 1;
  if (count > RATE_LIMIT.max) {
    throw fail_(429, 'RATE_LIMITED', 'Too many attempts with this email address. Please wait 10 minutes and try again.');
  }
  cache.put(key, String(count), RATE_LIMIT.windowSeconds);
}

// Serializes writes so two simultaneous submissions can't both pass a duplicate check.
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    throw fail_(503, 'SERVICE_UNAVAILABLE', 'The registration system is busy. Please try again in a moment.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function sheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    console.error('Missing sheet tab: ' + name);
    throw fail_(503, 'SERVICE_UNAVAILABLE', 'The submission system is not set up correctly. Please contact the organizers.');
  }
  return sheet;
}

// Reads a tab into { headers, rows }; rows are objects keyed by header. Blank rows (formatted or
// dropdown-only rows inside the data range) are skipped. Fails loudly if a required column is missing.
function readAll_(sheet) {
  var values = sheet.getDataRange().getValues();
  var headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  var missing = (REQUIRED_HEADERS[sheet.getName()] || []).filter(function (h) { return headers.indexOf(h) === -1; });
  if (missing.length) {
    console.error('Sheet "' + sheet.getName() + '" is missing column(s): ' + missing.join(', '));
    throw fail_(503, 'SERVICE_UNAVAILABLE', 'The submission system is not set up correctly. Please contact the organizers.');
  }
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row.some(function (v) { return String(v).trim() !== ''; })) continue;
    var rec = {};
    headers.forEach(function (h, c) { rec[h] = row[c]; });
    rows.push(rec);
  }
  return { headers: headers, rows: rows };
}

// Writes the record in the tab's own column order. Every value is written as plain text (a
// leading apostrophe, which Sheets hides): this stops formula injection (a submitted
// "=HYPERLINK(...)" stays text), keeps phone numbers and IDs from being reformatted as numbers,
// and keeps timestamps as ISO strings.
function append_(sheet, headers, record) {
  var row = headers.map(function (h) {
    var v = record[h];
    if (v === undefined || v === null || v === '') return '';
    return "'" + String(v);
  });
  sheet.appendRow(row);
}

function uniqueId_(prefix, rows, field) {
  var taken = {};
  rows.forEach(function (r) { taken[String(r[field]).toUpperCase()] = true; });
  for (var attempt = 0; attempt < 5; attempt++) {
    var id = prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
    if (!taken[id]) return id;
  }
  throw fail_(500, 'INTERNAL_ERROR', 'Could not generate a unique ID. Please try again.');
}

// The registration made with this email (one per email — register_ refuses duplicates). Used by
// the website's "View Payment Details" and "Continue to Abstract Submission" checks.
function findRegistrationByEmail_(email) {
  var rows = readAll_(sheet_(SHEET.REG)).rows;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].email).trim().toLowerCase() === email) return rows[i];
  }
  throw fail_(404, 'REGISTRATION_NOT_FOUND', 'No registration was found for this email address. Please register first, or use the email address you registered with.');
}

// Registration ID + the email it was registered under — both must match. (Dormant actions only.)
function findRegistration_(registrationId, email) {
  var id = String(registrationId || '').trim().toUpperCase();
  if (!id) throw fail_(400, 'VALIDATION_ERROR', 'registrationId: Please enter your Registration ID.');
  var e = email_(email);
  var reg = null;
  var rows = readAll_(sheet_(SHEET.REG)).rows;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].registration_id).trim().toUpperCase() === id) { reg = rows[i]; break; }
  }
  if (!reg) {
    throw fail_(404, 'REGISTRATION_NOT_FOUND', 'We could not verify your conference registration. Please register first or contact the conference organizers.');
  }
  if (String(reg.email).trim().toLowerCase() !== e) {
    throw fail_(403, 'REGISTRATION_INVALID', 'The email address does not match this Registration ID.');
  }
  return reg;
}

function belongsTo_(abstractRow, regId, email) {
  if (!abstractRow.abstract_id) return false;
  if (String(abstractRow.registration_id || '').trim()) return String(abstractRow.registration_id).trim() === regId;
  return String(abstractRow.email || '').trim().toLowerCase() === email;
}

function escapeHtml_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Sends a simple branded email (plain text + HTML). Returns true if sent. A mail failure (quota,
// bad address) is logged, never thrown — the submission is already saved by the time this runs.
// steps (optional): numbered "next steps", each { title, text, url, label, url2?, label2? }.
function sendMail_(to, subject, heading, intro, rows, closing, longText, replyTo, steps) {
  steps = steps || [];
  try {
    var stepsText = steps.length ? ['', 'NEXT STEPS'].concat(steps.map(function (s, i) {
      return '\n' + (i + 1) + '. ' + s.title + '\n' + s.text + '\n' + s.label + ': ' + s.url +
        (s.url2 ? '\n' + s.label2 + ': ' + s.url2 : '');
    })) : [];
    var text = [intro, ''].concat(rows.map(function (r) { return r[0] + ': ' + (r[1] || '—'); }))
      .concat(longText ? ['', longText] : []).concat(stepsText)
      .concat(['', closing, '', '— ICCS-CIRCLE 2027 Organizing Committee']).join('\n');
    var button = function (url, label) {
      return '<a href="' + escapeHtml_(url) + '" style="display:inline-block;margin:8px 8px 0 0;padding:9px 16px;background:#10243e;' +
        'color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px">' + escapeHtml_(label) + '</a>';
    };
    var stepsHtml = steps.length ? '<h3 style="color:#10243e;margin:24px 0 8px">Next steps</h3>' +
      '<ol style="padding-left:20px;margin:0">' + steps.map(function (s) {
        return '<li style="margin-bottom:16px"><b>' + escapeHtml_(s.title) + '</b><br>' +
          '<span style="font-size:14px;line-height:1.5">' + escapeHtml_(s.text) + '</span><br>' +
          button(s.url, s.label) + (s.url2 ? button(s.url2, s.label2) : '') + '</li>';
      }).join('') + '</ol>' : '';
    var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#243447;max-width:600px;margin:0 auto">' +
      '<h2 style="color:#10243e;margin-bottom:4px">' + escapeHtml_(heading) + '</h2>' +
      '<p style="color:#607080;margin-top:0">' + escapeHtml_(intro) + '</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">' +
      rows.map(function (r) {
        return '<tr><td style="padding:6px 12px 6px 0;color:#607080;white-space:nowrap;vertical-align:top">' + escapeHtml_(r[0]) +
          '</td><td style="padding:6px 0">' + escapeHtml_(r[1] || '—') + '</td></tr>';
      }).join('') + '</table>' +
      (longText ? '<p style="white-space:pre-wrap;background:#f4f7fa;padding:14px;border-radius:8px;font-size:14px;line-height:1.5">' + escapeHtml_(longText) + '</p>' : '') +
      stepsHtml +
      '<p style="margin-top:20px">' + escapeHtml_(closing) + '</p>' +
      '<p style="color:#607080;font-size:13px">— ICCS-CIRCLE 2027 Organizing Committee</p></div>';
    var options = { to: to, subject: subject, body: text, htmlBody: html, name: MAIL_SENDER_NAME };
    if (replyTo) options.replyTo = replyTo;
    MailApp.sendEmail(options);
    console.log('Email sent to ' + to + ': ' + subject);
    return true;
  } catch (err) {
    // The quota lookup fails for the same reasons sending does (e.g. missing permission), and must
    // never turn a saved registration into an error response.
    var quota = '?';
    try { quota = MailApp.getRemainingDailyQuota(); } catch (ignored) {}
    console.error('Email to ' + to + ' failed: ' + err + ' (remaining daily quota: ' + quota + ')');
    return false;
  }
}

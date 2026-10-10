const abstractModel = require('../models/abstract');
const registrationModel = require('../models/registration');
const idService = require('../services/idService');
const emailService = require('../services/emailService');
const config = require('../config/config');
const paymentInfo = require('../config/paymentInfo');
const response = require('../utils/response');
const {
  RegistrationRequiredError,
  RegistrationNotFoundError,
  RegistrationInvalidError,
  AbstractAlreadySubmittedError
} = require('../utils/errors');

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

// Public, but gated on a valid prior conference registration (§10–17 of the registration →
// abstract workflow): every abstract must reference a registration_id that actually exists in
// the Registrations sheet. This is enforced here, server-side — never trust the frontend to
// have blocked an unregistered submitter, since /api/abstracts can be called directly.
async function create(req, res, next) {
  try {
    const data = req.validated;
    const registrationId = (data.registrationId || '').trim();
    if (!registrationId) {
      throw new RegistrationRequiredError();
    }

    const registration = await registrationModel.repository.get(registrationId);
    if (!registration) {
      throw new RegistrationNotFoundError();
    }
    if (registrationModel.ABSTRACT_ELIGIBLE_STATUSES.indexOf(registration.registration_status) === -1) {
      throw new RegistrationInvalidError('Your conference registration is not currently valid for abstract submission. Please contact the organizers.');
    }

    // The registration record is the authoritative identity for this submission — never trust
    // a client-supplied email on its own. A mismatch is rejected rather than silently
    // overwritten, so the submitter gets a clear reason instead of a surprising outcome.
    const registrationEmail = String(registration.email).toLowerCase();
    const submittedEmail = data.email.toLowerCase();
    if (submittedEmail !== registrationEmail) {
      throw new RegistrationInvalidError('The email address does not match your conference registration.');
    }
    const email = registrationEmail;

    const wc = wordCount(data.abstractText);
    if (wc < 50 || wc > 350) {
      return response.fail(res, 400, 'VALIDATION_ERROR', 'Abstract must be between 50 and 350 words (currently ' + wc + ').');
    }

    const now = new Date().toISOString();
    const id = idService.generateId('ABS');
    const record = {
      abstract_id: id,
      submission_id: id,
      registration_id: registration.registration_id,
      title: data.title.trim(),
      authors: data.authors.trim(),
      corresponding_author: data.correspondingAuthor || data.authors.trim(),
      email: email,
      affiliation: data.affiliation || registration.institution || '',
      keywords: data.keywords || '',
      presentation_category: data.category,
      abstract_text: data.abstractText.trim(),
      word_count: String(wc),
      submission_status: 'Submitted',
      reviewer: '',
      review_comments: '',
      created_at: now,
      updated_at: now
    };

    // One abstract per registration: once a registration_id has a row in the Abstracts sheet,
    // it can't submit another. Checked atomically with the append (inside the Apps Script lock)
    // so a double-clicked submit can't land two rows under one registration.
    const result = await abstractModel.repository.createUnique(record, [
      [{ field: 'registration_id', value: registration.registration_id, normalize: 'exact' }]
    ]);
    if (!result.created) {
      throw new AbstractAlreadySubmittedError('An abstract has already been submitted for registration ' + registration.registration_id + '.');
    }

    // Fire-and-forget: the submission is already saved, so a mail failure (bad SMTP creds,
    // provider outage, etc.) must never turn into a failed/slow response for the submitter.
    emailService.sendAbstractConfirmation(record).catch((err) => {
      console.error('Failed to send abstract confirmation email to ' + record.email + ':', err.message);
    });

    return response.ok(res, {
      abstract_id: record.abstract_id,
      registration_id: record.registration_id,
      submission_status: record.submission_status,
      email_queued: config.emailConfigured
    }, 201);
  } catch (err) {
    next(err);
  }
}

// Statuses after which a faculty decision has been made — only then are the reviewer's
// comments shown to the author.
const DECIDED_STATUSES = ['Accepted', 'Rejected', 'Revision Required'];

// The participant's abstract, if any. Matches on registration_id; rows with no registration_id
// (an Abstracts tab created before that column was added — the sample sheet lacks it) fall back
// to the email, which create() above guarantees equals the registration's email.
async function findAbstractForRegistration(registration) {
  const regEmail = String(registration.email).toLowerCase();
  const matches = (await abstractModel.repository.listAll()).filter(function (a) {
    if (!a.abstract_id) return false; // blank row
    if (a.registration_id) return String(a.registration_id) === String(registration.registration_id);
    return String(a.email || '').toLowerCase() === regEmail;
  });
  matches.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
  return matches[0] || null;
}

// Public: a registrant checks the review status of their abstract, proving identity the same
// way as /api/registrations/verify (Registration ID + registered email). Payment instructions
// are included ONLY once the abstract is Accepted — that is the sole place they are published.
async function status(req, res, next) {
  try {
    const data = req.validated;
    const registration = await registrationModel.repository.get(data.registrationId);
    if (!registration) {
      throw new RegistrationNotFoundError();
    }
    if (String(registration.email).toLowerCase() !== data.email.toLowerCase()) {
      throw new RegistrationInvalidError('The email address does not match this Registration ID.');
    }

    const abstract = await findAbstractForRegistration(registration);
    if (!abstract) {
      return response.ok(res, { registration_id: registration.registration_id, abstract: null, payment: null });
    }

    const decided = DECIDED_STATUSES.indexOf(abstract.submission_status) !== -1;
    return response.ok(res, {
      registration_id: registration.registration_id,
      abstract: {
        abstract_id: abstract.abstract_id,
        title: abstract.title,
        presentation_category: abstract.presentation_category,
        submission_status: abstract.submission_status || 'Submitted',
        review_comments: decided ? (abstract.review_comments || '') : ''
      },
      payment: abstract.submission_status === 'Accepted' ? paymentInfo : null
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { create: create, status: status, findAbstractForRegistration: findAbstractForRegistration };

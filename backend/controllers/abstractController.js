const abstractModel = require('../models/abstract');
const registrationModel = require('../models/registration');
const idService = require('../services/idService');
const emailService = require('../services/emailService');
const config = require('../config/config');
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

module.exports = { create: create };

const registrationModel = require('../models/registration');
const idService = require('../services/idService');
const emailService = require('../services/emailService');
const config = require('../config/config');
const response = require('../utils/response');
const { AlreadyRegisteredError, RegistrationNotFoundError, RegistrationInvalidError } = require('../utils/errors');

// Normalizes phone numbers so "+91 98765 43210", "+919876543210", "09876543210" and
// "9876543210" are all recognized as the same number for duplicate detection. Strips every
// non-digit character, then drops a leading Indian country code (91) or trunk prefix (0) so
// what's left is the bare 10-digit subscriber number wherever that's unambiguous.
function normalizePhone(phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
  else if (digits.length === 11 && digits.indexOf('0') === 0) digits = digits.slice(1);
  return digits;
}

// Public: register for the conference. This is a prerequisite for abstract submission (see
// abstractController.create) — every abstract must reference a registration_id created here.
async function create(req, res, next) {
  try {
    const data = req.validated;
    const email = data.email.toLowerCase();
    const phone = normalizePhone(data.phone);

    const now = new Date().toISOString();
    const record = {
      registration_id: idService.generateId('REG'),
      name: data.name.trim(),
      email: email,
      phone: phone,
      institution: data.institution || data.affiliation || '',
      designation: data.designation || '',
      category: data.category,
      country: data.country || '',
      presentation_type: data.presentation_type || '',
      payment_status: 'Not Required',
      registration_status: 'Submitted',
      created_at: now,
      updated_at: now
    };

    // One registration per person: reject if EITHER the email or the phone number already has
    // a registration on file, even if the other field differs (no "same email, different phone"
    // or "different email, same phone" workaround). The check runs inside the Apps Script's
    // lock together with the append, so two simultaneous submissions can't both slip through.
    const result = await registrationModel.repository.createUnique(record, [
      [{ field: 'email', value: email, normalize: 'email' }],
      [{ field: 'phone', value: phone, normalize: 'phone' }]
    ]);
    if (!result.created) {
      // Deliberately generic — never reveal which field matched or any of the existing
      // registrant's details.
      throw new AlreadyRegisteredError();
    }

    // Fire-and-forget, same pattern as the abstract confirmation email — a mail failure must
    // never fail or delay the registration response, since the row is already saved.
    emailService.sendRegistrationConfirmation(record).catch((err) => {
      console.error('Failed to send registration confirmation email to ' + record.email + ':', err.message);
    });

    return response.ok(res, {
      registration_id: record.registration_id,
      registration_status: record.registration_status,
      email_queued: config.emailConfigured
    }, 201);
  } catch (err) {
    next(err);
  }
}

// Public: lets a returning registrant re-unlock the abstract form (e.g. a new browser session,
// or a different device) without re-registering. Requires the Registration ID they were given
// AND the email it was registered under — knowing only one is not enough. Response is
// deliberately minimal ({registration_id, email} only): this must never become a way to fish
// out another registrant's name, phone, institution, etc. from a guessed ID.
async function verify(req, res, next) {
  try {
    const data = req.validated;
    const registrationId = data.registrationId.trim();
    const email = data.email.toLowerCase();

    const registration = await registrationModel.repository.get(registrationId);
    if (!registration) {
      throw new RegistrationNotFoundError();
    }
    if (String(registration.email).toLowerCase() !== email) {
      // Same message/code as "not found" would leak nothing extra, but a distinct code here
      // matches what abstractController already uses for "ID exists, but this isn't yours" —
      // consistent errors across the two places a registration gets checked.
      throw new RegistrationInvalidError('The email address does not match this Registration ID.');
    }
    if (registrationModel.ABSTRACT_ELIGIBLE_STATUSES.indexOf(registration.registration_status) === -1) {
      throw new RegistrationInvalidError('This registration is not currently valid for abstract submission. Please contact the organizers.');
    }

    return response.ok(res, { registration_id: registration.registration_id, email: registration.email });
  } catch (err) {
    next(err);
  }
}

module.exports = { create: create, verify: verify, normalizePhone: normalizePhone };

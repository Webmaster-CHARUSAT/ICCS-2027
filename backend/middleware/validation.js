const { z } = require('zod');
const { ValidationError } = require('../utils/errors');
const abstractModel = require('../models/abstract');
const registrationModel = require('../models/registration');

function validate(schema) {
  return function (req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      return next(new ValidationError((first.path.join('.') || 'body') + ': ' + first.message));
    }
    req.validated = result.data;
    next();
  };
}

const emailSchema = z.string().trim().email('Please enter a valid email address.');
// Loose on purpose (spaces, +, -, parens all allowed) — normalization happens server-side in
// the controller; this only rejects obviously-not-a-phone-number input.
const phoneSchema = z.string().trim().min(7, 'Please enter a valid phone number.')
  .regex(/^[0-9+\-\s()]+$/, 'Please enter a valid phone number.');

const abstractSchema = z.object({
  // Not required at the schema level on purpose: a missing/blank registrationId should surface
  // as the specific REGISTRATION_REQUIRED error (see abstractController.create), not a generic
  // VALIDATION_ERROR — zod would otherwise just report "required" with no way to distinguish it.
  registrationId: z.string().trim().optional().default(''),
  title: z.string().trim().min(5, 'Title must be at least 5 characters.'),
  authors: z.string().trim().min(3, 'Please enter the author name(s).'),
  correspondingAuthor: z.string().trim().optional().default(''),
  email: emailSchema,
  affiliation: z.string().trim().optional().default(''),
  keywords: z.string().trim().optional().default(''),
  category: z.enum(abstractModel.CATEGORIES, { errorMap: () => ({ message: 'Please select a valid presentation category.' }) }),
  abstractText: z.string().trim().min(1, 'Abstract text is required.')
});

const registrationSchema = z.object({
  name: z.string().trim().min(3, 'Please enter your full name.'),
  email: emailSchema,
  phone: phoneSchema,
  institution: z.string().trim().optional().default(''),
  designation: z.string().trim().optional().default(''),
  category: z.enum(registrationModel.CATEGORIES, { errorMap: () => ({ message: 'Please select a valid registration category.' }) }),
  country: z.string().trim().optional().default(''),
  affiliation: z.string().trim().min(2, 'Please enter your affiliation.'),
  presentation_type: z.string().trim().optional().default('')
});

// For returning registrants re-unlocking the abstract form on a new device/session — see
// registrationController.verify. Deliberately minimal: just enough to look the record up.
const registrationVerifySchema = z.object({
  registrationId: z.string().trim().min(1, 'Please enter your Registration ID.'),
  email: emailSchema
});

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.'),
  email: emailSchema,
  subject: z.string().trim().min(2, 'Please enter a subject.'),
  message: z.string().trim().min(5, 'Please enter a message.')
});

module.exports = {
  validate: validate,
  abstractSchema: abstractSchema,
  registrationSchema: registrationSchema,
  registrationVerifySchema: registrationVerifySchema,
  contactSchema: contactSchema
};

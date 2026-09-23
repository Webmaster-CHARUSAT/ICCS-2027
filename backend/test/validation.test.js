const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  registrationSchema,
  registrationVerifySchema,
  abstractSchema,
  contactSchema
} = require('../middleware/validation');

const validRegistration = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '9876543210',
  category: 'Student',
  affiliation: 'Test University'
};

test('registrationSchema: accepts a valid registration', () => {
  const result = registrationSchema.safeParse(validRegistration);
  assert.equal(result.success, true);
});

test('registrationSchema: rejects an invalid email', () => {
  const result = registrationSchema.safeParse(Object.assign({}, validRegistration, { email: 'not-an-email' }));
  assert.equal(result.success, false);
});

test('registrationSchema: rejects a too-short phone number', () => {
  const result = registrationSchema.safeParse(Object.assign({}, validRegistration, { phone: '123' }));
  assert.equal(result.success, false);
});

test('registrationSchema: rejects an invalid category', () => {
  const result = registrationSchema.safeParse(Object.assign({}, validRegistration, { category: 'Not A Real Category' }));
  assert.equal(result.success, false);
});

test('registrationSchema: institution/designation/country/presentation_type default to empty string when omitted', () => {
  const result = registrationSchema.safeParse(validRegistration);
  assert.equal(result.success, true);
  assert.equal(result.data.institution, '');
  assert.equal(result.data.designation, '');
  assert.equal(result.data.country, '');
  assert.equal(result.data.presentation_type, '');
});

test('registrationVerifySchema: accepts a registrationId + email', () => {
  const result = registrationVerifySchema.safeParse({ registrationId: 'REG-ABC12345', email: 'jane@example.com' });
  assert.equal(result.success, true);
});

test('registrationVerifySchema: rejects an empty registrationId', () => {
  const result = registrationVerifySchema.safeParse({ registrationId: '', email: 'jane@example.com' });
  assert.equal(result.success, false);
});

const validAbstract = {
  title: 'A Sufficiently Long Title',
  authors: 'Jane Doe',
  email: 'jane@example.com',
  category: 'Oral Presentation',
  abstractText: 'Some text.'
};

test('abstractSchema: accepts a valid abstract without a registrationId (checked separately by the controller)', () => {
  const result = abstractSchema.safeParse(validAbstract);
  assert.equal(result.success, true);
  assert.equal(result.data.registrationId, '');
});

test('abstractSchema: rejects a title shorter than 5 characters', () => {
  const result = abstractSchema.safeParse(Object.assign({}, validAbstract, { title: 'Hi' }));
  assert.equal(result.success, false);
});

test('abstractSchema: rejects an invalid presentation category', () => {
  const result = abstractSchema.safeParse(Object.assign({}, validAbstract, { category: 'Keynote' }));
  assert.equal(result.success, false);
});

test('contactSchema: accepts a valid message', () => {
  const result = contactSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Question',
    message: 'Hello there.'
  });
  assert.equal(result.success, true);
});

test('contactSchema: rejects a missing message', () => {
  const result = contactSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Question',
    message: ''
  });
  assert.equal(result.success, false);
});

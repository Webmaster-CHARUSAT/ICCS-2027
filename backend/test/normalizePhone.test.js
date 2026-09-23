const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone } = require('../controllers/registrationController');

test('normalizePhone: bare 10-digit number is unchanged', () => {
  assert.equal(normalizePhone('9876543210'), '9876543210');
});

test('normalizePhone: strips spaces, +, hyphens, parens', () => {
  assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
  assert.equal(normalizePhone('(987) 654-3210'), '9876543210');
});

test('normalizePhone: strips a leading +91/91 country code', () => {
  assert.equal(normalizePhone('+919876543210'), '9876543210');
  assert.equal(normalizePhone('919876543210'), '9876543210');
});

test('normalizePhone: strips a leading trunk 0', () => {
  assert.equal(normalizePhone('09876543210'), '9876543210');
});

test('normalizePhone: two different formats of the same number normalize identically', () => {
  assert.equal(normalizePhone('+91 98765 43210'), normalizePhone('09876543210'));
  assert.equal(normalizePhone('+919876543210'), normalizePhone('9876543210'));
});

test('normalizePhone: empty/null/undefined input returns empty string, not a throw', () => {
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone(null), '');
  assert.equal(normalizePhone(undefined), '');
});

test('normalizePhone: a bare "91" prefix is only stripped when the remainder makes it look like a country code (12 digits total)', () => {
  // A genuine 10-digit number that happens to start with 91 must NOT be mistaken for a
  // country-coded 12-digit number and have two digits chopped off it.
  assert.equal(normalizePhone('9123456789'), '9123456789');
});

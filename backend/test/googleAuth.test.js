const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyIdToken } = require('../services/googleAuth');
const config = require('../config/config');
const userModel = require('../models/user');
const googleAuth = require('../services/googleAuth');
const adminAuthController = require('../controllers/adminAuthController');

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const future = String(Math.floor(Date.now() / 1000) + 3600);

function fakeFetch(status, claims) {
  return async () => ({ ok: status === 200, json: async () => claims });
}
const good = { aud: CLIENT_ID, iss: 'https://accounts.google.com', email: 'Faculty@Example.com', email_verified: 'true', exp: future, name: 'Fac' };

test('verifyIdToken: accepts a token issued for our client, lowercases the email', async () => {
  const id = await verifyIdToken('x'.repeat(30), { clientId: CLIENT_ID, fetch: fakeFetch(200, good) });
  assert.deepEqual(id, { email: 'faculty@example.com', name: 'Fac' });
});

test('verifyIdToken: rejects wrong audience, issuer, unverified email, expiry, or Google refusal', async () => {
  const opts = (claims, status) => ({ clientId: CLIENT_ID, fetch: fakeFetch(status || 200, claims) });
  assert.equal(await verifyIdToken('t'.repeat(30), opts(Object.assign({}, good, { aud: 'someone-else' }))), null);
  assert.equal(await verifyIdToken('t'.repeat(30), opts(Object.assign({}, good, { iss: 'evil.example' }))), null);
  assert.equal(await verifyIdToken('t'.repeat(30), opts(Object.assign({}, good, { email_verified: 'false' }))), null);
  assert.equal(await verifyIdToken('t'.repeat(30), opts(Object.assign({}, good, { exp: '1000' }))), null);
  assert.equal(await verifyIdToken('t'.repeat(30), opts({ error: 'invalid_token' }, 400)), null);
});

test('verifyIdToken: a network failure is reported as an outage, not a bad login', async () => {
  const failing = async () => { throw new Error('ECONNRESET'); };
  await assert.rejects(verifyIdToken('t'.repeat(30), { clientId: CLIENT_ID, fetch: failing }), (e) => e.unavailable === true);
});

function run(handler, req) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; resolve({ res: this, err: null }); return this; } };
    Promise.resolve(handler(req, res, (err) => resolve({ res, err }))).catch((err) => resolve({ res, err }));
  });
}

test('googleLogin: only active Users-sheet accounts get in; no password_hash in the response', async () => {
  const original = { verify: googleAuth.verifyIdToken, clientId: config.googleClientId, findOne: userModel.repository.findOne };
  config.googleClientId = CLIENT_ID;
  const users = [
    { user_id: 'USR-1', email: 'faculty@example.com', name: 'Fac', role: 'reviewer', status: 'active', password_hash: '' },
    { user_id: 'USR-2', email: 'gone@example.com', name: 'Gone', role: 'reviewer', status: 'disabled', password_hash: '' }
  ];
  userModel.repository.findOne = async (m) => users.find(m) || null;
  try {
    googleAuth.verifyIdToken = async () => ({ email: 'faculty@example.com', name: 'Fac' });
    const ok = await run(adminAuthController.googleLogin, { validated: { credential: 'c' } });
    assert.equal(ok.err, null);
    assert.ok(ok.res.body.data.token);
    assert.equal(JSON.stringify(ok.res.body).indexOf('password_hash'), -1);

    googleAuth.verifyIdToken = async () => ({ email: 'stranger@example.com', name: '' });
    assert.equal((await run(adminAuthController.googleLogin, { validated: { credential: 'c' } })).err.statusCode, 401);

    googleAuth.verifyIdToken = async () => ({ email: 'gone@example.com', name: '' });
    assert.equal((await run(adminAuthController.googleLogin, { validated: { credential: 'c' } })).err.statusCode, 401);

    googleAuth.verifyIdToken = async () => null;
    assert.equal((await run(adminAuthController.googleLogin, { validated: { credential: 'c' } })).err.statusCode, 401);

    config.googleClientId = '';
    assert.equal((await run(adminAuthController.googleLogin, { validated: { credential: 'c' } })).err.statusCode, 503);
  } finally {
    googleAuth.verifyIdToken = original.verify;
    config.googleClientId = original.clientId;
    userModel.repository.findOne = original.findOne;
  }
});

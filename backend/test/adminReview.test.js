const { test } = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../services/authService');
const { decisionSchema, loginSchema, abstractStatusSchema } = require('../middleware/validation');
const abstractModel = require('../models/abstract');
const registrationModel = require('../models/registration');
const abstractController = require('../controllers/abstractController');
const adminAbstractController = require('../controllers/adminAbstractController');
const adminAuthController = require('../controllers/adminAuthController');
const userModel = require('../models/user');
const { buildAcceptanceEmail } = require('../services/emailService');

const SECRET = 'x'.repeat(64);
const user = { user_id: 'USR-1', email: 'rev@example.com', name: 'Rev', role: 'reviewer' };

/* ---------- authService ---------- */
test('authService: sign/verify round-trip returns the payload', () => {
  const token = authService.sign(user, { secret: SECRET });
  const payload = authService.verify(token, { secret: SECRET });
  assert.equal(payload.sub, 'USR-1');
  assert.equal(payload.role, 'reviewer');
  assert.equal(payload.password_hash, undefined);
});

test('authService: a tampered payload or signature is rejected', () => {
  const token = authService.sign(user, { secret: SECRET });
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'USR-1', role: 'admin', exp: Date.now() + 1e6 })).toString('base64url');
  assert.equal(authService.verify(forged + '.' + sig, { secret: SECRET }), null);
  assert.equal(authService.verify(payload + '.' + sig.slice(0, -2) + 'AA', { secret: SECRET }), null);
  assert.equal(authService.verify(token, { secret: 'y'.repeat(64) }), null);
  assert.equal(authService.verify('garbage', { secret: SECRET }), null);
});

test('authService: an expired token is rejected', () => {
  const token = authService.sign(user, { secret: SECRET, now: Date.now() - 9 * 60 * 60 * 1000 });
  assert.equal(authService.verify(token, { secret: SECRET }), null);
});

test('authService: password hashing round-trip', async () => {
  const hash = await authService.hashPassword('correct horse battery');
  assert.equal(await authService.checkPassword('correct horse battery', hash), true);
  assert.equal(await authService.checkPassword('wrong', hash), false);
});

/* ---------- schemas ---------- */
test('decisionSchema: accepts Accepted/Rejected, rejects anything else', () => {
  assert.equal(decisionSchema.safeParse({ decision: 'Accepted' }).success, true);
  assert.equal(decisionSchema.safeParse({ decision: 'Rejected', comments: 'Out of scope.' }).success, true);
  assert.equal(decisionSchema.safeParse({ decision: 'Paid' }).success, false);
  assert.equal(decisionSchema.safeParse({ decision: 'Accepted', comments: 'a'.repeat(2001) }).success, false);
});

test('loginSchema / abstractStatusSchema basics; Registration ID is uppercased', () => {
  assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success, false);
  const r = abstractStatusSchema.safeParse({ registrationId: ' reg-abc123 ', email: 'a@b.co' });
  assert.equal(r.success, true);
  assert.equal(r.data.registrationId, 'REG-ABC123');
});

/* ---------- controllers (sheet stubbed) ---------- */
function fakeRes() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; }
  };
}
function run(handler, req) {
  return new Promise((resolve) => {
    const res = fakeRes();
    const origJson = res.json.bind(res);
    res.json = (b) => { origJson(b); resolve({ res, err: null }); return res; };
    Promise.resolve(handler(req, res, (err) => resolve({ res, err }))).catch((err) => resolve({ res, err }));
  });
}

const registration = { registration_id: 'REG-AAAA1111', email: 'author@example.com', name: 'Author', registration_status: 'Submitted' };
function stubSheets(abstracts) {
  registrationModel.repository.get = async (id) => (id === registration.registration_id ? registration : null);
  abstractModel.repository.listAll = async () => abstracts;
}

test('status: no comments before a decision, no payment info unless Accepted', async () => {
  stubSheets([{ abstract_id: 'ABS-1', registration_id: 'REG-AAAA1111', email: 'author@example.com', title: 'T', submission_status: 'Submitted', review_comments: 'internal note' }]);
  const { res, err } = await run(abstractController.status, { validated: { registrationId: 'REG-AAAA1111', email: 'author@example.com' } });
  assert.equal(err, null);
  assert.equal(res.body.data.abstract.review_comments, '');
  assert.equal(res.body.data.payment, null);
  assert.equal('payment_status' in res.body.data, false);
});

test('status: Accepted returns payment info and comments', async () => {
  stubSheets([{ abstract_id: 'ABS-1', registration_id: 'REG-AAAA1111', email: 'author@example.com', title: 'T', submission_status: 'Accepted', review_comments: 'Well done' }]);
  const { res } = await run(abstractController.status, { validated: { registrationId: 'REG-AAAA1111', email: 'author@example.com' } });
  assert.equal(res.body.data.abstract.review_comments, 'Well done');
  assert.equal(res.body.data.payment.indian.payUrl, 'https://rzp.io/rzp/GT56wXc');
});

test('status: falls back to email when the sheet has no registration_id column', async () => {
  stubSheets([{ abstract_id: 'ABS-2', email: 'Author@Example.com', title: 'Old row', submission_status: 'Submitted' }]);
  const { res } = await run(abstractController.status, { validated: { registrationId: 'REG-AAAA1111', email: 'author@example.com' } });
  assert.equal(res.body.data.abstract.abstract_id, 'ABS-2');
});

test('status: wrong email for the Registration ID is refused', async () => {
  stubSheets([]);
  const { err } = await run(abstractController.status, { validated: { registrationId: 'REG-AAAA1111', email: 'other@example.com' } });
  assert.equal(err.code, 'REGISTRATION_INVALID');
});

test('decide: unknown abstract -> 404 NOT_FOUND', async () => {
  abstractModel.repository.get = async () => null;
  const { err } = await run(adminAbstractController.decide, { params: { id: 'ABS-NOPE' }, validated: { decision: 'Accepted', comments: '' }, user });
  assert.equal(err.statusCode, 404);
});

test('decide: writes status/comments/reviewer/updated_at only', async () => {
  let patched = null;
  abstractModel.repository.get = async () => ({ abstract_id: 'ABS-1', email: 'author@example.com', title: 'T' });
  abstractModel.repository.update = async (id, patch) => { patched = patch; return Object.assign({ abstract_id: id }, patch); };
  const { res, err } = await run(adminAbstractController.decide, { params: { id: 'ABS-1' }, validated: { decision: 'Rejected', comments: 'No' }, user });
  assert.equal(err, null);
  assert.deepEqual(Object.keys(patched).sort(), ['review_comments', 'reviewer', 'submission_status', 'updated_at']);
  assert.equal(patched.reviewer, 'rev@example.com');
  assert.equal(res.body.data.submission_status, 'Rejected');
});

test('login: same generic 401 for unknown email and wrong password; never returns password_hash', async () => {
  const hash = await authService.hashPassword('right-password-1');
  userModel.repository.findOne = async (match) => [{ user_id: 'USR-1', email: 'rev@example.com', name: 'Rev', role: 'reviewer', status: 'active', password_hash: hash }].find(match) || null;

  const unknown = await run(adminAuthController.login, { validated: { email: 'nobody@example.com', password: 'x' } });
  const wrong = await run(adminAuthController.login, { validated: { email: 'rev@example.com', password: 'wrong' } });
  assert.equal(unknown.err.statusCode, 401);
  assert.equal(wrong.err.message, unknown.err.message);

  const ok = await run(adminAuthController.login, { validated: { email: 'REV@example.com', password: 'right-password-1' } });
  assert.equal(ok.err, null);
  assert.equal(JSON.stringify(ok.res.body).indexOf('password_hash'), -1);
  assert.ok(ok.res.body.data.token);
});

test('acceptance email escapes user content and contains no payment details', () => {
  const mail = buildAcceptanceEmail({ abstract_id: 'ABS-1', registration_id: 'REG-1', email: 'a@b.co', title: '<script>x</script>', presentation_category: 'Oral Presentation', review_comments: '' });
  assert.equal(mail.html.indexOf('<script>'), -1);
  assert.equal(mail.text.indexOf('30875081005'), -1);
});

const nodemailer = require('nodemailer');
const config = require('../config/config');

let transporter = null;

// Lazily built (and cached) so a missing/incomplete SMTP config doesn't throw at require-time —
// sendAbstractConfirmation() below just skips sending and logs a warning instead.
function getTransporter() {
  if (transporter) return transporter;
  if (!config.emailConfigured) return null;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });
  return transporter;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function row(label, value) {
  return '<tr><td style="padding:6px 12px 6px 0;color:#607080;white-space:nowrap;vertical-align:top">' + escapeHtml(label) +
    '</td><td style="padding:6px 0">' + escapeHtml(value || '—') + '</td></tr>';
}

// Sends the submitter a copy of everything they submitted, for their own records. Called
// fire-and-forget from abstractController.create — a mail failure must never fail the
// submission itself (the row is already saved in the sheet by the time this runs).
async function sendAbstractConfirmation(record) {
  const t = getTransporter();
  if (!t) {
    console.warn('SMTP not configured — skipping abstract confirmation email to ' + record.email);
    return;
  }

  const subject = 'ICCS-CIRCLE 2027 — Abstract Submission Received (' + record.abstract_id + ')';

  const text = [
    'Thank you for submitting your abstract to ICCS-CIRCLE 2027.',
    '',
    'Submission ID: ' + record.abstract_id,
    'Registration ID: ' + record.registration_id,
    'Title: ' + record.title,
    'Authors: ' + record.authors,
    'Corresponding Author: ' + record.corresponding_author,
    'Affiliation: ' + (record.affiliation || '—'),
    'Presentation Category: ' + record.presentation_category,
    'Keywords: ' + (record.keywords || '—'),
    'Word Count: ' + record.word_count,
    'Status: ' + record.submission_status,
    '',
    'Abstract:',
    record.abstract_text,
    '',
    'Please keep this Submission ID for your records. The Organizing Committee will contact',
    'you regarding the review outcome.',
    '',
    '— ICCS-CIRCLE 2027 Organizing Committee'
  ].join('\n');

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#243447;max-width:600px;margin:0 auto">' +
    '<h2 style="color:#10243e;margin-bottom:4px">Abstract Submission Received</h2>' +
    '<p style="color:#607080;margin-top:0">Thank you for submitting your abstract to <b>ICCS-CIRCLE 2027</b>. Here is a copy of the details you submitted.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">' +
    row('Submission ID', record.abstract_id) +
    row('Registration ID', record.registration_id) +
    row('Title', record.title) +
    row('Authors', record.authors) +
    row('Corresponding Author', record.corresponding_author) +
    row('Affiliation', record.affiliation) +
    row('Presentation Category', record.presentation_category) +
    row('Keywords', record.keywords) +
    row('Word Count', record.word_count) +
    row('Status', record.submission_status) +
    '</table>' +
    '<p style="color:#607080;margin-bottom:4px">Abstract</p>' +
    '<p style="white-space:pre-wrap;background:#f4f7fa;padding:14px;border-radius:8px;font-size:14px;line-height:1.5">' + escapeHtml(record.abstract_text) + '</p>' +
    '<p style="margin-top:20px">Please keep this Submission ID for your records. The Organizing Committee will contact you regarding the review outcome.</p>' +
    '<p style="color:#607080;font-size:13px">— ICCS-CIRCLE 2027 Organizing Committee</p>' +
    '</div>';

  await t.sendMail({ from: config.smtp.from, to: record.email, subject: subject, text: text, html: html });
}

// Sent right after a successful registration — carries the registration_id the submitter will
// need to carry forward into abstract submission. Same fire-and-forget contract as above.
async function sendRegistrationConfirmation(record) {
  const t = getTransporter();
  if (!t) {
    console.warn('SMTP not configured — skipping registration confirmation email to ' + record.email);
    return;
  }

  const subject = 'ICCS-CIRCLE 2027 — Registration Confirmed (' + record.registration_id + ')';

  const text = [
    'Thank you for registering for ICCS-CIRCLE 2027.',
    '',
    'Registration ID: ' + record.registration_id,
    'Name: ' + record.name,
    'Email: ' + record.email,
    'Institution: ' + (record.institution || '—'),
    'Category: ' + record.category,
    'Presentation Type: ' + (record.presentation_type || '—'),
    'Registration Status: ' + record.registration_status,
    '',
    'Keep this Registration ID — you will need it to submit an abstract. Use the same email',
    'address you registered with when you submit.',
    '',
    '— ICCS-CIRCLE 2027 Organizing Committee'
  ].join('\n');

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#243447;max-width:600px;margin:0 auto">' +
    '<h2 style="color:#10243e;margin-bottom:4px">Registration Confirmed</h2>' +
    '<p style="color:#607080;margin-top:0">Thank you for registering for <b>ICCS-CIRCLE 2027</b>. Here is a copy of your registration.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">' +
    row('Registration ID', record.registration_id) +
    row('Name', record.name) +
    row('Email', record.email) +
    row('Institution', record.institution) +
    row('Category', record.category) +
    row('Presentation Type', record.presentation_type) +
    row('Registration Status', record.registration_status) +
    '</table>' +
    '<p style="margin-top:20px"><b>Keep this Registration ID</b> — you will need it to submit an abstract. Use the same email address you registered with when you submit.</p>' +
    '<p style="color:#607080;font-size:13px">— ICCS-CIRCLE 2027 Organizing Committee</p>' +
    '</div>';

  await t.sendMail({ from: config.smtp.from, to: record.email, subject: subject, text: text, html: html });
}

module.exports = { sendAbstractConfirmation: sendAbstractConfirmation, sendRegistrationConfirmation: sendRegistrationConfirmation };

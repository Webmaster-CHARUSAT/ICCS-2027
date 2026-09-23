const contactModel = require('../models/contact');
const idService = require('../services/idService');
const response = require('../utils/response');

// Public: anyone may send a contact message.
async function create(req, res, next) {
  try {
    const data = req.validated;
    const now = new Date().toISOString();
    const record = {
      message_id: idService.generateId('MSG'),
      name: data.name.trim(),
      email: data.email.toLowerCase(),
      subject: data.subject.trim(),
      message: data.message.trim(),
      status: 'unread',
      created_at: now
    };
    await contactModel.repository.create(record);
    return response.ok(res, { message_id: record.message_id }, 201);
  } catch (err) {
    next(err);
  }
}

module.exports = { create: create };

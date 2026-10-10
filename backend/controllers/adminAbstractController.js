const abstractModel = require('../models/abstract');
const registrationModel = require('../models/registration');
const emailService = require('../services/emailService');
const response = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

/*
 * Faculty review dashboard (/admin). Abstracts are read live from the Abstracts tab of the
 * Google Sheet through the Apps Script Web App.
 *
 * Every read pulls the whole tab through Apps Script (slow — up to several seconds on a cold
 * start), so the list is cached in memory for a short time and dropped on every decision, so
 * a reviewer always sees their own change immediately. New public submissions appear within
 * CACHE_TTL_MS, or straight away with the dashboard's Refresh button (?fresh=1).
 */
const CACHE_TTL_MS = 20 * 1000;
let cache = { at: 0, records: null };

async function allAbstracts(fresh) {
  if (!fresh && cache.records && Date.now() - cache.at < CACHE_TTL_MS) return cache.records;
  // Skip blank rows (a formatted/validated but empty row inside the sheet's data range comes
  // back as a record with every field empty).
  const records = (await abstractModel.repository.listAll()).filter(function (r) { return r.abstract_id; });
  cache = { at: Date.now(), records: records };
  return records;
}

function invalidateCache() {
  cache = { at: 0, records: null };
}

function statusOf(record) {
  return record.submission_status || 'Submitted';
}

function summary(record) {
  return {
    abstract_id: record.abstract_id,
    registration_id: record.registration_id || '',
    title: record.title,
    authors: record.authors,
    email: record.email,
    presentation_category: record.presentation_category,
    submission_status: statusOf(record),
    created_at: record.created_at
  };
}

const SEARCH_FIELDS = ['title', 'authors', 'email', 'keywords', 'abstract_id', 'registration_id'];

// GET /api/admin/abstracts?status&category&search&page&limit[&fresh=1]
// Returns one page of matching abstracts plus counts per status across ALL abstracts, in one
// response so the dashboard needs a single (slow) round trip.
async function list(req, res, next) {
  try {
    const q = req.query;
    const records = await allAbstracts(q.fresh === '1');

    const stats = { total: records.length };
    abstractModel.STATUSES.forEach(function (s) { stats[s] = 0; });
    records.forEach(function (r) { stats[statusOf(r)] = (stats[statusOf(r)] || 0) + 1; });

    const search = String(q.search || '').trim().toLowerCase();
    let items = records.filter(function (r) {
      if (q.status && statusOf(r) !== q.status) return false;
      if (q.category && r.presentation_category !== q.category) return false;
      if (search) {
        return SEARCH_FIELDS.some(function (f) { return String(r[f] || '').toLowerCase().indexOf(search) !== -1; });
      }
      return true;
    });
    items.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });

    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(Math.max(parseInt(q.page, 10) || 1, 1), totalPages);
    items = items.slice((page - 1) * limit, page * limit).map(summary);

    return response.ok(res, {
      items: items,
      pagination: { page: page, limit: limit, total: total, totalPages: totalPages },
      stats: stats,
      categories: abstractModel.CATEGORIES,
      statuses: abstractModel.STATUSES
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/abstracts/:id — full abstract plus the registrant's name/institution.
async function get(req, res, next) {
  try {
    const abstract = await abstractModel.repository.get(req.params.id);
    if (!abstract) throw new NotFoundError('Abstract ' + req.params.id + ' was not found.');

    const registration = abstract.registration_id
      ? await registrationModel.repository.get(abstract.registration_id)
      : await registrationModel.repository.findOne(function (r) {
        return String(r.email || '').toLowerCase() === String(abstract.email || '').toLowerCase();
      });

    return response.ok(res, {
      abstract: Object.assign({}, abstract, { submission_status: statusOf(abstract) }),
      registration: registration ? {
        registration_id: registration.registration_id,
        name: registration.name,
        email: registration.email,
        institution: registration.institution,
        category: registration.category,
        country: registration.country
      } : null
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/abstracts/:id/decision {decision: 'Accepted'|'Rejected', comments}
// Writes only columns the Abstracts tab already has. A decision can be changed later (e.g. a
// mistaken click) — the reviewer and updated_at columns always show who decided last and when.
async function decide(req, res, next) {
  try {
    const id = req.params.id;
    const existing = await abstractModel.repository.get(id);
    if (!existing) throw new NotFoundError('Abstract ' + id + ' was not found.');

    const patch = {
      submission_status: req.validated.decision,
      review_comments: req.validated.comments,
      reviewer: req.user.email,
      updated_at: new Date().toISOString()
    };
    const updated = await abstractModel.repository.update(id, patch);
    invalidateCache();

    // Fire-and-forget, like the confirmation emails: the decision is already saved, so a mail
    // failure must not turn into a failed response for the reviewer.
    let emailQueued = false;
    if (patch.submission_status === 'Accepted') {
      emailQueued = emailService.isConfigured();
      emailService.sendAcceptanceEmail(Object.assign({}, existing, patch)).catch(function (err) {
        console.error('Failed to send acceptance email to ' + existing.email + ':', err.message);
      });
    }

    return response.ok(res, {
      abstract_id: id,
      submission_status: updated.submission_status,
      reviewer: patch.reviewer,
      updated_at: patch.updated_at,
      email_queued: emailQueued
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, decide, invalidateCache };

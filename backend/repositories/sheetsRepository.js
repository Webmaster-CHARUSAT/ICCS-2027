const Repository = require('./repository');
const sheetsService = require('../services/googleSheets');
const { NotFoundError } = require('../utils/errors');

/**
 * Google Sheets-backed repository for one worksheet/tab, talking to the Apps Script Web App
 * (see backend/services/googleSheets.js). `idField` is the stable business ID column
 * (e.g. "abstract_id") — the Apps Script side locates rows by that value, never by row index.
 */
class SheetsRepository extends Repository {
  constructor(sheetName, headers, idField) {
    super();
    this.sheetName = sheetName;
    this.headers = headers;
    this.idField = idField;
  }

  async _all() {
    const records = await sheetsService.listRecords(this.sheetName);
    return records || [];
  }

  async list(options) {
    options = options || {};
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const search = (options.search || '').trim().toLowerCase();
    const searchFields = options.searchFields || [];
    const filters = options.filters || {};

    let records = await this._all();

    if (search && searchFields.length) {
      records = records.filter(function (r) {
        return searchFields.some(function (f) {
          return String(r[f] || '').toLowerCase().indexOf(search) !== -1;
        });
      });
    }

    Object.keys(filters).forEach(function (key) {
      const val = filters[key];
      if (val === undefined || val === null || val === '') return;
      records = records.filter(function (r) { return r[key] === val; });
    });

    const total = records.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const items = records.slice(start, start + limit);

    return {
      items: items,
      pagination: { page: page, limit: limit, total: total, totalPages: totalPages }
    };
  }

  async listAll() {
    return this._all();
  }

  async get(id) {
    const records = await this._all();
    return records.find((r) => r[this.idField] === id) || null;
  }

  async findOne(matcher) {
    const records = await this._all();
    return records.find(matcher) || null;
  }

  async create(record) {
    return sheetsService.createRecord(this.sheetName, record);
  }

  async createUnique(record, uniqueGroups) {
    return sheetsService.createUniqueRecord(this.sheetName, record, uniqueGroups);
  }

  async update(id, patch) {
    const updated = await sheetsService.updateRecord(this.sheetName, this.idField, id, patch);
    if (!updated) throw new NotFoundError(this.sheetName + ' record "' + id + '" was not found.');
    return updated;
  }

  async remove(id) {
    const removed = await sheetsService.removeRecord(this.sheetName, this.idField, id);
    if (!removed) throw new NotFoundError(this.sheetName + ' record "' + id + '" was not found.');
  }
}

module.exports = SheetsRepository;

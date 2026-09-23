/**
 * Repository interface every storage backend must implement.
 * Controllers/services depend only on this shape, never on Google Sheets directly —
 * swapping SheetsRepository for e.g. a PostgresRepository later requires no API changes.
 *
 * list({ page, limit, search, searchFields, filters }) -> { items, total }
 * listAll() -> record[]               // every record, unpaginated — for server-side filtering
 *                                      // (e.g. "my submissions") that must not miss rows past page 1
 * get(id) -> record | null
 * findOne(matcher) -> record | null   // matcher: (record) => boolean
 * create(record) -> record
 * createUnique(record, uniqueGroups) -> { created: boolean, record }
 *                                      // atomic check-and-append; uniqueGroups is an array of
 *                                      // condition groups — a conflict is ALL conditions in ANY
 *                                      // one group matching an existing record. Exists because
 *                                      // findOne-then-create is not atomic across a network call.
 * update(id, patch) -> record
 * remove(id) -> void
 */
class Repository {
  async list() { throw new Error('Not implemented'); }
  async listAll() { throw new Error('Not implemented'); }
  async get() { throw new Error('Not implemented'); }
  async findOne() { throw new Error('Not implemented'); }
  async create() { throw new Error('Not implemented'); }
  async createUnique() { throw new Error('Not implemented'); }
  async update() { throw new Error('Not implemented'); }
  async remove() { throw new Error('Not implemented'); }
}

module.exports = Repository;

/**
 * ICCS-CIRCLE 2027 — Google Apps Script Web App backend for the conference spreadsheet.
 *
 * This is the "direct" alternative to the googleapis/service-account integration: it runs
 * inside the spreadsheet itself and is called by the Node.js backend over plain HTTP, so
 * there's no Google Cloud project, no service account, and no private key to manage.
 *
 * DESIGN NOTE — where the business logic lives:
 * This script is deliberately a thin, generic data layer. It does NOT generate IDs, decide
 * statuses, verify registrations, or know what a "registration" or "abstract" is. All of that
 * belongs to the Node backend (backend/controllers/*), which is the single source of truth —
 * duplicating it here would mean two implementations drifting apart, and (worst of all) IDs
 * generated here would never reach the browser, so the ID a submitter is shown would not match
 * the ID actually stored in the sheet.
 *
 * The one exception is the `createUnique` action below. Uniqueness is the single thing the
 * Node backend genuinely CANNOT do safely on its own: it would have to read the sheet, decide,
 * then write in a separate HTTP call, leaving a window where two simultaneous submissions both
 * pass the check before either writes. Doing the check + append together inside one lock here
 * closes that window. The Node backend still supplies the values to check and the record to
 * write — this script only answers "was it unique, and did I append it?".
 *
 * SETUP
 * 1. Open the ICCS-CIRCLE 2027 spreadsheet (the one with the Registrations/Abstracts/
 *    ContactMessages tabs already created with their header rows).
 * 2. Extensions -> Apps Script.
 * 3. Delete any starter code in Code.gs and paste this entire file in its place.
 * 4. Set the secret as a SCRIPT PROPERTY (not a hardcoded constant — a constant would put the
 *    secret in this file's source, which you may commit to a repository):
 *      Project Settings (gear icon, left sidebar) -> Script Properties -> Add script property
 *      Property: SHARED_SECRET
 *      Value:    a long random string — generate one with
 *                node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *    Use the SAME string as APPS_SCRIPT_SECRET in backend/.env.
 * 5. Deploy -> New deployment -> gear icon -> "Web app".
 *      Execute as: Me
 *      Who has access: Anyone
 *    Deploy, authorize the requested permissions, then copy the Web App URL (ends in /exec).
 * 6. Paste that URL into backend/.env as APPS_SCRIPT_URL.
 * 7. Whenever you edit this script, you must create a NEW deployment (or "Manage deployments"
 *    -> edit -> new version) for the change to take effect on the existing /exec URL. Editing a
 *    Script Property does NOT require a new deployment — it's read fresh on every request.
 *
 * SECURITY NOTE: "Who has access: Anyone" means anyone who has (or guesses) this URL can send
 * it requests — the SHARED_SECRET check below is what actually protects your data. Treat the
 * Script Property value like a password: rotate it if it's ever shared, screenshotted, or
 * pasted anywhere outside Project Settings (e.g. into a chat, ticket, or commit).
 */

function doPost(e) {
  var sharedSecret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  if (!sharedSecret) {
    return jsonResponse_({ ok: false, error: 'Server secret not configured.' });
  }

  var body;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ ok: false, error: 'Request body is missing.' });
    }
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'Invalid JSON body.' });
  }

  if (body.secret !== sharedSecret) {
    return jsonResponse_({ ok: false, error: 'Unauthorized.' });
  }

  // Writes are serialized with a script-wide lock so two near-simultaneous requests can't
  // interleave their read-modify-write against the same sheet. Reads (list) don't need it.
  var isWrite = body.action === 'create' || body.action === 'createUnique' ||
    body.action === 'update' || body.action === 'remove';
  var lock = isWrite ? LockService.getScriptLock() : null;
  if (lock) {
    try {
      lock.waitLock(30000);
    } catch (err) {
      return jsonResponse_({ ok: false, error: 'The spreadsheet is busy, please try again in a moment.' });
    }
  }

  try {
    var data;
    switch (body.action) {
      case 'list':
        data = listRecords_(body.sheet);
        break;
      case 'create':
        data = createRecord_(body.sheet, body.record);
        break;
      case 'createUnique':
        data = createUniqueRecord_(body.sheet, body.record, body.uniqueGroups);
        break;
      case 'update':
        data = updateRecord_(body.sheet, body.idField, body.id, body.patch);
        break;
      case 'remove':
        data = removeRecord_(body.sheet, body.idField, body.id);
        break;
      default:
        return jsonResponse_({ ok: false, error: 'Unknown action: ' + body.action });
    }
    return jsonResponse_({ ok: true, data: data });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function doGet(e) {
  return jsonResponse_({ ok: false, error: 'This endpoint only accepts POST requests.' });
}

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet tab "' + name + '" was not found in this spreadsheet.');
  return sheet;
}

// Reads the whole tab; row 1 is treated as the header. Returns { headers, rows } where each
// row is a plain object keyed by header name, plus a "__row" (1-indexed sheet row number)
// used only internally by updateRecord_/removeRecord_ below.
function readAll_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) return { headers: [], rows: [] };
  var headers = values[0];
  var rows = values.slice(1).map(function (row, i) {
    var record = { __row: i + 2 };
    headers.forEach(function (h, c) {
      record[h] = row[c];
    });
    return record;
  });
  return { headers: headers, rows: rows };
}

function stripRow_(record) {
  var copy = {};
  for (var key in record) {
    if (key !== '__row') copy[key] = record[key];
  }
  return copy;
}

function listRecords_(sheetName) {
  var sheet = getSheet_(sheetName);
  return readAll_(sheet).rows.map(stripRow_);
}

// Appends the record as-is, mapping it onto whatever columns the sheet's header row defines.
// Fields with no matching header are dropped; headers with no matching field become ''.
function appendMapped_(sheet, headers, record) {
  var row = headers.map(function (h) {
    return record[h] !== undefined ? record[h] : '';
  });
  sheet.appendRow(row);
  return record;
}

function createRecord_(sheetName, record) {
  if (!record) throw new Error('Record is required.');
  var sheet = getSheet_(sheetName);
  var headers = readAll_(sheet).headers;
  if (headers.length === 0) throw new Error('Sheet "' + sheetName + '" does not have a header row.');
  return appendMapped_(sheet, headers, record);
}

/**
 * Atomic "append only if no existing row conflicts" — the whole point of this action is that
 * the check and the append happen together inside doPost's lock, which the Node backend cannot
 * achieve across two separate HTTP calls.
 *
 * uniqueGroups is an array of groups; each group is an array of conditions. A row conflicts if
 * EVERY condition in ANY ONE group matches it. So:
 *   [[email], [phone]]           -> conflict on same email OR same phone      (registrations)
 *   [[registration_id]]          -> conflict on same registration_id         (abstracts — one per registration)
 *   [[email, title]]             -> conflict on same email AND same title    (an alternative rule, not currently used)
 * Each condition: { field: 'email', value: 'a@b.com', normalize: 'email'|'phone'|'text'|'exact' }
 *
 * Returns { created: true } or { created: false, conflict: true } — a duplicate is an expected
 * outcome, not a script failure, so it comes back as a normal ok:true response and the Node
 * backend decides which HTTP status the user sees.
 */
function createUniqueRecord_(sheetName, record, uniqueGroups) {
  if (!record) throw new Error('Record is required.');
  if (!uniqueGroups || !uniqueGroups.length) throw new Error('uniqueGroups is required for createUnique.');

  var sheet = getSheet_(sheetName);
  var all = readAll_(sheet);
  if (all.headers.length === 0) throw new Error('Sheet "' + sheetName + '" does not have a header row.');

  for (var i = 0; i < all.rows.length; i++) {
    var existing = all.rows[i];
    for (var g = 0; g < uniqueGroups.length; g++) {
      var group = uniqueGroups[g];
      if (!group || !group.length) continue;
      var allMatch = true;
      for (var c = 0; c < group.length; c++) {
        var cond = group[c];
        var wanted = normalizeValue_(cond.value, cond.normalize);
        var actual = normalizeValue_(existing[cond.field], cond.normalize);
        // An empty wanted/actual never counts as a match, so blank cells in the sheet (or a
        // blank optional field) can't collide with each other.
        if (!wanted || !actual || wanted !== actual) { allMatch = false; break; }
      }
      if (allMatch) return { created: false, conflict: true };
    }
  }

  appendMapped_(sheet, all.headers, record);
  return { created: true };
}

// Mirrors the normalization the Node backend applies before storing these values
// (backend/controllers/registrationController.js normalizePhone + .toLowerCase() on emails).
// Kept in sync deliberately: rows written by older versions may not be normalized on disk.
function normalizeValue_(value, mode) {
  if (value === undefined || value === null) return '';
  var str = String(value).trim();
  if (mode === 'email') return str.toLowerCase();
  if (mode === 'phone') {
    var digits = str.replace(/\D/g, '');
    if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.substring(2);
    else if (digits.length === 11 && digits.indexOf('0') === 0) digits = digits.substring(1);
    return digits;
  }
  if (mode === 'text') return str.toLowerCase().replace(/\s+/g, ' ');
  return str;
}

function updateRecord_(sheetName, idField, id, patch) {
  var sheet = getSheet_(sheetName);
  var all = readAll_(sheet);
  var match = null;
  for (var i = 0; i < all.rows.length; i++) {
    if (String(all.rows[i][idField]) === String(id)) { match = all.rows[i]; break; }
  }
  if (!match) return null;

  var merged = {};
  for (var k in match) merged[k] = match[k];
  for (var p in patch) merged[p] = patch[p];

  var row = all.headers.map(function (h) {
    return merged[h] !== undefined ? merged[h] : '';
  });
  sheet.getRange(match.__row, 1, 1, row.length).setValues([row]);
  return stripRow_(merged);
}

function removeRecord_(sheetName, idField, id) {
  var sheet = getSheet_(sheetName);
  var all = readAll_(sheet);
  var match = null;
  for (var i = 0; i < all.rows.length; i++) {
    if (String(all.rows[i][idField]) === String(id)) { match = all.rows[i]; break; }
  }
  if (!match) return false;
  sheet.deleteRow(match.__row);
  return true;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

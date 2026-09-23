// Client for the Google Apps Script Web App that sits directly on top of the spreadsheet
// (see google-apps-script/Code.gs for the script you deploy). This replaces the googleapis
// service-account integration: no Cloud project, no private key — just a deployed script URL
// and a shared secret. Nothing above this module (repositories/controllers) should know the
// transport details; they only call list/create/update/remove below.
const config = require('../config/config');
const { ServiceUnavailableError } = require('../utils/errors');

async function callScript(action, body) {
  if (!config.sheetsConfigured) {
    throw new ServiceUnavailableError(
      'Google Sheets is not configured. Set APPS_SCRIPT_URL and APPS_SCRIPT_SECRET in backend/.env.'
    );
  }

  let res;
  try {
    res = await fetch(config.appsScript.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ secret: config.appsScript.secret, action: action }, body)),
      redirect: 'follow',
      signal: AbortSignal.timeout(config.appsScript.timeoutMs)
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ServiceUnavailableError(
        'The Google Apps Script Web App did not respond within ' + config.appsScript.timeoutMs +
        'ms (it may be experiencing a cold start). Please try again in a moment.'
      );
    }
    throw new ServiceUnavailableError('Could not reach the Google Apps Script Web App: ' + err.message);
  }

  let payload;
  try {
    payload = await res.json();
  } catch (err) {
    throw new ServiceUnavailableError(
      'The Apps Script Web App returned a non-JSON response (check APPS_SCRIPT_URL and that the deployment access is set to "Anyone").'
    );
  }

  if (!payload || payload.ok !== true) {
    const message = (payload && payload.error) || 'The Apps Script Web App reported an error.';
    // The deployed script predates an action this backend now uses — almost always "edited
    // Code.gs but didn't create a new deployment version", which is otherwise baffling to debug.
    if (message.indexOf('Unknown action') === 0) {
      throw new ServiceUnavailableError(
        'The deployed Apps Script is out of date (' + message + '). Paste the current ' +
        'google-apps-script/Code.gs into the Apps Script editor and create a new deployment version.'
      );
    }
    throw new ServiceUnavailableError(message);
  }
  return payload.data;
}

function listRecords(sheetName) {
  return callScript('list', { sheet: sheetName });
}

function createRecord(sheetName, record) {
  return callScript('create', { sheet: sheetName, record: record }).then(function () {
    return record;
  });
}

/**
 * Append `record` only if no existing row conflicts, with the check and the append performed
 * together inside the Apps Script's lock (see createUniqueRecord_ in Code.gs). Doing the check
 * here in Node instead would leave a race: two simultaneous submissions could both read the
 * sheet, both see no duplicate, and both then append.
 *
 * Resolves { created: true, record } or { created: false } — a duplicate is an expected
 * outcome, so the caller decides what error (if any) the user sees.
 */
function createUniqueRecord(sheetName, record, uniqueGroups) {
  return callScript('createUnique', {
    sheet: sheetName,
    record: record,
    uniqueGroups: uniqueGroups
  }).then(function (data) {
    return { created: !!(data && data.created), record: record };
  });
}

function updateRecord(sheetName, idField, id, patch) {
  return callScript('update', { sheet: sheetName, idField: idField, id: id, patch: patch });
}

function removeRecord(sheetName, idField, id) {
  return callScript('remove', { sheet: sheetName, idField: idField, id: id });
}

module.exports = {
  listRecords: listRecords,
  createRecord: createRecord,
  createUniqueRecord: createUniqueRecord,
  updateRecord: updateRecord,
  removeRecord: removeRecord
};

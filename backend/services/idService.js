const { randomUUID } = require('crypto');

// Prefixed UUIDs: human-scannable prefix, but collision-resistant even under concurrent
// submissions (unlike a "last row + 1" scheme against Google Sheets — see README limitations).
function generateId(prefix) {
  const short = randomUUID().split('-')[0].toUpperCase();
  return prefix + '-' + short;
}

module.exports = { generateId: generateId };

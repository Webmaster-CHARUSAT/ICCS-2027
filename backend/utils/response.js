function ok(res, data, statusCode) {
  return res.status(statusCode || 200).json({ success: true, data: data });
}

function paginated(res, items, pagination) {
  return res.status(200).json({ success: true, data: items, pagination: pagination });
}

function fail(res, statusCode, code, message) {
  return res.status(statusCode).json({ success: false, error: { code: code, message: message } });
}

module.exports = { ok: ok, paginated: paginated, fail: fail };

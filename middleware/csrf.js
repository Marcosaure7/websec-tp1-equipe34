const crypto = require('crypto');

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function attachCsrfToLocals(req, res, next) {
  res.locals.csrfToken = ensureCsrfToken(req);
  next();
}

function regenerateCsrf(req) {
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
}

function verifyPostCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }
  const token =
    req.body && typeof req.body._csrf === 'string' ? req.body._csrf : '';
  if (!req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).send('Jeton CSRF invalide ou session expirée.');
  }
  next();
}

module.exports = {
  attachCsrfToLocals,
  verifyPostCsrf,
  regenerateCsrf,
};

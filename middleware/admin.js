const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(
  path.join(__dirname, '..', 'database', 'caissepassecure.db'),
);

// Middleware de vérification du rôle admin
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }

  try {
    db.prepare(
      'INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
    ).run(
      req.session.user ? req.session.user.id : null,
      'admin_access_denied',
      `Tentative d'accès admin : ${req.method} ${req.originalUrl}`,
      req.ip,
    );
  } catch (_) {
    /* ignore */
  }

  req.session.error = 'Accès réservé aux administrateurs';
  res.redirect('/account/dashboard');
}

module.exports = isAdmin;

const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { regenerateCsrf } = require('../middleware/csrf');

const db = new Database(
  path.join(__dirname, '..', 'database', 'caissepassecure.db'),
);

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  handler: (req, res) => {
    req.session.error = 'Trop de tentatives. Réessayez dans 15 minutes.';
    res.redirect('/auth/login');
  },
});

function logSecurityEvent(action, details, ip) {
  try {
    db.prepare(
      'INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
    ).run(null, action, details, ip || '');
  } catch (e) {
    console.error('logSecurityEvent:', e.message);
  }
}

// Page de connexion
router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Connexion' });
});

// Traitement de la connexion
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email || '').trim());

  let passwordOk = false;
  if (user && user.password) {
    if (String(user.password).startsWith('$2')) {
      passwordOk = bcrypt.compareSync(String(password || ''), user.password);
    } else {
      passwordOk = user.password === String(password || '');
    }
  }

  if (user && passwordOk) {
    if (user.active === 0) {
      req.session.error = 'Ce compte a été désactivé';
      return res.redirect('/auth/login');
    }

    if (!String(user.password).startsWith('$2')) {
      const hash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
    }

    regenerateCsrf(req);
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
    };

    req.session.success = `Bienvenue, ${user.name} !`;
    return res.redirect('/account/dashboard');
  }

  logSecurityEvent('login_failed', 'Tentative de connexion échouée', req.ip);
  req.session.error = 'Identifiants incorrects.';
  res.redirect('/auth/login');
});

// Page d'inscription
router.get('/register', (req, res) => {
  res.render('auth/register', { title: 'Inscription' });
});

// Traitement de l'inscription
router.post('/register', (req, res) => {
  const { name, email, password, password_confirm } = req.body;

  if (password !== password_confirm) {
    req.session.error = 'Les mots de passe ne correspondent pas';
    return res.redirect('/auth/register');
  }

  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    req.session.error = `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`;
    return res.redirect('/auth/register');
  }

  try {
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(String(email || '').trim());
    if (existing) {
      req.session.error = 'Cet email est déjà utilisé';
      return res.redirect('/auth/register');
    }

    const hash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
    db.prepare(
      'INSERT INTO users (name, email, password, balance) VALUES (?, ?, ?, ?)',
    ).run(String(name || '').trim(), String(email || '').trim(), hash, 100.0);

    req.session.success =
      'Compte créé avec succès ! Vous pouvez maintenant vous connecter.';
    res.redirect('/auth/login');
  } catch (err) {
    req.session.error = 'Erreur lors de la création du compte';
    res.redirect('/auth/register');
  }
});

// Page mot de passe oublié
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Mot de passe oublié' });
});

// Traitement mot de passe oublié
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const normalized = String(email || '').trim();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    db.prepare(
      'INSERT INTO password_resets (user_id, token) VALUES (?, ?)',
    ).run(user.id, token);

    if (process.env.NODE_ENV !== 'production') {
      console.info(
        '[dev] Lien de réinitialisation :',
        `/auth/reset-password?token=${token}`,
      );
    }
  }

  req.session.success =
    'Si cette adresse est associée à un compte, vous recevrez un lien de réinitialisation.';
  res.redirect('/auth/forgot-password');
});

// Page de réinitialisation
router.get('/reset-password', (req, res) => {
  const { token } = req.query;
  res.render('auth/forgot-password', {
    title: 'Réinitialiser le mot de passe',
    token,
  });
});

// Traitement réinitialisation
router.post('/reset-password', (req, res) => {
  const { token, password, password_confirm } = req.body;

  if (password !== password_confirm) {
    req.session.error = 'Les mots de passe ne correspondent pas';
    return res.redirect(`/auth/reset-password?token=${encodeURIComponent(token || '')}`);
  }

  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    req.session.error = `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`;
    return res.redirect(`/auth/reset-password?token=${encodeURIComponent(token || '')}`);
  }

  const reset = db
    .prepare(
      `SELECT * FROM password_resets WHERE token = ?
       AND datetime(created_at, '+1 hour') > datetime('now')`,
    )
    .get(token);

  if (reset) {
    const hash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(
      hash,
      reset.user_id,
    );
    db.prepare('DELETE FROM password_resets WHERE id = ?').run(reset.id);
    regenerateCsrf(req);

    req.session.success = 'Mot de passe modifié avec succès';
    return res.redirect('/auth/login');
  }

  req.session.error = 'Lien invalide ou expiré.';
  res.redirect('/auth/forgot-password');
});

// Déconnexion (POST uniquement — évite la déconnexion CSRF via lien GET)
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('session.destroy:', err);
    res.clearCookie('sid');
    res.redirect('/');
  });
});

module.exports = router;

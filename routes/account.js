const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const https = require('https');
const isAuthenticated = require('../middleware/auth');
const { isSafeAvatarUrl } = require('../lib/avatarUrl');

const db = new Database(
  path.join(__dirname, '..', 'database', 'caissepassecure.db'),
);

// Dashboard du compte
router.get('/dashboard', isAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) {
    req.session.error = 'Utilisateur non trouvé';
    return res.redirect('/');
  }

  const transactions = db
    .prepare(
      `
    SELECT t.*, 
           sender.name as sender_name, 
           receiver.name as receiver_name
    FROM transactions t
    LEFT JOIN users sender ON t.from_user_id = sender.id
    JOIN users receiver ON t.to_user_id = receiver.id
    WHERE t.from_user_id = ? OR t.to_user_id = ?
    ORDER BY t.created_at DESC
    LIMIT 5
  `,
    )
    .all(userId, userId);

  res.render('account/dashboard', {
    title: 'Mon compte',
    account: user,
    transactions,
    isOwnAccount: true,
  });
});

// Page de profil
router.get('/profile', isAuthenticated, (req, res) => {
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.session.user.id);

  res.render('account/profile', {
    title: 'Mon profil',
    account: user,
  });
});

// Modification du profil
router.post('/profile', isAuthenticated, (req, res) => {
  const { name, email, bio } = req.body;
  const id = req.session.user.id;

  try {
    const current = db
      .prepare('SELECT avatar_url FROM users WHERE id = ?')
      .get(id);

    db.prepare(
      'UPDATE users SET name = ?, email = ?, bio = ?, avatar_url = ? WHERE id = ?',
    ).run(
      String(name || '').trim(),
      String(email || '').trim(),
      String(bio || ''),
      current && current.avatar_url != null ? current.avatar_url : '',
      id,
    );

    req.session.user.name = String(name || '').trim();
    req.session.user.email = String(email || '').trim();

    req.session.success = 'Profil mis à jour avec succès';
  } catch (err) {
    req.session.error = 'Erreur lors de la mise à jour du profil';
  }

  res.redirect('/account/profile');
});

router.post('/profile/avatar', isAuthenticated, (req, res) => {
  const { avatar_url } = req.body;
  const raw = String(avatar_url || '').trim();

  if (!isSafeAvatarUrl(raw)) {
    req.session.error =
      'URL non autorisée (HTTPS uniquement, pas de réseau local).';
    return res.redirect('/account/profile');
  }

  try {
    https
      .get(raw, (response) => {
        if (response.statusCode === 200) {
          db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(
            raw,
            req.session.user.id,
          );
          req.session.user.avatar_url = raw;
          req.session.success = 'Avatar mis à jour';
        } else {
          req.session.error = `Impossible de charger l'image (status: ${response.statusCode})`;
        }
        res.redirect('/account/profile');
      })
      .on('error', (err) => {
        req.session.error = `Erreur: ${err.message}`;
        res.redirect('/account/profile');
      });
  } catch (err) {
    req.session.error = 'URL invalide';
    res.redirect('/account/profile');
  }
});

module.exports = router;

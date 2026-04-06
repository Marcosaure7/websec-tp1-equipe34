const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const isAuthenticated = require('../middleware/auth');

const db = new Database(
  path.join(__dirname, '..', 'database', 'caissepassecure.db'),
);

const PENDING_TTL_MS = 15 * 60 * 1000;

// Page de nouveau transfert
router.get('/new', isAuthenticated, (req, res) => {
  const user = db
    .prepare('SELECT balance FROM users WHERE id = ?')
    .get(req.session.user.id);

  res.render('transfer/new', {
    title: 'Nouveau transfert',
    balance: user.balance,
  });
});

// Traitement du transfert
router.post('/new', isAuthenticated, (req, res) => {
  const { recipient_email, amount, description } = req.body;
  const senderId = req.session.user.id;

  const transferAmount = parseFloat(amount);

  if (isNaN(transferAmount) || transferAmount <= 0) {
    req.session.error = 'Montant invalide';
    return res.redirect('/transfer/new');
  }

  const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(senderId);
  const recipient = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(recipient_email || '').trim());

  if (!recipient) {
    req.session.error = 'Destinataire non trouvé';
    return res.redirect('/transfer/new');
  }

  if (recipient.id === senderId) {
    req.session.error = "Vous ne pouvez pas vous transférer de l'argent";
    return res.redirect('/transfer/new');
  }

  if (sender.balance < transferAmount) {
    req.session.error = 'Solde insuffisant';
    return res.redirect('/transfer/new');
  }

  req.session.pendingTransfer = {
    recipient_id: recipient.id,
    amount: transferAmount,
    description: String(description || ''),
    createdAt: Date.now(),
  };

  res.redirect('/transfer/confirm');
});

// Page de confirmation (données liées à la session, pas aux paramètres d’URL)
router.get('/confirm', isAuthenticated, (req, res) => {
  const pending = req.session.pendingTransfer;
  if (
    !pending ||
    typeof pending.recipient_id !== 'number' ||
    Date.now() - pending.createdAt > PENDING_TTL_MS
  ) {
    delete req.session.pendingTransfer;
    req.session.error = 'Session de transfert expirée ou invalide.';
    return res.redirect('/transfer/new');
  }

  const recipient = db
    .prepare('SELECT id, name, email FROM users WHERE id = ?')
    .get(pending.recipient_id);

  if (!recipient) {
    delete req.session.pendingTransfer;
    req.session.error = 'Destinataire non trouvé';
    return res.redirect('/transfer/new');
  }

  res.render('transfer/new', {
    title: 'Confirmer le transfert',
    confirmation: true,
    recipient,
    amount: pending.amount,
    description: pending.description,
    balance: db
      .prepare('SELECT balance FROM users WHERE id = ?')
      .get(req.session.user.id).balance,
  });
});

// Exécution du transfert — doit correspondre exactement au pending en session
router.post('/confirm', isAuthenticated, (req, res) => {
  const pending = req.session.pendingTransfer;
  if (
    !pending ||
    Date.now() - pending.createdAt > PENDING_TTL_MS ||
    typeof pending.recipient_id !== 'number'
  ) {
    delete req.session.pendingTransfer;
    req.session.error = 'Session de transfert expirée ou invalide.';
    return res.redirect('/transfer/new');
  }

  const senderId = req.session.user.id;
  const transferAmount = pending.amount;
  const description = pending.description;

  const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(senderId);
  const recipient = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(pending.recipient_id);

  if (!recipient) {
    delete req.session.pendingTransfer;
    req.session.error = 'Destinataire non trouvé';
    return res.redirect('/transfer/new');
  }

  if (sender.balance < transferAmount) {
    req.session.error = 'Solde insuffisant';
    return res.redirect('/transfer/new');
  }

  try {
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(
      transferAmount,
      senderId,
    );
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(
      transferAmount,
      recipient.id,
    );

    db.prepare(
      'INSERT INTO transactions (from_user_id, to_user_id, amount, description) VALUES (?, ?, ?, ?)',
    ).run(senderId, recipient.id, transferAmount, description);

    delete req.session.pendingTransfer;

    try {
      db.prepare(
        'INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      ).run(
        senderId,
        'transfer',
        `Transfert de ${transferAmount} vers user #${recipient.id}`,
        req.ip,
      );
    } catch (_) {
      /* ignore log failure */
    }

    req.session.success = `Transfert de ${transferAmount.toFixed(2)} $ à ${recipient.name} effectué avec succès`;
    res.redirect('/account/dashboard');
  } catch (err) {
    req.session.error = 'Erreur lors du transfert';
    res.redirect('/transfer/new');
  }
});

module.exports = router;

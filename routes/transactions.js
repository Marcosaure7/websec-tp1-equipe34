const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const isAuthenticated = require('../middleware/auth');

const db = new Database(
  path.join(__dirname, '..', 'database', 'caissepassecure.db'),
);

// Historique des transactions
router.get('/history', isAuthenticated, (req, res) => {
  let userId = req.session.user.id;

  if (req.query.user_id != null && String(req.query.user_id) !== '') {
    if (req.session.user.role !== 'admin') {
      req.session.error = 'Accès refusé';
      return res.redirect('/transactions/history');
    }
    const parsed = parseInt(req.query.user_id, 10);
    if (Number.isNaN(parsed)) {
      return res.redirect('/transactions/history');
    }
    userId = parsed;
  }

  const transactions = db
    .prepare(
      `
    SELECT t.*, 
           sender.name as sender_name, 
           sender.email as sender_email,
           receiver.name as receiver_name,
           receiver.email as receiver_email
    FROM transactions t
    LEFT JOIN users sender ON t.from_user_id = sender.id
    JOIN users receiver ON t.to_user_id = receiver.id
    WHERE t.from_user_id = ? OR t.to_user_id = ?
    ORDER BY t.created_at DESC
  `,
    )
    .all(userId, userId);

  res.render('transactions/history', {
    title: 'Historique des transactions',
    transactions,
    historyUserId: userId,
    sessionUserId: req.session.user.id,
  });
});

// Recherche de transactions
router.get('/search', isAuthenticated, (req, res) => {
  res.render('transactions/search', {
    title: 'Rechercher des transactions',
    transactions: null,
    searchQuery: '',
  });
});

function escapeLike(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// Traitement de la recherche
router.post('/search', isAuthenticated, (req, res) => {
  const { query, date_from, date_to } = req.body;
  const userId = req.session.user.id;

  let sql = `
    SELECT t.*, 
           sender.name as sender_name, 
           sender.email as sender_email,
           receiver.name as receiver_name,
           receiver.email as receiver_email
    FROM transactions t
    LEFT JOIN users sender ON t.from_user_id = sender.id
    JOIN users receiver ON t.to_user_id = receiver.id
    WHERE (t.from_user_id = ? OR t.to_user_id = ?)
  `;
  const params = [userId, userId];

  if (query && String(query).trim()) {
    const pattern = `%${escapeLike(String(query).trim())}%`;
    sql += ` AND (t.description LIKE ? ESCAPE '\\' OR sender.name LIKE ? ESCAPE '\\' OR receiver.name LIKE ? ESCAPE '\\')`;
    params.push(pattern, pattern, pattern);
  }

  if (date_from && String(date_from).trim()) {
    sql += ' AND date(t.created_at) >= date(?)';
    params.push(String(date_from).trim());
  }

  if (date_to && String(date_to).trim()) {
    sql += ' AND date(t.created_at) <= date(?)';
    params.push(String(date_to).trim());
  }

  sql += ' ORDER BY t.created_at DESC';

  try {
    const transactions = db.prepare(sql).all(...params);

    res.render('transactions/search', {
      title: 'Rechercher des transactions',
      transactions,
      searchQuery: query || '',
      dateFrom: date_from,
      dateTo: date_to,
    });
  } catch (err) {
    console.error('transactions/search:', err.message);
    req.session.error = 'Erreur lors de la recherche';
    res.redirect('/transactions/search');
  }
});

module.exports = router;

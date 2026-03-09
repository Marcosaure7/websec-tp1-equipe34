/**
 * Outils de debug admin — chargé uniquement quand DEBUG=true en .env.
 * Ne pas utiliser en production.
 */
const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const isAuthenticated = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

const db = new Database(
  path.join(__dirname, '..', 'database', 'caissepassecure.db'),
);

router.get('/debug/query', isAuthenticated, isAdmin, (req, res) => {
  const sql = req.query.sql;

  if (!sql) {
    return res.json({
      message: 'Outil de debug SQL. Utilisation: ?sql=SELECT...',
    });
  }

  try {
    let result;
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      result = db.prepare(sql).all();
    } else {
      result = db.prepare(sql).run();
    }
    res.json({ success: true, result });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/export/:table', isAuthenticated, isAdmin, (req, res) => {
  const table = req.params.table;

  try {
    const data = db.prepare(`SELECT * FROM ${table}`).all();
    res.json(data);
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

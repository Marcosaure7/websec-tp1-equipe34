/**
 * Initialisation du schéma de la base de données.
 * Crée uniquement les tables (aucune donnée par défaut).
 * Sûr pour la production.
 */
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'caissepassecure.db'));

// Suppression des tables existantes
db.exec(`
  DROP TABLE IF EXISTS logs;
  DROP TABLE IF EXISTS transactions;
  DROP TABLE IF EXISTS password_resets;
  DROP TABLE IF EXISTS users;
`);

// Création des tables
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    bio TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    balance REAL DEFAULT 0,
    role TEXT DEFAULT 'user',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER,
    to_user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
  );

  CREATE TABLE password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

console.log('Schéma de la base de données créé avec succès.');
console.log('Pour insérer des données de test (développement uniquement) : npm run seed-dev');

db.close();

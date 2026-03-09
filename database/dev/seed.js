/**
 * Données de développement — À NE JAMAIS exécuter en production.
 * Insère des utilisateurs, transactions et logs de test.
 * Usage : npm run seed-dev (après npm run init-db)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

if (process.env.NODE_ENV === 'production') {
  console.error('ERREUR : seed-dev ne doit pas être exécuté en production (NODE_ENV=production).');
  process.exit(1);
}

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'caissepassecure.db'));

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount > 0) {
  console.error('La base contient déjà des utilisateurs. Exécutez "npm run init-db" pour réinitialiser le schéma avant de lancer seed-dev.');
  process.exit(1);
}

const users = [
  {
    name: 'Alice Dupont',
    email: 'alice@test.com',
    password: 'alice123',
    bio: `Cliente fidèle depuis ${new Date().getFullYear()}`,
    balance: 2500.0,
    role: 'user',
  },
  {
    name: 'Bob Martin',
    email: 'bob@test.com',
    password: 'bob123',
    bio: 'Entrepreneur passionné',
    balance: 850.0,
    role: 'user',
  },
  {
    name: 'Diana Ross',
    email: 'diana@test.com',
    password: 'diana123',
    bio: 'Étudiante en finance',
    balance: 150.0,
    role: 'user',
  },
  {
    name: 'Charlie Admin',
    email: 'admin@caissepassecure.com',
    password: 'admin123',
    bio: 'Administrateur système',
    balance: 10000.0,
    role: 'admin',
  },
];

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password, bio, balance, role)
  VALUES (@name, @email, @password, @bio, @balance, @role)
`);

for (const user of users) {
  insertUser.run({
    ...user,
    password: bcrypt.hashSync(user.password, 10),
  });
}

const transactions = [
  { from_user_id: 1, to_user_id: 2, amount: 150.0, description: 'Remboursement restaurant' },
  { from_user_id: 2, to_user_id: 1, amount: 75.0, description: 'Part du cadeau' },
  { from_user_id: 4, to_user_id: 1, amount: 1000.0, description: 'Bonus fidélité' },
  { from_user_id: 1, to_user_id: 3, amount: 50.0, description: 'Aide pour les livres' },
  { from_user_id: 3, to_user_id: 2, amount: 25.0, description: 'Café et croissants' },
];

const insertTransaction = db.prepare(`
  INSERT INTO transactions (from_user_id, to_user_id, amount, description)
  VALUES (@from_user_id, @to_user_id, @amount, @description)
`);

for (const transaction of transactions) {
  insertTransaction.run(transaction);
}

const logs = [
  { user_id: 1, action: 'login', details: 'Connexion réussie', ip_address: '192.168.1.100' },
  { user_id: 4, action: 'login', details: 'Connexion réussie', ip_address: '192.168.1.1' },
  { user_id: 4, action: 'user_update', details: 'Modification du solde de Alice Dupont', ip_address: '192.168.1.1' },
];

const insertLog = db.prepare(`
  INSERT INTO logs (user_id, action, details, ip_address)
  VALUES (@user_id, @action, @details, @ip_address)
`);

for (const log of logs) {
  insertLog.run(log);
}

console.log('Données de développement insérées avec succès.');
users.forEach((u) => {
  console.log(`  - ${u.email} (${u.role}) - Solde: ${u.balance} $`);
});

db.close();

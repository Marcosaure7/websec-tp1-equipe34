require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const ejsLayouts = require('express-ejs-layouts');

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const transferRoutes = require('./routes/transfer');
const transactionsRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');
const {
  attachCsrfToLocals,
  verifyPostCsrf,
} = require('./middleware/csrf');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET est obligatoire en production.');
  process.exit(1);
}

const sessionSecret =
  process.env.SESSION_SECRET || 'dev-only-never-use-in-production';

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

// Helpers disponibles dans toutes les vues
app.locals.formatDate = (date) => {
  return new Date(date).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

app.locals.formatMoney = (amount) => {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'sid',
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(attachCsrfToLocals);

// Variables globales pour les vues
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});

app.use(verifyPostCsrf);

// Routes
app.get('/', (req, res) => {
  res.render('home', { title: 'Accueil' });
});

app.use('/auth', authRoutes);
app.use('/account', accountRoutes);
app.use('/transfer', transferRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {
  if (process.env.DEBUG === 'true') {
    console.error('[DEBUG]', err.stack || err.message);
  }
  res.status(500).render('error', { message: 'Une erreur est survenue' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CaissePasSecure démarré sur http://localhost:${PORT}`);
});

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');

// In test mode, environment variables are set by the test runner before this module
// loads. Using override: true would clobber those values with whatever is in .env,
// making tests depend on a local .env file that may not exist on CI.
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true, override: process.env.NODE_ENV !== 'test' });

// Known development placeholder values that must never be used in production
// and indicate the developer has not yet generated a real secret.
const KNOWN_WEAK_SECRETS = [
  'fintrack-dev-only-secret',
  'replace_this_with_a_long_random_string',
  'generate-a-real-secret-do-not-use-this-value',
];

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error(
    'JWT_SECRET is not set.\n' +
    'Generate one with: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')" \n' +
    'Then add it to server/.env as JWT_SECRET=<value>'
  );
  process.exit(1);
}

if (KNOWN_WEAK_SECRETS.includes(jwtSecret)) {
  console.error(
    'JWT_SECRET is set to a known placeholder value and cannot be used.\n' +
    'Generate a real secret with: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')" \n' +
    'Then update JWT_SECRET in server/.env'
  );
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

// Render runs behind one trusted reverse proxy. Rate limiting must use the
// real forwarded client IP instead of treating every visitor as one IP.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Security headers. In production the API also serves the built SPA, so the
// CSP must allow the Vite bundle, Google Fonts and React inline styles.
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"]
    }
  } : false
}));

const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : process.env.NODE_ENV === 'production'
    ? [] // Production frontend uses same-origin requests; no wildcard/localhost CORS.
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(cookieParser());
// Authenticated financial responses must not be stored in shared browser caches.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ok: ready });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/budgets', require('./routes/budgetRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.json({ message: 'FinTrack API is running' });
  });
}

app.use(errorHandler);

// Production: serve the built client (client/dist) with an SPA fallback so the
// whole app runs from one origin — which also keeps the auth cookie same-origin.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(distPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Server running at http://${HOST}:${PORT}`);
    });
  });
}

module.exports = app;

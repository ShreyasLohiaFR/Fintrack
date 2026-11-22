/**
 * Infrastructure smoke tests
 *
 * Verifies that:
 *   1. The Jest / Supertest / MongoMemoryServer wiring is correct.
 *   2. The Express app loads without starting a listening HTTP server.
 *   3. The test DB is isolated from the development database.
 *   4. The health endpoint responds — confirming the app is reachable via Supertest.
 *   5. A protected route rejects requests with no JWT — confirming auth middleware is live.
 *   6. The app cannot reach a persistent database during the test run.
 *
 * These tests contain no business logic. They are pass/fail gates for the
 * test infrastructure itself, not for application features.
 */

'use strict';

const mongoose = require('mongoose');
const request  = require('supertest');

const { connect, disconnect, clearDatabase } = require('./setup');

// The app is required AFTER setup.js has already set NODE_ENV=test and JWT_SECRET,
// and AFTER we establish the mongoose connection in beforeAll. This ordering is
// important: requiring the app registers mongoose models and Express routes, but
// does NOT call connectDB() because the require.main === module guard prevents it.
let app;

beforeAll(async () => {
  await connect();
  // Require the app only after the test DB is connected and env vars are set.
  app = require('../server');
});

afterAll(disconnect);

afterEach(clearDatabase);

// ─────────────────────────────────────────────
// 1. Environment and process guards
// ─────────────────────────────────────────────

describe('Test environment', () => {
  it('NODE_ENV is "test"', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('JWT_SECRET is set and not a known weak placeholder', () => {
    const secret = process.env.JWT_SECRET;
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThan(32);

    const KNOWN_WEAK = [
      'fintrack-dev-only-secret',
      'replace_this_with_a_long_random_string',
      'generate-a-real-secret-do-not-use-this-value',
    ];
    expect(KNOWN_WEAK).not.toContain(secret);
  });
});

// ─────────────────────────────────────────────
// 2. Database isolation
// ─────────────────────────────────────────────

describe('Database isolation', () => {
  it('Mongoose is connected', () => {
    // readyState 1 = connected
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('Connected to an ephemeral in-memory database, not the dev database', () => {
    const host = mongoose.connection.host;
    // MongoMemoryServer always binds to 127.0.0.1.
    // A remote Atlas URI would have a hostname, not 127.0.0.1.
    // A real local MongoDB on 27017 would also match 127.0.0.1 — but MMS uses a
    // random high port, so we verify that too.
    expect(host).toBe('127.0.0.1');

    const port = mongoose.connection.port;
    // MMS picks a random available port — never the standard 27017
    expect(port).not.toBe(27017);
  });

  it('MONGODB_URI env var is not set (test run is isolated)', () => {
    // If MONGODB_URI were set, connectDB() might try to use it.
    // Tests never set it and the .env value is commented out.
    // This guards against accidental bleed-in.
    expect(process.env.MONGODB_URI).toBeUndefined();
  });

  it('Can write to and read from the test database', async () => {
    // Use a raw mongoose collection to avoid coupling to any app model
    const col = mongoose.connection.collection('_infra_test');
    await col.insertOne({ ping: true });
    const doc = await col.findOne({ ping: true });
    expect(doc).not.toBeNull();
    expect(doc.ping).toBe(true);
    // clearDatabase() in afterEach will remove this
  });
});

// ─────────────────────────────────────────────
// 3. Express app
// ─────────────────────────────────────────────

describe('Express app', () => {
  it('app is an Express application (not a listening net.Server)', () => {
    // An Express app is a function with a .listen() method but is NOT a net.Server.
    // We never call .listen() — Supertest handles that internally.
    expect(typeof app).toBe('function');
    expect(app.listen).toBeDefined();
    // Confirm it has NOT been started by the test infrastructure
    // (no open socket from the app itself)
    expect(app._server).toBeUndefined();
  });

  it('GET /api/health responds 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 4. Auth middleware is active (security baseline)
// ─────────────────────────────────────────────

describe('Authentication middleware', () => {
  it('GET /api/transactions with no token returns 401', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/transactions with a garbage token returns 401', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/budgets with no token returns 401', async () => {
    const res = await request(app).get('/api/budgets');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/analytics/summary with no token returns 401', async () => {
    const res = await request(app).get('/api/analytics/summary');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

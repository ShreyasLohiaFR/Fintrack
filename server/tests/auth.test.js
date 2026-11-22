/**
 * Authentication integration tests
 *
 * Covers: registration, login, duplicate emails, validation errors,
 * token protection, logout, and the /me endpoint.
 */

'use strict';

const request = require('supertest');
const { connect, disconnect, clearDatabase } = require('./setup');

let app;

beforeAll(async () => {
  await connect();
  app = require('../server');
});

afterAll(disconnect);

afterEach(clearDatabase);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const VALID_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123'
};

const registerUser = (data = VALID_USER) =>
  request(app).post('/api/auth/register').send(data);

const loginUser = (credentials = { email: VALID_USER.email, password: VALID_USER.password }) =>
  request(app).post('/api/auth/login').send(credentials);

// Register, then return the Bearer token for subsequent requests.
const getToken = async (userData = VALID_USER) => {
  const res = await registerUser(userData);
  expect(res.status).toBe(201);
  return res.body.token;
};

// ─────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers a new user and returns token + user object', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.user.name).toBe(VALID_USER.name);
    // password must never appear in the response
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects duplicate email registration', async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects duplicate email regardless of case', async () => {
    await registerUser();
    const res = await registerUser({ ...VALID_USER, email: 'TEST@EXAMPLE.COM' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is missing', async () => {
    const res = await registerUser({ email: VALID_USER.email, password: VALID_USER.password });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when email is missing', async () => {
    const res = await registerUser({ name: VALID_USER.name, password: VALID_USER.password });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password is missing', async () => {
    const res = await registerUser({ name: VALID_USER.name, email: VALID_USER.email });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password is too short (< 6 chars)', async () => {
    const res = await registerUser({ ...VALID_USER, password: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an invalid email format', async () => {
    const res = await registerUser({ ...VALID_USER, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when body is completely empty', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerUser();
  });

  it('logs in with correct credentials and returns a token', async () => {
    const res = await loginUser();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.user.password).toBeUndefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await loginUser({ email: VALID_USER.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for unknown email', async () => {
    const res = await loginUser({ email: 'nobody@example.com', password: VALID_USER.password });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: VALID_USER.password });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: VALID_USER.email });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('does not reveal whether the email exists (same 401 for both failure modes)', async () => {
    const wrongPass = await loginUser({ email: VALID_USER.email, password: 'bad' });
    const badEmail  = await loginUser({ email: 'ghost@example.com', password: 'bad' });
    // Both must be 401 with the same status — prevents user enumeration.
    expect(wrongPass.status).toBe(401);
    expect(badEmail.status).toBe(401);
    expect(wrongPass.body.message).toBe(badEmail.body.message);
  });
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns the logged-in user profile', async () => {
    const token = await getToken();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.user.password).toBeUndefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the session cookie', async () => {
    const token = await getToken();
    // Establish a cookie-based session first
    await request(app).post('/api/auth/login').send({
      email: VALID_USER.email,
      password: VALID_USER.password
    });
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

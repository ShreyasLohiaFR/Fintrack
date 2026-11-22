/**
 * Budget integration tests
 *
 * Covers: creation, upsert behavior, retrieval with spent amounts,
 * deletion, input validation, and cross-user authorization.
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

const registerAndLogin = async (email = 'user@example.com') => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.token;
};

const authed = (token) => ({
  get:    (url)  => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post:   (url)  => request(app).post(url).set('Authorization', `Bearer ${token}`),
  delete: (url)  => request(app).delete(url).set('Authorization', `Bearer ${token}`)
});

const VALID_BUDGET = { month: 11, year: 2026, amount: 10000 };

const createBudget = async (token, data = VALID_BUDGET) => {
  const res = await authed(token).post('/api/budgets').send(data);
  expect(res.status).toBe(200);
  return res.body.data;
};

// Add an expense for the given user in the budget period.
const addExpense = async (token, amount = 3000, date = '2026-11-10') => {
  const res = await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount, type: 'expense', category: 'Food', description: 'Test expense', date });
  expect(res.status).toBe(201);
  return res.body.data;
};

// ─────────────────────────────────────────────
// POST /api/budgets — create / upsert
// ─────────────────────────────────────────────

describe('POST /api/budgets', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('creates a new budget and returns progress fields', async () => {
    const res = await authed(token).post('/api/budgets').send(VALID_BUDGET);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.month).toBe(11);
    expect(data.year).toBe(2026);
    expect(data.amount).toBe(10000);
    expect(data.spent).toBeDefined();
    expect(data.remaining).toBeDefined();
    expect(data.percentageUsed).toBeDefined();
  });

  it('upserts (updates) an existing budget for the same month/year', async () => {
    await createBudget(token, { month: 11, year: 2026, amount: 10000 });
    const res = await authed(token).post('/api/budgets').send({ month: 11, year: 2026, amount: 20000 });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(20000);
    // Still one budget for that month
    const list = await authed(token).get('/api/budgets');
    expect(list.body.data.filter((b) => b.month === 11 && b.year === 2026)).toHaveLength(1);
  });

  it('returns 400 when month is missing', async () => {
    const { month, ...rest } = VALID_BUDGET;
    const res = await authed(token).post('/api/budgets').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when year is missing', async () => {
    const { year, ...rest } = VALID_BUDGET;
    const res = await authed(token).post('/api/budgets').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is missing', async () => {
    const { amount, ...rest } = VALID_BUDGET;
    const res = await authed(token).post('/api/budgets').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when month is out of range (0)', async () => {
    const res = await authed(token).post('/api/budgets').send({ ...VALID_BUDGET, month: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when month is out of range (13)', async () => {
    const res = await authed(token).post('/api/budgets').send({ ...VALID_BUDGET, month: 13 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await authed(token).post('/api/budgets').send({ ...VALID_BUDGET, amount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await authed(token).post('/api/budgets').send({ ...VALID_BUDGET, amount: -5000 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/budgets').send(VALID_BUDGET);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────
// GET /api/budgets — list
// ─────────────────────────────────────────────

describe('GET /api/budgets', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('returns an empty list for a new user', async () => {
    const res = await authed(token).get('/api/budgets');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns all budgets for the user', async () => {
    await createBudget(token, { month: 10, year: 2026, amount: 8000 });
    await createBudget(token, { month: 11, year: 2026, amount: 10000 });
    const res = await authed(token).get('/api/budgets');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('calculates spent correctly from actual expenses', async () => {
    await createBudget(token);           // 10000 limit for Nov 2026
    await addExpense(token, 3000);       // 3000 spent in Nov 2026

    const res = await authed(token).get('/api/budgets');
    expect(res.status).toBe(200);
    const budget = res.body.data.find((b) => b.month === 11 && b.year === 2026);
    expect(budget).toBeDefined();
    expect(budget.spent).toBe(3000);
    expect(budget.remaining).toBe(7000);
    expect(budget.percentageUsed).toBeCloseTo(30, 0);
  });

  it('does not count income toward spent', async () => {
    await createBudget(token);
    // Add income in the same month — must not increase "spent"
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 50000, type: 'income', category: 'Salary', description: 'November salary', date: '2026-11-01' });
    await addExpense(token, 2000);

    const res = await authed(token).get('/api/budgets');
    const budget = res.body.data.find((b) => b.month === 11 && b.year === 2026);
    expect(budget.spent).toBe(2000);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/budgets');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────
// DELETE /api/budgets/:id — delete
// ─────────────────────────────────────────────

describe('DELETE /api/budgets/:id', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('deletes a budget', async () => {
    const budget = await createBudget(token);
    const res = await authed(token).delete(`/api/budgets/${budget._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await authed(token).get('/api/budgets');
    expect(list.body.data).toHaveLength(0);
  });

  it('returns 404 for a non-existent budget', async () => {
    const res = await authed(token).delete('/api/budgets/000000000000000000000001');
    expect(res.status).toBe(404);
  });

  it("User B cannot delete User A's budget", async () => {
    const tokenB = await registerAndLogin('bob@example.com');
    const budget = await createBudget(token);
    const res = await authed(tokenB).delete(`/api/budgets/${budget._id}`);
    expect(res.status).toBe(404); // not 403 — no information leakage
  });
});

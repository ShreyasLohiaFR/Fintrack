/**
 * Analytics integration tests
 *
 * Covers: /summary, /categories, and /monthly endpoints including
 * correct totals, empty-database behaviour, and date-filter validation.
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
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`)
});

const addTransaction = async (token, data) => {
  const res = await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send(data);
  expect(res.status).toBe(201);
  return res.body.data;
};

// Use the current month/year so the "this month" aggregations in getSummary
// see these transactions, because getSummary uses Date.now() internally.
const nowDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
};

const THIS_MONTH = nowDate();

// ─────────────────────────────────────────────
// GET /api/analytics/summary
// ─────────────────────────────────────────────

describe('GET /api/analytics/summary', () => {
  it('returns all-zero totals for a new user', async () => {
    const token = await registerAndLogin();
    const res = await authed(token).get('/api/analytics/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.totalIncome).toBe(0);
    expect(data.totalExpenses).toBe(0);
    expect(data.netBalance).toBe(0);
    expect(data.monthIncome).toBe(0);
    expect(data.monthExpenses).toBe(0);
  });

  it('returns correct all-time totals after adding transactions', async () => {
    const token = await registerAndLogin();
    await addTransaction(token, {
      amount: 50000, type: 'income', category: 'Salary', description: 'Salary', date: THIS_MONTH
    });
    await addTransaction(token, {
      amount: 3000, type: 'expense', category: 'Food', description: 'Groceries', date: THIS_MONTH
    });

    const res = await authed(token).get('/api/analytics/summary');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalIncome).toBe(50000);
    expect(data.totalExpenses).toBe(3000);
    expect(data.netBalance).toBe(47000);
  });

  it('calculates net balance correctly (income − expenses)', async () => {
    const token = await registerAndLogin();
    await addTransaction(token, {
      amount: 20000, type: 'income', category: 'Salary', description: 'Partial salary', date: THIS_MONTH
    });
    await addTransaction(token, {
      amount: 25000, type: 'expense', category: 'Rent', description: 'Rent', date: THIS_MONTH
    });

    const res = await authed(token).get('/api/analytics/summary');
    expect(res.body.data.netBalance).toBe(-5000);
  });

  it('includes savings rate as a percentage of total income', async () => {
    const token = await registerAndLogin();
    await addTransaction(token, {
      amount: 10000, type: 'income', category: 'Salary', description: 'Salary', date: THIS_MONTH
    });
    await addTransaction(token, {
      amount: 4000, type: 'expense', category: 'Food', description: 'Food', date: THIS_MONTH
    });

    const res = await authed(token).get('/api/analytics/summary');
    // (10000 - 4000) / 10000 * 100 = 60%
    expect(res.body.data.savingsRate).toBeCloseTo(60, 0);
  });

  it('returns insights array', async () => {
    const token = await registerAndLogin();
    const res = await authed(token).get('/api/analytics/summary');
    expect(Array.isArray(res.body.data.insights)).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/analytics/summary');
    expect(res.status).toBe(401);
  });

  it('data is isolated per user', async () => {
    const tokenA = await registerAndLogin('alice@example.com');
    const tokenB = await registerAndLogin('bob@example.com');
    await addTransaction(tokenA, {
      amount: 100000, type: 'income', category: 'Salary', description: 'Big salary', date: THIS_MONTH
    });

    const resB = await authed(tokenB).get('/api/analytics/summary');
    expect(resB.body.data.totalIncome).toBe(0);
  });
});

// ─────────────────────────────────────────────
// GET /api/analytics/categories
// ─────────────────────────────────────────────

describe('GET /api/analytics/categories', () => {
  let token;

  beforeEach(async () => {
    token = await registerAndLogin();
  });

  it('returns an empty array when there are no transactions', async () => {
    const res = await authed(token).get('/api/analytics/categories');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('groups expenses by category with totals', async () => {
    await addTransaction(token, {
      amount: 2000, type: 'expense', category: 'Food', description: 'Lunch', date: THIS_MONTH
    });
    await addTransaction(token, {
      amount: 1500, type: 'expense', category: 'Food', description: 'Dinner', date: THIS_MONTH
    });
    await addTransaction(token, {
      amount: 800, type: 'expense', category: 'Transport', description: 'Metro', date: THIS_MONTH
    });

    const now = new Date();
    const res = await authed(token).get(
      `/api/analytics/categories?month=${now.getMonth() + 1}&year=${now.getFullYear()}`
    );
    expect(res.status).toBe(200);
    const food = res.body.data.find((row) => row._id === 'Food');
    expect(food).toBeDefined();
    expect(food.total).toBe(3500);
    expect(food.count).toBe(2);
  });

  it('defaults to expense type', async () => {
    await addTransaction(token, {
      amount: 50000, type: 'income', category: 'Salary', description: 'Salary', date: THIS_MONTH
    });
    await addTransaction(token, {
      amount: 1000, type: 'expense', category: 'Food', description: 'Food', date: THIS_MONTH
    });

    const now = new Date();
    const res = await authed(token).get(
      `/api/analytics/categories?month=${now.getMonth() + 1}&year=${now.getFullYear()}`
    );
    expect(res.status).toBe(200);
    // Only expense categories, not income
    const hasIncome = res.body.data.some((row) => row._id === 'Salary');
    expect(hasIncome).toBe(false);
  });

  it('returns income categories when type=income', async () => {
    await addTransaction(token, {
      amount: 50000, type: 'income', category: 'Salary', description: 'Salary', date: THIS_MONTH
    });

    const now = new Date();
    const res = await authed(token).get(
      `/api/analytics/categories?month=${now.getMonth() + 1}&year=${now.getFullYear()}&type=income`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.some((row) => row._id === 'Salary')).toBe(true);
  });

  it('returns 400 when only month is given without year', async () => {
    const res = await authed(token).get('/api/analytics/categories?month=5');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when only year is given without month', async () => {
    const res = await authed(token).get('/api/analytics/categories?year=2026');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for month out of range', async () => {
    const res = await authed(token).get('/api/analytics/categories?month=13&year=2026');
    expect(res.status).toBe(400);
  });

  it('returns 400 for month=0', async () => {
    const res = await authed(token).get('/api/analytics/categories?month=0&year=2026');
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/analytics/categories');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────
// GET /api/analytics/monthly
// ─────────────────────────────────────────────

describe('GET /api/analytics/monthly', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('returns exactly 6 months of data', async () => {
    const res = await authed(token).get('/api/analytics/monthly');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(6);
  });

  it('each month entry has income, expense and net fields', async () => {
    const res = await authed(token).get('/api/analytics/monthly');
    for (const row of res.body.data) {
      expect(typeof row.income).toBe('number');
      expect(typeof row.expense).toBe('number');
      expect(typeof row.net).toBe('number');
    }
  });

  it('net = income - expense for each month', async () => {
    const res = await authed(token).get('/api/analytics/monthly');
    for (const row of res.body.data) {
      expect(row.net).toBeCloseTo(row.income - row.expense, 5);
    }
  });

  it('returns correct totals after adding transactions this month', async () => {
    await addTransaction(token, {
      amount: 30000, type: 'income', category: 'Salary', description: 'Salary', date: THIS_MONTH
    });
    await addTransaction(token, {
      amount: 5000, type: 'expense', category: 'Rent', description: 'Rent', date: THIS_MONTH
    });

    const res = await authed(token).get('/api/analytics/monthly');
    expect(res.status).toBe(200);

    // The current month should be the last entry
    const last = res.body.data[res.body.data.length - 1];
    expect(last.income).toBe(30000);
    expect(last.expense).toBe(5000);
    expect(last.net).toBe(25000);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/analytics/monthly');
    expect(res.status).toBe(401);
  });
});

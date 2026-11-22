/**
 * Transaction integration tests
 *
 * Covers: CRUD, validation, filtering, search, sorting, pagination,
 * and cross-user authorization (User A cannot touch User B's data).
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

const registerAndLogin = async (email = 'user@example.com', password = 'password123') => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password });
  expect(res.status).toBe(201);
  return res.body.token;
};

const authed = (token) => ({
  get:    (url)  => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post:   (url)  => request(app).post(url).set('Authorization', `Bearer ${token}`),
  put:    (url)  => request(app).put(url).set('Authorization', `Bearer ${token}`),
  delete: (url)  => request(app).delete(url).set('Authorization', `Bearer ${token}`)
});

const VALID_EXPENSE = {
  amount: 1500,
  type: 'expense',
  category: 'Food',
  description: 'Lunch',
  date: '2026-01-15'
};

const VALID_INCOME = {
  amount: 50000,
  type: 'income',
  category: 'Salary',
  description: 'January salary',
  date: '2026-01-01'
};

const createTransaction = async (token, data = VALID_EXPENSE) => {
  const res = await authed(token).post('/api/transactions').send(data);
  expect(res.status).toBe(201);
  return res.body.data;
};

// ─────────────────────────────────────────────
// POST /api/transactions — create
// ─────────────────────────────────────────────

describe('POST /api/transactions', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('creates a valid expense transaction', async () => {
    const res = await authed(token).post('/api/transactions').send(VALID_EXPENSE);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(1500);
    expect(res.body.data.type).toBe('expense');
    expect(res.body.data.category).toBe('Food');
    expect(res.body.data.description).toBe('Lunch');
  });

  it('creates a valid income transaction', async () => {
    const res = await authed(token).post('/api/transactions').send(VALID_INCOME);
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('income');
    expect(res.body.data.category).toBe('Salary');
  });

  it('returns 400 when amount is missing', async () => {
    const { amount, ...rest } = VALID_EXPENSE;
    const res = await authed(token).post('/api/transactions').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await authed(token).post('/api/transactions').send({ ...VALID_EXPENSE, amount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await authed(token).post('/api/transactions').send({ ...VALID_EXPENSE, amount: -100 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid transaction type', async () => {
    const res = await authed(token).post('/api/transactions').send({ ...VALID_EXPENSE, type: 'transfer' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when category is invalid for the given type', async () => {
    // 'Rent' is a valid expense category but not valid for income
    const res = await authed(token).post('/api/transactions').send({ ...VALID_INCOME, category: 'Rent' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when description is missing', async () => {
    const { description, ...rest } = VALID_EXPENSE;
    const res = await authed(token).post('/api/transactions').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an invalid date string', async () => {
    const res = await authed(token).post('/api/transactions').send({ ...VALID_EXPENSE, date: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an out-of-range date (Feb 30)', async () => {
    const res = await authed(token).post('/api/transactions').send({ ...VALID_EXPENSE, date: '2026-02-30' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/transactions').send(VALID_EXPENSE);
    expect(res.status).toBe(401);
  });

  it('stores the transaction against the logged-in user only', async () => {
    const tx = await createTransaction(token);
    expect(tx.user).toBeDefined();
    // Create a second user and verify they cannot see it
    const token2 = await registerAndLogin('other@example.com');
    const res = await authed(token2).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// GET /api/transactions — list
// ─────────────────────────────────────────────

describe('GET /api/transactions', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('returns an empty list for a new user', async () => {
    const res = await authed(token).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns transactions belonging to the user', async () => {
    await createTransaction(token, VALID_EXPENSE);
    await createTransaction(token, VALID_INCOME);
    const res = await authed(token).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('filters by type=expense', async () => {
    await createTransaction(token, VALID_EXPENSE);
    await createTransaction(token, VALID_INCOME);
    const res = await authed(token).get('/api/transactions?type=expense');
    expect(res.status).toBe(200);
    expect(res.body.data.every((tx) => tx.type === 'expense')).toBe(true);
  });

  it('filters by type=income', async () => {
    await createTransaction(token, VALID_EXPENSE);
    await createTransaction(token, VALID_INCOME);
    const res = await authed(token).get('/api/transactions?type=income');
    expect(res.status).toBe(200);
    expect(res.body.data.every((tx) => tx.type === 'income')).toBe(true);
  });

  it('filters by category', async () => {
    await createTransaction(token, VALID_EXPENSE);
    await createTransaction(token, { ...VALID_EXPENSE, category: 'Transport', description: 'Metro' });
    const res = await authed(token).get('/api/transactions?category=Food');
    expect(res.status).toBe(200);
    expect(res.body.data.every((tx) => tx.category === 'Food')).toBe(true);
  });

  it('filters by startDate and endDate', async () => {
    await createTransaction(token, { ...VALID_EXPENSE, date: '2026-01-10', description: 'Jan' });
    await createTransaction(token, { ...VALID_EXPENSE, date: '2026-03-15', description: 'Mar' });
    const res = await authed(token).get('/api/transactions?startDate=2026-01-01&endDate=2026-01-31');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].description).toBe('Jan');
  });

  it('returns 400 for malformed startDate', async () => {
    const res = await authed(token).get('/api/transactions?startDate=not-a-date');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for out-of-range endDate (Feb 30)', async () => {
    const res = await authed(token).get('/api/transactions?endDate=2026-02-30');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('searches descriptions (case-insensitive)', async () => {
    await createTransaction(token, { ...VALID_EXPENSE, description: 'Grocery shopping' });
    await createTransaction(token, { ...VALID_EXPENSE, description: 'Netflix subscription' });
    const res = await authed(token).get('/api/transactions?search=GROCERY');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].description).toBe('Grocery shopping');
  });

  it('search treats regex metacharacters as literals', async () => {
    await createTransaction(token, { ...VALID_EXPENSE, description: 'Fee (late)' });
    await createTransaction(token, { ...VALID_EXPENSE, description: 'Monthly fee' });
    const res = await authed(token).get('/api/transactions?search=Fee+(late)');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].description).toBe('Fee (late)');
  });

  it('returns paginated results with page and limit params', async () => {
    for (let i = 1; i <= 5; i++) {
      await createTransaction(token, { ...VALID_EXPENSE, description: `Tx ${i}` });
    }
    const res = await authed(token).get('/api/transactions?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.pages).toBe(3);
    expect(res.body.page).toBe(1);
  });

  it('returns 400 for page=0', async () => {
    const res = await authed(token).get('/api/transactions?page=0&limit=10');
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit=0', async () => {
    const res = await authed(token).get('/api/transactions?page=1&limit=0');
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit > 1000', async () => {
    const res = await authed(token).get('/api/transactions?page=1&limit=1001');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// GET /api/transactions/:id — single
// ─────────────────────────────────────────────

describe('GET /api/transactions/:id', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('retrieves a single transaction by id', async () => {
    const tx = await createTransaction(token);
    const res = await authed(token).get(`/api/transactions/${tx._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(tx._id);
    expect(res.body.data.description).toBe('Lunch');
  });

  it('returns 404 for a non-existent id', async () => {
    // Valid ObjectId format but not in the database
    const res = await authed(token).get('/api/transactions/000000000000000000000001');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a malformed id (CastError → 404)', async () => {
    const res = await authed(token).get('/api/transactions/not-an-objectid');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// PUT /api/transactions/:id — update
// ─────────────────────────────────────────────

describe('PUT /api/transactions/:id', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('updates a transaction successfully', async () => {
    const tx = await createTransaction(token);
    const res = await authed(token).put(`/api/transactions/${tx._id}`).send({ amount: 2000, description: 'Updated lunch' });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(2000);
    expect(res.body.data.description).toBe('Updated lunch');
  });

  it('returns 400 when updating amount to zero', async () => {
    const tx = await createTransaction(token);
    const res = await authed(token).put(`/api/transactions/${tx._id}`).send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when updating amount to negative', async () => {
    const tx = await createTransaction(token);
    const res = await authed(token).put(`/api/transactions/${tx._id}`).send({ amount: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when updating type to invalid value', async () => {
    const tx = await createTransaction(token);
    const res = await authed(token).put(`/api/transactions/${tx._id}`).send({ type: 'refund' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when updating to a category invalid for the type', async () => {
    const tx = await createTransaction(token); // expense type
    const res = await authed(token).put(`/api/transactions/${tx._id}`).send({ category: 'Salary' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date on update', async () => {
    const tx = await createTransaction(token);
    const res = await authed(token).put(`/api/transactions/${tx._id}`).send({ date: '2026-02-30' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent transaction', async () => {
    const res = await authed(token).put('/api/transactions/000000000000000000000001').send({ amount: 100 });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────
// DELETE /api/transactions/:id — delete
// ─────────────────────────────────────────────

describe('DELETE /api/transactions/:id', () => {
  let token;
  beforeEach(async () => { token = await registerAndLogin(); });

  it('deletes a transaction', async () => {
    const tx = await createTransaction(token);
    const res = await authed(token).delete(`/api/transactions/${tx._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is gone
    const check = await authed(token).get(`/api/transactions/${tx._id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 for a non-existent transaction', async () => {
    const res = await authed(token).delete('/api/transactions/000000000000000000000001');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────
// Authorization: cross-user access prevention
// ─────────────────────────────────────────────

describe('Cross-user authorization', () => {
  let tokenA, tokenB, txByA;

  beforeEach(async () => {
    tokenA = await registerAndLogin('alice@example.com');
    tokenB = await registerAndLogin('bob@example.com');
    txByA  = await createTransaction(tokenA);
  });

  it("User B cannot read User A's transaction", async () => {
    const res = await authed(tokenB).get(`/api/transactions/${txByA._id}`);
    expect(res.status).toBe(404); // treated as not found, not 403 (no info leakage)
  });

  it("User B cannot update User A's transaction", async () => {
    const res = await authed(tokenB).put(`/api/transactions/${txByA._id}`).send({ amount: 9999 });
    expect(res.status).toBe(404);
  });

  it("User B cannot delete User A's transaction", async () => {
    const res = await authed(tokenB).delete(`/api/transactions/${txByA._id}`);
    expect(res.status).toBe(404);
  });

  it("User B's list does not include User A's transactions", async () => {
    const res = await authed(tokenB).get('/api/transactions');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((tx) => tx._id);
    expect(ids).not.toContain(txByA._id);
  });

  it('Unauthenticated request to list returns 401', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });
});

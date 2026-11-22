# FinTrack

A personal finance tracking application built on the MERN stack. FinTrack lets you record income and expenses, set monthly spending limits, and visualise where your money goes — all stored against your account and served from a single Express API.

---

## Features

- **Authentication** — JWT-based registration and login. Session lives in an `httpOnly` cookie; the raw token is also returned for non-browser clients.
- **Transaction management** — Create, read, update, and delete income and expense records with categories, descriptions, dates, and optional notes.
- **Filtering and search** — Filter transactions by type, category, and date range; free-text search on description.
- **Pagination** — Optional `?page=&limit=` parameters return paginated results with totals.
- **CSV export** — Download all filtered transactions as a comma-separated file.
- **Monthly budgets** — Set one spending cap per calendar month. Progress is calculated from actual expenses in that month.
- **Dashboard** — Net balance, cash-flow, six-month income/expense area chart, category pie chart, budget progress bar, top expenses, and personalised insights.
- **Analytics** — Six-month trend chart, category breakdown by month, savings rates, and average monthly spend.
- **Currency formatting** — User-selectable display currency symbol (INR, USD, EUR, GBP, JPY, AUD, CAD, SGD). This changes formatting only; it does not perform exchange-rate conversion. Record amounts consistently in one currency.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), React Router 6, Recharts, Lucide React, plain CSS |
| Backend | Node.js, Express 5 |
| Database | MongoDB via Mongoose 9 |
| Authentication | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| Security | `helmet`, `cors`, `express-rate-limit`, `cookie-parser` |
| Testing | Jest 29, Supertest 7, `mongodb-memory-server` |

---

## Architecture Overview

```
client/          Vite + React SPA
  src/
    components/  Shared UI (Navbar, Modal, Button)
    context/     AuthContext — session state + currency
    pages/       One file per route (Dashboard, Transactions, Budgets, Analytics)
    services/    Axios wrappers for each API group
    utils/       Formatters, error helpers, constants

server/          Express REST API
  config/        MongoDB connection (real → local → file-backed fallback)
  controllers/   Business logic (auth, transactions, budgets, analytics)
  middleware/    JWT guard, rate limiter, centralised error handler
  models/        Mongoose schemas (User, Transaction, Budget)
  routes/        Express routers
  utils/         Timezone helpers, category lists, currency list
  tests/         Jest + Supertest integration tests (isolated MongoMemoryServer)
```

The frontend is fully decoupled from the backend. During development both run on separate ports (5000 and 5173) and the Vite dev server proxies `/api` requests. In production the Express server serves the built SPA from `client/dist`.

---

## Folder Structure

```
Fintrack/
├── client/                  React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.js
├── server/                  Node/Express backend
│   ├── config/db.js
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── tests/
│   ├── utils/
│   ├── server.js
│   ├── .env.example
│   └── package.json
├── docs/                    Architecture notes and project proposal
├── package.json             Root convenience scripts
└── README.md
```

---

## Installation

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- MongoDB is **optional** — the server falls back to a file-backed local database automatically if no MongoDB is available.

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd Fintrack
npm run install-all
```

This installs root, server, and client dependencies in one step.

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
```

Open `server/.env` and set `JWT_SECRET` to a cryptographically random value:

```bash
node -e "require('crypto').randomBytes(32).toString('hex')"
```

Paste the output as `JWT_SECRET=<value>` in `server/.env`. **The server will refuse to start with a missing or placeholder secret.**

`MONGODB_URI` is optional. If omitted, the server tries local MongoDB (`127.0.0.1:27017`) and falls back to a file-backed in-memory database stored in `server/data/mongo/`.

---

## Running the Application

### Development (two terminals)

**Terminal 1 — Backend:**
```bash
cd server
npm run dev        # nodemon, restarts on file changes, port 5000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev        # Vite dev server with HMR, port 5173
```

Alternatively, from the project root:
```bash
npm run dev        # runs both via concurrently
```

### Production

```bash
npm run build      # builds client/dist
npm start          # starts the Express server; it serves the SPA from client/dist
```

---

## Running Automated Tests

Tests run entirely against an isolated in-memory database. They never touch your development or production data.

```bash
cd server
npm test
```

The repository contains 113 test cases across 5 suites. After installing dependencies, a successful local run should show:

```
Test Suites: 5 passed, 5 total
Tests:       113 passed, 113 total
```

Test files:

| File | Coverage |
|---|---|
| `tests/infrastructure.test.js` | DB isolation, env guards, health check, auth middleware baseline |
| `tests/auth.test.js` | Registration, login, token validation, logout, /me endpoint |
| `tests/transactions.test.js` | Full CRUD, filtering, search, pagination, cross-user isolation |
| `tests/budgets.test.js` | Create/upsert, retrieval with spent amounts, deletion, validation |
| `tests/analytics.test.js` | Summary totals, category breakdown, six-month trend |

---

## API Endpoints

All protected routes require `Authorization: Bearer <token>` or the `fintrack_token` httpOnly cookie.

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Create account. Body: `{ name, email, password }` |
| `POST` | `/api/auth/login` | Public | Log in. Body: `{ email, password }` |
| `POST` | `/api/auth/logout` | Public | Clear the session cookie |
| `GET` | `/api/auth/me` | 🔒 | Return the logged-in user profile |
| `PUT` | `/api/auth/me` | 🔒 | Update currency preference. Body: `{ currency }` |

### Transactions

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/transactions` | 🔒 | List transactions. Supports `?type`, `?category`, `?startDate`, `?endDate`, `?search`, `?sort`, `?page`, `?limit` |
| `POST` | `/api/transactions` | 🔒 | Create a transaction. Body: `{ amount, type, category, description, date?, notes? }` |
| `GET` | `/api/transactions/:id` | 🔒 | Retrieve a single transaction |
| `PUT` | `/api/transactions/:id` | 🔒 | Update a transaction (partial update supported) |
| `DELETE` | `/api/transactions/:id` | 🔒 | Delete a transaction |

**Transaction types:** `income`, `expense`

**Income categories:** Salary, Freelance, Scholarship, Gift, Investment, Other

**Expense categories:** Food, Transport, Education, Shopping, Entertainment, Bills, Health, Rent, Other

### Budgets

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/budgets` | 🔒 | List all budgets with actual spending progress |
| `POST` | `/api/budgets` | 🔒 | Create or update the budget for a month. Body: `{ month, year, amount }` |
| `DELETE` | `/api/budgets/:id` | 🔒 | Delete a budget |

### Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/analytics/summary` | 🔒 | All-time and current-month totals, savings rates, budget progress, insights |
| `GET` | `/api/analytics/categories` | 🔒 | Expense (or income) totals grouped by category. Supports `?month`, `?year`, `?type` |
| `GET` | `/api/analytics/monthly` | 🔒 | Income, expense, and net totals for the last 6 calendar months |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Returns `{ ok: true }` — used by tests and uptime monitors |

---

## Authentication Design

- Passwords are hashed with `bcryptjs` (cost factor 10) before storage. The `password` field is never returned in API responses.
- JWT secrets are validated at startup; the server exits if the secret is missing or is a known placeholder.
- Sessions can be carried by either an `httpOnly` cookie (browser) or an `Authorization: Bearer` header (API clients). The header takes precedence when both are present.
- Rate limiting protects the `/api/auth/register` and `/api/auth/login` endpoints (20 requests per 15 minutes per IP). The general API limit is 500 requests per 15 minutes.
- Every transaction, budget, and analytics query is scoped to `req.user._id`. Attempting to access another user's resource returns `404`, not `403`, to avoid leaking whether the resource exists.

---

## Database Setup

No manual MongoDB setup is required for local development:

1. If `MONGODB_URI` is set in `.env`, the server connects to that URI.
2. Otherwise it tries `mongodb://127.0.0.1:27017/fintrack`.
3. If local MongoDB is not running, it starts a file-backed `mongodb-memory-server` instance and stores data in `server/data/mongo/`. This directory is excluded from Git.

For production, you **must** set `MONGODB_URI` to a real connection string (e.g. MongoDB Atlas). The server fails at startup if it is missing or unreachable rather than writing to a local development database. In production, the server listens on `0.0.0.0` by default and serves the built frontend at `/`.

---

## Known Limitations

- No email verification on registration.
- No password reset flow.
- Passwords currently require at least 6 characters; strengthen this policy before serving real users.
- JWT tokens are not revocable before expiry (no token blacklist); logout only clears the client-side cookie.
- The six-month analytics chart is always anchored to the current date; there is no historical range selector.
- CSV export fetches all pages client-side; very large datasets may be slow.
- The client bundle is not code-split; initial load is ~700 KB uncompressed (standard for a Recharts app).
- `mongodb-memory-server` is currently listed as a production dependency to support a zero-config local development fallback. Production requires a valid `MONGODB_URI` and does not use the fallback.
- Changing the selected currency only changes the displayed currency symbol; no FX conversion takes place.
- Automated tests have not been independently run as part of this packaging review; run `npm test` before release.

---

## Generating a Secure JWT Secret

```bash
node -e "require('crypto').randomBytes(32).toString('hex')"
```

Copy the output and paste it as `JWT_SECRET=<value>` in `server/.env`. Do not reuse a secret across environments.

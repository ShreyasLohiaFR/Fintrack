# FinTrack architecture

This document describes the app as it is implemented, not a wishlist.

## 1. Overall architecture

FinTrack is a MERN app: React (Vite) talks to an Express API, which stores data in MongoDB through Mongoose.

```
Browser (React pages)
  → Axios (`/api/...`, httpOnly authentication cookie)
    → Express route + `protect` middleware
      → Controller
        → Mongoose query scoped to `req.user`
          → JSON response
            → React state
              → UI / charts
```

Two processes in development:

- API: `http://localhost:5000`
- Vite: proxies `/api` to that port so the frontend can call `/api` without CORS issues in local dev.

## 2. Frontend structure

- `src/pages` — screens: landing, login, register, dashboard, transactions, budgets, analytics
- `src/components` — layout, navbar, modal, button
- `src/context/AuthContext.jsx` — current user, login, register, logout
- `src/services` — one Axios helper per resource (`auth`, `transactions`, `budgets`, `analytics`)
- `src/utils` — currency/date formatting and category lists

There is no Redux. Auth is global; each page keeps its own list/form state.

## 3. Backend structure

- `server.js` — loads `.env` from the server folder, mounts routes, starts after Mongo connects
- `routes/` — HTTP paths
- `controllers/` — validation + database work + status codes
- `models/` — User, Transaction, Budget
- `middleware/auth.js` — JWT → `req.user`
- `middleware/errorHandler.js` — CastError, duplicate key, ValidationError
- `utils/categories.js` — allowed income/expense categories

## 4. Authentication flow

1. Register: name, email, password → bcrypt hash on the User `pre('save')` hook → JWT with `{ id: user._id }`
2. Login: look up email, `select('+password')`, `bcrypt.compare` → same JWT
3. Server sets the JWT in a `SameSite=Strict`, `httpOnly` cookie; browser JavaScript cannot access it
4. The browser sends the cookie using Axios `withCredentials`; `localStorage` caches only the non-secret user profile
5. `protect` verifies either the cookie or a bearer token for API clients, loads the user, and sets `req.user`
6. Logout clears the cookie and cached user profile; stateless JWTs remain valid until expiration unless separately revoked

Login/register 401s do **not** trigger the global “session expired” interceptor, so a wrong password is shown as a form error instead of wiping the session.

## 5. Database structure

**User:** name, email (unique), password hash (`select: false`), currency default `INR`

**Transaction:** `user` ObjectId, amount (> 0), type `income|expense`, category, description, date

**Budget:** `user` + month + year (unique together), amount. This is a **monthly spending cap**, not a per-category budget.

If `MONGODB_URI` is set, that database is used. Otherwise the server tries `mongodb://127.0.0.1:27017/fintrack`. If that is not running, it starts a file-backed MongoMemoryServer under `server/data/mongo` so accounts survive a restart.

## 6. Transaction flow

`POST /api/transactions` (protected):

1. Check required fields, type, and category
2. `Transaction.create({ user: req.user.id, ... })`
3. Return the document
4. Transactions page reloads the list

Read/update/delete always use `{ _id, user: req.user.id }`. A valid id that belongs to someone else looks like a 404.

## 7. Dashboard data flow

The dashboard does **not** total rows in the browser.

It calls:

- `GET /api/analytics/summary` — income, expenses, net, this month, savings rate, budget progress
- `GET /api/analytics/monthly` — last six months for the area chart
- `GET /api/transactions` — recent rows (first six)

## 8. Analytics calculation

MongoDB aggregation:

- Group by `type` and `$sum` amount for totals
- Filter by local month start/end for “this month”
- Distinct year+month of expenses for average monthly spend (not “divide by 12”)
- Group expenses by `category` for the pie chart and bars

Savings rate = `(income - expenses) / income * 100`, or `0` if income is 0, so the UI never shows `NaN` or `Infinity`.

## 9. Security

- Passwords hashed with bcrypt; never returned in JSON
- JWT secret and expiry come from `server/.env`
- Protected routes require a valid token
- Queries are user-scoped
- Controllers copy named fields only (not the whole `req.body`) on updates

## 10. Design decisions

- Custom CSS instead of Tailwind/MUI, so layout is visible in one stylesheet
- Recharts for graphs; the data still comes from the API
- Monthly budget (one number per month) because that matches how a student actually thinks about “don’t spend more than X this month”
- Axios services instead of `fetch` inside every page, without a generic API factory

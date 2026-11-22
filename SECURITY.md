# FinTrack security policy

FinTrack is a **portfolio and educational project**, not a regulated financial service. It stores user-entered finances and should not be trusted with bank credentials, account numbers, or other highly sensitive data.

## Report a vulnerability

Please do not publish secrets, private financial details, or exploit demonstrations in a public GitHub issue. Instead use GitHub's private vulnerability reporting feature if enabled, or contact the project owner privately using the address on their GitHub profile.

## Protections and limits

- User-specific queries, bcrypt password hashes, rate-limited login, secure HttpOnly SameSite cookies on HTTPS, MongoDB Atlas with restricted network access, and server-side request validation.
- API responses specify `Cache-Control: no-store`; production responses use Helmet security headers. Authentication tokens can also be used by external API clients.
- This project does not provide multi-factor authentication, email verification, password recovery, currency conversion, automatic backups, or compliance certifications.
- Only use synthetic/example amounts for public demonstrations. Never commit `.env` files, JWT signing keys, Atlas credentials, exported user data, or local MongoDB files.
- Use `npm audit --prefix server` and `npm audit --prefix client` to review third-party vulnerabilities. Automated dependency update PRs are configured; security advisories still require verification and testing before merging.

## Deployment

The running demo is at https://fintrack-tn0w.onrender.com. Store `MONGODB_URI` and `JWT_SECRET` exclusively as private Render environment variables. Do not include credentials in screenshots, logs, or documentation.

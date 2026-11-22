'use strict';

const { rateLimit } = require('express-rate-limit');

/**
 * Brute-force protection for credential endpoints.
 * Skipped when NODE_ENV=test so suites stay deterministic.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' }
});

/** Generous ceiling for the rest of the API — blocks scripted hammering, never normal use. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' }
});

module.exports = { authLimiter, apiLimiter };

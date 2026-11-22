'use strict';

/**
 * Calendar boundaries computed in ONE consistent timezone.
 *
 * MongoDB aggregations group dates with $year/$month using APP_TIMEZONE, so
 * every "month"/"day" boundary used by controllers must use the same zone —
 * otherwise a server whose local timezone differs from APP_TIMEZONE reports
 * different months for the same transaction depending on which endpoint
 * answered. All month/day math in the API goes through this module.
 */

const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

// hour12:false -> en-US emits "00".."23" (some ICU builds emit "24" for
// midnight; getParts normalises that below).
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

/** Wall-clock fields of `date` as they appear in TIMEZONE. */
const getParts = (date) => {
  const out = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  if (out.hour === 24) out.hour = 0;
  return out;
};

/**
 * Convert a wall-clock (year, month, day, ...) in TIMEZONE to the exact
 * instant it represents. Month is 1-based, like new Date(year, month - 1, day).
 * Two offset iterations converge for fixed-offset zones and for DST zones
 * (Asia/Kolkata has no DST, so one pass is exact there).
 */
const zonedToUtc = (year, month, day, hour = 0, minute = 0, second = 0, ms = 0) => {
  const target = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = getParts(new Date(guess));
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, ms);
    const delta = target - actual;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
};

/** First and last instant of a calendar month (month is 1-based). */
const monthBounds = (year, month) => ({
  start: zonedToUtc(year, month, 1, 0, 0, 0, 0),
  end: zonedToUtc(month === 12 ? year + 1 : year, month + 1, 0, 23, 59, 59, 999)
});

const startOfDay = (year, month, day) => zonedToUtc(year, month, day, 0, 0, 0, 0);
const endOfDay = (year, month, day) => zonedToUtc(year, month, day, 23, 59, 59, 999);
const noon = (year, month, day) => zonedToUtc(year, month, day, 12, 0, 0, 0);

/** First day of the month `offset` months away from the month containing `date`. */
const monthStartOffset = (date, offset = 0) => {
  const p = getParts(date);
  const zeroBased = p.month - 1 + offset;
  const year = p.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12;
  return zonedToUtc(year, month + 1, 1, 0, 0, 0, 0);
};

/** True for a plain date-only query/body value like "2026-05-15". */
const isDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));

module.exports = { TIMEZONE, getParts, zonedToUtc, monthBounds, startOfDay, endOfDay, noon, monthStartOffset, isDateOnly };

'use strict';

/**
 * Currencies the API accepts for a user profile. Kept deliberately small:
 * every entry must be a valid ISO 4217 code so Intl.NumberFormat can
 * format it on both the server (insights) and the client (formatters).
 */
const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD'];

const DEFAULT_CURRENCY = 'INR';

const isSupportedCurrency = (value) => SUPPORTED_CURRENCIES.includes(value);

module.exports = { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, isSupportedCurrency };

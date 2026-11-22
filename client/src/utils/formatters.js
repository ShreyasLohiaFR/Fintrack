let activeCurrency = 'INR';

/**
 * Currency shown by every formatter on the page. Set once from the logged-in
 * user's profile (AuthContext); falls back to INR before login.
 */
export const setCurrency = (code) => {
  if (code) activeCurrency = code;
};

export const getCurrency = () => activeCurrency;

export const formatCurrency = (amount) => {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `₹${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

export const formatPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0%';
  return `${number.toFixed(1)}%`;
};

/** Short axis-label money, e.g. "₹12K" / "$1.2K" — keeps charts uncluttered. */
export const formatCompact = (value) => {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeCurrency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(safe);
  } catch {
    return `₹${safe}`;
  }
};

export const toDateInputValue = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayInputValue = () => toDateInputValue(new Date());

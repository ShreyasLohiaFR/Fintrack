const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Scholarship',
  'Gift',
  'Investment',
  'Other'
];

const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Education',
  'Shopping',
  'Entertainment',
  'Bills',
  'Health',
  'Rent',
  'Other'
];

const isValidCategory = (type, category) => {
  if (type === 'income') return INCOME_CATEGORIES.includes(category);
  if (type === 'expense') return EXPENSE_CATEGORIES.includes(category);
  return false;
};

module.exports = {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  isValidCategory
};

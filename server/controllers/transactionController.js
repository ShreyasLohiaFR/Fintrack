const Transaction = require('../models/Transaction');
const { isValidCategory } = require('../utils/categories');
const { getParts, startOfDay, endOfDay, noon, isDateOnly } = require('../utils/timezone');

const ownedTransactionQuery = (req) => ({
  _id: req.params.id,
  user: req.user.id
});

const parseInputDate = (value) => {
  if (!value) return undefined;
  if (isDateOnly(value)) {
    const [year, month, day] = value.split('-').map(Number);
    // Noon in APP_TIMEZONE keeps the stored instant inside the intended
    // calendar day no matter which timezone the server process runs in.
    const date = noon(year, month, day);
    const p = getParts(date);
    if (p.year !== year || p.month !== month || p.day !== day) {
      return undefined; // out-of-range components (e.g. 2026-02-30) do not exist
    }
    return date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

// Parse a query-string date filter. Returns undefined for malformed values,
// including ISO dates with out-of-range components (e.g. 2026-02-30).
const parseFilterDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
      return undefined;
    }
  }
  return date;
};

// Escape regex metacharacters so user-provided search text is matched literally.
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORT_OPTIONS = ['date', '-date', 'amount', '-amount'];

exports.getTransactions = async (req, res, next) => {
  try {
    const { type, category, startDate, endDate, sort = '-date', search, page, limit } = req.query;
    const query = { user: req.user.id };
    const sortBy = SORT_OPTIONS.includes(sort) ? sort : '-date';

    // Reject repeated or structured query parameters before building Mongo filters.
    if ([type, category, startDate, endDate, sort, search, page, limit].some(
      value => value !== undefined && typeof value !== 'string'
    )) {
      return res.status(400).json({ success: false, message: 'Filters must be single text values' });
    }

    if (type) query.type = type;
    if (category) query.category = category;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = parseFilterDate(startDate);
        if (!start) {
          return res.status(400).json({ success: false, message: 'Please provide a valid date' });
        }
        if (isDateOnly(startDate)) {
          const [y, m, d] = String(startDate).split('-').map(Number);
          query.date.$gte = startOfDay(y, m, d);
        } else {
          query.date.$gte = start;
        }
      }
      if (endDate) {
        const end = parseFilterDate(endDate);
        if (!end) {
          return res.status(400).json({ success: false, message: 'Please provide a valid date' });
        }
        if (isDateOnly(endDate)) {
          const [y, m, d] = String(endDate).split('-').map(Number);
          query.date.$lte = endOfDay(y, m, d);
        } else {
          end.setHours(23, 59, 59, 999);
          query.date.$lte = end;
        }
      }
    }

    if (search) {
      query.description = { $regex: escapeRegex(search), $options: 'i' };
    }

    // Optional pagination: ?page=&limit= keeps the original response fields
    // (success/count/data) and adds total/page/pages/totals. Without these
    // params the endpoint behaves exactly as before (all matching rows).
    const wantsPaging = page !== undefined || limit !== undefined;
    let pageNum = 1;
    let limitNum = 20;
    if (wantsPaging) {
      if (page !== undefined) pageNum = Number(page);
      if (limit !== undefined) limitNum = Number(limit);
      if (!Number.isSafeInteger(pageNum) || pageNum < 1 || !Number.isSafeInteger((pageNum - 1) * limitNum)) {
        return res.status(400).json({ success: false, message: 'Page must be a positive integer' });
      }
      if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 1000) {
        return res.status(400).json({ success: false, message: 'Limit must be between 1 and 1000' });
      }
    }

    if (wantsPaging) {
      const [rows, total, typeTotals] = await Promise.all([
        Transaction.find(query).sort(sortBy).skip((pageNum - 1) * limitNum).limit(limitNum),
        Transaction.countDocuments(query),
        Transaction.aggregate([
          { $match: { ...query, user: req.user._id } },
          { $group: { _id: '$type', total: { $sum: '$amount' } } }
        ])
      ]);
      const incomeRow = typeTotals.find((row) => row._id === 'income');
      const expenseRow = typeTotals.find((row) => row._id === 'expense');
      return res.status(200).json({
        success: true,
        count: rows.length,
        total,
        page: pageNum,
        pages: Math.max(1, Math.ceil(total / limitNum)),
        totals: {
          income: incomeRow ? incomeRow.total : 0,
          expense: expenseRow ? expenseRow.total : 0
        },
        data: rows
      });
    }

    const transactions = await Transaction.find(query).sort(sortBy);

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne(ownedTransactionQuery(req));

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

exports.addTransaction = async (req, res, next) => {
  try {
    const { amount, type, category, description, date, notes } = req.body;
    const parsedAmount = Number(amount);

    if (!type || !category || !description || !Number.isFinite(parsedAmount)) {
      return res.status(400).json({ success: false, message: 'Amount, type, category, and description are required' });
    }

    if (typeof description !== 'string') {
      return res.status(400).json({ success: false, message: 'Description must be text' });
    }

    if (parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be income or expense' });
    }

    if (!isValidCategory(type, category)) {
      return res.status(400).json({ success: false, message: 'Invalid category for this transaction type' });
    }

    const parsedDate = date ? parseInputDate(date) : undefined;
    if (date && !parsedDate) {
      return res.status(400).json({ success: false, message: 'Please provide a valid date' });
    }

    const transaction = await Transaction.create({
      user: req.user.id,
      amount: parsedAmount,
      type,
      category,
      description: description.trim(),
      date: parsedDate,
      notes
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

exports.updateTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne(ownedTransactionQuery(req));

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const { amount, type, category, description, date, notes } = req.body;
    const nextType = type || transaction.type;
    const nextCategory = category || transaction.category;

    if (type && !['income', 'expense'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be income or expense' });
    }

    if ((type || category) && !isValidCategory(nextType, nextCategory)) {
      return res.status(400).json({ success: false, message: 'Invalid category for this transaction type' });
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
      }
      transaction.amount = parsedAmount;
    }
    if (type) transaction.type = type;
    if (category) transaction.category = category;
    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Description must be text' });
      }
      transaction.description = description.trim();
    }
    if (date) {
      const parsedDate = parseInputDate(date);
      if (!parsedDate) {
        return res.status(400).json({ success: false, message: 'Please provide a valid date' });
      }
      transaction.date = parsedDate;
    }
    if (notes !== undefined) transaction.notes = notes;

    await transaction.save();

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

exports.deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne(ownedTransactionQuery(req));

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    await transaction.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

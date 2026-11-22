const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const { TIMEZONE, monthBounds } = require('../utils/timezone');

const spentInMonth = async (userId, year, month) => {
  const { start, end } = monthBounds(year, month);
  const expenses = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        type: 'expense',
        date: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$amount' }
      }
    }
  ]);

  return expenses.length > 0 ? expenses[0].totalSpent : 0;
};

const withProgress = (budget, spent) => {
  const percentageUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  return {
    _id: budget._id,
    month: budget.month,
    year: budget.year,
    amount: budget.amount,
    spent,
    remaining: budget.amount - spent,
    percentageUsed: Number.isFinite(percentageUsed) ? percentageUsed : 0
  };
};

exports.getBudgets = async (req, res, next) => {
  try {
    const budgets = await Budget.find({ user: req.user.id }).sort('-year -month');

    // One aggregation over the covered month range instead of a query per
    // budget (the list used to run N+1 queries).
    let spentByMonth = new Map();
    if (budgets.length > 0) {
      const latest = budgets[0];
      const earliest = budgets[budgets.length - 1];
      const { start: rangeStart } = monthBounds(earliest.year, earliest.month);
      const { end: rangeEnd } = monthBounds(latest.year, latest.month);

      const rows = await Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'expense',
            date: { $gte: rangeStart, $lte: rangeEnd }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: { date: '$date', timezone: TIMEZONE } },
              month: { $month: { date: '$date', timezone: TIMEZONE } }
            },
            total: { $sum: '$amount' }
          }
        }
      ]);

      spentByMonth = new Map(rows.map((row) => [`${row._id.year}-${row._id.month}`, row.total]));
    }

    const budgetsWithSpent = budgets.map((budget) =>
      withProgress(budget, spentByMonth.get(`${budget.year}-${budget.month}`) || 0)
    );

    res.status(200).json({ success: true, data: budgetsWithSpent });
  } catch (error) {
    next(error);
  }
};

exports.createBudget = async (req, res, next) => {
  try {
    const month = Number(req.body.month);
    const year = Number(req.body.year);
    const amount = Number(req.body.amount);

    if (!month || !year || !amount) {
      return res.status(400).json({ success: false, message: 'Month, year, and amount are required' });
    }

    if (!Number.isInteger(month)) {
      return res.status(400).json({ success: false, message: 'Month must be an integer' });
    }

    if (!Number.isInteger(year) || Number.isNaN(new Date(year, 0, 1).getTime())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid year' });
    }

    if (!Number.isFinite(amount)) {
      return res.status(400).json({ success: false, message: 'Budget amount must be a finite number' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Month must be between 1 and 12' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Budget amount must be greater than zero' });
    }

    let budget = await Budget.findOne({ user: req.user.id, month, year });

    if (budget) {
      budget.amount = amount;
      await budget.save();
    } else {
      budget = await Budget.create({
        user: req.user.id,
        month,
        year,
        amount
      });
    }

    const spent = await spentInMonth(req.user._id, year, month);
    res.status(200).json({ success: true, data: withProgress(budget, spent) });
  } catch (error) {
    next(error);
  }
};

exports.deleteBudget = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!budget) {
      return res.status(404).json({ success: false, message: 'Budget not found' });
    }

    await budget.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

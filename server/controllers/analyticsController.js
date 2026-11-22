const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { TIMEZONE, getParts, monthBounds, monthStartOffset } = require('../utils/timezone');

const sumByType = (totals, type) => {
  const match = totals.find((row) => row._id === type);
  return match ? match.total : 0;
};

const percent = (part, whole) => {
  if (!whole) return 0;
  const value = (part / whole) * 100;
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
};

const buildInsights = ({
  monthIncome,
  monthExpenses,
  monthCashFlow,
  spentChange,
  topCategoryRow,
  budgetProgress,
  daysLeftInMonth,
  currency
}) => {
  const insights = [];

  if (monthIncome === 0 && monthExpenses === 0) {
    insights.push({
      tone: 'info',
      text: 'No transactions this month yet. Add income or an expense to see charts fill in.'
    });
    return insights;
  }

  if (monthCashFlow < 0) {
    insights.push({
      tone: 'warn',
      text: `This month is in the red by ${formatAmount(Math.abs(monthCashFlow), currency)}. Expenses are higher than income.`
    });
  } else if (monthIncome > 0) {
    insights.push({
      tone: 'ok',
      text: `You kept ${percent(monthCashFlow, monthIncome)}% of this month's income.`
    });
  }

  if (topCategoryRow) {
    insights.push({
      tone: 'info',
      text: `${topCategoryRow._id} is the largest expense category this month (${formatAmount(topCategoryRow.total, currency)}).`
    });
  }

  if (spentChange !== null && spentChange > 10) {
    insights.push({
      tone: 'warn',
      text: `Spending is up ${spentChange.toFixed(1)}% compared with last month.`
    });
  } else if (spentChange !== null && spentChange < -10) {
    insights.push({
      tone: 'ok',
      text: `Spending is down ${Math.abs(spentChange).toFixed(1)}% compared with last month.`
    });
  }

  if (!budgetProgress) {
    insights.push({
      tone: 'info',
      text: 'No monthly budget is set. Add one on the Budgets page to track a spending cap.'
    });
  } else if (budgetProgress.percentage > 100) {
    insights.push({
      tone: 'warn',
      text: `You are over this month's budget by ${formatAmount(budgetProgress.spent - budgetProgress.amount, currency)}.`
    });
  } else {
    insights.push({
      tone: 'ok',
      text: `${formatAmount(budgetProgress.remaining, currency)} left for ${daysLeftInMonth} days (about ${formatAmount(budgetProgress.dailySpendAllowed, currency)} / day).`
    });
  }

  return insights.slice(0, 4);
};

const formatAmount = (value, currency = 'INR') => {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safe);
};

exports.getSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const nowParts = getParts(now);
    const { start: startOfMonth, end: endOfMonth } = monthBounds(nowParts.year, nowParts.month);
    const lastMonthParts = getParts(monthStartOffset(now, -1));
    const { start: startOfLastMonth, end: endOfLastMonth } = monthBounds(
      lastMonthParts.year,
      lastMonthParts.month
    );

    const [totals, monthTotals, lastMonthTotals, monthsWithExpenses, topCategory, topExpenses, incomeCategories] = await Promise.all([
      Transaction.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { user: userId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { user: userId, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { user: userId, type: 'expense' } },
        {
          $group: {
            _id: {
              year: { $year: { date: '$date', timezone: TIMEZONE } },
              month: { $month: { date: '$date', timezone: TIMEZONE } }
            }
          }
        }
      ]),
      Transaction.aggregate([
        { $match: { user: userId, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 1 }
      ]),
      Transaction.find({
        user: userId,
        type: 'expense',
        date: { $gte: startOfMonth, $lte: endOfMonth }
      })
        .sort('-amount')
        .limit(5)
        .select('description amount category date'),
      Transaction.aggregate([
        { $match: { user: userId, type: 'income', date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ])
    ]);

    const totalIncome = sumByType(totals, 'income');
    const totalExpenses = sumByType(totals, 'expense');
    const monthIncome = sumByType(monthTotals, 'income');
    const monthExpenses = sumByType(monthTotals, 'expense');
    const lastMonthExpenses = sumByType(lastMonthTotals, 'expense');
    const monthCount = monthsWithExpenses.length || 1;
    const avgMonthlySpend = totalExpenses / monthCount;

    const currentBudget = await Budget.findOne({
      user: userId,
      month: nowParts.month,
      year: nowParts.year
    });

    const daysInMonth = getParts(endOfMonth).day;
    const daysLeftInMonth = daysInMonth - nowParts.day + 1;
    const monthCashFlow = monthIncome - monthExpenses;
    const spentChange = lastMonthExpenses > 0
      ? percent(monthExpenses - lastMonthExpenses, lastMonthExpenses)
      : null;

    const budgetProgress = currentBudget
      ? {
          amount: currentBudget.amount,
          spent: monthExpenses,
          remaining: currentBudget.amount - monthExpenses,
          percentage: percent(monthExpenses, currentBudget.amount),
          dailySpendAllowed: daysLeftInMonth > 0 && currentBudget.amount - monthExpenses > 0
            ? (currentBudget.amount - monthExpenses) / daysLeftInMonth
            : 0
        }
      : null;

    res.status(200).json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        monthIncome,
        monthExpenses,
        monthCashFlow,
        lastMonthExpenses,
        expenseChangePercent: spentChange,
        avgMonthlySpend: Number.isFinite(avgMonthlySpend) ? avgMonthlySpend : 0,
        savingsRate: percent(totalIncome - totalExpenses, totalIncome),
        monthSavingsRate: percent(monthIncome - monthExpenses, monthIncome),
        topCategory: topCategory[0] ? topCategory[0]._id : null,
        daysLeftInMonth,
        budgetProgress,
        topExpenses,
        incomeByCategory: incomeCategories,
        insights: buildInsights({
          monthIncome,
          monthExpenses,
          monthCashFlow,
          spentChange,
          topCategoryRow: topCategory[0],
          budgetProgress,
          daysLeftInMonth,
          currency: req.user.currency
        })
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const { month, year, type = 'expense' } = req.query;
    const transactionType = type === 'income' ? 'income' : 'expense';
    const match = { user: req.user._id, type: transactionType };

    if ((month && !year) || (!month && year)) {
      return res.status(400).json({ success: false, message: 'Both month and year are required together' });
    }

    if (month && year) {
      const monthNumber = Number(month);
      const yearNumber = Number(year);
      if (!Number.isInteger(monthNumber)) {
        return res.status(400).json({ success: false, message: 'Month must be an integer' });
      }
      if (monthNumber < 1 || monthNumber > 12) {
        return res.status(400).json({ success: false, message: 'Month must be between 1 and 12' });
      }
      if (!Number.isInteger(yearNumber) || Number.isNaN(new Date(yearNumber, 0, 1).getTime())) {
        return res.status(400).json({ success: false, message: 'Please provide a valid year' });
      }
      const { start, end } = monthBounds(yearNumber, monthNumber);
      match.date = { $gte: start, $lte: end };
    }

    const categories = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

exports.getMonthly = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const sixMonthsAgo = monthStartOffset(now, -5);

    const trends = await Transaction.aggregate([
      { $match: { user: userId, date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: { date: '$date', timezone: TIMEZONE } },
            month: { $month: { date: '$date', timezone: TIMEZONE } },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthlyRows = {};

    for (let i = 5; i >= 0; i--) {
      const monthStartParts = getParts(monthStartOffset(now, -i));
      const key = `${monthStartParts.year}-${monthStartParts.month}`;
      monthlyRows[key] = {
        month: new Date(Date.UTC(monthStartParts.year, monthStartParts.month - 1, 1))
          .toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }),
        year: monthStartParts.year,
        income: 0,
        expense: 0,
        net: 0
      };
    }

    trends.forEach((row) => {
      const key = `${row._id.year}-${row._id.month}`;
      if (monthlyRows[key]) {
        monthlyRows[key][row._id.type] = row.total;
      }
    });

    const monthly = Object.values(monthlyRows).map((row) => ({
      ...row,
      net: row.income - row.expense
    }));

    res.status(200).json({ success: true, data: monthly });
  } catch (error) {
    next(error);
  }
};

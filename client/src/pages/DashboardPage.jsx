import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { getSummary, getMonthlyTrend, getCategoryBreakdown } from '../services/analyticsService';
import { getTransactions } from '../services/transactionService';
import { formatCurrency, formatDate, formatPercent, formatCompact } from '../utils/formatters';
import { apiErrorMessage } from '../utils/apiError';

const PIE_COLORS = ['#1e6f54', '#a4660b', '#b3402c', '#52796f', '#8c5a3b', '#c98a2e'];

const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const now = new Date();
        const [summaryResponse, monthlyResponse, categoryResponse, transactionsResponse] = await Promise.all([
          getSummary(),
          getMonthlyTrend(),
          getCategoryBreakdown(now.getMonth() + 1, now.getFullYear()),
          getTransactions({ sort: '-date', page: 1, limit: 6 })
        ]);
        setSummary(summaryResponse.data);
        setMonthly(monthlyResponse.data);
        setCategories(categoryResponse.data);
        setRecentTransactions(transactionsResponse.data.slice(0, 6));
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load the dashboard.'));
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) return <p className="muted">Loading dashboard...</p>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const budget = summary.budgetProgress;
  const budgetWidth = budget ? Math.min(budget.percentage, 100) : 0;
  const budgetColor = !budget
    ? 'var(--teal)'
    : budget.percentage > 100
      ? 'var(--expense)'
      : budget.percentage > 80
        ? 'var(--warn)'
        : 'var(--income)';
  const pieData = categories.map((row) => ({ name: row._id, value: row.total }));
  const incomeBars = (summary.incomeByCategory || []).map((row) => ({
    name: row._id,
    total: row.total
  }));
  const spentChange = summary.expenseChangePercent;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Numbers below are calculated from your saved transactions.</p>
        </div>
        <Link to="/transactions" className="btn btn-primary">Add transaction</Link>
      </div>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-label">Net balance</div>
          <div className="stat-value">{formatCurrency(summary.netBalance)}</div>
          <p className="stat-hint">All-time income minus expenses</p>
        </div>
        <div className="card">
          <div className="stat-label">This month cash flow</div>
          <div className={`stat-value ${summary.monthCashFlow >= 0 ? 'income' : 'expense'}`}>
            {formatCurrency(summary.monthCashFlow)}
          </div>
          <p className="stat-hint">
            {formatCurrency(summary.monthIncome)} in · {formatCurrency(summary.monthExpenses)} out
          </p>
        </div>
        <div className="card">
          <div className="stat-label">Savings rate</div>
          <div className="stat-value">{formatPercent(summary.savingsRate)}</div>
          <p className="stat-hint">Share of all-time income not spent</p>
        </div>
        <div className="card">
          <div className="stat-label">Spend vs last month</div>
          <div className="stat-value">
            {spentChange === null ? '—' : formatPercent(spentChange)}
          </div>
          <p className="stat-hint">
            {spentChange === null ? 'No expenses last month to compare' : 'Positive means you spent more'}
          </p>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <h2>Income vs expenses</h2>
          <p className="muted chart-caption">Last six months</p>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd2" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#7e7668', fontSize: 12 }} />
                <YAxis tickFormatter={formatCompact} width={68} tickLine={false} axisLine={false} tick={{ fill: '#7e7668', fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ background: '#fffdf9', border: '1px solid #e7e0d2', borderRadius: 10, fontSize: 13 }}
                />
                <Area type="monotone" dataKey="income" name="Income" stroke="#1a7f4f" fill="#e6f4ea" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Expenses" stroke="#b3402c" fill="#fbeae4" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2>This month by category</h2>
          {pieData.length === 0 ? (
            <div className="empty">Add an expense this month to see the breakdown.</div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={86} paddingAngle={2}>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="split" style={{ marginTop: '0.9rem' }}>
        <div className="card">
          <h2>What stands out</h2>
          <div className="insight-list" style={{ marginTop: '0.85rem' }}>
            {(summary.insights || []).map((insight) => (
              <p key={insight.text} className={`insight ${insight.tone}`}>{insight.text}</p>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Income sources this month</h2>
          {incomeBars.length === 0 ? (
            <div className="empty">Add income to see salary vs freelance vs other.</div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeBars} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd2" horizontal={false} />
                  <XAxis type="number" tickFormatter={formatCompact} tickLine={false} axisLine={false} tick={{ fill: '#7e7668', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={88} tickLine={false} axisLine={false} tick={{ fill: '#4e4739', fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ background: '#fffdf9', border: '1px solid #e7e0d2', borderRadius: 10, fontSize: 13 }}
                  />
                  <Bar dataKey="total" name="Income" fill="#1e6f54" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="split" style={{ marginTop: '0.9rem' }}>
        <div className="card">
          <h2>Monthly budget</h2>
          {budget ? (
            <div className="budget-block">
              <div className="budget-meta">
                <span className="muted">Spent {formatCurrency(budget.spent)}</span>
                <span className="muted">Limit {formatCurrency(budget.amount)}</span>
              </div>
              <div className="progress">
                <span style={{ width: `${budgetWidth}%`, background: budgetColor }} />
              </div>
              <p className="budget-status">
                {budget.percentage > 100
                  ? `Over by ${formatCurrency(budget.spent - budget.amount)}`
                  : `${formatCurrency(budget.remaining)} left · ${summary.daysLeftInMonth} days remaining`}
              </p>
              {budget.percentage <= 100 && (
                <p className="muted">
                  Suggested daily spend: {formatCurrency(budget.dailySpendAllowed)}
                </p>
              )}
            </div>
          ) : (
            <div className="empty">
              No budget for this month yet.
              <div style={{ marginTop: '0.7rem' }}>
                <Link to="/budgets" className="btn btn-secondary">Set a budget</Link>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="page-head" style={{ marginBottom: '0.4rem' }}>
            <h2>Largest expenses</h2>
            <Link to="/transactions" className="text-link">View all</Link>
          </div>
          {(summary.topExpenses || []).length === 0 ? (
            <div className="empty">No expenses stored for this month.</div>
          ) : (
            <ul className="activity-list">
              {summary.topExpenses.map((transaction) => (
                <li key={transaction._id}>
                  <div>
                    <strong>{transaction.description}</strong>
                    <p className="muted">{formatDate(transaction.date)} · {transaction.category}</p>
                  </div>
                  <span className="expense">-{formatCurrency(transaction.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '0.9rem' }}>
        <div className="page-head" style={{ marginBottom: '0.4rem' }}>
          <h2>Recent activity</h2>
          <Link to="/transactions" className="text-link">View all</Link>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="empty">Add a transaction to see it here.</div>
        ) : (
          <ul className="activity-list">
            {recentTransactions.map((transaction) => (
              <li key={transaction._id}>
                <div>
                  <strong>{transaction.description}</strong>
                  <p className="muted">{formatDate(transaction.date)} · {transaction.category}</p>
                </div>
                <span className={transaction.type === 'income' ? 'income' : 'expense'}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

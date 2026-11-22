import { useEffect, useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getSummary, getCategoryBreakdown, getMonthlyTrend } from '../services/analyticsService';
import { formatCurrency, formatPercent, formatCompact } from '../utils/formatters';
import { MONTHS } from '../utils/constants';
import { apiErrorMessage } from '../utils/apiError';

const PIE_COLORS = ['#1e6f54', '#a4660b', '#b3402c', '#52796f', '#8c5a72', '#c98a2e', '#7c8a72', '#3f4a3f'];

const AnalyticsPage = () => {
  const now = new Date();
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const [summaryResponse, categoryResponse, monthlyResponse] = await Promise.all([
          getSummary(),
          getCategoryBreakdown(month, year),
          getMonthlyTrend()
        ]);
        setSummary(summaryResponse.data);
        setCategories(categoryResponse.data);
        setMonthly(monthlyResponse.data);
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load analytics.'));
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [month, year]);

  if (loading && !summary) return <p className="muted">Loading analytics...</p>;
  if (error && !summary) return <div className="alert alert-error">{error}</div>;

  const monthExpenseTotal = categories.reduce((sum, row) => sum + row.total, 0);
  const pieData = categories.map((row) => ({ name: row._id, value: row.total }));
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="muted">Month filter applies to the pie and the category list. The six-month chart is always the last six months.</p>
        </div>
        <div className="page-head-actions">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((label, index) => (
              <option key={label} value={index + 1}>{label}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {summary && (
        <div className="stat-grid">
          <div className="card stat-card">
            <div className="stat-label">All-time savings rate</div>
            <div className="stat-value">{formatPercent(summary.savingsRate)}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">This month savings rate</div>
            <div className="stat-value">{formatPercent(summary.monthSavingsRate)}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Avg monthly spend</div>
            <div className="stat-value">{formatCurrency(summary.avgMonthlySpend)}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Top category this month</div>
            <div className="stat-value stat-value-sm">{summary.topCategory || '—'}</div>
          </div>
        </div>
      )}

      <div className="split">
        <div className="card">
          <h2>Six-month trend</h2>
          <p className="muted chart-caption">Bars are income and expenses. The line is net cash flow.</p>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd2" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#7e7668', fontSize: 12 }} />
                <YAxis tickFormatter={formatCompact} width={72} tickLine={false} axisLine={false} tick={{ fill: '#7e7668', fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ background: '#fffdf9', border: '1px solid #e7e0d2', borderRadius: 10, fontSize: 13 }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#1a7f4f" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#b3402c" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="net" name="Net" stroke="#1e6f54" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2>{MONTHS[month - 1]} by category</h2>
          {pieData.length === 0 ? (
            <div className="empty">No expenses in this month.</div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
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

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2>Category breakdown</h2>
        {categories.length === 0 ? (
          <div className="empty">No expense data to group yet.</div>
        ) : (
          <div className="breakdown-list">
            {categories.map((category) => {
              const share = monthExpenseTotal > 0 ? (category.total / monthExpenseTotal) * 100 : 0;
              return (
                <div key={category._id}>
                  <div className="budget-meta">
                    <strong>{category._id}</strong>
                    <span className="muted">{formatCurrency(category.total)} · {formatPercent(share)}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${share}%`, background: 'var(--teal)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;

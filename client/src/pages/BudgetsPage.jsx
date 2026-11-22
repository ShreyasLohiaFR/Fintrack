import { useEffect, useState } from 'react';
import { getBudgets, createOrUpdateBudget, deleteBudget } from '../services/budgetService';
import { formatCurrency, formatPercent, getCurrency } from '../utils/formatters';
import { MONTHS } from '../utils/constants';
import { apiErrorMessage } from '../utils/apiError';
import Button from '../components/common/Button';

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const BudgetsPage = () => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    month: currentMonth,
    year: currentYear,
    amount: ''
  });

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const response = await getBudgets();
      setBudgets(response.data || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load budgets.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createOrUpdateBudget({
        month: Number(form.month),
        year: Number(form.year),
        amount: Number(form.amount)
      });
      setForm((prev) => ({ ...prev, amount: '' }));
      loadBudgets();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the budget.'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this monthly budget?')) return;
    try {
      await deleteBudget(id);
      loadBudgets();
    } catch (err) {
      setError('Could not delete the budget.');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Monthly budgets</h1>
          <p className="muted">One spending limit per month. Progress uses actual expenses in that month.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>Set or update a limit</h2>
        <form onSubmit={handleSubmit} className="filters" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <select name="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
            {MONTHS.map((label, index) => (
              <option key={label} value={index + 1}>{label}</option>
            ))}
          </select>
          <input
            type="number"
            name="year"
            value={form.year}
            min="2020"
            onChange={(e) => setForm({ ...form, year: e.target.value })}
          />
          <input
            type="number"
            name="amount"
            min="1"
            step="1"
            placeholder={`Amount in ${getCurrency()}`}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <Button type="submit">Save budget</Button>
        </form>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="muted">Loading budgets...</p>
      ) : budgets.length === 0 ? (
        <div className="card empty">No budgets yet. Set this month’s limit above.</div>
      ) : (
        <div className="split">
          {budgets.map((budget) => {
            const over = budget.percentageUsed > 100;
            const barColor = over ? 'var(--expense)' : budget.percentageUsed > 80 ? 'var(--warn)' : 'var(--income)';
            return (
              <div key={budget._id} className="card">
                <div className="page-head">
                  <h3>{MONTHS[budget.month - 1]} {budget.year}</h3>
                  <Button variant="ghost" onClick={() => handleDelete(budget._id)}>Delete</Button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span className="muted">Spent {formatCurrency(budget.spent)}</span>
                  <span className="muted">Limit {formatCurrency(budget.amount)}</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${Math.min(budget.percentageUsed, 100)}%`, background: barColor }} />
                </div>
                <p style={{ marginTop: '0.8rem', fontWeight: 700 }}>
                  {over
                    ? `Over by ${formatCurrency(budget.spent - budget.amount)}`
                    : `${formatCurrency(budget.remaining)} remaining · ${formatPercent(budget.percentageUsed)} used`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BudgetsPage;

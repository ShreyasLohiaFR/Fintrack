import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from '../services/transactionService';
import { formatCurrency, formatDate, toDateInputValue, todayInputValue, getCurrency } from '../utils/formatters';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../utils/constants';
import { apiErrorMessage } from '../utils/apiError';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';

const emptyForm = () => ({
  type: 'expense',
  amount: '',
  category: '',
  description: '',
  date: todayInputValue(),
  notes: ''
});

const PAGE_SIZE = 10;

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const response = await getTransactions({ ...filters, page, limit: PAGE_SIZE });
      setTransactions(response.data);
      setTotal(response.total ?? response.data.length);
      setPages(response.pages ?? 1);
      setTotals(response.totals ?? { income: 0, expense: 0 });
      setError('');
      // Deleting the last row of the last page would strand us on an empty
      // page — step back to the new final page (triggers one reload).
      if (response.total !== undefined && page > response.pages) {
        setPage(response.pages);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load transactions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.category, filters.startDate, filters.endDate, page]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setPage(1);
    setFilters((prev) => ({ ...prev, [name]: value, ...(name === 'type' ? { category: '' } : {}) }));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (page !== 1) {
      setPage(1); // effect reloads with the new search text
    } else {
      loadTransactions();
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (transaction) => {
    setEditingId(transaction._id);
    setFormData({
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      date: toDateInputValue(transaction.date),
      notes: transaction.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'type' ? { category: '' } : {})
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const payload = { ...formData, amount: Number(formData.amount) };

    try {
      if (editingId) {
        await updateTransaction(editingId, payload);
      } else {
        await addTransaction(payload);
      }
      setIsModalOpen(false);
      loadTransactions();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the transaction.'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await deleteTransaction(id);
      loadTransactions();
    } catch {
      setError('Could not delete the transaction.');
    }
  };

  const exportCsv = async () => {
    try {
      // Export every filtered row (all pages), not just the visible page.
      let all = [];
      let current = 1;
      let lastPage = 1;
      do {
        const response = await getTransactions({ ...filters, page: current, limit: 1000 });
        all = all.concat(response.data);
        lastPage = response.pages;
        current += 1;
      } while (current <= lastPage);

      const wrap = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const header = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Notes'];
      const rows = all.map((transaction) => [
        formatDate(transaction.date),
        transaction.type,
        transaction.category,
      wrap(transaction.description),
      transaction.amount,
      wrap(transaction.notes || '')
    ]);
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fintrack-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not export transactions.'));
    }
  };

  const categories = formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const filterCategories = filters.type === 'income'
    ? INCOME_CATEGORIES
    : filters.type === 'expense'
      ? EXPENSE_CATEGORIES
      : [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p className="muted">These rows are stored against your user id. Totals below follow the current filters.</p>
        </div>
        <div className="page-head-actions">
          {transactions.length > 0 && (
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          )}
          <Button onClick={openCreate}><Plus size={16} /> Add transaction</Button>
        </div>
      </div>

      <form className="filters card" onSubmit={handleSearchSubmit}>
        <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search description" />
        <select name="type" value={filters.type} onChange={handleFilterChange}>
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select name="category" value={filters.category} onChange={handleFilterChange}>
          <option value="">All categories</option>
          {[...new Set(filterCategories)].map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <div className="card">
        {error && <div className="alert alert-error">{error}</div>}
        {!loading && transactions.length > 0 && (
          <div className="totals-row">
            <span>Income <strong className="income">{formatCurrency(totals.income)}</strong></span>
            <span>Expenses <strong className="expense">{formatCurrency(totals.expense)}</strong></span>
            <span>Net <strong>{formatCurrency(totals.income - totals.expense)}</strong></span>
            <span className="muted">{total} rows</span>
          </div>
        )}
        {loading ? (
          <div className="empty">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="empty">No transactions match these filters.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction._id}>
                    <td>{formatDate(transaction.date)}</td>
                    <td>{transaction.description}</td>
                    <td>
                      <span className={`badge ${transaction.type === 'income' ? 'badge-income' : 'badge-expense'}`}>
                        {transaction.category}
                      </span>
                    </td>
                    <td className={transaction.type === 'income' ? 'income' : 'expense'}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => openEdit(transaction)} aria-label="Edit">
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn" onClick={() => handleDelete(transaction._id)} aria-label="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && pages > 1 && (
          <div className="pagination">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="pagination-status">Page {page} of {pages}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit transaction' : 'Add transaction'}
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="radio-row">
            <label>
              <input type="radio" name="type" value="expense" checked={formData.type === 'expense'} onChange={handleInputChange} /> Expense
            </label>
            <label>
              <input type="radio" name="type" value="income" checked={formData.type === 'income'} onChange={handleInputChange} /> Income
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Amount ({getCurrency()})</label>
            <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} min="0.01" step="0.01" required />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select name="category" value={formData.category} onChange={handleInputChange} required>
              <option value="" disabled>Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input type="text" name="description" value={formData.description} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input type="text" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="UPI, cash, split with roommate..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TransactionsPage;

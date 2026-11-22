import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, PiggyBank, PieChart, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SUPPORTED_CURRENCIES } from '../../utils/constants';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/analytics', label: 'Analytics', icon: PieChart },
];

const AppLayout = () => {
  const { user, logout, updateCurrency } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCurrencyChange = async (event) => {
    try {
      await updateCurrency(event.target.value);
    } catch {
      // keep the previous currency on failure (server rejected it)
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">FinTrack</div>
        <p className="sidebar-tagline">Income, spend, budget.</p>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <p className="sidebar-name">{user.name}</p>
          <p className="sidebar-email">{user.email}</p>
          <label className="sidebar-currency">
            <span>Currency</span>
            <select value={user.currency || 'INR'} onChange={handleCurrencyChange}>
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div>
        <nav className="mobile-nav">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to}>{label}</NavLink>
          ))}
          <button onClick={handleLogout}>Log out</button>
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

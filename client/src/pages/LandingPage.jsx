import { Link } from 'react-router-dom';
import { BarChart3, PiggyBank, ShieldCheck, Wallet } from 'lucide-react';
import Navbar from '../components/common/Navbar';

const features = [
  {
    icon: Wallet,
    title: 'Income and expenses',
    text: 'Log payments with a category and date. Filter by type, month, or description.'
  },
  {
    icon: PiggyBank,
    title: 'Monthly budget',
    text: 'Set one spending cap per month. The bar uses real expense totals from MongoDB.'
  },
  {
    icon: BarChart3,
    title: 'Charts and insights',
    text: 'Category pie, six-month cash flow, and a few sentences about what changed.'
  },
  {
    icon: ShieldCheck,
    title: 'Account-scoped data',
    text: 'Passwords are hashed with bcrypt. Each query includes the logged-in user id.'
  }
];

const LandingPage = () => {
  return (
    <div className="landing">
      <Navbar />
      <section className="page hero">
        <div>
          <p className="eyebrow">Personal finance tracker</p>
          <h1>Know where the month <em>actually</em> went.</h1>
          <p>
            FinTrack is a MERN app for income, expenses, a monthly budget, and analytics.
            Create an account, add transactions, and the dashboard totals come from your own data.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary">Create account</Link>
            <Link to="/login" className="btn btn-secondary">Log in</Link>
          </div>
        </div>
        <div className="hero-panel">
          <div>
            <p className="hero-panel-note">Dashboard preview</p>
            <h2 className="hero-panel-title">Balance, cash flow, and category spend on one screen.</h2>
          </div>
          <div className="hero-preview">
            <div className="hero-stat">
              <span>Net balance</span>
              <strong>Income − expenses</strong>
            </div>
            <div className="hero-stat">
              <span>This month</span>
              <strong>Live MongoDB totals</strong>
            </div>
            <div className="hero-bars" aria-hidden="true">
              <span style={{ height: '62%' }} />
              <span style={{ height: '40%' }} />
              <span style={{ height: '78%' }} />
              <span style={{ height: '52%' }} />
              <span style={{ height: '70%' }} />
              <span style={{ height: '46%' }} />
            </div>
          </div>
        </div>
      </section>

      <section className="page feature-grid">
        {features.map(({ icon: Icon, title, text }) => (
          <article key={title} className="card feature-card">
            <div className="feature-icon"><Icon size={18} /></div>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </article>
        ))}
      </section>

      <section className="page how-it-works">
        <h2>How a transaction reaches the dashboard</h2>
        <ol>
          <li>You submit the form on the Transactions page.</li>
          <li>Express checks amount, type, and category, then stores a document with your user id.</li>
          <li>Analytics routes run MongoDB aggregations for totals and monthly trends.</li>
          <li>The dashboard refetches that data after you save.</li>
        </ol>
      </section>
    </div>
  );
};

export default LandingPage;

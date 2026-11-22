import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import { apiErrorMessage } from '../utils/apiError';

const RegisterPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the account.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <Link to="/" className="brand">FinTrack</Link>
        <div>
          <h2 className="auth-side-title">One account. Your ledger stays private.</h2>
          <p className="auth-side-copy">We hash the password with bcrypt and never send it back in API responses.</p>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <h1>Create account</h1>
          <p className="muted auth-lead">Name, email, and a password of at least 6 characters.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Name</label>
              <input id="name" type="text" name="name" value={formData.name} onChange={handleChange} required autoComplete="name" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} required minLength={6} autoComplete="new-password" />
            </div>
            <Button type="submit" loading={isLoading} style={{ width: '100%' }}>Sign up</Button>
          </form>
          <p className="muted auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

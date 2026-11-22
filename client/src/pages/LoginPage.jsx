import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import { apiErrorMessage } from '../utils/apiError';

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not log in.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <Link to="/" className="brand">FinTrack</Link>
        <div>
          <h2 className="auth-side-title">Welcome back.</h2>
          <p className="auth-side-copy">Your JWT is sent on each request. Queries are scoped to this user id.</p>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <h1>Log in</h1>
          <p className="muted auth-lead">Use the email you registered with.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} required autoComplete="current-password" />
            </div>
            <Button type="submit" loading={isLoading} style={{ width: '100%' }}>Log in</Button>
          </form>
          <p className="muted auth-switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

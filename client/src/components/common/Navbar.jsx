import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { user } = useAuth();

  return (
    <header className="page public-nav">
      <Link to="/" className="brand">FinTrack</Link>
      <div className="nav-links">
        {user ? (
          <Link to="/dashboard" className="btn btn-primary">Open app</Link>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="btn btn-primary">Create account</Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;

import { createContext, useContext, useState, useEffect } from 'react';
import * as authService from '../services/authService';
import { setCurrency } from '../utils/formatters';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

// Persist (or clear) the cached profile and point every money formatter at
// the user's currency. The session itself lives in an httpOnly cookie that
// JavaScript cannot read.
const applyUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
    setCurrency(user.currency || 'INR');
  } else {
    localStorage.removeItem('user');
    setCurrency('INR');
  }
  return user;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = readStoredUser();
    if (stored) setCurrency(stored.currency || 'INR');
    return stored;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const data = await authService.getMe();
        setUser(applyUser(data.user));
      } catch (err) {
        if (err.response?.status === 401) {
          setUser(applyUser(null));
        }
        // A network hiccup keeps the cached profile instead of logging out.
      } finally {
        setLoading(false);
      }
    };

    verifySession();

    const handleUnauthorized = () => setUser(applyUser(null));
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    setUser(applyUser(data.user));
  };

  const register = async (userData) => {
    const data = await authService.register(userData);
    setUser(applyUser(data.user));
  };

  const logout = () => {
    authService.logout().catch(() => {}); // clear the httpOnly cookie (best effort)
    setUser(applyUser(null));
  };

  const updateCurrency = async (currency) => {
    const data = await authService.updateMe({ currency });
    setUser(applyUser(data.user));
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateCurrency, loading }}>
      {loading ? <div className="loading-screen">Loading FinTrack...</div> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

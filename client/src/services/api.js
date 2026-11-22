import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  // Browser sessions ride on the httpOnly auth cookie; no token in JS.
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isLoginOrRegister = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    if (error.response?.status === 401 && !isLoginOrRegister) {
      localStorage.removeItem('token'); // legacy cleanup
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    return Promise.reject(error);
  }
);

export default api;

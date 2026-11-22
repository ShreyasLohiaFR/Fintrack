import api from './api';

export const getSummary = async () => {
  const response = await api.get('/analytics/summary');
  return response.data;
};

export const getCategoryBreakdown = async (month, year, type = 'expense') => {
  const params = new URLSearchParams();
  if (month && year) {
    params.set('month', month);
    params.set('year', year);
  }
  if (type) params.set('type', type);
  const query = params.toString();
  const response = await api.get(query ? `/analytics/categories?${query}` : '/analytics/categories');
  return response.data;
};

export const getMonthlyTrend = async () => {
  const response = await api.get('/analytics/monthly');
  return response.data;
};

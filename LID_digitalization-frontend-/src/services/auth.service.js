import api from '../api/axiosClient';

const AUTH_PREFIX = '/auth';

export const login = async (email, password) => {
  const response = await api.post(`${AUTH_PREFIX}/login`, { email, password });
  return response.data;
};

export const register = async (data) => {
  const response = await api.post(`${AUTH_PREFIX}/register`, data);
  return response.data;
};

export const getMe = async () => {
  const response = await api.get(`${AUTH_PREFIX}/me`);
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await api.put(`${AUTH_PREFIX}/profile`, data);
  return response.data;
};

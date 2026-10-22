import api from '../api/axiosClient';

const USER_PREFIX = '/users';

export const getUsers = async (params = {}) => {
  const response = await api.get(USER_PREFIX, { params });
  return response.data;
};

export const createUser = async (data) => {
  const response = await api.post(USER_PREFIX, data);
  return response.data;
};

export const updateUser = async (id, data) => {
  const response = await api.put(`${USER_PREFIX}/${id}`, data);
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await api.delete(`${USER_PREFIX}/${id}`);
  return response.data;
};

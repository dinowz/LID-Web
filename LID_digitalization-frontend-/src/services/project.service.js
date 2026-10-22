import api from '../api/axiosClient';

export const getProjects = async (params = {}) => {
  const response = await api.get('/projects', { params });
  return response.data;
};

export const createProject = async (payload) => {
  const response = await api.post('/projects', payload);
  return response.data;
};

export const getProjectById = async (id) => {
  const response = await api.get(`/projects/${id}`);
  return response.data;
};

export const updateProject = async (id, data) => {
  const response = await api.put(`/projects/${id}`, data);
  return response.data;
};

export const deleteProject = async (id) => {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
};

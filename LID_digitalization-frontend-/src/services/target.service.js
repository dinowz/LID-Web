import api from '../api/axiosClient';

export const getTargets = async () => {
  const response = await api.get('/targets');
  return response.data;
};

export const getTargetByYear = async (year) => {
  const response = await api.get(`/targets/${year}`);
  return response.data;
};

export const upsertTarget = async (data) => {
  const response = await api.post('/targets', data);
  return response.data;
};

export const deleteTarget = async (id) => {
  const response = await api.delete(`/targets/${id}`);
  return response.data;
};

import api from '../api/axiosClient';

export const getServices = async (params = {}) => {
  const response = await api.get('/services', { params });
  return response.data;
};

export const getServiceById = async (id) => {
  const response = await api.get(`/services/${id}`);
  return response.data;
};

export const updateService = async (id, data) => {
  const response = await api.put(`/services/${id}`, data);
  return response.data;
};

export const deleteService = async (id) => {
  const response = await api.delete(`/services/${id}`);
  return response.data;
};

export const createServiceExecutionFromQuotation = async (quotationId) => {
  const response = await api.post(`/services/from-quotation/${quotationId}`);
  return response.data;
};

export const createServiceExecutionFromInquiry = async (inquiryId) => {
  const response = await api.post(`/services/from-inquiry/${inquiryId}`);
  return response.data;
};

export const createServiceExecution = async (payload) => {
  const response = await api.post('/services', payload);
  return response.data;
};

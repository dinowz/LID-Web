import api from '../api/axiosClient';

export const getPOs = async (filters = {}) => {
  const response = await api.get('/po', { params: filters });
  return response.data;
};

export const getPOById = async (id) => {
  const response = await api.get(`/po/${id}`);
  return response.data;
};

export const createPOFromQuotation = async (quotationId, formData) => {
  const config = formData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  const response = await api.post(`/po/from-quotation/${quotationId}`, formData, config);
  return response.data;
};

export const updatePO = async (id, data) => {
  const response = await api.put(`/po/${id}`, data);
  return response.data;
};

export const sendReminder = async (id) => {
  const response = await api.post(`/po/${id}/send-reminder`);
  return response.data;
};

export const revertPOToQuotation = async (id, reason) => {
  const response = await api.post(`/po/${id}/revert`, { reason });
  return response.data;
};

export const splitPO = async (id, data) => {
  const response = await api.post(`/po/${id}/split`, data);
  return response.data;
};

export const uploadDocument = async (id, formData) => {
  const response = await api.post(`/po/${id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const renameDocument = async (id, data) => {
  const response = await api.patch(`/po/${id}/rename-document`, data);
  return response.data;
};

export const deletePO = async (id) => {
  const response = await api.delete(`/po/${id}`);
  return response.data;
};

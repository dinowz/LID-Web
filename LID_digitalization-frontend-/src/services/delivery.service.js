import api from '../api/axiosClient';

export const getDeliveries = async (params = {}) => {
  const response = await api.get('/deliveries', { params });
  return response.data;
};

export const getDeliveryById = async (id) => {
  const response = await api.get(`/deliveries/${id}`);
  return response.data;
};

export const createDelivery = async (data) => {
  const response = await api.post('/deliveries', data);
  return response.data;
};

export const splitDelivery = async (deliveryId, data) => {
  const response = await api.post(`/deliveries/${deliveryId}/split`, data);
  return response.data;
};

export const updateDeliveryTracking = async (id, data) => {
  const response = await api.put(`/deliveries/${id}`, data);
  return response.data;
};

export const updateDeliveryStatus = async (id, data) => {
  const response = await api.patch(`/deliveries/${id}/status`, data);
  return response.data;
};

export const deleteDeliveryItem = async (deliveryId, itemId) => {
  const response = await api.delete(`/deliveries/${deliveryId}/items/${itemId}`);
  return response.data;
};

export const deleteDelivery = async (id) => {
  const response = await api.delete(`/deliveries/${id}`);
  return response.data;
};

export const generateDeliveryNote = async (id, data) => {
  const response = await api.post(`/deliveries/${id}/generate-note`, data, {
    responseType: 'blob',
  });
  return response.data;
};

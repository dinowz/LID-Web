import api from '../api/axiosClient';

export const getReadyToInvoiceList = async (params = {}) => {
  const response = await api.get('/invoices/ready-to-invoice', { params });
  return response.data;
};

export const createInvoiceFromDelivery = async (deliveryId) => {
  const response = await api.post('/invoices/from-delivery', { deliveryId });
  return response.data;
};

export const createInvoiceFromPoDp = async (poId) => {
  const response = await api.post('/invoices/from-po-dp', { poId });
  return response.data;
};

export const createInvoiceFromService = async (serviceId) => {
  const response = await api.post('/invoices/from-service', { serviceId });
  return response.data;
};

export const createInvoiceFromProject = async (projectId, data) => {
  const response = await api.post('/invoices/from-project', { projectId, data });
  return response.data;
};

export const getInvoices = async (params = {}) => {
  const response = await api.get('/invoices', { params });
  return response.data;
};

export const createInvoice = async (payload) => {
  const response = await api.post('/invoices', payload);
  return response.data;
};

export const getInvoiceById = async (id) => {
  const response = await api.get(`/invoices/${id}`);
  return response.data;
};

export const updateInvoiceStatus = async (id, status, changeNote) => {
  const response = await api.patch(`/invoices/${id}/status`, { status, changeNote });
  return response.data;
};

export const updateInvoiceData = async (id, data) => {
  const isFormData = data instanceof FormData;
  const response = await api.put(`/invoices/${id}`, data, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
  });
  return response.data;
};

export const uploadExternalInvoiceDocument = async (id, formData) => {
  const response = await api.post(`/invoices/${id}/upload-external`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const markInvoiceAsPaid = async (id, formData) => {
  const response = await api.post(`/invoices/${id}/pay`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteDraftInvoice = async (id) => {
  const response = await api.delete(`/invoices/${id}/draft`);
  return response.data;
};

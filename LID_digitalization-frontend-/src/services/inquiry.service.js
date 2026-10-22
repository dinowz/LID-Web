import api from '../api/axiosClient';

const INQUIRY_PREFIX = '/inquiries';

export const INQUIRY_SOURCES = [
  { id: 'WEB', sourceName: 'Web' },
  { id: 'PHONE', sourceName: 'Phone' },
  { id: 'EMAIL', sourceName: 'Email' },
];

export const INQUIRY_STATUSES = [
  { id: 'OPEN', statusName: 'Open' },
  { id: 'FOLLOW_UP', statusName: 'Follow Up' },
  { id: 'CLOSED', statusName: 'Closed' },
];

export const getCustomers = async (params = {}) => {
  const response = await api.get(`${INQUIRY_PREFIX}/customers`, { params });
  return response.data;
};

export const getCodeWords = async (params = {}) => {
  const response = await api.get(`${INQUIRY_PREFIX}/codewords`, { params });
  return response.data;
};


export const getInquiries = async (params = {}) => {
  const response = await api.get(INQUIRY_PREFIX, { params });
  return response.data;
};

export const getInquiryById = async (id) => {
  const response = await api.get(`${INQUIRY_PREFIX}/${id}`);
  return response.data;
};

export const createInquiry = async (data) => {
  const response = await api.post(INQUIRY_PREFIX, data);
  return response.data;
};

export const updateInquiry = async (id, data) => {
  const response = await api.put(`${INQUIRY_PREFIX}/${id}`, data);
  return response.data;
};

export const deleteInquiry = async (id) => {
  const response = await api.delete(`${INQUIRY_PREFIX}/${id}`);
  return response.data;
};

export const updateInquiryStatus = async (id, payload) => {
  // payload: { newStatusCode, changeNote }
  const response = await api.patch(`${INQUIRY_PREFIX}/${id}/status`, payload);
  return response.data;
};

export const reviewInquiryDetails = async (id, payload) => {
  // payload: { details: [{ detailId, mappedServiceId, stockAvailable... }] }
  const response = await api.patch(`${INQUIRY_PREFIX}/${id}/review`, payload);
  return response.data;
};

export const getInquiryStatuses = async () => {
  const response = await api.get(`${INQUIRY_PREFIX}/statuses`);
  return response.data;
};

export const getInquiryCodewords = async () => {
  const response = await api.get(`${INQUIRY_PREFIX}/codewords`);
  return response.data;
};

export const exportInquiryExcel = async (id, filename) => {
  const response = await api.get(`${INQUIRY_PREFIX}/${id}/export-excel`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename || `Inquiry_${id}_Items.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

import api from '../api/axiosClient';

export const getQuotations = async (params) => {
  const response = await api.get('/quotations', { params });
  return response.data;
};

export const prepareQuotationFromInquiry = async (inquiryId) => {
  const response = await api.get(`/quotations/from-inquiry/${inquiryId}/prepare`);
  return response.data;
};

export const createQuotationFromInquiry = async (inquiryId, payload) => {
  const response = await api.post(`/quotations/from-inquiry/${inquiryId}`, payload);
  return response.data;
};

export const getQuotationById = async (id) => {
  const response = await api.get(`/quotations/${id}`);
  return response.data;
};

export const revertQuotationToInquiry = async (id, reason) => {
  const response = await api.post(`/quotations/${id}/revert`, { reason });
  return response.data;
};

export const updateQuotation = async (id, payload) => {
  const response = await api.patch(`/quotations/${id}`, payload);
  return response.data;
};

export const deleteQuotation = async (id) => {
  const response = await api.delete(`/quotations/${id}`);
  return response.data;
};

export const downloadQuotationPdf = async (id, quotationNumber) => {
  const response = await api.get(`/quotations/${id}/pdf`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Quotation_${quotationNumber || id}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getQuotationPdfBlob = async (id) => {
  const response = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
  return response.data;
};

export const acceptQuotationWithPO = async (id, formData) => {
  const config = formData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  const response = await api.post(`/quotations/${id}/accept-with-po`, formData, config);
  return response.data;
};

import api from '../api/axiosClient';

const MASTER_PREFIX = '/admin/master';

// --- SERVICE CATEGORIES ---
export const getServiceCategories = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/service-categories`, { params });
  return response.data;
};

export const createServiceCategory = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/service-categories`, data);
  return response.data;
};

export const updateServiceCategory = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/service-categories/${id}`, data);
  return response.data;
};

export const deleteServiceCategory = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/service-categories/${id}`);
  return response.data;
};

// --- SERVICES ---
export const getServices = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/services`, { params });
  return response.data;
};

export const createService = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/services`, data);
  return response.data;
};

export const updateService = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/services/${id}`, data);
  return response.data;
};

export const deleteService = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/services/${id}`);
  return response.data;
};

// --- SPARE PART CATEGORIES ---
export const getSparePartCategories = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/spare-part-categories`, { params });
  return response.data;
};

export const createSparePartCategory = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/spare-part-categories`, data);
  return response.data;
};

export const updateSparePartCategory = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/spare-part-categories/${id}`, data);
  return response.data;
};

export const deleteSparePartCategory = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/spare-part-categories/${id}`);
  return response.data;
};

// --- SPARE PARTS ---
export const getSpareParts = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/spare-parts`, { params });
  return response.data;
};

export const createSparePart = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/spare-parts`, data);
  return response.data;
};

export const updateSparePart = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/spare-parts/${id}`, data);
  return response.data;
};

export const deleteSparePart = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/spare-parts/${id}`);
  return response.data;
};

// --- CUSTOMERS ---
export const getCustomers = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/customers`, { params });
  return response.data;
};

export const createCustomer = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/customers`, data);
  return response.data;
};

export const updateCustomer = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/customers/${id}`, data);
  return response.data;
};

export const deleteCustomer = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/customers/${id}`);
  return response.data;
};

// --- CODEWORDS ---
export const getCodeWords = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/codewords`, { params });
  return response.data;
};

export const createCodeWord = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/codewords`, data);
  return response.data;
};

export const updateCodeWord = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/codewords/${id}`, data);
  return response.data;
};

export const deleteCodeWord = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/codewords/${id}`);
  return response.data;
};

// --- MASTER DIVISIONS ---
export const getMasterDivisions = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/divisions`, { params });
  return response.data;
};

export const createMasterDivision = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/divisions`, data);
  return response.data;
};

export const updateMasterDivision = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/divisions/${id}`, data);
  return response.data;
};

export const deleteMasterDivision = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/divisions/${id}`);
  return response.data;
};

// --- VENDORS ---
export const getVendors = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/vendors`, { params });
  return response.data;
};

export const createVendor = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/vendors`, data);
  return response.data;
};

export const updateVendor = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/vendors/${id}`, data);
  return response.data;
};

export const deleteVendor = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/vendors/${id}`);
  return response.data;
};

// --- FORWARDERS ---
export const getForwarders = async (params = {}) => {
  const response = await api.get(`${MASTER_PREFIX}/forwarders`, { params });
  return response.data;
};

export const createForwarder = async (data) => {
  const response = await api.post(`${MASTER_PREFIX}/forwarders`, data);
  return response.data;
};

export const updateForwarder = async (id, data) => {
  const response = await api.put(`${MASTER_PREFIX}/forwarders/${id}`, data);
  return response.data;
};

export const deleteForwarder = async (id) => {
  const response = await api.delete(`${MASTER_PREFIX}/forwarders/${id}`);
  return response.data;
};

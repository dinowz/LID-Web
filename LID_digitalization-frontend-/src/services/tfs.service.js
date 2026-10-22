const getToken = () => sessionStorage.getItem('token');
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

export const getAllTfs = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.serviceExecutionId) query.set('serviceExecutionId', params.serviceExecutionId);
  if (params.personnelId) query.set('personnelId', params.personnelId);
  if (params.status) query.set('status', params.status);
  if (params.assignmentType) query.set('assignmentType', params.assignmentType);
  if (params.unlinked) query.set('unlinked', 'true');

  const res = await fetch(`/api/tfs/?${query.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch TFS list');
  return res.json();
};

export const searchServices = async (query) => {
  const res = await fetch(`/api/tfs/search-services?q=${encodeURIComponent(query)}`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to search services');
  return res.json();
};

export const createTfsAssignment = async (serviceExecutionId, body) => {
  const res = await fetch(`/api/tfs/service-execution/${serviceExecutionId}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create TFS assignment');
  }
  return res.json();
};

export const createStandaloneTfsAssignment = async (body) => {
  const res = await fetch(`/api/tfs/standalone`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create standalone TFS assignment');
  }
  return res.json();
};

export const linkTfsToServiceExecution = async (tfsId, serviceExecutionId) => {
  const res = await fetch(`/api/tfs/${tfsId}/link`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ serviceExecutionId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to link TFS to Service Execution');
  }
  return res.json();
};

export const updateTfsAssignment = async (id, body) => {
  const res = await fetch(`/api/tfs/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update TFS assignment');
  }
  return res.json();
};

export const deleteTfsAssignment = async (id) => {
  const res = await fetch(`/api/tfs/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete TFS assignment');
  }
};

export const getTfsAssignmentsByServiceId = async (serviceId) => {
  const res = await fetch(`/api/tfs/service-execution/${serviceId}`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch TFS assignments');
  return res.json();
};

import { useMemo } from 'react';

const decodeToken = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const usePermissions = () => {
  const token = sessionStorage.getItem('token');
  const user = decodeToken(token);
  // Support both old single-role token and new multi-role token
  const roles = user?.roles || (user?.role ? [user.role] : []);

  const hasRole = (...checkRoles) => checkRoles.some(r => roles.includes(r));

  const permissions = useMemo(() => {
    return {
      // ── Module View Access ────────────────────────────────────────────────
      canViewSparepartQuotation: hasRole('ADMIN', 'SPARE_PART', 'MANAGEMENT', 'PROCUREMENT', 'LOGISTIC', 'FINANCE'),
      canViewServiceQuotation: hasRole('ADMIN', 'SERVICE', 'MANAGEMENT', 'TFS', 'PROCUREMENT', 'FINANCE'),
      canViewProjectQuotation: hasRole('ADMIN', 'PROJECT', 'MANAGEMENT', 'PROCUREMENT', 'FINANCE'),
      
      canViewSparepartPO: hasRole('ADMIN', 'SPARE_PART', 'PROCUREMENT', 'MANAGEMENT', 'LOGISTIC', 'FINANCE'),
      canViewServicePO: hasRole('ADMIN', 'SERVICE', 'PROCUREMENT', 'MANAGEMENT', 'FINANCE', 'TFS'),
      canViewProjectPO: hasRole('ADMIN', 'PROJECT', 'PROCUREMENT', 'MANAGEMENT', 'FINANCE'),
      
      canViewServiceExecution: hasRole('ADMIN', 'SERVICE', 'TFS', 'MANAGEMENT', 'PROCUREMENT', 'FINANCE'),
      canViewProjectExecution: hasRole('ADMIN', 'PROJECT', 'MANAGEMENT', 'PROCUREMENT', 'FINANCE'),
      canViewTFSSchedule: hasRole('ADMIN', 'TFS', 'SERVICE', 'MANAGEMENT', 'FINANCE'),
      
      canViewDelivery: hasRole('ADMIN', 'SPARE_PART', 'LOGISTIC', 'MANAGEMENT', 'PROCUREMENT', 'FINANCE'),
      canViewFinance: hasRole('ADMIN', 'FINANCE', 'SPARE_PART', 'MANAGEMENT', 'SERVICE', 'PROJECT'),

      // ── Section-level Access (hides entire section in sidebar) ────────────
      canViewServiceSection: hasRole('ADMIN', 'SERVICE', 'TFS', 'PROJECT', 'PROCUREMENT', 'MANAGEMENT', 'FINANCE', 'SPARE_PART'),
      canViewProjectSection: hasRole('ADMIN', 'PROJECT', 'SERVICE', 'PROCUREMENT', 'MANAGEMENT', 'FINANCE', 'SPARE_PART','TFS'),

      // ── Spare Part module ─────────────────────────────────────────────────
      canCreateInquiry: hasRole('ADMIN', 'SPARE_PART', 'TFS', 'PROJECT', 'SERVICE'),
      canEditInquiry: hasRole('ADMIN', 'SPARE_PART', 'TFS', 'PROJECT', 'SERVICE'),
      canEditQuotation: hasRole('ADMIN', 'SPARE_PART', 'PROJECT'),

      // ── Procurement / Logistic / Finance ─────────────────────────────────
      canEditPO: hasRole('ADMIN', 'PROCUREMENT'),
      canEditDelivery: hasRole('ADMIN', 'LOGISTIC'),
      canEditInvoice: hasRole('ADMIN', 'FINANCE'),

      // ── Create PO from Quotation (per-module) ────────────────────────────
      canCreateSparepartPO: hasRole('ADMIN', 'PROCUREMENT', 'SPARE_PART'),
      canCreateServicePO: hasRole('ADMIN', 'PROCUREMENT', 'SERVICE'),
      canCreateProjectPO: hasRole('ADMIN', 'PROCUREMENT', 'PROJECT'),


      // ── Service module ────────────────────────────────────────────────────
      canCreateServiceInquiry: hasRole('ADMIN', 'SERVICE', 'TFS', 'SPARE_PART', 'PROJECT'),
      canEditServiceInquiry: hasRole('ADMIN', 'SERVICE', 'TFS', 'SPARE_PART', 'PROJECT'),
      canEditServiceQuotation: hasRole('ADMIN', 'SERVICE'),
      canEditServicePO: hasRole('ADMIN', 'PROCUREMENT'),
      canEditServiceExecution: hasRole('ADMIN', 'SERVICE'),
      canEditService: hasRole('ADMIN', 'SERVICE'),
      canEditTFS: hasRole('ADMIN', 'TFS', 'SERVICE'),

      // ── Project module ────────────────────────────────────────────────────
      canEditProjectExecution: hasRole('ADMIN', 'PROJECT'),
      canEditProject: hasRole('ADMIN', 'PROJECT'),

      // ── Administration ────────────────────────────────────────────────────
      canEditMaster: hasRole('ADMIN'),
      isAdmin: hasRole('ADMIN'),

      // ── Meta ──────────────────────────────────────────────────────────────
      roles: roles,
      // Backward compat: expose primary role (first) for display purposes
      role: roles[0] || '',

      // ── Delete (hanya ADMIN) ──────────────────────────────────────────────────
      canDelete: hasRole('ADMIN'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(',')]);

  return permissions;
};

export default usePermissions;

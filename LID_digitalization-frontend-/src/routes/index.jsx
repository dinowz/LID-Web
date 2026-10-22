import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RouterProvider, createBrowserRouter, createRoutesFromElements, Route, Navigate } from 'react-router-dom';

// ── Auth helper: cek token ada & belum expired ─────────────────────────────
const isTokenValid = () => {
  const token = sessionStorage.getItem('token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp dalam detik (UNIX), Date.now() dalam milidetik
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      sessionStorage.removeItem('token'); // hapus token expired
      return false;
    }
    return true;
  } catch {
    // Token bukan JWT valid — hapus
    sessionStorage.removeItem('token');
    return false;
  }
};

import usePermissions from '../hooks/usePermissions';
import ProtectedRoute from '../components/ProtectedRoute';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import MainLayout from '../layouts/MainLayout';
import Users from '../pages/Users';
import MasterServiceTypes from '../pages/MasterServiceTypes';
import MasterServices from '../pages/MasterServices';
import MasterSparePartTypes from '../pages/MasterSparePartTypes';
import MasterSpareParts from '../pages/MasterSpareParts';
import MasterCustomers from '../pages/MasterCustomers';
import MasterCodeWords from '../pages/MasterCodeWords';
import MasterDivisions from '../pages/MasterDivisions';
import MasterVendors from '../pages/MasterVendors';
import MasterForwarders from '../pages/MasterForwarders';
import TargetSettings from '../pages/TargetSettings';

// ── Spare Part module (EXISTING — unchanged) ──────────────────────────────────
import InquiriesList from '../pages/Sparepart/Inquiries/List';
import InquiryCreate from '../pages/Sparepart/Inquiries/Create';
import InquiryDetail from '../pages/Sparepart/Inquiries/Detail';
import InquiryEdit from '../pages/Sparepart/Inquiries/Edit';
import CreateFromInquiry from '../pages/Sparepart/Quotations/CreateFromInquiry';
import QuotationDetail from '../pages/Sparepart/Quotations/Detail';
import QuotationsList from '../pages/Sparepart/Quotations/List';
import POList from '../pages/Sparepart/PO/List';
import PODetail from '../pages/Sparepart/PO/Detail';
import DeliveryList from '../pages/Sparepart/Delivery/List';
import DeliveryDetail from '../pages/Sparepart/Delivery/Detail';

// ── Service module ────────────────────────────────────────────────────────────
import ServiceInquiryList from '../pages/Service/Inquiries/List';
import ServiceInquiryCreate from '../pages/Service/Inquiries/Create';
import ServiceInquiryDetail from '../pages/Service/Inquiries/Detail';
import ServiceInquiryEdit from '../pages/Service/Inquiries/Edit';
import ServiceQuotationList from '../pages/Service/Quotations/List';
import ServiceQuotationCreateFromInquiry from '../pages/Service/Quotations/CreateFromInquiry';
import ServiceQuotationDetail from '../pages/Service/Quotations/Detail';
import ServicePOList from '../pages/Service/PO/List';
import ServicePODetail from '../pages/Service/PO/Detail';
import ServiceExecutionList from '../pages/Service/Executions/List';
import ServiceExecutionDetail from '../pages/Service/Executions/Detail';
import ServiceExecutionCreate from '../pages/Service/Executions/Create';

// ── Project module ────────────────────────────────────────────────────────────
import ProjectInquiryList from '../pages/Project/Inquiries/List';
import ProjectInquiryCreate from '../pages/Project/Inquiries/Create';
import ProjectInquiryDetail from '../pages/Project/Inquiries/Detail';
import ProjectInquiryEdit from '../pages/Project/Inquiries/Edit';
import ProjectQuotationList from '../pages/Project/Quotations/List';
import ProjectQuotationCreateFromInquiry from '../pages/Project/Quotations/CreateFromInquiry';
import ProjectQuotationDetail from '../pages/Project/Quotations/Detail';
import ProjectPOList from '../pages/Project/PO/List';
import ProjectPODetail from '../pages/Project/PO/Detail';
import ProjectExecutionList from '../pages/Project/Executions/List';
import ProjectExecutionCreate from '../pages/Project/Executions/Create';
import ProjectExecutionDetail from '../pages/Project/Executions/Detail';

// ── Finance module ────────────────────────────────────────────────────────────
import InvoiceList from '../pages/Finance/Invoices/List';
import InvoiceCreate from '../pages/Finance/Invoices/Create';
import InvoiceDetail from '../pages/Finance/Invoices/Detail';
import ReadyToInvoice from '../pages/Finance/Invoices/ReadyToInvoice';

// ── TFS module ────────────────────────────────────────────────────────────────
import ScheduledTFSList from '../pages/TFS/ScheduledTFS/List';
import ScheduledTFSCreate from '../pages/TFS/ScheduledTFS/Create';

const AppRoutes = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(isTokenValid);
  const permissions = usePermissions();

  // Sinkronisasi antar tab & validasi berkala
  useEffect(() => {
    // Cek ulang token setiap 1 menit (deteksi expiry)
    const timer = setInterval(() => {
      setIsAuthenticated(isTokenValid());
    }, 60 * 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Migrate to Data Router to support useBlocker
  const router = useMemo(() => {
    return createBrowserRouter(
      createRoutesFromElements(
        <Route>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login setIsAuthenticated={setIsAuthenticated} />
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Register />
            )
          }
        />

        <Route
          path="/"
          element={
            isAuthenticated ? (
              <MainLayout setIsAuthenticated={setIsAuthenticated} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><Users /></ProtectedRoute>} />

          {/* Admin / Master Data */}
          <Route path="admin/master-service-types" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterServiceTypes /></ProtectedRoute>} />
          <Route path="admin/master-services" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterServices /></ProtectedRoute>} />
          <Route path="admin/master-spare-part-types" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterSparePartTypes /></ProtectedRoute>} />
          <Route path="admin/master-spare-parts" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterSpareParts /></ProtectedRoute>} />
          <Route path="admin/master-customers" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterCustomers /></ProtectedRoute>} />
          <Route path="admin/master-codewords" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterCodeWords /></ProtectedRoute>} />
          <Route path="admin/master-divisions" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterDivisions /></ProtectedRoute>} />
          <Route path="admin/master-vendors" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterVendors /></ProtectedRoute>} />
          <Route path="admin/master-forwarders" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><MasterForwarders /></ProtectedRoute>} />
          <Route path="admin/target-settings" element={<ProtectedRoute isAllowed={permissions.canEditMaster}><TargetSettings /></ProtectedRoute>} />

          {/* ── SPARE PART ────────────────────────────────────────────────── */}
          <Route path="inquiries" element={<InquiriesList />} />
          <Route path="inquiries/create" element={<InquiryCreate />} />
          <Route path="inquiries/:id" element={<InquiryDetail />} />
          <Route path="inquiries/:id/edit" element={<InquiryEdit />} />
          <Route path="quotations" element={<ProtectedRoute isAllowed={permissions.canViewSparepartQuotation}><QuotationsList /></ProtectedRoute>} />
          <Route path="quotations/create-from-inquiry/:id" element={<ProtectedRoute isAllowed={permissions.canViewSparepartQuotation}><CreateFromInquiry /></ProtectedRoute>} />
          <Route path="quotations/:id/edit" element={<ProtectedRoute isAllowed={permissions.canViewSparepartQuotation}><CreateFromInquiry /></ProtectedRoute>} />
          <Route path="quotations/:id" element={<ProtectedRoute isAllowed={permissions.canViewSparepartQuotation}><QuotationDetail /></ProtectedRoute>} />
          <Route path="po" element={<ProtectedRoute isAllowed={permissions.canViewSparepartPO}><POList /></ProtectedRoute>} />
          <Route path="po/:id" element={<ProtectedRoute isAllowed={permissions.canViewSparepartPO}><PODetail /></ProtectedRoute>} />
          <Route path="deliveries" element={<ProtectedRoute isAllowed={permissions.canViewDelivery}><DeliveryList /></ProtectedRoute>} />
          <Route path="deliveries/:id" element={<ProtectedRoute isAllowed={permissions.canViewDelivery}><DeliveryDetail /></ProtectedRoute>} />

          {/* ── SERVICE module ───────────────────────────────────────────── */}
          <Route path="service/inquiries" element={<ServiceInquiryList />} />
          <Route path="service/inquiries/create" element={<ServiceInquiryCreate />} />
          <Route path="service/inquiries/:id" element={<ServiceInquiryDetail />} />
          <Route path="service/inquiries/:id/edit" element={<ServiceInquiryEdit />} />
          <Route path="service/quotations" element={<ProtectedRoute isAllowed={permissions.canViewServiceQuotation}><ServiceQuotationList /></ProtectedRoute>} />
          <Route path="service/quotations/create-from-inquiry/:id" element={<ProtectedRoute isAllowed={permissions.canViewServiceQuotation}><ServiceQuotationCreateFromInquiry /></ProtectedRoute>} />
          <Route path="service/quotations/:id/edit" element={<ProtectedRoute isAllowed={permissions.canViewServiceQuotation}><ServiceQuotationCreateFromInquiry /></ProtectedRoute>} />
          <Route path="service/quotations/:id" element={<ProtectedRoute isAllowed={permissions.canViewServiceQuotation}><ServiceQuotationDetail /></ProtectedRoute>} />
          <Route path="service/po" element={<ProtectedRoute isAllowed={permissions.canViewServicePO}><ServicePOList /></ProtectedRoute>} />
          <Route path="service/po/:id" element={<ProtectedRoute isAllowed={permissions.canViewServicePO}><ServicePODetail /></ProtectedRoute>} />
          <Route path="service/executions" element={<ProtectedRoute isAllowed={permissions.canViewServiceExecution}><ServiceExecutionList /></ProtectedRoute>} />
          <Route path="service/executions/create" element={<ProtectedRoute isAllowed={permissions.canViewServiceExecution}><ServiceExecutionCreate /></ProtectedRoute>} />
          <Route path="service/executions/:id" element={<ProtectedRoute isAllowed={permissions.canViewServiceExecution}><ServiceExecutionDetail /></ProtectedRoute>} />

          {/* ── PROJECT module ───────────────────────────────────────────── */}
          <Route path="project/inquiries" element={<ProjectInquiryList />} />
          <Route path="project/inquiries/create" element={<ProjectInquiryCreate />} />
          <Route path="project/inquiries/:id" element={<ProjectInquiryDetail />} />
          <Route path="project/inquiries/:id/edit" element={<ProjectInquiryEdit />} />
          <Route path="project/quotations" element={<ProtectedRoute isAllowed={permissions.canViewProjectQuotation}><ProjectQuotationList /></ProtectedRoute>} />
          <Route path="project/quotations/create-from-inquiry/:id" element={<ProtectedRoute isAllowed={permissions.canViewProjectQuotation}><ProjectQuotationCreateFromInquiry /></ProtectedRoute>} />
          <Route path="project/quotations/:id/edit" element={<ProtectedRoute isAllowed={permissions.canViewProjectQuotation}><ProjectQuotationCreateFromInquiry /></ProtectedRoute>} />
          <Route path="project/quotations/:id" element={<ProtectedRoute isAllowed={permissions.canViewProjectQuotation}><ProjectQuotationDetail /></ProtectedRoute>} />
          <Route path="project/po" element={<ProtectedRoute isAllowed={permissions.canViewProjectPO}><ProjectPOList /></ProtectedRoute>} />
          <Route path="project/po/:id" element={<ProtectedRoute isAllowed={permissions.canViewProjectPO}><ProjectPODetail /></ProtectedRoute>} />
          <Route path="project/executions" element={<ProtectedRoute isAllowed={permissions.canViewProjectExecution}><ProjectExecutionList /></ProtectedRoute>} />
          <Route path="project/executions/create" element={<ProtectedRoute isAllowed={permissions.canViewProjectExecution}><ProjectExecutionCreate /></ProtectedRoute>} />
          <Route path="project/executions/:id" element={<ProtectedRoute isAllowed={permissions.canViewProjectExecution}><ProjectExecutionDetail /></ProtectedRoute>} />

          {/* ── FINANCE module ───────────────────────────────────────────── */}
          <Route path="finance/ready" element={<ProtectedRoute isAllowed={permissions.canViewFinance}><ReadyToInvoice /></ProtectedRoute>} />
          <Route path="finance/invoices" element={<ProtectedRoute isAllowed={permissions.canViewFinance}><InvoiceList /></ProtectedRoute>} />
          <Route path="finance/invoices/create" element={<ProtectedRoute isAllowed={permissions.canEditInvoice}><InvoiceCreate /></ProtectedRoute>} />
          <Route path="finance/invoices/:id" element={<ProtectedRoute isAllowed={permissions.canViewFinance}><InvoiceDetail /></ProtectedRoute>} />

          {/* ── TFS module ───────────────────────────────────────────────── */}
          <Route path="tfs/scheduled" element={<ProtectedRoute isAllowed={permissions.canViewTFSSchedule}><ScheduledTFSList /></ProtectedRoute>} />
          <Route path="tfs/scheduled/create" element={<ProtectedRoute isAllowed={permissions.canViewTFSSchedule}><ScheduledTFSCreate /></ProtectedRoute>} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />
        </Route>
      )
    );
  }, [isAuthenticated, permissions]);

  return <RouterProvider router={router} />;
};

export default AppRoutes;
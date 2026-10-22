import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { getPOs } from '../services/po.service';
import { getInquiries } from '../services/inquiry.service';
import { getQuotations } from '../services/quotation.service';
import { getDeliveries } from '../services/delivery.service';
import { getServices } from '../services/service.service';
import { getProjects } from '../services/project.service';
import { getReadyToInvoiceList } from '../services/invoice.service';
import {
  DashboardOutlined, UserOutlined, FileTextOutlined, ShoppingCartOutlined,
  TruckOutlined, FolderOpenOutlined, SettingOutlined, LogoutOutlined,
  ToolOutlined, BankOutlined, DownOutlined, RightOutlined,
  ThunderboltOutlined, AuditOutlined, LockOutlined, MailOutlined, CalendarOutlined, LineChartOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined
} from '@ant-design/icons';
import { Modal, Form, Input, message, Tabs, Typography, Button as AntButton } from 'antd';
import { getMe, updateProfile } from '../services/auth.service';
import usePermissions from '../hooks/usePermissions';
import logo from '../assets/logo.png';

// ── Decode JWT payload untuk mendapatkan data user ────────────────────────
const getUserFromToken = () => {
  const token = sessionStorage.getItem('token');
  if (!token) return { name: 'Unknown', rolesDisplay: '-', initial: 'U' };
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const name = payload.name || 'Unknown';
    // Support both old token (role) and new token (roles array)
    const rolesArray = payload.roles || (payload.role ? [payload.role] : []);
    const rolesDisplay = rolesArray.length > 0 ? rolesArray.join(', ') : '-';
    const initial = name.charAt(0).toUpperCase();
    return { name, rolesDisplay, initial };
  } catch {
    return { name: 'Unknown', rolesDisplay: '-', initial: 'U' };
  }
};

const routeTitles = {
  '/dashboard': 'Dashboard',
  '/inquiries': 'Spare Part Inquiries',
  '/quotations': 'Spare Part Quotations',
  '/po': 'Purchase Orders',
  '/deliveries': 'Delivery Tracking',
  '/service/inquiries': 'Service Inquiries',
  '/service/quotations': 'Service Quotations',
  '/service/po': 'Service Purchase Orders',
  '/service/executions': 'Service Execution',
  '/tfs/scheduled': 'Scheduled TFS',
  '/project/inquiries': 'Project Inquiries',
  '/project/quotations': 'Project Quotations',
  '/project/po': 'Project Purchase Orders',
  '/project/executions': 'Project Execution',
  '/finance/ready': 'Ready to Invoice',
  '/finance/invoices': 'Invoice & Payment',
  '/users': 'User Management',
  '/admin': 'Master Data',
  '/profile': 'My Profile'
};

const NavItem = ({ to, icon: Icon, label, active, badge, sidebarCollapsed }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm ${active
      ? 'bg-primary-500 text-white font-medium shadow-sm'
      : 'hover:bg-primary-500/20 text-white/80 hover:text-white'
      } ${sidebarCollapsed ? 'justify-center' : ''}`}
    title={sidebarCollapsed ? label : ''}
  >
    <Icon style={{ fontSize: 17 }} className="shrink-0" />
    {!sidebarCollapsed && <span className="flex-1 truncate whitespace-nowrap">{label}</span>}
    {!sidebarCollapsed && badge > 0 && (
      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0">
        {badge}
      </span>
    )}
  </Link>
);

const NavGroup = ({ icon: Icon, label, children, defaultOpen = false, sidebarCollapsed }) => {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (sidebarCollapsed) {
      setOpen(false);
    }
  }, [sidebarCollapsed]);

  return (
    <div className={sidebarCollapsed ? "relative group" : ""}>
      <button
        onClick={() => !sidebarCollapsed && setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary-500/20 text-white/80 hover:text-white transition-all text-sm ${sidebarCollapsed ? 'justify-center' : ''}`}
        title={sidebarCollapsed ? label : ''}
      >
        <Icon style={{ fontSize: 17 }} className="shrink-0" />
        {!sidebarCollapsed && <span className="flex-1 text-left font-semibold truncate">{label}</span>}
        {!sidebarCollapsed && (open ? <DownOutlined style={{ fontSize: 14 }} /> : <RightOutlined style={{ fontSize: 14 }} />)}
      </button>
      
      {/* Standard Submenu ketika normal (Tidak Collapsed) */}
      {!sidebarCollapsed && open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-primary-500/30 pl-2">
          {children}
        </div>
      )}

      {/* Flyout Submenu ketika Collapsed (Muncul saat Hover) */}
      {sidebarCollapsed && (
        <div className="absolute left-full top-0 pl-2 w-56 hidden group-hover:block z-50">
          <div className="bg-primary-600 rounded-lg shadow-xl border border-primary-500/30 p-1.5">
            <p className="px-3 py-1.5 text-xs font-bold text-primary-200 border-b border-primary-550/30 mb-1 truncate uppercase tracking-wider">
              {label}
            </p>
            <div className="space-y-0.5">
              {React.Children.map(children, child =>
                React.isValidElement(child) ? React.cloneElement(child, { sidebarCollapsed: false }) : child
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavSection = ({ label, sidebarCollapsed }) => (
  sidebarCollapsed ? (
    <div className="border-t border-primary-500/30 my-2 mx-2" />
  ) : (
    <p className="px-3 pt-4 pb-1 text-xs font-semibold text-primary-300 uppercase tracking-wider truncate">
      {label}
    </p>
  )
);

const MainLayout = ({ setIsAuthenticated }) => {
  const permissions = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [sparePoCount, setSparePoCount] = useState(0);
  const [spareInquiryCount, setSpareInquiryCount] = useState(0);
  const [spareQuotationCount, setSpareQuotationCount] = useState(0);
  const [spareDeliveryCount, setSpareDeliveryCount] = useState(0);
  const [servicePoCount, setServicePoCount] = useState(0);
  const [serviceInquiryCount, setServiceInquiryCount] = useState(0);
  const [serviceQuotationCount, setServiceQuotationCount] = useState(0);
  const [serviceExecutionCount, setServiceExecutionCount] = useState(0);
  const [projectPoCount, setProjectPoCount] = useState(0);
  const [projectInquiryCount, setProjectInquiryCount] = useState(0);
  const [projectQuotationCount, setProjectQuotationCount] = useState(0);
  const [projectExecutionCount, setProjectExecutionCount] = useState(0);
  const [readyToInvoiceCount, setReadyToInvoiceCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(getUserFromToken);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [profileForm] = Form.useForm();
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const openProfileModal = async () => {
    try {
      const userData = await getMe();
      profileForm.setFieldsValue({
        name: userData.user.name,
        email: userData.user.email,
        password: '',
        confirmPassword: ''
      });
      setProfileModalVisible(true);
    } catch (err) {
      message.error('Failed to load profile data');
    }
  };

  const handleUpdateProfile = async (values) => {
    if (values.password && values.password !== values.confirmPassword) {
      return message.error('Passwords do not match');
    }

    setUpdatingProfile(true);
    try {
      const res = await updateProfile({
        name: values.name,
        email: values.email,
        password: values.password || undefined
      });
      message.success('Profile updated successfully');
      setProfileModalVisible(false);

      // Update local state
      const updatedRoles = res.user.roles || (res.user.role ? [res.user.role] : []);
      setCurrentUser({
        name: res.user.name,
        rolesDisplay: updatedRoles.length > 0 ? updatedRoles.join(', ') : '-',
        initial: res.user.name.charAt(0).toUpperCase()
      });
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const canViewAnyPO = permissions.canViewSparepartPO || permissions.canViewServicePO || permissions.canViewProjectPO;
        const canViewAnyQuotation = permissions.canViewSparepartQuotation || permissions.canViewServiceQuotation || permissions.canViewProjectQuotation;

        const [pos, inqs, quos, dels, svcs, projs, readyList] = await Promise.all([
          canViewAnyPO ? getPOs().catch(() => []) : Promise.resolve([]),
          getInquiries().catch(() => []),
          canViewAnyQuotation ? getQuotations().catch(() => []) : Promise.resolve([]),
          permissions.canViewDelivery ? getDeliveries().catch(() => []) : Promise.resolve([]),
          getServices().catch(() => []),
          getProjects().catch(() => []),
          permissions.canViewFinance ? getReadyToInvoiceList().catch(() => []) : Promise.resolve([])
        ]);

        // --- SPARE PART COUNTS ---
        // Count POs that are NOT 'COMPLETED' and are SPARE_PART
        setSparePoCount(pos.filter(po =>
          po.status !== 'COMPLETED' &&
          (po.poType === 'SPARE_PART' || po.quotation?.inquiry?.requestType === 'SPARE_PART')
        ).length);

        // Count Inquiries that are NOT 'CONVERTED' or 'CLOSED' and are SPARE_PART
        setSpareInquiryCount(inqs.filter(inq =>
          inq.statusCode !== 'CONVERTED' &&
          inq.statusCode !== 'CLOSED' &&
          (inq.requestType === 'SPARE_PART' || (!inq.requestType.startsWith('SERVICE_') && !inq.requestType.startsWith('PROJECT_')))
        ).length);

        // Count Quotations that are NOT 'REALIZED' or 'CLOSE_LOSS' and are SPARE_PART
        setSpareQuotationCount(quos.filter(quo =>
          quo.status !== 'REALIZED' &&
          quo.status !== 'EXECUTED' &&
          quo.status !== 'CLOSE_LOSS' &&
          (quo.quotationType === 'SPARE_PART' || quo.inquiry?.requestType === 'SPARE_PART')
        ).length);

        // Count Deliveries that are NOT 'COMPLETED' or 'DELIVERED'
        setSpareDeliveryCount(dels.filter(d =>
          d.status !== 'COMPLETED' &&
          d.status !== 'DELIVERED'
        ).length);

        // --- SERVICE COUNTS ---
        // Count POs that are NOT 'COMPLETED' and are SERVICE
        setServicePoCount(pos.filter(po =>
          po.status !== 'COMPLETED' &&
          (po.poType === 'SERVICE' || po.quotation?.inquiry?.requestType?.startsWith('SERVICE_'))
        ).length);

        // Count Inquiries that are NOT 'CONVERTED' or 'CLOSED' and are SERVICE
        setServiceInquiryCount(inqs.filter(inq =>
          inq.statusCode !== 'CONVERTED' &&
          inq.statusCode !== 'CLOSED' &&
          inq.requestType.startsWith('SERVICE_')
        ).length);

        // Count Quotations that are NOT 'REALIZED' or 'CLOSE_LOSS' and are SERVICE
        setServiceQuotationCount(quos.filter(quo =>
          quo.status !== 'REALIZED' &&
          quo.status !== 'EXECUTED' &&
          quo.status !== 'CLOSE_LOSS' &&
          (quo.quotationType === 'SERVICE' || quo.inquiry?.requestType?.startsWith('SERVICE_'))
        ).length);

        // Count Service Executions that are NOT 'DONE'
        setServiceExecutionCount(svcs.filter(s =>
          s.status !== 'DONE'
        ).length);

        // --- PROJECT COUNTS ---
        // Count POs that are NOT 'COMPLETED' and are PROJECT
        setProjectPoCount(pos.filter(po =>
          po.status !== 'COMPLETED' &&
          (po.poType === 'PROJECT' || po.quotation?.inquiry?.requestType?.startsWith('PROJECT_'))
        ).length);

        // Count Inquiries that are NOT 'CONVERTED' or 'CLOSED' and are PROJECT
        setProjectInquiryCount(inqs.filter(inq =>
          inq.statusCode !== 'CONVERTED' &&
          inq.statusCode !== 'CLOSED' &&
          inq.requestType.startsWith('PROJECT_')
        ).length);

        // Count Project Executions that are NOT 'DONE'
        setProjectExecutionCount(projs.filter(p =>
          p.status !== 'DONE'
        ).length);

        // Count Quotations that are NOT 'REALIZED' or 'CLOSE_LOSS' and are PROJECT
        setProjectQuotationCount(quos.filter(quo =>
          quo.status !== 'REALIZED' &&
          quo.status !== 'EXECUTED' &&
          quo.status !== 'CLOSE_LOSS' &&
          (quo.quotationType === 'PROJECT' || quo.inquiry?.requestType?.startsWith('PROJECT_'))
        ).length);

        // --- FINANCE COUNTS ---
        setReadyToInvoiceCount(readyList.length);
      } catch (err) {
        console.error('Failed to fetch counts for badges', err);
      }
    };

    fetchCounts();
    // Refresh every 5 minutes
    const interval = setInterval(fetchCounts, 5 * 60 * 1000);

    // Listen to SSE events for real-time badge updates
    const eventSource = new EventSource(`${import.meta.env.VITE_API_URL}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'REFRESH_BADGE') {
          fetchCounts();
        }
      } catch (err) {
        console.error('SSE Error:', err);
      }
    };

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  // Update dynamic page title
  useEffect(() => {
    const currentPath = location.pathname;
    let pageTitle = 'Portal';

    // Find the best match from routeTitles
    // Sort keys by length descending to match more specific routes first (e.g. /service/po before /service)
    const sortedPaths = Object.keys(routeTitles).sort((a, b) => b.length - a.length);
    const matchedPath = sortedPaths.find(path => currentPath.startsWith(path));

    if (matchedPath) {
      pageTitle = routeTitles[matchedPath];
    }

    document.title = `${pageTitle} | LIND Digitalization`;
  }, [location.pathname]);

  const handleLogoutClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setLogoutModalVisible(true);
  };

  const onConfirmLogout = () => {
    sessionStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate('/login', { replace: true });
    setLogoutModalVisible(false);
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans print:block print:h-auto print:bg-white">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-20 overflow-visible' : 'w-64 overflow-y-auto'} bg-primary-600 text-white shadow-xl flex flex-col print:hidden transition-all duration-300`}>
        <div className={`p-4 bg-primary-600 border-b border-primary-500/30 sticky top-0 z-10 ${sidebarCollapsed ? 'flex justify-center items-center h-16' : ''}`}>
          {sidebarCollapsed ? (
            <span className="text-lg font-bold tracking-wider text-white">LIND</span>
          ) : (
            <>
              <div className="flex items-center justify-center mb-1">
                <img src={logo} alt="Loesche Indonesia Logo" className="h-10 w-auto brightness-0 invert" />
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/50 text-center">
                Monitoring Portal
              </div>
            </>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {/* Dashboard */}
          <NavItem to="/dashboard" icon={DashboardOutlined} label="Dashboard" active={path === '/dashboard'} sidebarCollapsed={sidebarCollapsed} />

          {/* ── SPARE PART ────────────────────────────────────────────────── */}
          <NavSection label="Spare Part" sidebarCollapsed={sidebarCollapsed} />
          <NavGroup icon={ShoppingCartOutlined} label="Spare Part" defaultOpen={['/inquiries', '/quotations', '/po', '/deliveries'].some(p => path.startsWith(p))} sidebarCollapsed={sidebarCollapsed}>
            <NavItem to="/inquiries" icon={FileTextOutlined} label="Inquiries" active={path.startsWith('/inquiries')} badge={spareInquiryCount} sidebarCollapsed={sidebarCollapsed} />
            {permissions.canViewSparepartQuotation && <NavItem to="/quotations" icon={FileTextOutlined} label="Quotations" active={path.startsWith('/quotations')} badge={spareQuotationCount} sidebarCollapsed={sidebarCollapsed} />}
            {permissions.canViewSparepartPO && <NavItem to="/po" icon={ShoppingCartOutlined} label="Purchase Orders" active={path.startsWith('/po')} badge={sparePoCount} sidebarCollapsed={sidebarCollapsed} />}
            {permissions.canViewDelivery && <NavItem to="/deliveries" icon={TruckOutlined} label="Delivery" active={path.startsWith('/deliveries')} badge={spareDeliveryCount} sidebarCollapsed={sidebarCollapsed} />}
          </NavGroup>

          {/* ── SERVICE ──────────────────────────────────────────────────── */}
          {permissions.canViewServiceSection && (
            <>
              <NavSection label="Service" sidebarCollapsed={sidebarCollapsed} />
              <NavGroup icon={ToolOutlined} label="Service" defaultOpen={path.startsWith('/service')} sidebarCollapsed={sidebarCollapsed}>
                <NavItem to="/service/inquiries" icon={FileTextOutlined} label="Inquiries" active={path.startsWith('/service/inquiries')} badge={serviceInquiryCount} sidebarCollapsed={sidebarCollapsed} />
                {permissions.canViewServiceQuotation && <NavItem to="/service/quotations" icon={FileTextOutlined} label="Quotations" active={path.startsWith('/service/quotations')} badge={serviceQuotationCount} sidebarCollapsed={sidebarCollapsed} />}
                {permissions.canViewServicePO && <NavItem to="/service/po" icon={ShoppingCartOutlined} label="Purchase Orders" active={path.startsWith('/service/po')} badge={servicePoCount} sidebarCollapsed={sidebarCollapsed} />}
                {permissions.canViewServiceExecution && <NavItem to="/service/executions" icon={ToolOutlined} label="Service Execution" active={path.startsWith('/service/executions')} badge={serviceExecutionCount} sidebarCollapsed={sidebarCollapsed} />}
                {permissions.canViewTFSSchedule && <NavItem to="/tfs/scheduled" icon={CalendarOutlined} label="Scheduled TFS" active={path.startsWith('/tfs/scheduled')} sidebarCollapsed={sidebarCollapsed} />}
              </NavGroup>
            </>
          )}

          {/* ── PROJECT ──────────────────────────────────────────────────── */}
          {permissions.canViewProjectSection && (
            <>
              <NavSection label="Project" sidebarCollapsed={sidebarCollapsed} />
              <NavGroup icon={BankOutlined} label="Project" defaultOpen={path.startsWith('/project')} sidebarCollapsed={sidebarCollapsed}>
                <NavItem to="/project/inquiries" icon={FileTextOutlined} label="Inquiries" active={path.startsWith('/project/inquiries')} badge={projectInquiryCount} sidebarCollapsed={sidebarCollapsed} />
                {permissions.canViewProjectQuotation && <NavItem to="/project/quotations" icon={FileTextOutlined} label="Quotations" active={path.startsWith('/project/quotations')} badge={projectQuotationCount} sidebarCollapsed={sidebarCollapsed} />}
                {permissions.canViewProjectPO && <NavItem to="/project/po" icon={ShoppingCartOutlined} label="Purchase Orders" active={path.startsWith('/project/po')} badge={projectPoCount} sidebarCollapsed={sidebarCollapsed} />}
                {permissions.canViewProjectExecution && <NavItem to="/project/executions" icon={FolderOpenOutlined} label="Project Execution" active={path.startsWith('/project/executions')} badge={projectExecutionCount} sidebarCollapsed={sidebarCollapsed} />}
              </NavGroup>
            </>
          )}

          {/* ── FINANCE ──────────────────────────────────────────────────── */}
          {permissions.canViewFinance && (
            <>
              <NavSection label="Finance" sidebarCollapsed={sidebarCollapsed} />
              <NavItem to="/finance/ready" icon={FileTextOutlined} label="Ready to Invoice" active={path.startsWith('/finance/ready')} badge={readyToInvoiceCount} sidebarCollapsed={sidebarCollapsed} />
              <NavItem to="/finance/invoices" icon={AuditOutlined} label="Invoice & Payment" active={path.startsWith('/finance/invoices')} sidebarCollapsed={sidebarCollapsed} />
            </>
          )}

          {/* ── ADMINISTRATION ───────────────────────────────────────────── */}
          {permissions.canEditMaster && (
            <div className="pt-3 mt-2 border-t border-primary-500/30">
              <NavSection label="Administration" sidebarCollapsed={sidebarCollapsed} />
              <NavItem to="/users" icon={UserOutlined} label="User Management" active={path.startsWith('/users')} sidebarCollapsed={sidebarCollapsed} />
              <NavGroup icon={SettingOutlined} label="Master Data" defaultOpen={path.startsWith('/admin')} sidebarCollapsed={sidebarCollapsed}>
                <NavItem to="/admin/master-service-types" icon={FileTextOutlined} label="Service Type" active={path === '/admin/master-service-types'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/master-services" icon={FileTextOutlined} label="Service" active={path === '/admin/master-services'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/master-spare-part-types" icon={FolderOpenOutlined} label="Spare Part Type" active={path === '/admin/master-spare-part-types'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/master-spare-parts" icon={FolderOpenOutlined} label="Spare Part" active={path === '/admin/master-spare-parts'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/master-customers" icon={UserOutlined} label="Customer" active={path === '/admin/master-customers'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/master-codewords" icon={SettingOutlined} label="Codeword" active={path === '/admin/master-codewords'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/master-divisions" icon={UserOutlined} label="Personnel" active={path === '/admin/master-divisions'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/master-vendors" icon={TruckOutlined} label="Vendor" active={path === '/admin/master-vendors'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/master-forwarders" icon={TruckOutlined} label="Forwarder" active={path === '/admin/master-forwarders'} sidebarCollapsed={sidebarCollapsed} />
                <NavItem to="/admin/target-settings" icon={LineChartOutlined} label="Target Settings" active={path === '/admin/target-settings'} sidebarCollapsed={sidebarCollapsed} />
              </NavGroup>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-primary-500/30 sticky bottom-0 bg-primary-600">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold cursor-pointer shrink-0"
                onClick={openProfileModal}
                title="Profile"
              >
                {currentUser.initial}
              </div>
              <button
                type="button"
                onClick={handleLogoutClick}
                className="p-2 hover:bg-red-500/20 text-white/80 hover:text-red-400 rounded-md transition-colors"
                title="Logout"
              >
                <LogoutOutlined style={{ fontSize: 18 }} />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 text-sm text-white/80 cursor-pointer hover:bg-white/10 p-1 rounded-lg transition-colors"
              onClick={openProfileModal}
            >
              <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold shrink-0">
                {currentUser.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{currentUser.name}</p>
                <p className="text-xs text-white/70">{currentUser.rolesDisplay}</p>
              </div>
              <button
                type="button"
                onClick={handleLogoutClick}
                className="p-2 hover:bg-red-500/20 text-white/80 hover:text-red-400 rounded-md transition-colors"
                title="Logout"
              >
                <LogoutOutlined style={{ fontSize: 18 }} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto print:block print:overflow-visible">
        <header className="bg-white shadow-sm border-b border-primary-500/20 px-6 py-4 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="p-1.5 hover:bg-gray-100 text-primary-600 rounded-md transition-colors border border-primary-500/20 flex items-center justify-center"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <MenuUnfoldOutlined style={{ fontSize: 18 }} /> : <MenuFoldOutlined style={{ fontSize: 18 }} />}
            </button>
            <h2 className="text-xl font-semibold text-primary-600">Overview</h2>
          </div>
          <div className="text-sm text-primary-600">Status: Online</div>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      <Modal
        title="Logout Confirmation"
        open={logoutModalVisible}
        onOk={onConfirmLogout}
        onCancel={() => setLogoutModalVisible(false)}
        okText="Logout"
        okType="danger"
        cancelText="Cancel"
        centered
      >
        <p>Are you sure you want to log out from the system?</p>
      </Modal>

      {/* Profile Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <UserOutlined className="text-primary-600" />
            <span>My Profile</span>
          </div>
        }
        open={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        footer={null}
        width={450}
        centered
        className="profile-modal"
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleUpdateProfile}
          requiredMark={false}
          className="mt-4"
        >
          <Tabs defaultActiveKey="1" items={[
            {
              key: '1',
              label: 'General Information',
              children: (
                <div className="space-y-4 pt-2">
                  <Form.Item
                    name="name"
                    label="Full Name"
                    rules={[{ required: true, message: 'Please enter your name' }]}
                  >
                    <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Enter your full name" />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label="Email Address"
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email' }
                    ]}
                  >
                    <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="Enter your email" />
                  </Form.Item>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your Role</p>
                    <p className="font-semibold text-primary-700">{currentUser.rolesDisplay}</p>
                  </div>
                </div>
              )
            },
            {
              key: '2',
              label: 'Change Password',
              children: (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-gray-500 italic mb-4">Leave blank if you don't want to change password</p>
                  <Form.Item
                    name="password"
                    label="New Password"
                    rules={[{ min: 6, message: 'Password must be at least 6 characters' }]}
                  >
                    <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Enter new password" />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="Confirm New Password"
                    dependencies={['password']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('The two passwords do not match'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Confirm new password" />
                  </Form.Item>
                </div>
              )
            }
          ]} />

          <div className="flex justify-end gap-2 mt-8 border-t pt-4">
            <AntButton onClick={() => setProfileModalVisible(false)}>Cancel</AntButton>
            <AntButton type="primary" htmlType="submit" loading={updatingProfile} className="bg-primary-600 hover:bg-primary-700">
              Save Changes
            </AntButton>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default MainLayout;

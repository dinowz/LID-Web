import React, { useState, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Button, Tag, Typography, message, Space, Modal } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCartOutlined, ThunderboltOutlined, BankOutlined, PlusOutlined,
  RightOutlined, LockOutlined, EyeOutlined,
  DeleteOutlined, EditOutlined, CheckOutlined, ExclamationCircleOutlined, ClockCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { getInquiries, deleteInquiry } from '../../../services/inquiry.service';
import usePermissions from '../../../hooks/usePermissions';
import { getStatusColor, getIdleInfo, getValueEnum } from '../../../utils/statusHelper';
import { exportToCSV } from '../../../utils/exportCsv';
import { ActionButtonGroup, ViewActionButton, EditActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const { Text } = Typography;

const SERVICE_CATEGORY_LABELS = {
  EXTERNAL_PURCHASE: { label: 'External Purchase', color: 'blue', icon: <ShoppingCartOutlined /> },
  EXTERNAL_TFS: { label: 'External TFS', color: 'cyan', icon: <ThunderboltOutlined /> },
  EXTERNAL: { label: 'External Service', color: 'geekblue', icon: <ShoppingCartOutlined /> },
  IC_TFS: { label: 'IC – TFS', color: 'purple', icon: <BankOutlined /> },
};

const SUMMARY_CATEGORIES = {
  EXTERNAL: { label: 'External', icon: <ShoppingCartOutlined /> },
  IC: { label: 'Inter Company', icon: <BankOutlined /> },
};

const STATUS_COLORS = {
  OPEN: 'processing',
  CONVERTED: 'success',
};

const getCategoryFromType = (requestType) => {
  if (requestType === 'SERVICE_EXTERNAL_PURCHASE') return 'EXTERNAL_PURCHASE';
  if (requestType === 'SERVICE_EXTERNAL_TFS') return 'EXTERNAL_TFS';
  if (requestType === 'SERVICE_EXTERNAL') return 'EXTERNAL';
  if (requestType === 'SERVICE_IC_TFS') return 'IC_TFS';
  return requestType;
};

export default function ServiceInquiryList() {
  const [allData, setAllData] = useState([]);
  const [convertedModalOpen, setConvertedModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const [filterCategory, setFilterCategory] = useState('');
  const actionRef = useRef();
  const navigate = useNavigate();
  const permissions = usePermissions();

  const handleEditClick = (record) => {
    if (record.statusCode === 'CONVERTED') {
      setConvertedModalOpen(true);
      return;
    }
    navigate(`/service/inquiries/${record.id}?mode=edit`);
  };

  const handleDelete = async () => {
    const { record } = deleteModal;
    if (!record) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteInquiry(record.id);
      message.success('Inquiry successfully deleted');
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (error) {
      message.error(error.response?.data?.error || error.message || 'Failed to delete inquiry');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['Inquiry No', 'Date', 'Due Date', 'Customer', 'Code Word', 'Mill Type', 'Subject', 'Service Type', 'Status', 'Creator', 'Created At'];
    const rows = data.map(i => [
      i.inquiryNumber || '',
      dayjs(i.inquiryDate).format('YYYY-MM-DD'),
      i.dueDate ? dayjs(i.dueDate).format('YYYY-MM-DD') : '-',
      i.customer?.name || '',
      i.codeWord?.code || '-',
      i.codeWord?.millType || '-',
      i.subject || '',
      getCategoryFromType(i.requestType) || i.requestType,
      i.statusCode || '',
      i.creator?.name || '-',
      dayjs(i.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    exportToCSV(headers, rows, `Service_Inquiry_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting service inquiries to CSV...');
  };

  // Compute summary counts from raw (unfiltered) data
  const summaryCounts = Object.entries(SUMMARY_CATEGORIES).map(([key, { label, icon }]) => {
    const count = allData.filter(i => {
      const cat = getCategoryFromType(i.requestType);
      if (key === 'EXTERNAL') return cat === 'EXTERNAL_PURCHASE' || cat === 'EXTERNAL_TFS' || cat === 'EXTERNAL';
      if (key === 'IC') return cat === 'IC_TFS';
      return false;
    }).length;
    return { key, label, icon, count };
  });

  const columns = [
    {
      title: 'Inquiry No.',
      dataIndex: 'inquiryNumber',
      key: 'inquiryNumber',
      valueType: 'text',
      render: (_, r) => <Text strong>{r.inquiryNumber}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'inquiryDate',
      key: 'inquiryDate',
      hideInSearch: true,
      valueType: 'dateRange',
      fieldProps: { format: 'DD/MM/YYYY' },
      render: (_, r) => r.inquiryDate ? dayjs(r.inquiryDate).format('DD/MM/YYYY') : '-',
      search: { transform: (value) => ({ startDate: value[0], endDate: value[1] }) },
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      valueType: 'text',
      render: (_, r) => r.customer?.name || '-',
    },
    {
      title: 'Code Word',
      dataIndex: ['codeWord', 'code'],
      key: 'codeWord.code',
      valueType: 'text',
      render: (_, record) => record.codeWord?.code || '-',
      search: {
        transform: (value) => ({
          codeWordCode: value,
        }),
      },
    },
    {
      title: 'Mill Type',
      dataIndex: ['codeWord', 'millType'],
      key: 'codeWord.millType',
      valueType: 'text',
      hideInSearch: true,
      render: (_, record) => record.codeWord?.millType || '-',
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      valueType: 'text',
    },
    {
      title: 'Service Type',
      dataIndex: 'requestType',
      key: 'requestType',
      hideInSearch: true,
      render: (requestType) => {
        const catKey = getCategoryFromType(requestType);
        const cat = SERVICE_CATEGORY_LABELS[catKey] || { label: catKey, color: 'default' };
        return <Tag color={cat.color}>{cat.label}</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'statusCode',
      key: 'statusCode',
      valueType: 'select',
      valueEnum: getValueEnum(['OPEN', 'CONVERTED']),
      render: (_, r) => (
        <Tag color={getStatusColor(r.statusCode)}>{r.statusCode}</Tag>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      hideInSearch: true,
      render: (_, record) => record.dueDate ? dayjs(record.dueDate).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Creator',
      key: 'creator',
      hideInSearch: true,
      render: (_, r) => r.creator?.name || '-'
    },
    {
      title: 'Update',
      key: 'updater',
      hideInSearch: true,
      render: (_, r) => r.updater?.name || '-'
    },
    {
      title: 'Last Activity',
      key: 'lastActivity',
      hideInSearch: true,
      render: (_, record) => {
        const ref = record.lastActivityAt || record.createdAt;
        const dateStr = ref ? dayjs(ref).format('DD/MM/YY') : '-';
        const idle = getIdleInfo(record);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClockCircleOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>{dateStr}</span>
            {idle && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: idle.color,
                background: idle.bg, borderRadius: 4, padding: '1px 5px',
              }}>
                {idle.label}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      hideInSearch: true,
      render: (_, record) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/service/inquiries/${record.id}`)}
          />
          {permissions.canEditServiceInquiry && (
            <EditActionButton
              onClick={() => handleEditClick(record)}
              isLocked={record.statusCode === 'CONVERTED'}
              lockTooltip="Inquiry already converted"
            />
          )}
          {permissions.canDelete && (
            <DeleteActionButton
              onClick={() => setDeleteModal({ open: true, record, loading: false })}
            />
          )}
        </ActionButtonGroup>
      ),
    },
  ];

  return (
    <>
      {/* Summary Cards (preserved) */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {summaryCounts.map(({ key, label, icon, count }) => {
          const isActive = filterCategory === key;
          return (
            <button
              key={key}
              onClick={() => {
                setFilterCategory(isActive ? '' : key);
                // Trigger table reload after category change
                setTimeout(() => actionRef.current?.reload(), 0);
              }}
              className={`relative overflow-hidden p-5 rounded-xl border transition-all text-left group ${isActive
                ? 'border-primary-500 bg-primary-50/40 shadow-sm'
                : 'border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 shadow-sm hover:shadow-md'
                }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                  <p className="text-3xl font-black text-gray-900 leading-none tabular-nums">{count}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${isActive ? 'bg-primary-500 text-white shadow-lg shadow-primary-200' : 'bg-gray-50 text-gray-400'
                  } transition-all duration-300`}>
                  {icon}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isActive && <CheckOutlined className="text-primary-500 text-[10px]" />}
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-primary-600' : 'text-gray-300 group-hover:text-gray-400'
                    } transition-colors`}>
                    {isActive ? 'Filter Active' : 'View Inquiries'}
                  </span>
                </div>
                <RightOutlined className={`text-xs ${isActive ? 'text-primary-500' : 'text-gray-300'
                  } transition-transform group-hover:translate-x-1`} />
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 h-1 bg-primary-500 w-full" />
              )}
            </button>
          );
        })}
      </div>

      <ProTable
        actionRef={actionRef}
        rowKey="id"
        style={{ width: '100%' }}
        scroll={{ x: 'max-content' }}
        columns={columns}
        request={async (params) => {
          try {
            const result = await getInquiries({ requestModule: 'SERVICE_' });
            let filtered = [...result];

            // Store raw data for summary cards
            setAllData(result);

            // Filter: Inquiry Number
            if (params.inquiryNumber) {
              const s = params.inquiryNumber.toLowerCase();
              filtered = filtered.filter(i => i.inquiryNumber?.toLowerCase().includes(s));
            }

            // Filter: Customer Name
            if (params.customerName) {
              const s = params.customerName.toLowerCase();
              filtered = filtered.filter(i => i.customer?.name?.toLowerCase().includes(s));
            }

            // Filter: Code Word
            if (params.codeWordCode) {
              const s = params.codeWordCode.toLowerCase();

              filtered = filtered.filter(i =>
                i.codeWord?.code?.toLowerCase().includes(s)
              );
            }

            // Filter: Subject
            if (params.subject) {
              const s = params.subject.toLowerCase();
              filtered = filtered.filter(i => i.subject?.toLowerCase().includes(s));
            }

            // Filter: Status
            if (params.statusCode) {
              filtered = filtered.filter(i => i.statusCode === params.statusCode);
            }

            // Filter: Summary Category Card
            if (filterCategory) {
              filtered = filtered.filter(i => {
                const cat = getCategoryFromType(i.requestType);
                if (filterCategory === 'EXTERNAL') return cat === 'EXTERNAL_PURCHASE' || cat === 'EXTERNAL_TFS' || cat === 'EXTERNAL';
                if (filterCategory === 'IC') return cat === 'IC_TFS';
                return true;
              });
            }

            return { data: filtered, success: true, total: filtered.length };
          } catch (err) {
            console.error(err);
            message.error('Failed to load inquiries');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div>
            <div className="text-base font-semibold text-gray-800">Service Inquiries</div>
            <div className="text-xs text-gray-400 font-normal">Manage all inquiries for the Service module</div>
          </div>
        }
        toolBarRender={() => [
          permissions.canCreateServiceInquiry && (
            <Button
              key="create"
              type='primary'
              icon={<PlusOutlined style={{ fontSize: 16 }} />}
              onClick={() => navigate('/service/inquiries/create')}
              className="bg-blue-600 shadow-sm"
            >
              Create Inquiry
            </Button>
          ),
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={() => handleExport(allData)}
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            Export CSV
          </Button>,
        ]}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['10', '15', '20', '50', '100']
        }}
        search={{ labelWidth: 'auto', layout: 'vertical', defaultCollapsed: false }}
        cardProps={{ className: 'rounded-xl shadow-sm border-gray-100' }}
      />

      {/* Modal: blokir edit jika CONVERTED */}
      <Modal
        open={convertedModalOpen}
        onCancel={() => setConvertedModalOpen(false)}
        onOk={() => setConvertedModalOpen(false)}
        okText="Understood"
        cancelButtonProps={{ style: { display: 'none' } }}
        title={
          <div className="flex items-center gap-2 text-amber-600">
            <LockOutlined />
            <span>Inquiry Cannot Be Edited</span>
          </div>
        }
        centered
      >
        <div className="py-2 space-y-3">
          <p className="text-gray-700">
            This inquiry is already <strong className="text-green-600">CONVERTED</strong> and has been converted into a Quotation.
          </p>
          <p className="text-gray-500 text-sm">
            Converted inquiry data cannot be changed to maintain document consistency.
            If there are changes, please edit directly on the related Quotation document.
          </p>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <span className="flex items-center gap-2 text-red-600">
            <ExclamationCircleOutlined />
            Confirm Hard Delete Inquiry
          </span>
        }
        open={deleteModal.open}
        onOk={handleDelete}
        onCancel={() => setDeleteModal({ open: false, record: null, loading: false })}
        confirmLoading={deleteModal.loading}
        okText="Yes, Delete Permanently"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        centered
      >
        <p className="text-gray-700 mb-2">You are about to permanently delete the inquiry:</p>
        <p className="font-semibold text-blue-700 text-base mb-3">
          {deleteModal.record?.inquiryNumber || <span className="italic text-gray-400">No Inquiry #</span>}
        </p>
        <p className="text-gray-500 text-sm">
          Customer: <strong>{deleteModal.record?.customer?.name || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm">
          Subject: <strong>{deleteModal.record?.subject || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm mb-4">
          Status: <strong>{deleteModal.record?.statusCode}</strong>
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ This action <strong>cannot be undone</strong>. All inquiry data including details will be permanently deleted.
        </div>
      </Modal>
    </>
  );
}

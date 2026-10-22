import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Tag, Space, message, Modal } from 'antd';
import { PlusOutlined, EyeOutlined, FormOutlined, DeleteOutlined, BuildOutlined, UpSquareOutlined, ToolOutlined, ExclamationCircleFilled, LockOutlined, ClockCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import { getInquiries, deleteInquiry } from '../../../services/inquiry.service';
import usePermissions from '../../../hooks/usePermissions';
import { getStatusColor, getIdleInfo, getValueEnum } from '../../../utils/statusHelper';
import { exportToCSV } from '../../../utils/exportCsv';
import { ActionButtonGroup, ViewActionButton, EditActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const { Title, Text } = Typography;

const PROJECT_TYPE_META = {
  PROJECT_NEW_PLANT: { label: 'New Plant', icon: <BuildOutlined />, canContinue: false },
  PROJECT_UPGRADE: { label: 'Upgrade', icon: <UpSquareOutlined />, canContinue: false },
  PROJECT_OM: { label: 'O&M', icon: <ToolOutlined />, canContinue: true },
};

const STATUS_COLORS = {
  OPEN: 'blue',
  CONVERTED: 'green',
};

export default function ProjectInquiryList() {
  const [filterType, setFilterType] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const [convertedModalOpen, setConvertedModalOpen] = useState(false);

  // Custom state for statistics
  const [statistics, setStatistics] = useState({
    PROJECT_NEW_PLANT: 0,
    PROJECT_UPGRADE: 0,
    PROJECT_OM: 0
  });
  const [allDataForExport, setAllDataForExport] = useState([]);

  const navigate = useNavigate();
  const permissions = usePermissions();
  const actionRef = useRef();

  const handleEditClick = (record) => {
    if (record.statusCode === 'CONVERTED') {
      setConvertedModalOpen(true);
      return;
    }
    navigate(`/project/inquiries/${record.id}?mode=edit`);
  };

  const handleConfirmDelete = async () => {
    const { record } = deleteModal;
    if (!record) return;

    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteInquiry(record.id);
      message.success('Inquiry deleted successfully');
      actionRef.current?.reload();
      setDeleteModal({ open: false, record: null, loading: false });
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.error || 'Failed to delete inquiry');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = () => {
    if (allDataForExport.length === 0) return message.warning('No data to export');
    const headers = ['Inquiry No', 'Date', 'Due Date', 'Customer', 'Code Word', 'Mill Type', 'Subject', 'Project Type', 'Status', 'Creator', 'Created At'];
    const rows = allDataForExport.map(i => [
      i.inquiryNumber || '',
      dayjs(i.inquiryDate).format('YYYY-MM-DD'),
      i.dueDate ? dayjs(i.dueDate).format('YYYY-MM-DD') : '-',
      i.customer?.name || i.customerName || '',
      i.codeWord?.code || i.codeWordCode || '-',
      i.codeWord?.millType || i.millType || '-',
      i.subject || '',
      (PROJECT_TYPE_META[i.requestType] ? PROJECT_TYPE_META[i.requestType].label : i.requestType) || '-',
      i.statusCode || '',
      i.creator?.name || '-',
      dayjs(i.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    exportToCSV(headers, rows, `Project_Inquiry_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting project inquiries to CSV...');
  };

  const columns = [
    {
      title: 'Inquiry No',
      dataIndex: 'inquiryNumber',
      render: (text) => <Text strong className="font-mono text-primary-600">{text}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'inquiryDate',
      key: 'inquiryDate',
      search: false,
      render: (_, record) => dayjs(record.inquiryDate).format('DD/MM/YYYY'),
    },
    {
      title: 'Customer',
      key: 'customer',
      dataIndex: 'customerName',
      valueType: 'text',
      render: (_, record) =>
        record.customer?.name ||
        record.customerName ||
        <span className="text-gray-400">-</span>,
      search: {
        transform: (value) => ({
          customerName: value,
        }),
      },
    },
    {
      title: 'Code Word',
      dataIndex: ['codeWord', 'code'],
      key: 'codeWordCode',
      valueType: 'text',
      render: (_, record) => record.codeWord?.code || record.codeWordCode || '-',
      search: {
        transform: (value) => ({
          codeWordCode: value,
        }),
      },
    },
    {
      title: 'Mill Type',
      dataIndex: ['codeWord', 'millType'],
      key: 'codeWordMillType',
      valueType: 'text',
      search: false,
      render: (_, record) => record.codeWord?.millType || record.millType || '-',
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      search: true,
      render: (text) => <Text>{text}</Text>,
    },
    {
      title: 'Project Type',
      dataIndex: 'requestType',
      search: false,
      render: (t) => {
        const meta = PROJECT_TYPE_META[t];
        if (!meta) return <Tag>{t}</Tag>;
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'statusCode',
      valueEnum: getValueEnum(['OPEN', 'CONVERTED']),
      render: (_, record) => (
        <Tag color={getStatusColor(record.statusCode)}>
          {record.statusCode}
        </Tag>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      search: false,
      render: (_, record) => record.dueDate ? dayjs(record.dueDate).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Last Activity',
      key: 'lastActivity',
      search: false,
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
      title: 'Creator',
      key: 'creator',
      search: false,
      render: (_, r) => r.creator?.name || '-'
    },
    {
      title: 'Update',
      key: 'updater',
      search: false,
      render: (_, r) => r.updater?.name || '-'
    },
    {
      title: 'Action',
      key: 'action',
      search: false,
      render: (_, record) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/project/inquiries/${record.id}`)}
          />
          {permissions.canEditInquiry && (
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
    <div className="space-y-6">
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

      {/* Type summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(PROJECT_TYPE_META).map(([key, meta]) => {
          return (
            <button key={key} onClick={() => {
              const newFilter = filterType === key ? '' : key;
              setFilterType(newFilter);
            }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${filterType === key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-primary-300'}`}>
              <div className="text-2xl mb-1 text-primary-600">{meta.icon}</div>
              <div className="font-semibold text-sm text-gray-700">{meta.label}</div>
              <div className="text-2xl font-bold text-primary-600 mt-1">{statistics[key] || 0}</div>
              {!meta.canContinue && <div className="text-xs text-gray-400 mt-1">Inquiries only</div>}
              {meta.canContinue && <div className="text-xs text-green-600 mt-1">Full workflow</div>}
            </button>
          );
        })}
      </div>

      <ProTable
        columns={columns}
        actionRef={actionRef}
        cardBordered
        style={{ width: '100%' }}
        scroll={{ x: 'max-content' }}
        params={{ filterType }}
        request={async (params = {}) => {
          try {
            const result = await getInquiries({ requestModule: 'PROJECT_' });
            console.log(result);

            // Calculate statistics
            const stats = {
              PROJECT_NEW_PLANT: 0,
              PROJECT_UPGRADE: 0,
              PROJECT_OM: 0,
            };

            result.forEach(i => {
              if (stats[i.requestType] !== undefined) {
                stats[i.requestType]++;
              }
            });

            setStatistics(stats);

            // Manual filtering
            const filtered = result.filter(inq => {
              // =========================
              // Field fallback
              // =========================
              const inquiryNumber = inq.inquiryNumber || '';

              const customerName =
                inq.customer?.name ||
                inq.customerName ||
                '';

              const codeWord =
                inq.codeWord?.code ||
                inq.codeWordCode ||
                inq.codeWord ||
                '';

              const subject = inq.subject || '';
              const statusCode = inq.statusCode || '';
              const requestType = inq.requestType || '';

              // =========================
              // Params filter
              // =========================
              const inquiryNumberSearch = params.inquiryNumber || '';
              const customerNameSearch = params.customerName || '';
              const codeWordSearch = params.codeWordCode || '';
              const subjectSearch = params.subject || '';

              // =========================
              // Filter: Inquiry Number
              // =========================
              const matchInquiryNumber =
                !inquiryNumberSearch ||
                inquiryNumber
                  .toLowerCase()
                  .includes(inquiryNumberSearch.toLowerCase());

              // =========================
              // Filter: Customer
              // =========================
              const matchCustomer =
                !customerNameSearch ||
                customerName
                  .toLowerCase()
                  .includes(customerNameSearch.toLowerCase());

              // =========================
              // Filter: Code Word
              // =========================
              const matchCodeWord =
                !codeWordSearch ||
                codeWord
                  .toLowerCase()
                  .includes(codeWordSearch.toLowerCase());

              // =========================
              // Filter: Subject
              // =========================
              const matchSubject =
                !subjectSearch ||
                subject
                  .toLowerCase()
                  .includes(subjectSearch.toLowerCase());

              // =========================
              // Filter: Type
              // =========================
              const matchType =
                !params.filterType ||
                requestType === params.filterType;

              // =========================
              // Filter: Status
              // =========================
              const matchStatus =
                !params.statusCode ||
                statusCode === params.statusCode;

              // =========================
              // Filter: Date
              // =========================
              let matchDate = true;
              if (params.startDate && params.endDate) {
                const start = dayjs(params.startDate).startOf('day');
                const end = dayjs(params.endDate).endOf('day');
                const iDate = dayjs(inq.inquiryDate);
                if (iDate.isValid()) {
                  matchDate = iDate.isSameOrAfter(start) && iDate.isSameOrBefore(end);
                }
              }

              return (
                matchInquiryNumber &&
                matchCustomer &&
                matchCodeWord &&
                matchSubject &&
                matchType &&
                matchStatus &&
                matchDate
              );
            });

            setAllDataForExport(filtered);

            // Pagination manual
            const pageSize = params.pageSize || 15;
            const current = params.current || 1;

            const paginated = filtered.slice(
              (current - 1) * pageSize,
              current * pageSize
            );

            return {
              data: paginated,
              success: true,
              total: filtered.length,
            };
          } catch (error) {
            console.error(error);
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        headerTitle={
          <div>
            <div className="text-base font-semibold text-gray-800">Project Inquiries</div>
            <div className="text-xs text-gray-400 font-normal">Manage all inquiries for the Project module</div>
          </div>
        }
        rowKey="id"
        search={{ labelWidth: 'auto', layout: 'vertical', defaultCollapsed: false }}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['10', '15', '20', '50', '100']
        }}
        dateFormatter="string"
        toolBarRender={() => [
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            Export CSV
          </Button>,
          permissions.canEditInquiry && (
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/project/inquiries/create')}
              className="bg-primary-600 shadow-sm"
            >
              New Project Inquiry
            </Button>
          ),
        ]}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-red-600">
            <ExclamationCircleFilled />
            <span>Confirm Deletion</span>
          </div>
        }
        open={deleteModal.open}
        onOk={handleConfirmDelete}
        onCancel={() => setDeleteModal({ open: false, record: null, loading: false })}
        confirmLoading={deleteModal.loading}
        okText="Yes, Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
      >
        <p className="mb-4 text-gray-600">
          Are you sure you want to permanently delete this inquiry? This action <strong>cannot be undone</strong> and will remove all associated data.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <p className="font-semibold text-blue-700 text-base mb-3">{deleteModal.record?.inquiryNumber}</p>
          <div className="text-sm space-y-1 text-gray-600">
            <p>
              Customer: <strong>{deleteModal.record?.customer?.name || deleteModal.record?.customerName || '-'}</strong>
            </p>
            <p>
              Subject: <strong>{deleteModal.record?.subject || '-'}</strong>
            </p>
            <p>
              Type: <strong>{deleteModal.record?.requestType || '-'}</strong>
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

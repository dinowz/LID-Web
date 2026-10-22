import React, { useState, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Button, Tag, Space, message, Popconfirm, Modal, Typography } from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  FormOutlined,
  DeleteOutlined,
  LockOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getInquiries, deleteInquiry } from '../../../services/inquiry.service';
import usePermissions from '../../../hooks/usePermissions';
import { getStatusColor, getIdleInfo, getValueEnum } from '../../../utils/statusHelper';
import { ActionButtonGroup, ViewActionButton, EditActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';
import { exportToCSV } from '../../../utils/exportCsv';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const { Text } = Typography;

const InquiriesList = () => {
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const [convertedModalOpen, setConvertedModalOpen] = useState(false);
  const [allData, setAllData] = useState([]);
  const actionRef = useRef();
  const navigate = useNavigate();
  const permissions = usePermissions();

  const handleEditClick = (record) => {
    if (record.statusCode === 'CONVERTED') {
      setConvertedModalOpen(true);
      return;
    }
    navigate(`/inquiries/${record.id}?mode=edit`);
  };

  const handleDelete = async () => {
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

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['Inquiry No', 'Date', 'Due Date', 'Customer', 'Code Word', 'Mill Type', 'Subject', 'Request Type', 'Status', 'Creator', 'Created At'];
    const rows = data.map(i => [
      i.inquiryNumber || '',
      dayjs(i.inquiryDate).format('YYYY-MM-DD'),
      i.dueDate ? dayjs(i.dueDate).format('YYYY-MM-DD') : '-',
      i.customer?.name || '',
      i.codeWord?.code || '-',
      i.codeWord?.millType || '-',
      i.subject || '',
      i.requestType || '',
      i.statusCode || '',
      i.creator?.name || '-',
      dayjs(i.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    exportToCSV(headers, rows, `Inquiry_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting inquiries to CSV...');
  };

  const columns = [
    {
      title: 'Inquiry No',
      dataIndex: 'inquiryNumber',
      key: 'inquiryNumber',
      valueType: 'text',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'inquiryDate',
      key: 'inquiryDate',
      hideInSearch: true,
      valueType: 'dateRange',
      render: (_, record) => dayjs(record.inquiryDate).format('DD/MM/YYYY'),
      search: {
        transform: (value) => ({
          startDate: value?.[0],
          endDate: value?.[1],
        }),
      },
    },
    {
      title: 'Customer',
      key: 'customer',
      dataIndex: 'customerName',
      valueType: 'text',
      render: (_, record) => record.customer?.name || <span className="text-gray-400">-</span>,
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
      title: 'Status',
      dataIndex: 'statusCode',
      key: 'statusCode',
      valueType: 'select',
      valueEnum: getValueEnum(['OPEN', 'CONVERTED']),
      render: (_, record) => (
        <Tag color={getStatusColor(record.statusCode)}>{record.statusCode}</Tag>
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
      title: 'Creator',
      dataIndex: ['creator', 'name'],
      key: 'creator',
      hideInSearch: true,
      render: (text) => <Text>{text || '-'}</Text>,
    },
    {
      title: 'Update',
      dataIndex: ['updater', 'name'],
      key: 'updater',
      hideInSearch: true,
      render: (text) => <Text>{text || '-'}</Text>,
    },
    {
      title: 'Action',
      key: 'action',
      hideInSearch: true,
      render: (_, record) => (
        <ActionButtonGroup>
          <ViewActionButton onClick={() => navigate(`/inquiries/${record.id}`)} />

          {permissions.canEditInquiry && (
            <EditActionButton
              isLocked={record.statusCode === 'CONVERTED'}
              lockTooltip="Inquiry sudah dikonversi"
              onClick={() => handleEditClick(record)}
            />
          )}

          {permissions.canDelete && (
            <DeleteActionButton onClick={() => setDeleteModal({ open: true, record, loading: false })} />
          )}
        </ActionButtonGroup>
      ),
    },
  ];

  return (
    <>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        style={{ width: '100%' }}
        scroll={{ x: 'max-content' }}
        columns={columns}
        request={async (params) => {
          try {
            const result = await getInquiries({ requestModule: 'SPARE_PART' });
            let filtered = [...result];

            // Filter: Inquiry Number
            if (params.inquiryNumber) {
              const s = params.inquiryNumber.toLowerCase();
              filtered = filtered.filter(i => i.inquiryNumber?.toLowerCase().includes(s));
            }

            // Filter: Customer
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

            // Filter: Date Range
            if (params.startDate && params.endDate) {
              const start = dayjs(params.startDate, ['DD/MM/YYYY', 'YYYY-MM-DD']).startOf('day');
              const end = dayjs(params.endDate, ['DD/MM/YYYY', 'YYYY-MM-DD']).endOf('day');
              filtered = filtered.filter(i => {
                const d = dayjs(i.inquiryDate);
                return d.isSameOrAfter(start) && d.isSameOrBefore(end);
              });
            }

            setAllData(filtered);
            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load inquiries');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div>
            <div className="text-base font-semibold text-gray-800">Spare Part Inquiries</div>
            <div className="text-xs text-gray-400 font-normal">
              Manage incoming customer requests and internal reviews
            </div>
          </div>
        }
        toolBarRender={() => [
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={() => handleExport(allData)}
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            Export CSV
          </Button>,
          permissions.canCreateInquiry && (
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/inquiries/create')}
            >
              Create Inquiry
            </Button>
          ),
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
        okText="Mengerti"
        cancelButtonProps={{ style: { display: 'none' } }}
        title={
          <div className="flex items-center gap-2 text-amber-600">
            <LockOutlined />
            <span>Inquiry Tidak Dapat Diedit</span>
          </div>
        }
        centered
      >
        <div className="py-2 space-y-3">
          <p className="text-gray-700">
            Inquiry ini sudah berstatus <strong className="text-green-600">CONVERTED</strong> dan telah dikonversi menjadi Quotation.
          </p>
          <p className="text-gray-500 text-sm">
            Data inquiry yang sudah dikonversi tidak dapat diubah untuk menjaga konsistensi dokumen.
            Jika ada perubahan, silakan edit langsung pada dokumen Quotation terkait.
          </p>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-red-600">
            <ExclamationCircleOutlined />
            <span>Confirm Hard Delete Inquiry</span>
          </div>
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
        <p className="mb-2 text-gray-700">You are about to permanently delete the inquiry:</p>
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ⚠️ This action <strong>cannot be undone</strong>. All inquiry data including details will be permanently deleted.
          </div>
        </div>
      </Modal>
    </>
  );
};

export default InquiriesList;
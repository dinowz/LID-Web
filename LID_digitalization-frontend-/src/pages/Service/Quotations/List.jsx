import React, { useState, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Button, Typography, Tag, Space, message, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import { EyeOutlined, DeleteOutlined, ExclamationCircleOutlined, ClockCircleOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons';
import { getQuotations, deleteQuotation } from '../../../services/quotation.service';
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

const { Text } = Typography;

const STATUS_COLOR = { DRAFT: 'orange', SENT: 'blue', REALIZED: 'green', EXECUTED: 'purple', CLOSE_LOSS: 'red' };

const CAT_LABELS = {
  EXTERNAL_PURCHASE: { label: 'External Purchase', color: 'gray' },
  EXTERNAL_TFS: { label: 'External TFS', color: 'gray' },
  EXTERNAL: { label: 'External Service', color: 'geekblue' },
  IC_TFS: { label: 'IC – TFS', color: 'gray' },
};

const getCat = (requestType) => ({
  'SERVICE_EXTERNAL_PURCHASE': 'EXTERNAL_PURCHASE',
  'SERVICE_EXTERNAL_TFS': 'EXTERNAL_TFS',
  'SERVICE_EXTERNAL': 'EXTERNAL',
  'SERVICE_IC_TFS': 'IC_TFS',
}[requestType] || null);

export default function ServiceQuotationList() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [allData, setAllData] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const actionRef = useRef();

  const handleDelete = async () => {
    const { record } = deleteModal;
    if (!record) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteQuotation(record.id);
      message.success('Quotation successfully deleted');
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (error) {
      message.error(error.response?.data?.error || error.message || 'Failed to delete quotation');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['Quotation No', 'Inquiry Ref', 'Due Date', 'Customer', 'Subject', 'Code Word', 'Service Type', 'Total Price', 'Currency', 'Status', 'Creator', 'Date'];
    const rows = data.map(q => [
      q.quotationNumber || '',
      q.inquiry?.inquiryNumber || '',
      q.inquiry?.dueDate ? dayjs(q.inquiry.dueDate).format('YYYY-MM-DD') : '-',
      q.inquiry?.customer?.name || '-',
      q.inquiry?.subject || '-',
      q.inquiry?.codeWord?.code || '-',
      (getCat(q.inquiry?.requestType) ? CAT_LABELS[getCat(q.inquiry?.requestType)].label : q.inquiry?.requestType) || '-',
      q.totalPrice ? Math.round(parseFloat(q.totalPrice)) : '0',
      q.currency || 'IDR',
      q.status || '',
      q.creator?.name || '-',
      dayjs(q.createdAt).format('YYYY-MM-DD'),
    ]);
    exportToCSV(headers, rows, `Service_Quotation_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting service quotations to CSV...');
  };

  const columns = [
    {
      title: 'Quotation No', dataIndex: 'quotationNumber', key: 'quotationNumber', order: 6,
      valueType: 'text',
      render: (_, r) => <span className="font-medium">{r.quotationNumber}</span>
    },
    {
      title: 'Inquiry No', dataIndex: 'inquiryRef', key: 'inquiryRef', order: 2,
      valueType: 'text',
      render: (_, r) => r.inquiry?.inquiryNumber || '-',
    },
    {
      title: 'Date', dataIndex: 'createdAt', key: 'createdAt',
      valueType: 'dateRange',
      hideInSearch: true,
      fieldProps: { format: 'DD/MM/YYYY' },
      render: (_, r) => new Date(r.createdAt).toLocaleDateString('en-US'),
      search: { transform: (value) => ({ startDate: value[0], endDate: value[1] }) },
    },
    {
      title: 'Customer', dataIndex: 'customerName', key: 'customerName', order: 4,
      valueType: 'text',
      render: (_, r) => r.inquiry?.customer?.name || '-',
    },
    {
      title: 'Subject', dataIndex: 'subject', key: 'subject',
      valueType: 'text',
      ellipsis: true,
      render: (_, r) => r.inquiry?.subject || '-',
    },
    {
      title: 'Code Word',
      dataIndex: ['inquiry', 'codeWord', 'code'],
      key: 'codeWordCode',
      valueType: 'text',
      order: 3,
      render: (_, record) =>
        record.inquiry?.codeWord?.code ||
        record.codeWord?.code ||
        '-',
      search: {
        transform: (value) => ({
          codeWordCode: value,
        }),
      },
    },
    {
      title: 'Service Type', key: 'type',
      hideInSearch: true,
      render: (_, r) => {
        const cat = getCat(r.inquiry?.requestType);
        const meta = cat ? CAT_LABELS[cat] : null;
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : '-';
      }
    },
    {
      title: 'Total Price', dataIndex: 'totalPrice', key: 'totalPrice', align: 'right',
      hideInSearch: true,
      render: (_, r) => `${r.currency || 'IDR'} ${parseFloat(r.totalPrice).toLocaleString('en-US')}`
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      valueType: 'select',
      valueEnum: getValueEnum(['DRAFT', 'SENT', 'REALIZED', 'EXECUTED', 'CLOSE_LOSS']),
      render: (_, r) => <Tag color={getStatusColor(r.status)}>{r.status}</Tag>
    },
    {
      title: 'Due Date',
      dataIndex: ['inquiry', 'dueDate'],
      key: 'dueDate',
      hideInSearch: true,
      render: (_, record) => record.inquiry?.dueDate ? dayjs(record.inquiry.dueDate).format('DD/MM/YYYY') : '-',
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
      title: 'Creator', key: 'creator',
      hideInSearch: true,
      render: (_, record) => record.creator?.name || '-',
    },
    {
      title: 'Update', key: 'updater',
      hideInSearch: true,
      render: (_, record) => record.updater?.name || '-'
    },
    {
      title: 'Action', key: 'action',
      hideInSearch: true,
      render: (_, r) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/service/quotations/${r.id}`)}
          />
          {permissions.canEditServiceQuotation && (
            <EditActionButton
              onClick={() => navigate(`/service/quotations/${r.id}?mode=edit`)}
              isLocked={r.status !== 'DRAFT' && r.status !== 'SENT'}
              lockTooltip="Cannot edit non-draft/sent quotation"
            />
          )}
          {permissions.canDelete && (
            <DeleteActionButton
              onClick={() => setDeleteModal({ open: true, record: r, loading: false })}
            />
          )}
        </ActionButtonGroup>
      )
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
            const result = await getQuotations({ quotationType: 'SERVICE' });
            let filtered = [...result];

            setAllData(filtered);

            // Filter: Quotation Number
            if (params.quotationNumber) {
              const s = params.quotationNumber.toLowerCase();
              filtered = filtered.filter(q => q.quotationNumber?.toLowerCase().includes(s));
            }

            // Filter: Inquiry Ref
            if (params.inquiryRef) {
              const s = params.inquiryRef.toLowerCase();
              filtered = filtered.filter(q => q.inquiry?.inquiryNumber?.toLowerCase().includes(s));
            }

            // Filter: Customer Name
            if (params.customerName) {
              const s = params.customerName.toLowerCase();
              filtered = filtered.filter(q => q.inquiry?.customer?.name?.toLowerCase().includes(s));
            }

            // Filter: Subject
            if (params.subject) {
              const s = params.subject.toLowerCase();
              filtered = filtered.filter(q => q.inquiry?.subject?.toLowerCase().includes(s));
            }

            // Filter: Code Word
            if (params.codeWordCode) {
              const s = params.codeWordCode.toLowerCase();

              filtered = filtered.filter(i =>
                i.codeWord?.code?.toLowerCase().includes(s)
              );
            }

            // Filter: Status
            if (params.status) {
              filtered = filtered.filter(q => q.status === params.status);
            }

            // Filter: Date Range
            if (params.startDate && params.endDate) {
              const start = dayjs(params.startDate, ['DD/MM/YYYY', 'YYYY-MM-DD']).startOf('day');
              const end = dayjs(params.endDate, ['DD/MM/YYYY', 'YYYY-MM-DD']).endOf('day');
              filtered = filtered.filter(q => {
                const d = dayjs(q.createdAt);
                return d.isSameOrAfter(start) && d.isSameOrBefore(end);
              });
            }

            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load service quotations');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div>
            <div className="text-base font-semibold text-gray-800">Service Quotations</div>
            <div className="text-xs text-gray-400 font-normal">Manage customer quotations generated from inquiries
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
        ]}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['10', '15', '20', '50', '100']
        }}
        search={{ labelWidth: 'auto', layout: 'vertical', defaultCollapsed: false }}
        cardProps={{ className: 'rounded-xl shadow-sm border-gray-100' }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <span className="flex items-center gap-2 text-red-600">
            <ExclamationCircleOutlined />
            Confirm Hard Delete Quotation
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
        <p className="text-gray-700 mb-2">You are about to permanently delete the quotation:</p>
        <p className="font-semibold text-blue-700 text-base mb-3">
          {deleteModal.record?.quotationNumber || <span className="italic text-gray-400">No Quotation #</span>}
        </p>
        <p className="text-gray-500 text-sm">
          Customer: <strong>{deleteModal.record?.inquiry?.customer?.name || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm">
          Inquiry Ref: <strong>{deleteModal.record?.inquiry?.inquiryNumber || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm mb-4">
          Status: <strong>{deleteModal.record?.status}</strong>
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ This action <strong>cannot be undone</strong>. All quotation data including details and history will be permanently deleted.
        </div>
      </Modal>
    </>
  );
}

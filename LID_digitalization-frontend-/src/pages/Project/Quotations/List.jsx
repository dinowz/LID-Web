import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProTable } from '@ant-design/pro-components';
import { Tag, Button, message, Tooltip, Modal, Space, Typography } from 'antd';
import {
  EyeOutlined, DeleteOutlined, ExclamationCircleFilled,
  ClockCircleOutlined, DownloadOutlined, EditOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { getQuotations, deleteQuotation } from '../../../services/quotation.service';
import usePermissions from '../../../hooks/usePermissions';
import { getStatusColor, getIdleInfo, getValueEnum } from '../../../utils/statusHelper';
import { exportToCSV } from '../../../utils/exportCsv';
import { ActionButtonGroup, ViewActionButton, EditActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const { Text } = Typography;

const STATUS_COLOR = {
  DRAFT: 'orange',
  SENT: 'blue',
  // REALIZED: 'green',
  EXECUTED: 'green',
  CLOSE_LOSS: 'red',
};

export default function ProjectQuotationList() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [allData, setAllData] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const actionRef = useRef();

  const handleConfirmDelete = async () => {
    const { record } = deleteModal;
    if (!record) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteQuotation(record.id);
      message.success('Quotation deleted successfully');
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.error || 'Failed to delete quotation');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['Quotation No', 'Inquiry Ref', 'Due Date', 'Code Word', 'Project Type', 'Customer', 'Subject', 'Total Price', 'Currency', 'Status', 'Creator', 'Date'];
    const rows = data.map(q => {
      const type = q.inquiry?.requestType;
      const typeLabel = { PROJECT_NEW_PLANT: 'New Plant', PROJECT_UPGRADE: 'Upgrade', PROJECT_OM: 'O&M' }[type] || type || '-';
      return [
        q.quotationNumber || '',
        q.inquiry?.inquiryNumber || '',
        q.inquiry?.dueDate ? dayjs(q.inquiry.dueDate).format('YYYY-MM-DD') : '-',
        q.inquiry?.codeWord?.code || '-',
        typeLabel,
        q.inquiry?.customer?.name || '-',
        q.inquiry?.subject || '-',
        q.totalPrice ? Math.round(parseFloat(q.totalPrice)) : '0',
        q.currency || 'IDR',
        q.status || '',
        q.creator?.name || '-',
        dayjs(q.createdAt).format('YYYY-MM-DD'),
      ];
    });
    exportToCSV(headers, rows, `Project_Quotation_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting project quotations to CSV...');
  };

  const columns = [
    {
      title: 'Quotation No.',
      dataIndex: 'quotationNumber',
      valueType: 'text',
      order: 6,
      render: (_, r) => <Text strong className="font-mono text-xs text-blue-700">{r.quotationNumber}</Text>,
    },
    {
      title: 'Inquiry No.',
      dataIndex: 'inquiryNumber',
      valueType: 'text',
      order: 2,
      render: (_, r) => r.inquiry?.inquiryNumber || '-',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      valueType: 'dateRange',
      hideInSearch: true,
      fieldProps: { format: 'DD/MM/YYYY' },
      render: (_, r) => r.createdAt ? dayjs(r.createdAt).format('DD/MM/YYYY') : '-',
      search: { transform: (value) => ({ dateStart: value[0], dateEnd: value[1] }) },
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      valueType: 'text',
      order: 4,
      render: (_, r) => r.inquiry?.customer?.name || '-',
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      valueType: 'text',
      ellipsis: true,
      render: (_, r) => r.inquiry?.subject || '-',
    },
    {
      title: 'Code Word',
      dataIndex: 'codeWord',
      valueType: 'text',
      order: 3,
      render: (_, r) => r.inquiry?.codeWord?.code || '-',
    },
    {
      title: 'Project Type',
      dataIndex: 'requestType',
      hideInSearch: true,
      valueType: 'select',
      valueEnum: {
        PROJECT_NEW_PLANT: { text: 'New Plant' },
        PROJECT_UPGRADE: { text: 'Upgrade' },
        PROJECT_OM: { text: 'O&M' },
      },
      render: (_, r) => {
        const type = r.inquiry?.requestType;
        const meta = {
          PROJECT_NEW_PLANT: { label: 'New Plant', color: 'emerald' },
          PROJECT_UPGRADE: { label: 'Upgrade', color: 'blue' },
          PROJECT_OM: { label: 'O&M', color: 'violet' },
        }[type];
        if (!meta) return type || '-';
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Total Price',
      dataIndex: 'totalPrice',
      align: 'right',
      hideInSearch: true,
      render: (_, r) => `${r.currency || 'IDR'} ${parseFloat(r.totalPrice || 0).toLocaleString('en-US')}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      valueType: 'select',
      order: 1,
      valueEnum: getValueEnum(['DRAFT', 'SENT', 'REALIZED', 'EXECUTED', 'CLOSE_LOSS']),
      render: (_, r) => <Tag color={getStatusColor(r.status)}>{r.status}</Tag>,
    },
    {
      title: 'Due Date',
      dataIndex: ['inquiry', 'dueDate'],
      search: false,
      render: (_, record) => record.inquiry?.dueDate ? dayjs(record.inquiry.dueDate).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivityAt',
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
              <span style={{ fontSize: 10, fontWeight: 700, color: idle.color, background: idle.bg, borderRadius: 4, padding: '1px 5px' }}>
                {idle.label}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Creator',
      dataIndex: 'creator',
      hideInSearch: true,
      render: (_, r) => r.creator?.name || '-',
    },
    {
      title: 'Update',
      dataIndex: 'updater',
      hideInSearch: true,
      render: (_, r) => r.updater?.name || '-',
    },
    {
      title: 'Actions',
      align: 'center',
      hideInSearch: true,
      render: (_, r) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/project/quotations/${r.id}`)}
          />
          {permissions.canEditQuotation && (
            <EditActionButton
              onClick={() => navigate(`/project/quotations/${r.id}?mode=edit`)}
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
            const result = await getQuotations({ quotationType: 'PROJECT' });
            let filtered = Array.isArray(result) ? [...result] : [];
            setAllData(filtered);

            if (params.quotationNumber) {
              const s = params.quotationNumber.toLowerCase();
              filtered = filtered.filter(q => q.quotationNumber?.toLowerCase().includes(s));
            }
            if (params.inquiryNumber) {
              const s = params.inquiryNumber.toLowerCase();
              filtered = filtered.filter(q => q.inquiry?.inquiryNumber?.toLowerCase().includes(s));
            }
            if (params.codeWord) {
              const s = params.codeWord.toLowerCase();
              filtered = filtered.filter(q => q.inquiry?.codeWord?.code?.toLowerCase().includes(s));
            }
            if (params.customerName) {
              const s = params.customerName.toLowerCase();
              filtered = filtered.filter(q => q.inquiry?.customer?.name?.toLowerCase().includes(s));
            }
            if (params.subject) {
              const s = params.subject.toLowerCase();
              filtered = filtered.filter(q => q.inquiry?.subject?.toLowerCase().includes(s));
            }
            if (params.status) {
              filtered = filtered.filter(q => q.status === params.status);
            }
            if (params.dateStart && params.dateEnd) {
              const start = dayjs(params.dateStart, ['DD/MM/YYYY', 'YYYY-MM-DD']).startOf('day');
              const end = dayjs(params.dateEnd, ['DD/MM/YYYY', 'YYYY-MM-DD']).endOf('day');
              filtered = filtered.filter(q => {
                if (!q.createdAt) return false;
                const d = dayjs(q.createdAt);
                return d.isSameOrAfter(start) && d.isSameOrBefore(end);
              });
            }

            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load project quotations');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div className="flex items-center gap-3">
            <FileTextOutlined className="text-primary-600 text-2xl" />
            <div>
              <h1 className="text-xl font-bold text-gray-800 m-0">Project Quotations</h1>
              <p className="text-sm text-gray-500 m-0 font-normal">Manage all quotations for the Project module</p>
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
        scroll={{ x: 'max-content' }}
        search={{ labelWidth: 'auto', layout: 'vertical', defaultCollapsed: false }}
        cardProps={{ className: 'rounded-xl shadow-sm border-gray-100 mt-5' }}
      />

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
        centered
      >
        <p className="mb-4 text-gray-600">
          Are you sure you want to permanently delete this quotation? This action <strong>cannot be undone</strong>.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <p className="font-semibold text-blue-700 text-base mb-3">{deleteModal.record?.quotationNumber}</p>
          <div className="text-sm space-y-1 text-gray-600">
            <p>Customer: <strong>{deleteModal.record?.inquiry?.customer?.name || '-'}</strong></p>
            <p>Inquiry Ref: <strong>{deleteModal.record?.inquiry?.inquiryNumber || '-'}</strong></p>
            <p>Total: <strong>{deleteModal.record?.currency || 'IDR'} {parseFloat(deleteModal.record?.totalPrice || 0).toLocaleString('en-US')}</strong></p>
          </div>
        </div>
      </Modal>
    </>
  );
}

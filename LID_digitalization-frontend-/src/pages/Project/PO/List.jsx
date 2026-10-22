import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProTable } from '@ant-design/pro-components';
import { Tag, Button, message, Tooltip, Modal, Space, Typography } from 'antd';
import {
  EyeOutlined, DeleteOutlined, ExclamationCircleFilled,
  ClockCircleOutlined, DownloadOutlined, FilePdfOutlined, ShoppingCartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { getPOs, deletePO } from '../../../services/po.service';
import usePermissions from '../../../hooks/usePermissions';
import { getFileUrl } from '../../../utils/file';
import { getStatusColor, getIdleInfo, getValueEnum } from '../../../utils/statusHelper';
import { exportToCSV } from '../../../utils/exportCsv';
import { ActionButtonGroup, ViewActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const { Text } = Typography;

const STATUS_COLOR = {
  REVIEW: 'warning',
  IN_PROGRESS: 'success',
  COMPLETED: 'success',
  READY: 'green',
  WAITING_OC: 'processing',
  PROCESSING: 'processing',
};

export default function ProjectPOList() {
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
      await deletePO(record.id);
      message.success('Purchase Order deleted successfully');
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.error || 'Failed to delete Purchase Order');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['PO Number', 'SD Document', 'Inquiry Ref', 'Quotation Ref', 'Code Word', 'Customer', 'Project Name', 'Net Value', 'Currency', 'Status', 'Creator', 'Date'];
    const rows = data.map(p => [
      p.poNumber || '',
      p.sdDocument || '',
      p.quotation?.inquiry?.inquiryNumber || '-',
      p.quotation?.quotationNumber || '-',
      p.quotation?.inquiry?.codeWord?.code || '-',
      p.quotation?.inquiry?.customer?.name || '-',
      p.quotation?.inquiry?.subject || '-',
      p.netValue ? Math.round(parseFloat(p.netValue)) : '0',
      p.currency || 'IDR',
      p.status || '',
      p.creator?.name || '-',
      dayjs(p.createdAt).format('YYYY-MM-DD'),
    ]);
    exportToCSV(headers, rows, `Project_PO_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting project purchase orders to CSV...');
  };

  const columns = [
    {
      title: 'PO No.',
      dataIndex: 'poNumber',
      valueType: 'text',
      render: (_, r) => r.poNumber || <span className="text-gray-400 italic text-xs">Not available</span>,
    },
    {
      title: 'Quotation No.',
      dataIndex: 'quotationRef',
      valueType: 'text',
      render: (_, r) => (
        <span className="font-medium text-gray-700">
          {r.quotation?.quotationNumber || '-'}
        </span>
      ),
    },
    {
      title: 'Inquiry No.',
      dataIndex: 'inquiryNumber',
      valueType: 'text',
      render: (_, r) => <Text strong className="font-mono text-xs text-blue-700">{r.quotation?.inquiry?.inquiryNumber || '-'}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      hideInSearch: true,
      valueType: 'dateRange',
      fieldProps: { format: 'DD/MM/YYYY' },
      render: (_, r) => r.createdAt ? dayjs(r.createdAt).format('DD/MM/YYYY') : '-',
      search: { transform: (value) => ({ dateStart: value[0], dateEnd: value[1] }) },
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      valueType: 'text',
      render: (_, r) => r.quotation?.inquiry?.customer?.name || '-',
    },
    {
      title: 'Code Word',
      dataIndex: ['inquiry', 'codeWord', 'code'],
      key: 'codeWordCode',
      valueType: 'text',
      render: (_, r) => r.quotation?.inquiry?.codeWord?.code || '-',
      search: {
        transform: (value) => ({
          codeWordCode: value,
        }),
      },
    },
    {
      title: 'PO Value',
      dataIndex: 'netValue',
      align: 'right',
      hideInSearch: true,
      render: (_, r) => {
        const val = r.netValue !== null && r.netValue !== undefined && Number(r.netValue) > 0 
          ? Number(r.netValue) 
          : Number(r.quotation?.totalPrice || 0);
        return `${r.currency || 'IDR'} ${val.toLocaleString('en-US')}`;
      },
    },
    {
      title: 'Docs',
      dataIndex: 'docs',
      hideInSearch: true,
      render: (_, r) => {
        const details = r.projectDetail;
        if (!details) return '-';
        return (
          <Space size="small">
            {details.internalPoFile && (
              <Tooltip title="Internal PO">
                <Button size="small" type="text" icon={<FilePdfOutlined className="text-red-500" />} onClick={() => window.open(getFileUrl(details.internalPoFile), '_blank')} />
              </Tooltip>
            )}
            {details.ocFile && (
              <Tooltip title="Order Confirmation">
                <Button size="small" type="text" icon={<FilePdfOutlined className="text-blue-500" />} onClick={() => window.open(getFileUrl(details.ocFile), '_blank')} />
              </Tooltip>
            )}
            {details.projectReportFile && (
              <Tooltip title="Project Report">
                <Button size="small" type="text" icon={<FilePdfOutlined className="text-green-500" />} onClick={() => window.open(getFileUrl(details.projectReportFile), '_blank')} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: getValueEnum(['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'IN_PROGRESS', 'COMPLETED']),
      render: (_, r) => <Tag color={getStatusColor(r.status)}>{r.status}</Tag>,
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
      title: 'Updater',
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
            onClick={() => navigate(`/project/po/${r.id}`)}
          />
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
            const result = await getPOs({ poType: 'PROJECT' });
            let filtered = Array.isArray(result) ? [...result] : [];
            setAllData(filtered);

            if (params.poNumber) {
              const s = params.poNumber.toLowerCase();
              filtered = filtered.filter(p => p.poNumber?.toLowerCase().includes(s));
            }
            if (params.inquiryNumber) {
              const s = params.inquiryNumber.toLowerCase();
              filtered = filtered.filter(p => p.quotation?.inquiry?.inquiryNumber?.toLowerCase().includes(s));
            }
            if (params.quotationRef) {
              const s = params.quotationRef.toLowerCase();
              filtered = filtered.filter(p => p.quotation?.quotationNumber?.toLowerCase().includes(s));
            }
            if (params.customerName) {
              const s = params.customerName.toLowerCase();
              filtered = filtered.filter(p => p.quotation?.inquiry?.customer?.name?.toLowerCase().includes(s));
            }
            if (params.codeWordCode) {
              const s = params.codeWordCode.toLowerCase();
              filtered = filtered.filter(p => p.quotation?.inquiry?.codeWord?.code?.toLowerCase().includes(s));
            }
            if (params.status) {
              filtered = filtered.filter(p => p.status === params.status);
            }
            if (params.dateStart && params.dateEnd) {
              const start = dayjs(params.dateStart, ['DD/MM/YYYY', 'YYYY-MM-DD']).startOf('day');
              const end = dayjs(params.dateEnd, ['DD/MM/YYYY', 'YYYY-MM-DD']).endOf('day');
              filtered = filtered.filter(p => {
                if (!p.createdAt) return false;
                const d = dayjs(p.createdAt);
                return d.isSameOrAfter(start) && d.isSameOrBefore(end);
              });
            }

            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load project PO');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div className="flex items-center gap-3">
            <ShoppingCartOutlined className="text-primary-600 text-2xl" />
            <div>
              <h1 className="text-xl font-bold text-gray-800 m-0">Project Purchase Orders</h1>
              <p className="text-sm text-gray-500 m-0 font-normal">PO from Project workflow</p>
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
          Are you sure you want to permanently delete this Purchase Order? This action <strong>cannot be undone</strong>.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <p className="font-semibold text-blue-700 text-base mb-3">{deleteModal.record?.poNumber || <span className="italic text-gray-400">No PO #</span>}</p>
          <div className="text-sm space-y-1 text-gray-600">
            <p>Customer: <strong>{deleteModal.record?.quotation?.inquiry?.customer?.name || '-'}</strong></p>
            <p>Inquiry Ref: <strong>{deleteModal.record?.quotation?.inquiry?.inquiryNumber || '-'}</strong></p>
            <p>Status: <strong>{deleteModal.record?.status || '-'}</strong></p>
          </div>
        </div>
      </Modal>
    </>
  );
}

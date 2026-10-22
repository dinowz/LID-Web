import React, { useState, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Tag, Button, message, Typography, Modal, Space, Tooltip } from 'antd';
import { EyeOutlined, DeleteOutlined, ExclamationCircleOutlined, ClockCircleOutlined, FilePdfOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getPOs, deletePO } from '../../../services/po.service';
import usePermissions from '../../../hooks/usePermissions';
import { getFileUrl } from '../../../utils/file';
import { getStatusColor, getIdleInfo, getValueEnum } from '../../../utils/statusHelper';
import { exportToCSV } from '../../../utils/exportCsv';
import { ActionButtonGroup, ViewActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const { Text } = Typography;

const STATUS_COLOR = {
  REVIEW: 'orange',
  PROCESSING: 'processing',
  WAITING_OC: 'processing',
  READY: 'green',
  COMPLETED: 'green'
};

export default function ServicePOList() {
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
      await deletePO(record.id);
      message.success('Purchase Order successfully deleted');
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (error) {
      message.error(error.response?.data?.error || error.message || 'Failed to delete PO');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['PO Number', 'SD Document', 'Inquiry/TFS Ref', 'Customer', 'Code Word', 'Net Value', 'Currency', 'Status', 'Creator', 'Date'];
    const rows = data.map(p => [
      p.poNumber || '',
      p.sdDocument || '',
      p.quotation?.inquiry?.inquiryNumber || p.tfs?.inquiry?.inquiryNumber || p.tfs?.tfsNumber || '-',
      p.quotation?.inquiry?.customer?.name || p.tfs?.inquiry?.customer?.name || p.tfs?.customerName || '-',
      p.codeWord || p.quotation?.inquiry?.codeWord?.code || p.tfs?.inquiry?.codeWord?.code || '-',
      p.netValue ? Math.round(parseFloat(p.netValue)) : '0',
      p.currency || 'IDR',
      p.status || '',
      p.creator?.name || '-',
      dayjs(p.createdAt).format('YYYY-MM-DD'),
    ]);
    exportToCSV(headers, rows, `Service_PO_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting service purchase orders to CSV...');
  };

  const columns = [
    {
      title: 'PO No.', dataIndex: 'poNumber', key: 'poNumber', order: 6,
      valueType: 'text',
      render: (_, r) => (
        <div>
          {r.poNumber ? <div className="text-sm font-semibold">{r.poNumber}</div> : <span className="text-gray-400 italic text-xs">No PO #</span>}
          {r.sdDocument && <div className="text-xs text-gray-500">SD: {r.sdDocument}</div>}
        </div>
      )
    },
    {
      title: 'Quotation No.',
      dataIndex: 'quotationRef',
      key: 'quotationRef',
      valueType: 'text',
      render: (_, r) => (
        <span className="font-medium text-gray-700">
          {r.quotation?.quotationNumber || '-'}
        </span>
      ),
      search: {
        transform: (value) => ({
          quotationRef: value,
        }),
      },
    },
    {
      title: 'Inquiry No.', dataIndex: 'refNumber', key: 'refNumber',
      valueType: 'text',
      render: (_, r) => (
        <span className="font-medium">
          {r.quotation?.inquiry?.inquiryNumber || r.tfs?.inquiry?.inquiryNumber || r.tfs?.tfsNumber || '-'}
          {r.tfs && <Tag color="orange" className="ml-1 text-[10px]">IC</Tag>}
        </span>
      )
    },
    {
      title: 'Date', dataIndex: 'createdAt', key: 'createdAt',
      valueType: 'dateRange',
      hideInSearch: true,
      fieldProps: { format: 'DD/MM/YYYY' },
      render: (_, r) => dayjs(r.createdAt).format('DD/MM/YYYY'),
      search: { transform: (value) => ({ startDate: value[0], endDate: value[1] }) },
    },
    {
      title: 'Customer', dataIndex: 'customerName', key: 'customerName',
      valueType: 'text', order: 4,
      render: (_, r) => r.quotation?.inquiry?.customer?.name || r.tfs?.inquiry?.customer?.name || r.tfs?.customerName || '-'
    },
    {
      title: 'Code Word',
      dataIndex: 'codeWordCode',
      key: 'codeWordCode',
      valueType: 'text',
      order: 3,
      render: (_, r) =>
        r.codeWord ||
        r.quotation?.inquiry?.codeWord?.code ||
        r.tfs?.inquiry?.codeWord?.code ||
        '-',
      search: {
        transform: (value) => ({
          codeWordCode: value,
        }),
      },
    },
    {
      title: 'PO Value', dataIndex: 'netValue', key: 'netValue', align: 'right',
      hideInSearch: true,
      render: (_, r) => {
        const val = r.netValue !== null && r.netValue !== undefined && Number(r.netValue) > 0 
          ? Number(r.netValue) 
          : Number(r.quotation?.totalPrice || 0);
        return `${r.currency || 'IDR'} ${val.toLocaleString('en-US')}`;
      }
    },
    {
      title: 'Docs',
      key: 'docs',
      hideInSearch: true,
      render: (_, r) => {
        const details = r.serviceDetail;
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
            {details.serviceReportFile && (
              <Tooltip title="Service Report">
                <Button size="small" type="text" icon={<FilePdfOutlined className="text-green-500" />} onClick={() => window.open(getFileUrl(details.serviceReportFile), '_blank')} />
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      valueType: 'select',
      valueEnum: getValueEnum(['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'COMPLETED']),
      render: (_, r) => <Tag color={getStatusColor(r.status)}>{r.status}</Tag>
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
      render: (_, r) => r.creator?.name || '-'
    },
    {
      title: 'Update', key: 'updater',
      hideInSearch: true,
      render: (_, r) => r.updater?.name || '-'
    },
    {
      title: 'Action', key: 'action',
      hideInSearch: true,
      render: (_, r) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/service/po/${r.id}`)}
          />
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
            const result = await getPOs({ poType: 'SERVICE' });
            let filtered = [...result];

            setAllData(filtered);

            // Filter: PO Number
            if (params.poNumber) {
              const s = params.poNumber.toLowerCase();
              filtered = filtered.filter(p => p.poNumber?.toLowerCase().includes(s));
            }

            // Filter: Quotation Ref
            if (params.quotationRef) {
              const s = params.quotationRef.toLowerCase();

              filtered = filtered.filter(p => {
                const quotationRef = p.quotation?.quotationNumber || '';

                return quotationRef.toLowerCase().includes(s);
              });
            }

            // Filter: Code Word
            if (params.codeWordCode) {
              const s = params.codeWordCode.toLowerCase();

              filtered = filtered.filter(p => {
                const codeWord =
                  p.codeWord ||
                  p.quotation?.inquiry?.codeWord?.code ||
                  p.tfs?.inquiry?.codeWord?.code ||
                  '';

                return codeWord.toLowerCase().includes(s);
              });
            }

            // Filter: Ref Number
            if (params.refNumber) {
              const s = params.refNumber.toLowerCase();
              filtered = filtered.filter(p =>
                p.quotation?.inquiry?.inquiryNumber?.toLowerCase().includes(s) ||
                p.tfs?.inquiry?.inquiryNumber?.toLowerCase().includes(s) ||
                p.tfs?.tfsNumber?.toLowerCase().includes(s)
              );
            }

            // Filter: Customer Name
            if (params.customerName) {
              const s = params.customerName.toLowerCase();
              filtered = filtered.filter(p =>
                p.quotation?.inquiry?.customer?.name?.toLowerCase().includes(s) ||
                p.tfs?.inquiry?.customer?.name?.toLowerCase().includes(s) ||
                p.tfs?.customerName?.toLowerCase().includes(s)
              );
            }

            // Filter: Status
            if (params.status) {
              filtered = filtered.filter(p => p.status === params.status);
            }

            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load service POs');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div>
            <div className="text-base font-semibold text-gray-800">Service Purchase Orders</div>
            <div className="text-xs text-gray-400 font-normal">PO from External Purchase & External TFS workflow</div>
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
            Confirm Hard Delete Purchase Order
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
        <p className="text-gray-700 mb-2">You are about to permanently delete the PO:</p>
        <p className="font-semibold text-blue-700 text-base mb-3">
          {deleteModal.record?.poNumber || <span className="italic text-gray-400">No PO #</span>}
        </p>
        <p className="text-gray-500 text-sm">
          Customer: <strong>{deleteModal.record?.quotation?.inquiry?.customer?.name || deleteModal.record?.tfs?.inquiry?.customer?.name || deleteModal.record?.tfs?.customerName || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm">
          Ref: <strong>{deleteModal.record?.quotation?.inquiry?.inquiryNumber || deleteModal.record?.tfs?.inquiry?.inquiryNumber || deleteModal.record?.tfs?.tfsNumber || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm mb-4">
          Status: <strong>{deleteModal.record?.status}</strong>
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ This action <strong>cannot be undone</strong>. All PO data including details and history will be permanently deleted.
        </div>
      </Modal>
    </>
  );
}

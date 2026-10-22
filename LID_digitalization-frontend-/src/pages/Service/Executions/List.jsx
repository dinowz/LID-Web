import React, { useState, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Tag, Button, message, Progress, Tooltip, Modal, Space, Typography } from 'antd';
import { EyeOutlined, DeleteOutlined, ExclamationCircleOutlined, ClockCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import usePermissions from '../../../hooks/usePermissions';
import { getServices, deleteService } from '../../../services/service.service';
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

const { Title, Text } = Typography;

const formatSourceType = (type) => {
  switch (type) {
    case 'EXTERNAL_PURCHASE': return 'External Purchase';
    case 'IC_TFS': return 'IC - TFS';
    case 'EXTERNAL_TFS': return 'External TFS';
    default: return type || '-';
  }
};

const SOURCE_TYPE_COLOR = {
  'EXTERNAL_PURCHASE': 'purple',
  'IC_TFS': 'blue',
  'EXTERNAL_TFS': 'cyan'
};

// Parse engineerName format "ServiceType|PIC Name"
const parseEngineerName = (val) => {
  if (!val) return { serviceType: null, picName: null };
  const parts = val.split('|');
  return { serviceType: parts[0] || null, picName: parts[1] || null };
};

const STATUS_COLOR = {
  PENDING: 'orange', IN_PROGRESS: 'blue', DONE: 'green',
};

export default function ServiceExecutionList() {
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
      await deleteService(record.id);
      message.success('Service Execution successfully deleted');
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (error) {
      message.error(error.message || 'Failed to delete service execution');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['Execution No', 'SD Number', 'Inquiry Number', 'Quotation Number', 'PO Number', 'Customer', 'Code Word', 'Subject', 'Location', 'Service Type', 'PIC', 'Creator', 'Status', 'Progress (%)', 'Start Date', 'Target Date'];
    const rows = data.map(ex => {
      const { picName } = parseEngineerName(ex.engineerName);
      return [
        ex.serviceNumber || '',
        ex.sdNumber || '-',
        ex.inquiryNumber || '-',
        ex.quotationNumber || '-',
        ex.purchaseOrder?.poNumber || '-',
        ex.customerName || '-',
        ex.codeWord || '-',
        ex.subject || '',
        ex.location || '',
        formatSourceType(ex.sourceType),
        picName || '-',
        ex.creator?.name || '-',
        ex.status || '',
        ex.progressPercentage || 0,
        ex.startDate ? dayjs(ex.startDate).format('YYYY-MM-DD') : '-',
        ex.targetDate ? dayjs(ex.targetDate).format('YYYY-MM-DD') : '-',
      ];
    });
    exportToCSV(headers, rows, `Service_Execution_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting service executions to CSV...');
  };

  const columns = [
    {
      title: 'Service No.', dataIndex: 'serviceNumber', key: 'serviceNumber', order: 6,
      valueType: 'text',
      render: (_, r) => <span className="font-medium">{r.serviceNumber}</span>
    },
    {
      title: 'SD No.', dataIndex: 'sdNumber', key: 'sdNumber',
      valueType: 'text',
      render: (_, r) => <span className="font-mono">{r.sdNumber || '-'}</span>
    },
    {
      title: 'Quotation No.', dataIndex: 'quotationNumber', key: 'quotationNumber',
      valueType: 'text',
      render: (_, r) => <span className="font-mono">{r.quotationNumber || '-'}</span>
    },
    {
      title: 'Inquiry No.', dataIndex: 'inquiryNumber', key: 'inquiryNumber',
      valueType: 'text',
      render: (_, r) => <span className="font-mono">{r.inquiryNumber || '-'}</span>
    },
    {
      title: 'Customer', dataIndex: 'customerName', key: 'customerName', order: 5,
      valueType: 'text',
      render: (_, r) => r.customerName || '-'
    },
    {
      title: 'Code Word',
      dataIndex: 'codeWord',
      key: 'codeWord',
      valueType: 'text',
      order: 4,
      render: (_, record) => {
        const codeWord =
          record.codeWord ||
          record.purchaseOrder?.codeWord ||
          record.purchaseOrder?.quotation?.inquiry?.codeWord?.code ||
          record.purchaseOrder?.tfs?.inquiry?.codeWord?.code ||
          '';

        return codeWord ? (
          <Tag color="purple">{codeWord}</Tag>
        ) : (
          '-'
        );
      },
      search: {
        transform: (value) => ({
          codeWord: value,
        }),
      },
    },
    {
      title: 'Subject / Description', dataIndex: 'subject', key: 'subject',
      valueType: 'text',
      hideInSearch: true,
      render: (_, r) => r.subject ? (
        <Tooltip title={r.subject}>
          <div className="truncate max-w-[230px]">{r.subject}</div>
        </Tooltip>
      ) : '-'
    },
    {
      title: 'Service Type', key: 'serviceType',
      hideInSearch: true,
      render: (_, r) => {
        const formatted = formatSourceType(r.sourceType);
        const color = SOURCE_TYPE_COLOR[r.sourceType] || 'default';
        return r.sourceType ? <Tag color={color}>{formatted}</Tag> : '-';
      }
    },
    {
      title: 'Progress', key: 'progress', width: 150,
      hideInSearch: true,
      render: (_, r) => <Progress percent={r.progressPercentage || 0} size="small" status={r.progressPercentage === 100 ? 'success' : 'active'} />
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      valueType: 'select',
      valueEnum: getValueEnum(['PENDING', 'IN_PROGRESS', 'DONE', 'COMPLETED']),
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
      title: 'Creator',
      key: 'creator',
      hideInSearch: true,
      render: (_, r) => r.creator?.name || '-'
    },
    {
      title: 'Updater',
      key: 'updater',
      hideInSearch: true,
      render: (_, r) => r.updater?.name || '-'
    },
    {
      title: 'Action', key: 'action',
      hideInSearch: true,
      render: (_, r) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/service/executions/${r.id}`)}
          />
          {permissions.canDelete && r.status === 'PENDING' && (
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
            const result = await getServices();
            console.log(result)
            let filtered = Array.isArray(result) ? [...result] : [];


            // Filter: Execution Number
            if (params.serviceNumber) {
              const s = params.serviceNumber.toLowerCase();
              filtered = filtered.filter(ex => ex.serviceNumber?.toLowerCase().includes(s));
            }

            // Filter: Quotation Number
            if (params.quotationNumber) {
              const s = params.quotationNumber.toLowerCase();
              filtered = filtered.filter(ex => ex.quotationNumber?.toLowerCase().includes(s));
            }

            // Filter: PO Number
            if (params.poNumber) {
              const s = params.poNumber.toLowerCase();
              filtered = filtered.filter(ex => ex.purchaseOrder?.poNumber?.toLowerCase().includes(s));
            }

            // Filter: Customer Name
            if (params.customerName) {
              const s = params.customerName.toLowerCase();
              filtered = filtered.filter(ex => ex.customerName?.toLowerCase().includes(s));
            }

            // Filter: Code Word
            if (params.codeWord) {
              const s = params.codeWord.toLowerCase();

              filtered = filtered.filter(ex => {
                const codeWord =
                  ex.codeWord ||
                  ex.purchaseOrder?.codeWord ||
                  ex.purchaseOrder?.quotation?.inquiry?.codeWord?.code ||
                  ex.purchaseOrder?.tfs?.inquiry?.codeWord?.code ||
                  '';

                return codeWord.toLowerCase().includes(s);
              });
            }

            // Filter: Subject
            if (params.subject) {
              const s = params.subject.toLowerCase();
              filtered = filtered.filter(ex => ex.subject?.toLowerCase().includes(s));
            }

            // Filter: Inquiry Number
            if (params.inquiryNumber) {
              const s = params.inquiryNumber.toLowerCase();
              filtered = filtered.filter(ex => ex.inquiryNumber?.toLowerCase().includes(s));
            }

            // Filter: Status
            if (params.status) {
              filtered = filtered.filter(ex => ex.status === params.status);
            }

            // Filter: Date Range
            if (params.startDate && params.endDate) {
              const start = dayjs(params.startDate, ['DD/MM/YYYY', 'YYYY-MM-DD']).startOf('day');
              const end = dayjs(params.endDate, ['DD/MM/YYYY', 'YYYY-MM-DD']).endOf('day');
              filtered = filtered.filter(ex => {
                const d = dayjs(ex.startDate || ex.createdAt);
                return d.isSameOrAfter(start) && d.isSameOrBefore(end);
              });
            }

            setAllData(filtered);

            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load service data');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div>
            <div className="text-base font-semibold text-gray-800">Service Execution</div>
            <div className="text-xs text-gray-400 font-normal">Monitor and update service execution progress</div>
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
            Confirm Hard Delete Service Execution
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
        <p className="text-gray-700 mb-2">You are about to permanently delete the service execution:</p>
        <p className="font-semibold text-blue-700 text-base mb-3">
          {deleteModal.record?.serviceNumber || <span className="italic text-gray-400">No Execution #</span>}
        </p>
        <p className="text-gray-500 text-sm">
          Customer: <strong>{deleteModal.record?.customerName || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm">
          PO Ref: <strong>{deleteModal.record?.purchaseOrder?.poNumber || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm">
          Subject: <strong>{deleteModal.record?.subject || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm mb-4">
          Status: <strong>{deleteModal.record?.status}</strong>
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ This action <strong>cannot be undone</strong>. All service execution data including logs and history will be permanently deleted.
        </div>
      </Modal>
    </>
  );
}

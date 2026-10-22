import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProTable } from '@ant-design/pro-components';
import { Tag, Button, message, Progress, Tooltip, Modal, Space, Typography, Badge } from 'antd';
import { EyeOutlined, DeleteOutlined, ExclamationCircleFilled, ClockCircleOutlined, DownloadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import usePermissions from '../../../hooks/usePermissions';
import { getProjects, deleteProject } from '../../../services/project.service';
import { getStatusColor, getIdleInfo, getValueEnum } from '../../../utils/statusHelper';
import { exportToCSV } from '../../../utils/exportCsv';
import { ActionButtonGroup, ViewActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const { Text } = Typography;

const STATUS_COLOR = {
  PENDING: 'orange',
  IN_PROGRESS: 'blue',
  DONE: 'green',
};

const PROJECT_TYPE_LABELS = {
  OM: 'O&M',
  NEW_PLANT: 'New Plant',
  UPGRADE: 'Upgrade',
};

export default function ProjectExecutionList() {
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
      await deleteProject(record.id);
      message.success('Project deleted successfully');
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (error) {
      console.error(error);
      message.error(error.message || 'Failed to delete project');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['Project No', 'Project Name', 'Customer', 'Subject', 'Code Word', 'Type', 'PO Number', 'Quotation No', 'Inquiry No', 'Progress (%)', 'Status', 'Creator', 'Target Date', 'Created At'];
    const rows = data.map(p => [
      p.projectNumber || '',
      p.projectName || '',
      p.purchaseOrder?.quotation?.inquiry?.customer?.name || '-',
      p.purchaseOrder?.quotation?.inquiry?.subject || '-',
      p.purchaseOrder?.codeWord || '-',
      PROJECT_TYPE_LABELS[p.projectType] || p.projectType,
      p.purchaseOrder?.poNumber || '-',
      p.purchaseOrder?.quotation?.quotationNumber || '-',
      p.purchaseOrder?.quotation?.inquiry?.inquiryNumber || '-',
      p.progressPercentage || 0,
      p.status || '',
      p.creator?.name || '-',
      p.targetDate ? dayjs(p.targetDate).format('YYYY-MM-DD') : '-',
      dayjs(p.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    exportToCSV(headers, rows, `Project_Execution_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting project executions to CSV...');
  };

  const columns = [
    {
      title: 'Project No.',
      dataIndex: 'projectNumber',
      valueType: 'text',
      order: 6,
      render: v => <Text strong className="font-mono text-xs text-blue-700">{v}</Text>,
    },
    {
      title: 'Quotation No.',
      dataIndex: 'quotationRef',
      valueType: 'text',
      render: (_, r) => r.purchaseOrder?.quotation?.quotationNumber || '-',
    },
    {
      title: 'Inquiry No.',
      dataIndex: 'inquiryRef',
      valueType: 'text',
      render: (_, r) => r.purchaseOrder?.quotation?.inquiry?.inquiryNumber || '-',
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      valueType: 'text',
      order: 5,
      render: (_, r) => r.purchaseOrder?.quotation?.inquiry?.customer?.name || '-',
    },
    {
      title: 'Code Word',
      dataIndex: 'codeWord',
      valueType: 'text',
      order: 4,
      render: (_, r) => r.purchaseOrder?.codeWord ? (
        <Tag color="purple">{r.purchaseOrder.codeWord}</Tag>
      ) : '-',
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      hideInSearch: true,
      valueType: 'text',
      render: (_, r) => r.purchaseOrder?.quotation?.inquiry?.subject || '-',
    },
    {
      title: 'Project Type',
      dataIndex: 'projectType',
      hideInSearch: true,
      valueType: 'select',
      valueEnum: {
        OM: { text: 'O&M' },
        NEW_PLANT: { text: 'New Plant' },
        UPGRADE: { text: 'Upgrade' },
      },
      render: v => <Tag color="gray">{PROJECT_TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Progress',
      dataIndex: 'progressPercentage',
      hideInSearch: true,
      render: (_, r) => (
        <Progress
          percent={r.progressPercentage || 0}
          size="small"
          status={r.status === 'DONE' ? 'success' : 'active'}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: getValueEnum(['PENDING', 'IN_PROGRESS', 'DONE', 'COMPLETED']),
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
            onClick={() => navigate(`/project/executions/${r.id}`)}
          />
          {permissions.canDelete && r.status === 'PENDING' && (
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
            const result = await getProjects();
            let filtered = Array.isArray(result) ? [...result] : [];
            setAllData(filtered);

            if (params.projectNumber) {
              const s = params.projectNumber.toLowerCase();
              filtered = filtered.filter(p => p.projectNumber?.toLowerCase().includes(s));
            }
            if (params.projectName) {
              const s = params.projectName.toLowerCase();
              filtered = filtered.filter(p => p.projectName?.toLowerCase().includes(s));
            }
            if (params.customerName) {
              const s = params.customerName.toLowerCase();
              filtered = filtered.filter(p => p.purchaseOrder?.quotation?.inquiry?.customer?.name?.toLowerCase().includes(s));
            }
            if (params.codeWord) {
              const s = params.codeWord.toLowerCase();
              filtered = filtered.filter(p => p.purchaseOrder?.codeWord?.toLowerCase().includes(s));
            }
            if (params.poNumber) {
              const s = params.poNumber.toLowerCase();
              filtered = filtered.filter(p => p.purchaseOrder?.poNumber?.toLowerCase().includes(s));
            }
            if (params.quotationRef) {
              const s = params.quotationRef.toLowerCase();
              filtered = filtered.filter(p => p.purchaseOrder?.quotation?.quotationNumber?.toLowerCase().includes(s));
            }
            if (params.inquiryRef) {
              const s = params.inquiryRef.toLowerCase();
              filtered = filtered.filter(p => p.purchaseOrder?.quotation?.inquiry?.inquiryNumber?.toLowerCase().includes(s));
            }
            if (params.status) {
              filtered = filtered.filter(p => p.status === params.status);
            }

            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load project data');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div className="flex items-center gap-3">
            <FolderOpenOutlined className="text-primary-600 text-2xl" />
            <div>
              <h1 className="text-xl font-bold text-gray-800 m-0">Project Execution</h1>
              <p className="text-sm text-gray-500 m-0 font-normal">Monitor and update project progress</p>
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
          Are you sure you want to permanently delete this project? This action <strong>cannot be undone</strong> and will remove all associated data.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <p className="font-semibold text-blue-700 text-base mb-3">{deleteModal.record?.projectNumber}</p>
          <div className="text-sm space-y-1 text-gray-600">
            <p>Project Name: <strong>{deleteModal.record?.projectName || '-'}</strong></p>
            <p>PO Number: <strong>{deleteModal.record?.purchaseOrder?.poNumber || '-'}</strong></p>
            <p>Status: <strong>{deleteModal.record?.status || '-'}</strong></p>
          </div>
        </div>
      </Modal>
    </>
  );
}

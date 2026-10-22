import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProTable } from '@ant-design/pro-components';
import { Tag, Button, Space, Tooltip, message, Popconfirm, Badge, Dropdown, Modal } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, DollarOutlined, GiftOutlined, CoffeeOutlined, DownOutlined, CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { getAllTfs, deleteTfsAssignment } from '../../../services/tfs.service';
import { getMasterDivisions } from '../../../services/master.service';
import usePermissions from '../../../hooks/usePermissions';
import { ActionButtonGroup, EditActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const STATUS_COLOR = {
  DRAFT: 'default',
  PENDING: 'orange',
  IN_PROGRESS: 'blue',
  DONE: 'green',
  CANCELLED: 'red',
  ASSIGNED: 'purple',
};

const ASSIGNMENT_TYPE_CONFIG = {
  PAID_ASSIGNMENT: { label: 'Paid', color: 'blue', icon: <DollarOutlined /> },
  FREE_ASSIGNMENT: { label: 'Free', color: 'green', icon: <GiftOutlined /> },
  DAY_OFF: { label: 'Day Off', color: 'default', icon: <CoffeeOutlined /> },
};

export default function ScheduledTFSList() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [allData, setAllData] = useState([]);
  const [personnelList, setPersonnelList] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const actionRef = useRef();

  useEffect(() => {
    getMasterDivisions({ active: true }).then(setPersonnelList).catch(() => { });
  }, []);

  const handleDelete = async () => {
    const { record } = deleteModal;
    if (!record) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteTfsAssignment(record.id);
      message.success(`TFS ${record.tfsNumber} deleted`);
      actionRef.current?.reload();
      setDeleteModal({ open: false, record: null, loading: false });
    } catch (err) {
      message.error(err.message || 'Failed to delete');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) {
      message.warning('No data to export');
      return;
    }

    const headers = [
      'TFS Number', 'Type', 'Service Number', 'Service Type', 'Personnel', 'Personnel Code', 'Title', 'Start Date', 'End Date', 'Days', 'Hours/Day', 'Status'
    ];

    const rows = data.map(r => {
      const type = getServiceType(r);
      const typeLabel = SERVICE_TYPE_CONFIG[type]?.label || type || '-';
      return [
        r.tfsNumber || '',
        r.assignmentType || 'PAID_ASSIGNMENT',
        r.serviceExecution?.serviceNumber || '-',
        typeLabel,
        r.personnel?.name || '-',
        r.personnel?.personnel_code || '-',
        r.title || '',
        r.startDate ? dayjs(r.startDate).format('YYYY-MM-DD') : '-',
        r.endDate ? dayjs(r.endDate).format('YYYY-MM-DD') : '-',
        r.days || 0,
        r.hoursPerDay || 0,
        r.status || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Scheduled_TFS_Report_${dayjs().format('YYYYMMDD_HHmm')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('Exporting to CSV...');
  };

  const newScheduleItems = {
    items: [
      { key: 'PAID', label: 'Paid Assignment', icon: <DollarOutlined /> },
      { key: 'FREE', label: 'Free Assignment', icon: <GiftOutlined /> },
      { key: 'DAYOFF', label: 'Day Off', icon: <CoffeeOutlined /> },
    ],
    onClick: ({ key }) => navigate(`/tfs/scheduled/create?type=${key}`),
  };

  const SERVICE_TYPE_CONFIG = {
    EXTERNAL_PURCHASE: { label: 'External Purchase', color: 'purple' },
    IC_TFS: { label: 'IC - TFS', color: 'blue' },
    EXTERNAL_TFS: { label: 'External TFS', color: 'cyan' },
  };

  const getServiceType = (row) =>
    row.serviceExecution?.sourceType ||
    row.sourceType ||
    '';

  // Convert personnelList to ProTable valueEnum format
  const personnelValueEnum = personnelList.reduce((acc, curr) => {
    acc[curr.id] = { text: `[${curr.personnel_code}] ${curr.name}` };
    return acc;
  }, {});

  const columns = [
    {
      title: 'TFS No.',
      dataIndex: 'tfsNumber',
      valueType: 'text',
      order: 6,
      render: (v) => <span className="font-mono text-xs font-semibold text-blue-700">{v}</span>,
    },
    {
      title: 'Service No.',
      dataIndex: 'serviceNumber',
      valueType: 'text',
      render: (_, r) => r.serviceExecution ? (
        <Button
          type="link"
          size="small"
          className="p-0 text-primary-600"
          onClick={() => navigate(`/service/executions/${r.serviceExecution?.id}`)}
        >
          {r.serviceExecution?.serviceNumber || '-'}
        </Button>
      ) : (
        <Tag color="orange">Standalone</Tag>
      ),
    },
    {
      title: 'Schedule Type',
      dataIndex: 'assignmentType',
      valueType: 'select',
      order: 5,
      valueEnum: {
        PAID_ASSIGNMENT: { text: 'Paid', status: 'Success' },
        FREE_ASSIGNMENT: { text: 'Free', status: 'Processing' },
        DAY_OFF: { text: 'Day Off', status: 'Default' },
      },
      render: (_, r) => {
        const config = ASSIGNMENT_TYPE_CONFIG[r.assignmentType] || ASSIGNMENT_TYPE_CONFIG.PAID_ASSIGNMENT;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Service Type',
      dataIndex: 'sourceType',
      key: 'sourceType',
      valueType: 'select',
      order: 4,
      valueEnum: {
        EXTERNAL_PURCHASE: { text: 'External Purchase', status: 'Default' },
        IC_TFS: { text: 'IC - TFS', status: 'Processing' },
        EXTERNAL_TFS: { text: 'External TFS', status: 'Success' },
      },
      render: (_, r) => {
        const type = getServiceType(r);
        const config = SERVICE_TYPE_CONFIG[type];
        return config
          ? <Tag color={config.color}>{config.label}</Tag>
          : <span className="text-gray-400">-</span>;
      },
    },

    {
      title: 'Personnel',
      dataIndex: 'personnelId',
      valueType: 'select',
      valueEnum: personnelValueEnum,
      order: 6,
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.personnel?.name || '-'}</div>
          <div className="text-xs text-gray-400">{r.personnel?.personnel_code} — {r.personnel?.title}</div>
        </div>
      ),
    },
    {
      title: 'Task Title',
      dataIndex: 'title',
      hideInSearch: true,
      valueType: 'text',
      render: v => v || <span className="italic text-gray-400">—</span>,
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      hideInSearch: true,
      valueType: 'dateRange',
      fieldProps: { format: 'DD/MM/YYYY' },
      render: (_, r) => r.startDate ? dayjs(r.startDate).format('DD/MM/YYYY') : '-',
      search: { transform: (value) => ({ startDateStart: value[0], startDateEnd: value[1] }) },
      sorter: (a, b) => new Date(a.startDate) - new Date(b.startDate),
      defaultSortOrder: 'descend',
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      hideInSearch: true,
      render: (_, r) => r.endDate ? dayjs(r.endDate).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Duration',
      dataIndex: 'days',
      align: 'center',
      hideInSearch: true,
      render: (_, r) => r.days ? <Badge count={`${r.days}d`} color="geekblue" overflowCount={999} /> : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        DRAFT: { text: 'DRAFT', status: 'Default' },
        PENDING: { text: 'PENDING', status: 'Warning' },
        IN_PROGRESS: { text: 'IN PROGRESS', status: 'Processing' },
        DONE: { text: 'DONE', status: 'Success' },
        CANCELLED: { text: 'CANCELLED', status: 'Error' },
      },
      render: (_, r) => <Tag color={STATUS_COLOR[r.status] || 'default'}>{r.status || '-'}</Tag>,
    },
    {
      title: 'Actions',
      align: 'center',
      hideInSearch: true,
      render: (_, r) => {
        const isLocked = r.serviceExecution?.status === 'DONE' || ['IN_PROGRESS', 'DONE', 'CANCELLED'].includes(r.status);
        return (
          <ActionButtonGroup>
            {permissions.canEditTFS && (
              <EditActionButton
                onClick={() =>
                  navigate(`/tfs/scheduled/create?editId=${r.id}&serviceId=${r.serviceExecution?.id || ''}&serviceNumber=${r.serviceExecution?.serviceNumber || ''}`)
                }
                isLocked={isLocked}
                lockTooltip="Cannot edit ongoing/finished schedule"
              />
            )}
            {permissions.canDelete && (
              <DeleteActionButton
                onClick={() => setDeleteModal({ open: true, record: r, loading: false })}
                disabled={isLocked}
                tooltip={isLocked ? "Cannot delete ongoing/finished schedule" : "Delete"}
              />
            )}
          </ActionButtonGroup>
        );
      },
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
            const result = await getAllTfs();
            console.log(result)
            let filtered = [...result];
            setAllData(filtered);

            // Filter: TFS Number
            if (params.tfsNumber) {
              const s = params.tfsNumber.toLowerCase();
              filtered = filtered.filter(row => row.tfsNumber?.toLowerCase().includes(s));
            }

            // Filter: Service Number
            if (params.serviceNumber) {
              const s = params.serviceNumber.toLowerCase();
              filtered = filtered.filter(row => row.serviceExecution?.serviceNumber?.toLowerCase().includes(s));
            }

            // Filter: Task Title
            if (params.title) {
              const s = params.title.toLowerCase();
              filtered = filtered.filter(row => row.title?.toLowerCase().includes(s));
            }

            // Filter: Personnel
            if (params.personnelId) {
              filtered = filtered.filter(row => row.personnel?.id === params.personnelId);
            }

            // Filter: Assignment Type
            if (params.assignmentType) {
              filtered = filtered.filter(row => row.assignmentType === params.assignmentType);
            }

            // Filter: Status
            if (params.status) {
              filtered = filtered.filter(row => row.status === params.status);
            }

            // Filter: Service Type
            if (params.sourceType) {
              filtered = filtered.filter(row => getServiceType(row) === params.sourceType);
            }

            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load TFS data');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div>
            <div className="flex items-center gap-3">
              <CalendarOutlined className="text-primary-600 text-2xl" />
              <div>
                <h1 className="text-xl font-bold text-gray-800 m-0">Scheduled TFS</h1>
                <p className="text-sm text-gray-500 m-0 font-normal">Manage Technical Field Service personnel scheduling</p>
              </div>
            </div>
          </div>
        }
        toolBarRender={() => [
          permissions.canEditTFS && (
            <Dropdown key="new" menu={newScheduleItems} placement="bottomRight">
              <Button type="primary" icon={<PlusOutlined />} className="bg-primary-600">
                New Schedule <DownOutlined />
              </Button>
            </Dropdown>
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
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        search={{ labelWidth: 'auto', layout: 'vertical', defaultCollapsed: false }}
        cardProps={{ className: 'rounded-xl shadow-sm border-gray-100 mt-5' }}
      />
      <Modal
        title={
          <div className="flex items-center gap-2 text-red-600">
            <span className="anticon"><DeleteOutlined /></span>
            <span>Confirm Deletion</span>
          </div>
        }
        open={deleteModal.open}
        onOk={handleDelete}
        onCancel={() => setDeleteModal({ open: false, record: null, loading: false })}
        confirmLoading={deleteModal.loading}
        okText="Yes, Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        centered
      >
        <p className="mb-4 text-gray-600">
          Are you sure you want to permanently delete this TFS schedule? This action <strong>cannot be undone</strong>.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <p className="font-semibold text-blue-700 text-base mb-3">{deleteModal.record?.tfsNumber || <span className="italic text-gray-400">No TFS #</span>}</p>
          <div className="text-sm space-y-1 text-gray-600">
            <p>Personnel: <strong>{deleteModal.record?.personnel?.name || '-'}</strong></p>
            <p>Type: <strong>{deleteModal.record?.assignmentType || '-'}</strong></p>
            <p>Status: <strong>{deleteModal.record?.status || '-'}</strong></p>
          </div>
        </div>
      </Modal>
    </>
  );
}

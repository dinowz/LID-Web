import React, { useState, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Typography, Tag, Button, message, Tooltip, Space, Modal } from 'antd';
import { EyeOutlined, WarningOutlined, TruckOutlined, EnvironmentOutlined, DeleteOutlined, ExclamationCircleOutlined, ClockCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getDeliveries, deleteDelivery } from '../../../services/delivery.service';
import usePermissions from '../../../hooks/usePermissions';
import { getStatusColor, getStatusTagProps, getValueEnum } from '../../../utils/statusHelper';
import dayjs from 'dayjs';
import { ActionButtonGroup, ViewActionButton, DeleteActionButton } from '../../../components/common/ActionButtons';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  REVIEW_LOGISTIC: { color: 'default', label: 'REVIEW LOGISTIC', status: 'Default' },
  PACKED: { color: 'cyan', label: 'PACKED', status: 'Processing' },
  SHIPPED: { color: 'blue', label: 'SHIPPED', status: 'Processing' },
  IN_TRANSIT: { color: 'geekblue', label: 'IN TRANSIT', status: 'Processing' },
  DELIVERED: { color: 'green', label: 'DELIVERED', status: 'Success' },
  DELAYED: { color: 'red', label: 'DELAYED', status: 'Error' },
  COMPLETED: { color: 'success', label: 'COMPLETED', status: 'Success' },
};

const isOverdue = (delivery) => {
  if (!delivery.targetDeliveryDate) return false;
  if (['COMPLETED', 'DELIVERED'].includes(delivery.status)) return false;
  const target = new Date(delivery.targetDeliveryDate);
  const now = new Date();
  return now > target;
};

const DeliveryList = () => {
  const [allData, setAllData] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const actionRef = useRef();
  const navigate = useNavigate();
  const permissions = usePermissions();

  const handleDeleteDelivery = async () => {
    const { record } = deleteModal;
    if (!record) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteDelivery(record.id);
      message.success(`Delivery ${record.deliveryNumber} successfully deleted`);
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to delete delivery');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['Delivery No', 'Status', 'PO Number', 'Customer', 'SD Document', 'Code Word', 'AWB/Tracking', 'Shipping Service', 'Current Location', 'Target Delivery Date', 'Weight (kg)', 'Freight Cost (IDR)', 'Creator', 'Created At'];
    const rows = data.map(d => [
      d.deliveryNumber || '',
      STATUS_CONFIG[d.status]?.label || d.status,
      d.purchaseOrder?.poNumber || '',
      d.purchaseOrder?.quotation?.inquiry?.customer?.name || '',
      d.purchaseOrder?.sdDocument || '',
      d.purchaseOrder?.codeWord || '',
      d.trackingNumber || '',
      d.shippingService || '',
      d.currentLocation || '',
      d.targetDeliveryDate ? dayjs(d.targetDeliveryDate).format('YYYY-MM-DD') : '-',
      d.weightKg ? parseFloat(d.weightKg).toFixed(2) : '0',
      d.freightCost ? Math.round(parseFloat(d.freightCost)) : '0',
      d.creator?.name || '-',
      dayjs(d.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    exportToCSV(headers, rows, `Delivery_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting data to CSV...');
  };

  const getIdleInfo = (record) => {
    if (!['REVIEW_LOGISTIC', 'PACKED'].includes(record.status)) return null;
    const ref = record.updatedAt || record.createdAt;
    if (!ref) return null;
    const days = Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 3) return { days, color: '#ef4444', bg: '#fef2f2', label: `${days}d idle` };
    if (days >= 1) return { days, color: '#f59e0b', bg: '#fffbeb', label: `${days}d idle` };
    return null;
  };

  const valueEnumStatus = Object.entries(STATUS_CONFIG).reduce((acc, [key, val]) => {
    acc[key] = { text: val.label, status: val.status };
    return acc;
  }, {});

  const columns = [
    {
      title: 'Delivery No',
      dataIndex: 'deliveryNumber',
      key: 'deliveryNumber',
      valueType: 'text',
      order: 7,
      render: (text, record) => (
        <div>
          <div className="font-semibold text-blue-700">{text}</div>
          {isOverdue(record) && (
            <Tag color="red" icon={<WarningOutlined />} className="text-[10px] mt-1">Overdue</Tag>
          )}
        </div>
      )
    },
    {
      title: 'PO No.',
      key: 'po',
      hideInSearch: true,
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.purchaseOrder?.poNumber || <span className="text-gray-400 italic">No PO#</span>}</div>
          <div className="text-xs text-gray-500">{r.purchaseOrder?.quotation?.inquiry?.customer?.name || '-'}</div>
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
          {r.purchaseOrder?.quotation?.quotationNumber || '-'}
        </span>
      ),
      search: {
        transform: (value) => ({
          quotationRef: value,
        }),
      },
    },
    {
      title: 'Inquiry No.',
      dataIndex: 'inquiryRef',
      key: 'inquiryRef',
      valueType: 'text',
      render: (_, r) => (
        <span className="font-medium text-gray-700">
          {r.purchaseOrder?.quotation?.inquiry?.inquiryNumber || '-'}
        </span>
      ),
      search: {
        transform: (value) => ({
          inquiryRef: value,
        }),
      },
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      hideInSearch: true,
      render: (_, r) => r.createdAt ? dayjs(r.createdAt).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      valueType: 'text',
      order: 6,
      render: (_, r) => r.purchaseOrder?.quotation?.inquiry?.customer?.name || '-',
    },
    {
      title: 'PO No.',
      dataIndex: 'poNumber',
      key: 'poNumber',
      hideInTable: true,
      valueType: 'text',
      order: 4,
    },
    {
      title: 'Code Word',
      key: 'codeWord',
      dataIndex: 'codeWord',
      valueType: 'text',
      order: 5,
      render: (_, r) => r.purchaseOrder?.codeWord ? (
        <Tag color="purple" className="font-medium">{r.purchaseOrder.codeWord}</Tag>
      ) : <Text type="secondary" className="text-xs">-</Text>
    },
    {
      title: 'Freight Cost',
      key: 'freight',
      hideInSearch: true,
      render: (_, r) => r.freightCost
        ? <span className="text-sm font-medium">IDR {parseFloat(r.freightCost).toLocaleString('en-US')}</span>
        : <span className="text-gray-400 text-xs">-</span>
    },
    {
      title: 'Status',
      key: 'status',
      dataIndex: 'status',
      valueEnum: getValueEnum(['REVIEW_LOGISTIC', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'COMPLETED']),
      render: (_, r) => {
        const tagProps = getStatusTagProps(r.status);
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag color={tagProps.color}>{tagProps.label}</Tag>
            {(r.status === 'DELAYED' || isOverdue(r)) && (
              <Tooltip title="Delivery is overdue or delayed">
                <WarningOutlined className="text-red-500 animate-pulse" />
              </Tooltip>
            )}
          </div>
        );
      }
    },
    {
      title: 'Target Delivery Date',
      dataIndex: 'targetDeliveryDate',
      key: 'targetDeliveryDate',
      hideInSearch: true,
      render: (v, r) => {
        if (!v) return <span className="text-gray-400 text-xs">-</span>;
        const overdue = isOverdue(r);
        return (
          <span className={overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        );
      }
    },
    {
      title: 'Last Activity',
      key: 'lastActivity',
      hideInSearch: true,
      render: (_, record) => {
        const ref = record.updatedAt || record.createdAt;
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
      dataIndex: ['creator', 'name'],
      hideInSearch: true,
      render: (_, r) => r.creator?.name || '-'
    },
    {
      title: 'Updater',
      key: 'updater',
      dataIndex: ['updater', 'name'],
      hideInSearch: true,
      render: (_, r) => r.updater?.name || '-'
    },
    {
      title: 'Action',
      key: 'action',
      hideInSearch: true,
      render: (_, record) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/deliveries/${record.id}`)}
          />
          {permissions.canDelete && (
            <DeleteActionButton
              onClick={() => setDeleteModal({ open: true, record, loading: false })}
              tooltip="Hard delete — cannot be undone"
            />
          )}
        </ActionButtonGroup>
      )
    }
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
            const result = await getDeliveries({ poType: 'SPARE_PART' });
            let filtered = [...result];

            // Filter: Delivery Number
            if (params.deliveryNumber) {
              const s = params.deliveryNumber.toLowerCase();
              filtered = filtered.filter(d => d.deliveryNumber?.toLowerCase().includes(s));
            }

            // Filter: PO Number
            if (params.poNumber) {
              const s = params.poNumber.toLowerCase();
              filtered = filtered.filter(d => d.purchaseOrder?.poNumber?.toLowerCase().includes(s));
            }

            // Filter: Customer Name
            if (params.customerName) {
              const s = params.customerName.toLowerCase();
              filtered = filtered.filter(d =>
                d.purchaseOrder?.quotation?.inquiry?.customer?.name?.toLowerCase().includes(s)
              );
            }

            // Filter: Quotation Ref
            if (params.quotationRef) {
              const s = params.quotationRef.toLowerCase();

              filtered = filtered.filter(d => {
                const quotationRef =
                  d.purchaseOrder?.quotation?.quotationNumber ||
                  '';

                return quotationRef.toLowerCase().includes(s);
              });
            }

            // Filter: Inquiry Ref
            if (params.inquiryRef) {
              const s = params.inquiryRef.toLowerCase();

              filtered = filtered.filter(d => {
                const inquiryRef =
                  d.purchaseOrder?.quotation?.inquiry?.inquiryNumber ||
                  '';

                return inquiryRef.toLowerCase().includes(s);
              });
            }

            // Filter: SD Document
            if (params.sdDocument) {
              const s = params.sdDocument.toLowerCase();
              filtered = filtered.filter(d => d.purchaseOrder?.sdDocument?.toLowerCase().includes(s));
            }

            // Filter: Code Word
            if (params.codeWord) {
              const s = params.codeWord.toLowerCase();
              filtered = filtered.filter(d => d.purchaseOrder?.codeWord?.toLowerCase().includes(s));
            }

            // Filter: AWB / Tracking
            if (params.trackingNumber) {
              const s = params.trackingNumber.toLowerCase();
              filtered = filtered.filter(d => d.trackingNumber?.toLowerCase().includes(s));
            }

            // Filter: Status
            if (params.status) {
              filtered = filtered.filter(d => d.status === params.status);
            }

            setAllData(filtered);
            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load deliveries');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div>
            <div className="flex items-center gap-3">
              <TruckOutlined className="text-2xl text-blue-600" />
              <div className="text-base font-semibold text-gray-800">Delivery Management</div>
            </div>
            <div className="text-xs text-gray-400 font-normal">Track shipment and logistics for spare part orders</div>
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
          </Button>
        ]}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['10', '15', '20', '50', '100']
        }}
        search={{ labelWidth: 'auto', layout: 'vertical', defaultCollapsed: false }}
        cardProps={{ className: 'rounded-xl shadow-sm border-gray-100' }}
        rowClassName={(record) =>
          record.status === 'DELAYED' || isOverdue(record)
            ? 'bg-red-50 border-l-4 border-red-400'
            : ''
        }
      />

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <span className="flex items-center gap-2 text-red-600">
            <ExclamationCircleOutlined />
            Confirm Hard Delete
          </span>
        }
        open={deleteModal.open}
        onOk={handleDeleteDelivery}
        onCancel={() => setDeleteModal({ open: false, record: null, loading: false })}
        confirmLoading={deleteModal.loading}
        okText="Yes, Delete Permanently"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
      >
        <p className="text-gray-700 mb-2">
          You are about to permanently delete the delivery:
        </p>
        <p className="font-semibold text-blue-700 text-base mb-3">
          {deleteModal.record?.deliveryNumber}
        </p>
        <p className="text-gray-500 text-sm">
          Customer: <strong>{deleteModal.record?.purchaseOrder?.quotation?.inquiry?.customer?.name || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm mb-4">
          PO: <strong>{deleteModal.record?.purchaseOrder?.poNumber || 'No PO#'}</strong>
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ This action <strong>cannot be undone</strong>. All delivery data including items and history will be permanently deleted.
        </div>
      </Modal>
    </>
  );
};

export default DeliveryList;

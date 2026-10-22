import React, { useState, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Typography, Tag, Button, message, Tooltip, Timeline, Modal, Space } from 'antd';
import { EyeOutlined, WarningOutlined, DeleteOutlined, ExclamationCircleOutlined, ClockCircleOutlined, FilePdfOutlined, DownloadOutlined, BranchesOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getPOs, deletePO } from '../../../services/po.service';
import { getFileUrl } from '../../../utils/file';
import usePermissions from '../../../hooks/usePermissions';
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

const { Title } = Typography;



const POList = () => {
  const [allData, setAllData] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const actionRef = useRef();
  const navigate = useNavigate();
  const permissions = usePermissions();

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');
    const headers = ['PO Number', 'SD Document', 'Inquiry/TFS Ref', 'Customer', 'Code Word', 'Net Value', 'Currency', 'Status', 'Estimated Ready to Ship', 'Creator', 'Created At'];
    const rows = data.map(p => [
      p.poNumber || '',
      p.sdDocument || '',
      p.quotation?.inquiry?.inquiryNumber || p.tfs?.inquiry?.inquiryNumber || p.tfs?.tfsNumber || '-',
      p.quotation?.inquiry?.customer?.name || p.tfs?.inquiry?.customer?.name || p.tfs?.customerName || '-',
      p.quotation?.inquiry?.codeWord?.code || p.tfs?.inquiry?.codeWord?.code || p.codeWord || '-',
      p.netValue ? Math.round(parseFloat(p.netValue)) : '0',
      p.currency || '',
      p.status || '',
      p.sparePartDetail?.estimatedReadyToShip ? dayjs(p.sparePartDetail.estimatedReadyToShip).format('YYYY-MM-DD') : '-',
      p.creator?.name || '-',
      dayjs(p.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    exportToCSV(headers, rows, `PO_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting Purchase Orders to CSV...');
  };

  const handleDeletePO = async () => {
    const { record } = deleteModal;
    if (!record) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await deletePO(record.id);
      message.success(`PO ${record.poNumber || record.id} successfully deleted`);
      setDeleteModal({ open: false, record: null, loading: false });
      actionRef.current?.reload();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to delete PO');
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const isWarningHandlingTime = (po) => {
    if (po.status !== 'REVIEW') return false;
    const createdAt = new Date(po.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - createdAt);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 2;
  };

  const columns = [
    {
      title: 'PO No.',
      dataIndex: 'poNumber',
      key: 'poNumber',
      order: 6,
      render: (_, r) => {
        const siblingCount = r.quotation?.purchaseOrders?.length || 0;
        return (
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {r.poNumber ? <span className="text-sm font-semibold">{r.poNumber}</span> : <span className="text-gray-400 italic text-xs">No PO #</span>}
              {siblingCount > 1 && (
                <Tooltip title={`Split PO: 1 of ${siblingCount} POs from Quotation ${r.quotation?.quotationNumber || ''}`}>
                  <Tag color="purple" className="m-0 text-[10px] leading-tight px-1 py-0.5" icon={<BranchesOutlined />}>
                    Split ({siblingCount})
                  </Tag>
                </Tooltip>
              )}
            </div>
            {r.sdDocument && <div className="text-xs text-gray-500">SD: {r.sdDocument}</div>}
            <div className="text-[11px] text-gray-400">{r.details?.length || 0} item(s)</div>
          </div>
        );
      }
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
      )
    },
    {
      title: 'Inquiry No.',
      dataIndex: 'refNumber',
      key: 'refNumber',
      valueType: 'text',
      render: (_, r) => (
        <span className="font-medium text-gray-700">
          {r.quotation?.inquiry?.inquiryNumber || r.tfs?.inquiry?.inquiryNumber || r.tfs?.tfsNumber || '-'}
          {r.tfs && <Tag color="orange" className="ml-2">IC TFS</Tag>}
        </span>
      )
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      hideInSearch: true,
      valueType: 'dateRange',
      render: (_, r) => new Date(r.createdAt).toLocaleDateString(),
      search: {
        transform: (value) => ({
          startDate: value?.[0],
          endDate: value?.[1],
        }),
      },
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      order: 5,
      valueType: 'text',
      render: (_, r) => r.quotation?.inquiry?.customer?.name || r.tfs?.inquiry?.customer?.name || r.tfs?.customerName || '-',
    },
    {
      title: 'Code Word',
      dataIndex: ['inquiry', 'codeWord', 'code'],
      key: 'codeWordCode',
      order: 4,
      valueType: 'text',
      render: (_, record) =>
        record.quotation?.inquiry?.codeWord?.code ||
        '-',
      search: {
        transform: (value) => ({
          codeWordCode: value,
        }),
      },
    },
    {
      title: 'PO Value',
      key: 'netValue',
      hideInSearch: true,
      render: (_, r) => {
        const val = r.netValue !== null && r.netValue !== undefined && Number(r.netValue) > 0 
          ? Number(r.netValue) 
          : Number(r.quotation?.totalPrice || 0);
        return `${r.currency || 'IDR'} ${val.toLocaleString()}`;
      }
    },
    {
      title: 'Docs',
      key: 'docs',
      hideInSearch: true,
      render: (_, r) => {
        const details = r.sparePartDetail;
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
            {details.vendorInvoiceFile && (
              <Tooltip title="Vendor Invoice">
                <Button size="small" type="text" icon={<FilePdfOutlined className="text-green-500" />} onClick={() => window.open(getFileUrl(details.vendorInvoiceFile), '_blank')} />
              </Tooltip>
            )}
            {details.vendorPackingListFile && (
              <Tooltip title="Packing List">
                <Button size="small" type="text" icon={<FilePdfOutlined className="text-orange-500" />} onClick={() => window.open(getFileUrl(details.vendorPackingListFile), '_blank')} />
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      valueEnum: getValueEnum(['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'COMPLETED']),
      render: (_, r) => {
        const warning = isWarningHandlingTime(r);
        return (
          <div className="flex items-center gap-2">
            <Tag color={getStatusColor(r.status)}>{r.status}</Tag>
            {warning && (
              <Tooltip title="Handling Time Exceeded (> 2 Days) in Review status">
                <Tag color="red" icon={<WarningOutlined className="animate-pulse" />}>Overdue</Tag>
              </Tooltip>
            )}
          </div>
        );
      }
    },
    {
      title: 'Estimated Ready to Ship',
      dataIndex: ['sparePartDetail', 'estimatedReadyToShip'],
      key: 'estimatedReadyToShip',
      hideInSearch: true,
      render: (_, record) => {
        const date = record.sparePartDetail?.estimatedReadyToShip;
        return date ? dayjs(date).format('DD/MM/YYYY') : '-';
      },
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
      render: (_, r) => r.creator?.name || '-'
    },
    {
      title: 'Updater',
      dataIndex: ['updater', 'name'],
      key: 'updater',
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
            onClick={() => navigate(`/po/${record.id}`)}
          />
          {permissions.canDelete && (
            <DeleteActionButton
              onClick={() => setDeleteModal({ open: true, record, loading: false })}
              tooltip="Hard delete — cannot be undone"
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
        style={{ width: '100%' }}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        columns={columns}
        request={async (params) => {
          try {
            const result = await getPOs({ poType: 'SPARE_PART' });
            let filtered = [...result];

            // Filter: PO Number
            if (params.poNumber) {
              const s = params.poNumber.toLowerCase();
              filtered = filtered.filter(p => p.poNumber?.toLowerCase().includes(s));
            }


            // Filter: Inquiry Ref
            if (params.refNumber) {
              const s = params.refNumber.toLowerCase();
              filtered = filtered.filter(p =>
                p.quotation?.inquiry?.inquiryNumber?.toLowerCase().includes(s)
              );
            }

            // Filter: Quotation Ref
            if (params.quotationRef) {
              const s = params.quotationRef.toLowerCase();
              filtered = filtered.filter(p => p.quotation?.quotationNumber?.toLowerCase().includes(s));
            }

            // Filter: Code Word
            if (params.codeWordCode) {
              const s = params.codeWordCode.toLowerCase();

              filtered = filtered.filter(p =>
                p.quotation?.inquiry?.codeWord?.code?.toLowerCase().includes(s)
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

            setAllData(filtered);
            return { data: filtered, success: true, total: filtered.length };
          } catch (error) {
            console.error(error);
            message.error('Failed to load Purchase Orders');
            return { data: [], success: false, total: 0 };
          }
        }}
        headerTitle={
          <div>
            <div className="text-base font-semibold text-gray-800">Spare Part Purchase Orders</div>
            <div className="text-xs text-gray-400 font-normal">Monitor review and processing of vendor purchase orders</div>
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
        expandable={{
          expandedRowRender: record => (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <Title level={5} className="mb-4 text-xs uppercase text-gray-500 tracking-wider">Status History</Title>
              <Timeline mode="left" size="small">
                {record.histories?.map((h, i) => (
                  <Timeline.Item key={i} color="green">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-semibold">{h.newStatus}</div>
                        <div className="text-[10px] text-gray-500">{h.changeNote}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500">{new Date(h.createdAt).toLocaleString()}</div>
                        {h.changer && <div className="text-[10px] text-gray-400">By: {h.changer.name}</div>}
                      </div>
                    </div>
                  </Timeline.Item>
                ))}
                {(!record.histories || record.histories.length === 0) && <div className="text-xs italic text-gray-400">No history available</div>}
              </Timeline>
            </div>
          ),
          rowExpandable: record => record.histories?.length > 0,
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <span className="flex items-center gap-2 text-red-600">
            <ExclamationCircleOutlined />
            Confirm Hard Delete PO
          </span>
        }
        open={deleteModal.open}
        onOk={handleDeletePO}
        onCancel={() => setDeleteModal({ open: false, record: null, loading: false })}
        confirmLoading={deleteModal.loading}
        okText="Yes, Delete Permanently"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
      >
        <p className="text-gray-700 mb-2">You are about to permanently delete PO:</p>
        <p className="font-semibold text-blue-700 text-base mb-3">
          {deleteModal.record?.poNumber || <span className="italic text-gray-400">No PO #</span>}
        </p>
        <p className="text-gray-500 text-sm">
          Customer: <strong>{deleteModal.record?.quotation?.inquiry?.customer?.name || deleteModal.record?.tfs?.inquiry?.customer?.name || '-'}</strong>
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
};

export default POList;

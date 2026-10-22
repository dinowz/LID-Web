import React, { useState, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Button, Typography, Tag, Space, message, Modal } from 'antd';
import { EyeOutlined, DeleteOutlined, ExclamationCircleOutlined, ClockCircleOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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

const QuotationsList = () => {
  const [allData, setAllData] = useState([]);
  const [isPartFilterActive, setIsPartFilterActive] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null, loading: false });
  const actionRef = useRef();
  const navigate = useNavigate();
  const permissions = usePermissions();

  const handleExport = (data) => {
    if (!data || data.length === 0) return message.warning('No data to export');

    if (isPartFilterActive) {
      const headers = ['Part Number', 'Part Name', 'Price', 'Currency', 'QTY', 'Quotation No', 'Customer', 'Subject', 'Code Word', 'Status'];
      const rows = data.map(item => [
        item.partNumber || '',
        item.partName || '',
        item.price ? Math.round(parseFloat(item.price)) : '0',
        item.currency || '',
        item.qty || '',
        item.quotationNumber || '',
        item.customerName || 'N/A',
        item.subject || '-',
        item.codeWord || '-',
        item.status || '',
      ]);
      exportToCSV(headers, rows, `Part_Quotation_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
      message.success('Exporting filtered parts to CSV...');
      return;
    }

    const headers = ['Quotation No', 'Date', 'Due Date', 'Customer', 'Subject', 'Inquiry Ref', 'Code Word', 'Total Price', 'Currency', 'Status', 'Creator', 'Created At'];
    const rows = data.map(q => [
      q.quotationNumber || '',
      dayjs(q.createdAt).format('YYYY-MM-DD'),
      q.inquiry?.dueDate ? dayjs(q.inquiry.dueDate).format('YYYY-MM-DD') : '-',
      q.inquiry?.customer?.name || 'N/A',
      q.inquiry?.subject || '-',
      q.inquiry?.inquiryNumber || '',
      q.inquiry?.codeWord?.code || q.codeWord?.code || '-',
      q.totalPrice ? Math.round(parseFloat(q.totalPrice)) : '0',
      q.currency || '',
      q.status || '',
      q.creator?.name || '-',
      dayjs(q.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    exportToCSV(headers, rows, `Quotation_Report_${dayjs().format('YYYYMMDD_HHmm')}`);
    message.success('Exporting quotations to CSV...');
  };

  const handleDeleteQuotation = async () => {
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

  // ── Standard Quotation Columns ───────────────────────────────────────────────
  const quotationColumns = [
    {
      title: 'Quotation No',
      dataIndex: 'quotationNumber',
      key: 'quotationNumber',
      valueType: 'text',
      order: 5,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Inquiry No',
      dataIndex: 'inquiryNumber',
      key: 'inquiryNumber',
      valueType: 'text',
      order: 2,
      render: (_, record) => record.inquiry?.inquiryNumber || '-'
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      hideInSearch: true,
      valueType: 'dateRange',
      render: (_, record) => new Date(record.createdAt).toLocaleDateString(),
      search: {
        transform: (value) => ({
          startDate: value?.[0],
          endDate: value?.[1],
        }),
      },
    },
    {
      title: 'Customer',
      key: 'customerName',
      dataIndex: 'customerName',
      valueType: 'text',
      order: 4,
      render: (_, record) => record.inquiry?.customer?.name || 'N/A'
    },
    {
      title: 'Subject',
      key: 'subject',
      dataIndex: 'subject',
      valueType: 'text',
      ellipsis: true,
      render: (_, record) => record.inquiry?.subject || '-'
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
      title: 'Part Number',
      dataIndex: 'partNumber',
      key: 'partNumber',
      valueType: 'text',
      order: 6,
      hideInTable: true,
    },
    {
      title: 'Creator',
      dataIndex: ['creator', 'name'],
      key: 'creatorName',
      hideInSearch: true,
      render: (text) => <Text>{text || '-'}</Text>,
    },
    {
      title: 'Updater',
      dataIndex: ['updater', 'name'],
      key: 'updaterName',
      hideInSearch: true,
      render: (text) => <Text>{text || '-'}</Text>,
    },
    {
      title: 'Total Price',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      align: 'right',
      hideInSearch: true,
      render: (v, record) => {
        const amount = parseFloat(v || 0).toLocaleString('id-ID');
        const currency = record.currency || '';
        return currency
          ? <span><span className="font-medium">{currency} {amount}</span></span>
          : <span className="font-medium">{amount}</span>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      order: 1,
      valueType: 'select',
      valueEnum: getValueEnum(['DRAFT', 'SENT', 'REALIZED', 'EXECUTED', 'CLOSE_LOSS']),
      render: (_, record) => (
        <Tag color={getStatusColor(record.status)}>{record.status}</Tag>
      )
    },
    {
      title: 'Due Date',
      dataIndex: ['inquiry', 'dueDate'],
      key: 'dueDate',
      hideInSearch: true,
      render: (_, record) => record.inquiry?.dueDate ? dayjs(record.inquiry.dueDate).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Forecast',
      dataIndex: 'forecast',
      key: 'forecast',
      valueType: 'select',
      valueEnum: getValueEnum(['BEST', 'NORMAL', 'WORST']),
      render: (forecast) => {
        if (!forecast) return '-';
        const colorMap = { BEST: 'success', NORMAL: 'warning', WORST: 'error' };
        return <Tag color={colorMap[forecast] || 'default'}>{forecast}</Tag>;
      }
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
      title: 'Action',
      key: 'action',
      hideInSearch: true,
      render: (_, record) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/quotations/${record.id}`)}
          />
          {permissions.canEditQuotation && (
            <EditActionButton
              onClick={() => navigate(`/quotations/${record.id}?mode=edit`)}
              isLocked={record.status !== 'DRAFT' && record.status !== 'SENT'}
              lockTooltip="Cannot edit non-draft/sent quotation"
            />
          )}
          {permissions.canDelete && (
            <DeleteActionButton
              onClick={() => setDeleteModal({ open: true, record, loading: false })}
            />
          )}
        </ActionButtonGroup>
      ),
    },
  ];

  // ── Item-Level Filtered Columns (When Part Number Filter Active) ─────────────
  const partItemColumns = [
    {
      title: 'Part Number',
      dataIndex: 'partNumber',
      key: 'partNumber',
      valueType: 'text',
      order: 6,
      render: (text) => <Text strong className="text-blue-700">{text || '-'}</Text>,
    },
    {
      title: 'Part Name',
      dataIndex: 'partName',
      key: 'partName',
      hideInSearch: true,
      render: (text) => <Text>{text || '-'}</Text>,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      align: 'right',
      hideInSearch: true,
      render: (v, record) => {
        const amount = parseFloat(v || 0).toLocaleString('id-ID');
        const currency = record.currency || '';
        return currency
          ? <Text className="font-semibold">{currency} {amount}</Text>
          : <Text className="font-semibold">{amount}</Text>;
      }
    },
    {
      title: 'QTY',
      dataIndex: 'qty',
      key: 'qty',
      align: 'center',
      hideInSearch: true,
      render: (qty) => <Text color="blue">{qty}</Text>,
    },
    {
      title: 'Quotation No',
      dataIndex: 'quotationNumber',
      key: 'quotationNumber',
      valueType: 'text',
      order: 5,
      render: (text, record) => (
        <a
          onClick={() => navigate(`/quotations/${record.quotationId}`)}
          className="font-medium text-blue-600 hover:underline cursor-pointer"
        >
          {text}
        </a>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      valueType: 'text',
      order: 4,
      render: (text) => <Text>{text || 'N/A'}</Text>,
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      valueType: 'text',
      ellipsis: true,
      render: (text) => <Text>{text || '-'}</Text>,
    },
    {
      title: 'Code Word',
      dataIndex: 'codeWord',
      key: 'codeWordCode',
      valueType: 'text',
      order: 3,
      render: (text) => <Tag color="cyan">{text || '-'}</Tag>,
      search: {
        transform: (value) => ({
          codeWordCode: value,
        }),
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      order: 1,
      valueType: 'select',
      valueEnum: getValueEnum(['DRAFT', 'SENT', 'REALIZED', 'EXECUTED', 'CLOSE_LOSS']),
      render: (_, record) => (
        <Tag color={getStatusColor(record.status)}>{record.status}</Tag>
      )
    },
    // Search fields kept intact so form does not jump
    {
      title: 'Inquiry No',
      dataIndex: 'inquiryNumber',
      key: 'inquiryNumber',
      valueType: 'text',
      order: 2,
      hideInTable: true,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      hideInTable: true,
      valueType: 'dateRange',
      search: {
        transform: (value) => ({
          startDate: value?.[0],
          endDate: value?.[1],
        }),
      },
    },
    {
      title: 'Forecast',
      dataIndex: 'forecast',
      key: 'forecast',
      valueType: 'select',
      hideInTable: true,
      valueEnum: getValueEnum(['BEST', 'NORMAL', 'WORST']),
    },
    {
      title: 'Action',
      key: 'action',
      hideInSearch: true,
      render: (_, record) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/quotations/${record.quotationId}`)}
          />
        </ActionButtonGroup>
      ),
    },
  ];

  const columns = isPartFilterActive ? partItemColumns : quotationColumns;

  return (
    <>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        style={{ width: '100%' }}
        scroll={{ x: 'max-content' }}
        columns={columns}

        columnsState={{
          defaultValue: {
            forecast: {
              show: true,
            },
          },
        }}

        request={async (params) => {
          try {
            const result = await getQuotations({
              quotationType: 'SPARE_PART',
            });

            let filtered = [...result];

            // Filter: Quotation Number
            if (params.quotationNumber) {
              const s = params.quotationNumber.toLowerCase();

              filtered = filtered.filter(q =>
                q.quotationNumber?.toLowerCase().includes(s)
              );
            }

            // Filter: Customer
            if (params.customerName) {
              const s = params.customerName.toLowerCase();

              filtered = filtered.filter(q =>
                q.inquiry?.customer?.name
                  ?.toLowerCase()
                  .includes(s)
              );
            }

            // Filter: Subject
            if (params.subject) {
              const s = params.subject.toLowerCase();

              filtered = filtered.filter(q =>
                q.inquiry?.subject
                  ?.toLowerCase()
                  .includes(s)
              );
            }

            // Filter: Inquiry Ref
            if (params.inquiryNumber) {
              const s = params.inquiryNumber.toLowerCase();

              filtered = filtered.filter(q =>
                q.inquiry?.inquiryNumber
                  ?.toLowerCase()
                  .includes(s)
              );
            }

            // Filter: Code Word
            if (params.codeWordCode) {
              const s = params.codeWordCode.toLowerCase();

              filtered = filtered.filter(q =>
                (q.inquiry?.codeWord?.code || q.codeWord?.code)
                  ?.toLowerCase()
                  .includes(s)
              );
            }

            // Filter: Forecast
            if (params.forecast) {
              filtered = filtered.filter(
                q => q.forecast === params.forecast
              );
            }

            // Filter: Status
            if (params.status) {
              filtered = filtered.filter(
                q => q.status === params.status
              );
            }

            // Filter: Date Range
            if (params.startDate && params.endDate) {
              const start = dayjs(
                params.startDate,
                ['DD/MM/YYYY', 'YYYY-MM-DD']
              ).startOf('day');

              const end = dayjs(
                params.endDate,
                ['DD/MM/YYYY', 'YYYY-MM-DD']
              ).endOf('day');

              filtered = filtered.filter(q => {
                const date = dayjs(q.createdAt);

                return (
                  date.isSameOrAfter(start) &&
                  date.isSameOrBefore(end)
                );
              });
            }

            // Filter: Part Number (Level Item / Part Flattening)
            const searchPart = params.partNumber ? params.partNumber.trim().toLowerCase() : '';
            if (searchPart) {
              setIsPartFilterActive(true);
              const partRows = [];

              filtered.forEach(q => {
                (q.details || []).forEach(d => {
                  const inqDetail = q.inquiry?.details?.find(
                    id => (d.inquiryDetailId && String(id.id) === String(d.inquiryDetailId)) || id.lineNo === d.lineNo
                  );
                  const pNum = inqDetail?.requestedPartNumber || d.sparePart?.partCode || '';
                  const pName = inqDetail?.requestedItemName || inqDetail?.requestDescription || d.sparePart?.partName || '';

                  if (
                    pNum.toLowerCase().includes(searchPart) ||
                    pName.toLowerCase().includes(searchPart)
                  ) {
                    const price = d.sellPriceCalc && parseFloat(d.sellPriceCalc) > 0
                      ? parseFloat(d.sellPriceCalc)
                      : (parseFloat(d.unitPrice) || 0);

                    partRows.push({
                      id: `${q.id}-${d.id}`,
                      quotationId: q.id,
                      partNumber: pNum || '-',
                      partName: pName || '-',
                      price,
                      currency: q.currency || 'IDR',
                      qty: parseFloat(d.qty) || 1,
                      quotationNumber: q.quotationNumber,
                      customerName: q.inquiry?.customer?.name || 'N/A',
                      subject: q.inquiry?.subject || '-',
                      codeWord: q.inquiry?.codeWord?.code || q.codeWord?.code || '-',
                      status: q.status,
                      createdAt: q.createdAt,
                      rawQuotation: q,
                    });
                  }
                });
              });

              setAllData(partRows);

              return {
                data: partRows,
                success: true,
                total: partRows.length,
              };
            } else {
              setIsPartFilterActive(false);
              setAllData(filtered);

              return {
                data: filtered,
                success: true,
                total: filtered.length,
              };
            }
          } catch (error) {
            console.error(error);
            message.error('Failed to load quotations');

            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}

        headerTitle={
          <div>
            <div className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <span>Spare Part Quotation</span>
              {isPartFilterActive && (
                <Tag color="blue" className="text-xs">
                  Filtered by Part: {allData.length} items found
                </Tag>
              )}
            </div>

            <div className="text-xs text-gray-400 font-normal">
              {isPartFilterActive
                ? 'Showing individual parts matching the Part Number search'
                : 'Manage customer quotations generated from inquiries'}
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
          pageSizeOptions: ['10', '15', '20', '50', '100'],
        }}

        search={{
          labelWidth: 'auto',
          layout: 'vertical',
          defaultCollapsed: false,
        }}

        cardProps={{
          className: 'rounded-xl shadow-sm border-gray-100',
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <span className="flex items-center gap-2 text-red-600">
            <ExclamationCircleOutlined />
            Konfirmasi Hard Delete Quotation
          </span>
        }
        open={deleteModal.open}
        onOk={handleDeleteQuotation}
        onCancel={() => setDeleteModal({ open: false, record: null, loading: false })}
        confirmLoading={deleteModal.loading}
        okText="Ya, Hapus Permanen"
        okButtonProps={{ danger: true }}
        cancelText="Batal"
      >
        <p className="text-gray-700 mb-2">Anda akan menghapus permanen quotation:</p>
        <p className="font-semibold text-blue-700 text-base mb-3">{deleteModal.record?.quotationNumber}</p>
        <p className="text-gray-500 text-sm">
          Customer: <strong>{deleteModal.record?.inquiry?.customer?.name || '-'}</strong>
        </p>
        <p className="text-gray-500 text-sm mb-4">
          Status: <strong>{deleteModal.record?.status}</strong>
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ Tindakan ini <strong>tidak dapat dibatalkan</strong>. Quotation yang sudah memiliki PO tidak bisa dihapus.
        </div>
      </Modal>
    </>
  );
};

export default QuotationsList;

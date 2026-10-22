import React, { useRef, useState } from 'react';
import { Button, Typography, Tag, message, Tooltip, Space } from 'antd';
import { PlusOutlined, EyeOutlined, FileProtectOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ProTable } from '@ant-design/pro-components';
import { getInvoices } from '../../../services/invoice.service';
import usePermissions from '../../../hooks/usePermissions';
import { ActionButtonGroup, ViewActionButton } from '../../../components/common/ActionButtons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_COLORS = {
  DRAFT: 'default',
  SENT: 'blue',
  PAID: 'success',
  OVERDUE: 'error',
  CANCELLED: 'default',
};

const InvoiceList = () => {
  const permissions = usePermissions();
  const navigate = useNavigate();
  const actionRef = useRef();

  const [allDataForExport, setAllDataForExport] = useState([]);

  const handleExport = () => {
    if (allDataForExport.length === 0) {
      message.warning('No data to export');
      return;
    }

    const headers = [
      'Invoice No', 'SO/SD SAP Number', 'Source', 'Customer', 'Ref / PO No', 'Total Amount', 'Currency', 'Due Date', 'Status', 'Creator', 'Created At'
    ];

    const rows = allDataForExport.map(inv => {
      let refPo = inv.purchaseOrder?.poNumber || '-';
      if (refPo === '-' && inv.sourceType === 'SERVICE' && inv.service?.serviceNumber) {
        refPo = inv.service.serviceNumber;
      }

      return [
        inv.invoiceNumber || 'DRAFT',
        inv.soSdSapNumber || '-',
        inv.sourceType || '',
        inv.customer?.name || '-',
        refPo,
        inv.totalAmount ? Math.round(parseFloat(inv.totalAmount)) : '0',
        inv.currency || 'IDR',
        inv.dueDate ? dayjs(inv.dueDate).format('YYYY-MM-DD') : '-',
        inv.displayStatus || inv.status || '',
        inv.creator?.name || '-',
        dayjs(inv.createdAt).format('YYYY-MM-DD HH:mm')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Invoice_Report_${dayjs().format('YYYYMMDD_HHmm')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('Exporting invoices to CSV...');
  };

  const columns = [
    {
      title: 'Invoice No / Customer',
      dataIndex: 'keyword',
      hideInTable: true,
      tooltip: 'Search by Invoice No or Customer Name',
    },
    {
      title: 'Invoice No',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      search: false,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => navigate(`/finance/invoices/${record.id}`)} className="font-semibold">{text || 'DRAFT'}</a>
          {record.soSdSapNumber && (
            <Text type="secondary" className="text-xs">SO/SD: {record.soSdSapNumber}</Text>
          )}
        </Space>
      )
    },
    {
      title: 'SO/SD SAP Number',
      dataIndex: 'soSdSapNumber',
      key: 'soSdSapNumber',
      search: false,
      hideInTable: true,
    },
    {
      title: 'Source',
      dataIndex: 'sourceType',
      key: 'sourceType',
      valueEnum: {
        DELIVERY: { text: 'Sparepart (Delivery)' },
        SERVICE: { text: 'Service' },
        PROJECT: { text: 'Project' },
      },
      render: (_, record) => <Tag>{record.sourceType}</Tag>
    },
    {
      title: 'Customer',
      key: 'customer',
      search: false,
      render: (_, record) => record.customer?.name || '-'
    },
    {
      title: 'Ref / PO No',
      key: 'reference',
      search: false,
      render: (_, record) => {
        if (record.purchaseOrder?.poNumber) {
          return record.purchaseOrder.poNumber;
        }
        if (record.sourceType === 'SERVICE' && record.service?.serviceNumber) {
          return (
            <Space size="small">
              <Tag color="blue" className="m-0">SVC</Tag>
              <Text style={{ fontSize: '12px' }}>{record.service.serviceNumber}</Text>
            </Space>
          );
        }
        return '-';
      }
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      search: false,
      render: (val, record) => `${record.currency} ${parseFloat(val || 0).toLocaleString('en-US')}`
    },
    {
      title: 'Date Filter',
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      search: false,
      render: date => date ? dayjs(date).format('DD/MM/YYYY') : '-'
    },
    {
      title: 'Status',
      key: 'displayStatus',
      dataIndex: 'displayStatus',
      valueEnum: {
        DRAFT: { text: 'Draft' },
        SENT: { text: 'Sent' },
        PAID: { text: 'Paid' },
        OVERDUE: { text: 'Overdue' },
        CANCELLED: { text: 'Cancelled' },
      },
      render: (status) => (
        <div className="flex items-center gap-2">
          <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>
        </div>
      )
    },
    {
      title: 'Creator',
      key: 'creator',
      search: false,
      render: (_, r) => r.creator?.name || '-'
    },
    {
      title: 'Updater',
      key: 'updater',
      search: false,
      render: (_, r) => r.updater?.name || '-'
    },
    {
      title: 'Action',
      key: 'action',
      search: false,
      render: (_, record) => (
        <ActionButtonGroup>
          <ViewActionButton
            onClick={() => navigate(`/finance/invoices/${record.id}`)}
          />
          {record.paymentProofUrl && (
            <Tooltip title="Download Payment Proof">
              <Button
                // type="text"
                size="small"
                icon={<DownloadOutlined className="text-green-600" />}
                onClick={async (e) => {
                  e.stopPropagation();
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                  const baseHost = import.meta.env.VITE_API_BASE_URL || apiUrl.replace('/api', '');
                  const finalHost = baseHost.startsWith('http') ? baseHost : window.location.origin;
                  const fileUrl = `${finalHost}${record.paymentProofUrl}`;

                  try {
                    const response = await fetch(fileUrl);
                    if (!response.ok) throw new Error('Network response was not ok');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    const filename = record.paymentProofUrl.split('/').pop() || `PaymentProof_${record.invoiceNumber || 'Unknown'}`;
                    link.setAttribute('download', filename);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    message.error('Failed to download file, opening in new tab instead');
                    window.open(fileUrl, '_blank');
                  }
                }}
              />
            </Tooltip>
          )}
        </ActionButtonGroup>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={4} style={{ margin: 0 }}>All Invoices</Title>
          <div className="text-gray-500 text-sm mt-1">Manage all created invoices</div>
        </div>
      </div>

      <ProTable
        columns={columns}
        actionRef={actionRef}
        cardBordered
        style={{ width: '100%' }}
        scroll={{ x: 'max-content' }}
        request={async (params = {}) => {
          try {
            const res = await getInvoices();

            // Add UI Overdue Indicator logic
            const processedData = res.map(inv => {
              let displayStatus = inv.status;
              if (inv.status === 'SENT' && inv.dueDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const due = new Date(inv.dueDate);
                if (today > due) displayStatus = 'OVERDUE';
              }
              return { ...inv, displayStatus };
            });

            // Filtering
            const filtered = processedData.filter(item => {
              const keyword = params.keyword || '';
              const matchSearch = !keyword ||
                (item.invoiceNumber?.toLowerCase() || '').includes(keyword.toLowerCase()) ||
                (item.customer?.name?.toLowerCase() || '').includes(keyword.toLowerCase());

              const matchType = !params.sourceType || item.sourceType === params.sourceType;
              const matchStatus = !params.displayStatus || item.displayStatus === params.displayStatus;

              let matchDate = true;
              if (params.dateRange && params.dateRange.length === 2) {
                const itemDate = new Date(item.invoiceDate || item.createdAt);
                const start = dayjs(params.dateRange[0]).startOf('day').toDate();
                const end = dayjs(params.dateRange[1]).endOf('day').toDate();
                matchDate = itemDate >= start && itemDate <= end;
              }

              return matchSearch && matchType && matchStatus && matchDate;
            });

            setAllDataForExport(filtered);

            // Pagination manual
            const pageSize = params.pageSize || 10;
            const current = params.current || 1;
            const paginated = filtered.slice((current - 1) * pageSize, current * pageSize);

            return {
              data: paginated,
              success: true,
              total: filtered.length,
            };
          } catch (error) {
            message.error('Failed to load invoices');
            return { data: [], success: false, total: 0 };
          }
        }}
        rowKey="id"
        search={{ labelWidth: 'auto', layout: 'vertical', defaultCollapsed: false }}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['10', '15', '20', '50', '100']
        }}
        dateFormatter="string"
        toolBarRender={() => [
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            Export CSV
          </Button>,
          permissions.canEditInvoice && (
            <Button
              key="create"
              type="primary"
              onClick={() => navigate('/finance/ready')}
              icon={<PlusOutlined />}
            >
              New Invoice
            </Button>
          ),
        ]}
      />
    </div>
  );
};

export default InvoiceList;

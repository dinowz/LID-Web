import React, { useState, useRef } from 'react';
import { Button, Typography, Tag, message, Modal, Form, Input, InputNumber, DatePicker, Upload, Table } from 'antd';
import { ClockCircleOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ProTable } from '@ant-design/pro-components';
import {
  getReadyToInvoiceList,
  createInvoiceFromDelivery,
  createInvoiceFromPoDp,
  createInvoiceFromService,
  createInvoiceFromProject,
  uploadExternalInvoiceDocument,
  deleteDraftInvoice
} from '../../../services/invoice.service';
import usePermissions from '../../../hooks/usePermissions';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ReadyToInvoice = () => {
  const permissions = usePermissions();
  const navigate = useNavigate();
  const actionRef = useRef();

  const [creating, setCreating] = useState(false);

  // Modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [form] = Form.useForm();

  const [allDataForExport, setAllDataForExport] = useState([]);

  const handleOpenUpload = (record) => {
    setSelectedRecord(record);
    form.resetFields();
    setFileList([]);
    if (record.sourceType === 'PROJECT') {
      form.setFieldsValue({
        description: `Project Progress - ${record.referenceNumber}`,
        amount: record.remainingToInvoice,
        soSdSapNumber: record.sdNumber || undefined
      });
    } else {
      form.setFieldsValue({
        soSdSapNumber: record.sdNumber || undefined
      });
    }
    setIsModalVisible(true);
  };

  const handleUploadSubmit = async (values) => {
    if (fileList.length === 0) {
      return message.error('Please upload an invoice file');
    }

    setCreating(true);
    let invoice = null;
    try {

      if (selectedRecord.sourceType === 'PROJECT') {
        invoice = await createInvoiceFromProject(selectedRecord.id, {
          description: values.description,
          amount: values.amount
        });
      } else if (selectedRecord.isDp) {
        invoice = await createInvoiceFromPoDp(selectedRecord.id);
      } else if (selectedRecord.sourceType === 'DELIVERY') {
        invoice = await createInvoiceFromDelivery(selectedRecord.id);
      } else if (selectedRecord.sourceType === 'SERVICE') {
        invoice = await createInvoiceFromService(selectedRecord.id);
      }

      if (!invoice) throw new Error('Failed to create base invoice');

      const formData = new FormData();
      formData.append('file', fileList[0].originFileObj);
      formData.append('invoiceNumber', values.invoiceNumber);
      if (values.invoiceDate) formData.append('invoiceDate', values.invoiceDate.toISOString());
      if (values.dueDate) formData.append('dueDate', values.dueDate.toISOString());
      if (values.remarks) formData.append('remarks', values.remarks);
      formData.append('soSdSapNumber', values.soSdSapNumber);

      await uploadExternalInvoiceDocument(invoice.id, formData);

      message.success('Invoice uploaded successfully');
      setIsModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      if (invoice && invoice.id) {
        try {
          await deleteDraftInvoice(invoice.id);
        } catch (rollbackError) {
          console.error('Failed to rollback draft invoice:', rollbackError);
        }
      }
      message.error(error.response?.data?.error || error.message || 'Failed to upload invoice');
    } finally {
      setCreating(false);
    }
  };

  const handleExport = () => {
    if (allDataForExport.length === 0) {
      message.warning('No data to export');
      return;
    }

    const headers = [
      'Reference No', 'Type', 'SD Number', 'PO Ref', 'Customer', 'Status', 'Completion Date', 'Total Amount', 'Already Billed', 'Remaining to Invoice'
    ];

    const rows = allDataForExport.map(r => {
      let totalAmount = 0;
      if (r.sourceType === 'PROJECT') {
        totalAmount = r.poNetValue || 0;
      } else if (r.isDp) {
        totalAmount = r.totalAmount || 0;
      } else {
        totalAmount = (r.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      }

      const typeLabel = r.isDp
        ? `SPAREPART (DP ${r.dpPercent}%)`
        : r.hasDp && r.sourceType === 'DELIVERY'
        ? 'DELIVERY (Pelunasan)'
        : (r.sourceType || '');

      return [
        r.referenceNumber || '',
        typeLabel,
        r.sdNumber || '-',
        r.poNumber || '-',
        r.customerName || '-',
        r.status || '',
        r.completionDate ? dayjs(r.completionDate).format('YYYY-MM-DD') : '-',
        Math.round(parseFloat(totalAmount)),
        r.totalInvoiced ? Math.round(parseFloat(r.totalInvoiced)) : (r.alreadyBilled ? Math.round(parseFloat(r.alreadyBilled)) : '0'),
        r.remainingToInvoice ? Math.round(parseFloat(r.remainingToInvoice)) : '0'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Ready_To_Invoice_Report_${dayjs().format('YYYYMMDD_HHmm')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('Exporting ready to invoice list to CSV...');
  };

  const columns = [
    {
      title: 'Reference No / Customer',
      dataIndex: 'keyword',
      hideInTable: true,
      tooltip: 'Search by Reference No, PO Number, SD Number, or Customer Name',
    },
    {
      title: 'Reference No',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      search: false,
      render: (text, record) => {
        return (
          <div>
            <Text className="font-semibold text-primary-600 hover:text-primary-800">{text}</Text>
            {record.sourceType === 'PROJECT' && (
              <div className="text-xs text-gray-500 mt-1 bg-gray-50 p-1 rounded inline-block">
                Billed: {record.currency || 'IDR'} {Number(record.totalInvoiced || 0).toLocaleString('en-US')} /
                {record.currency || 'IDR'} {Number(record.poNetValue || 0).toLocaleString('en-US')}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Type',
      dataIndex: 'sourceType',
      key: 'sourceType',
      valueEnum: {
        DELIVERY: { text: 'Sparepart (Delivery)' },
        SERVICE: { text: 'Service' },
        PROJECT: { text: 'Project' },
      },
      render: (type, record) => {
        if (record.isDp) {
          return <Tag color="gold">SPAREPART (DP {record.dpPercent}%)</Tag>;
        }
        if (record.sourceType === 'DELIVERY' && record.hasDp) {
          return <Tag color="green">DELIVERY (Pelunasan)</Tag>;
        }
        const color = type === 'DELIVERY' ? 'green' : type === 'SERVICE' ? 'blue' : 'purple';
        return <Tag color={color}>{type}</Tag>;
      }
    },
    {
      title: 'SD Number',
      dataIndex: 'sdNumber',
      key: 'sdNumber',
      search: false,
      render: (text) => text ? (
        <span className="font-mono font-medium text-gray-800">{text}</span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      title: 'PO Ref',
      dataIndex: 'poNumber',
      key: 'poNumber',
      search: false,
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      search: false,
      render: text => <span className="font-semibold text-gray-700">{text}</span>
    },
    {
      title: 'Status',
      dataIndex: 'billingStatus',
      key: 'billingStatus',
      search: false,
      render: (billingStatus, record) => (
        <Tag color={billingStatus === 'OPEN' ? 'orange' : 'blue'}>
          {billingStatus || 'OPEN'}
        </Tag>
      )
    },
    {
      title: 'Completion Date Filter',
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
    },
    {
      title: 'Completion Date',
      dataIndex: 'completionDate',
      key: 'completionDate',
      search: false,
      render: date => date ? dayjs(date).format('DD/MM/YYYY') : '-'
    },
    {
      title: 'Total Amount',
      key: 'totalAmount',
      align: 'right',
      search: false,
      render: (_, record) => {
        let amount = 0;
        if (record.sourceType === 'PROJECT') {
          amount = record.poNetValue || 0;
        } else if (record.isDp) {
          amount = record.totalAmount || 0;
        } else {
          amount = (record.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        }

        if (record.hasDp && !record.isDp && record.remainingToInvoice != null) {
          return (
            <div className="text-right">
              <span className="font-semibold text-gray-800">
                {record.currency || 'IDR'} {Number(record.remainingToInvoice).toLocaleString('en-US')}
              </span>
              <div className="text-[11px] text-gray-400">
                PO: {record.currency || 'IDR'} {Number(record.totalAmount || amount).toLocaleString('en-US')}
              </div>
              <div className="text-[11px] text-amber-600">
                DP Deducted: -{record.currency || 'IDR'} {Number(record.alreadyBilled || 0).toLocaleString('en-US')}
              </div>
            </div>
          );
        }

        return (
          <span className="font-semibold text-gray-700">
            {record.currency || 'IDR'} {Number(amount).toLocaleString('en-US')}
          </span>
        );
      }
    },
    {
      title: 'Days Pending',
      key: 'daysPending',
      search: false,
      render: (_, record) => {
        if (!record.completionDate) return '-';
        const days = dayjs().diff(dayjs(record.completionDate), 'day');
        const color = days >= 2 ? '#ef4444' : '#6b7280';
        return (
          <span style={{ color, fontWeight: days >= 2 ? 700 : 400 }}>
            {days} days
            {days >= 2 && <Tag color="error" style={{ marginLeft: 8 }}>Pending</Tag>}
          </span>
        );
      }
    },
    {
      title: 'Action',
      key: 'action',
      search: false,
      hideInTable: !permissions.canEditInvoice,
      render: (_, record) => (
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => handleOpenUpload(record)}
          loading={creating}
          size="small"
          className="bg-primary-600 hover:bg-primary-700"
        >
          Upload Invoice
        </Button>
      )
    }
  ];

  const expandedRowRender = (record) => {
    const itemColumns = [
      { title: 'No', dataIndex: 'no', key: 'no', width: 50, render: (_, __, index) => index + 1 },
      { title: 'Item Description', dataIndex: 'description', key: 'description' },
      {
        title: 'Qty',
        key: 'qty_display',
        align: 'center',
        render: (_, item) => (
          <div>
            <div>{item.qty} {item.uom}</div>
            {item.hours && <Text type="secondary" style={{ fontSize: '11px' }}>({item.hours} hrs/day)</Text>}
          </div>
        )
      },
      {
        title: 'Unit Price',
        dataIndex: 'unitPrice',
        key: 'unitPrice',
        align: 'right',
        render: (val) => val ? `${record.currency || 'IDR'} ${Number(val).toLocaleString('en-US')}` : '-'
      },
      {
        title: 'Total',
        dataIndex: 'total',
        key: 'total',
        align: 'right',
        render: (val) => `${record.currency || 'IDR'} ${Number(val).toLocaleString('en-US')}`
      },
    ];

    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <Text strong className="block mb-2 text-primary-700">Line Items Detail</Text>
        <Table
          columns={itemColumns}
          dataSource={record.items || []}
          pagination={false}
          size="small"
          rowKey={(item, index) => `item-${index}`}
          className="shadow-sm"
          bordered
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={4} style={{ margin: 0 }}>Ready to Invoice</Title>
          <Text type="secondary">List of items waiting to be invoiced</Text>
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
            const res = await getReadyToInvoiceList();

            // Filtering
            const filtered = res.filter(item => {
              const keyword = params.keyword || '';
              const matchSearch = !keyword ||
                (item.referenceNumber?.toLowerCase() || '').includes(keyword.toLowerCase()) ||
                (item.customerName?.toLowerCase() || '').includes(keyword.toLowerCase()) ||
                (item.poNumber?.toLowerCase() || '').includes(keyword.toLowerCase()) ||
                (item.sdNumber?.toLowerCase() || '').includes(keyword.toLowerCase());

              const matchType = !params.sourceType || item.sourceType === params.sourceType;

              let matchDate = true;
              if (params.dateRange && params.dateRange.length === 2) {
                const itemDate = new Date(item.completionDate);
                const start = dayjs(params.dateRange[0]).startOf('day').toDate();
                const end = dayjs(params.dateRange[1]).endOf('day').toDate();
                matchDate = itemDate >= start && itemDate <= end;
              }

              return matchSearch && matchType && matchDate;
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
            message.error('Failed to load ready to invoice list');
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
        expandable={{
          expandedRowRender,
          expandRowByClick: true,
        }}
        toolBarRender={() => [
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            Export CSV
          </Button>,
          <Button
            key="viewall"
            onClick={() => navigate('/finance/invoices')}
            icon={<ClockCircleOutlined />}
          >
            View All Invoices
          </Button>,
        ]}
      />

      <Modal
        title={
          selectedRecord?.isDp
            ? `Upload Sparepart Down Payment Invoice (${selectedRecord.dpPercent}%)`
            : selectedRecord?.sourceType === 'PROJECT'
            ? "Upload Project Invoice"
            : selectedRecord?.hasDp
            ? "Upload Sparepart Final Invoice (Pelunasan)"
            : "Upload Invoice"
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        {selectedRecord?.isDp && (
          <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="text-sm text-amber-900 font-semibold mb-1">
              Down Payment Invoice ({selectedRecord.dpPercent}%)
            </div>
            <div className="text-xs text-amber-800">
              PO Ref: <strong>{selectedRecord.poNumber}</strong> | DP Amount:{' '}
              <strong>{selectedRecord.currency || 'IDR'} {Number(selectedRecord.totalAmount).toLocaleString('en-US')}</strong>
            </div>
          </div>
        )}
        {selectedRecord?.hasDp && !selectedRecord?.isDp && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-green-900 font-semibold mb-1">
              Final Invoicing (Pelunasan Delivery)
            </div>
            <div className="text-xs text-green-800">
              Total PO: <strong>{selectedRecord.currency || 'IDR'} {Number(selectedRecord.totalAmount).toLocaleString('en-US')}</strong> | DP Deducted: -<strong>{selectedRecord.currency || 'IDR'} {Number(selectedRecord.alreadyBilled || 0).toLocaleString('en-US')}</strong>
            </div>
            <div className="text-sm text-green-900 font-bold mt-1">
              Remaining to Bill: {selectedRecord.currency || 'IDR'} {Number(selectedRecord.remainingToInvoice).toLocaleString('en-US')}
            </div>
          </div>
        )}
        {selectedRecord?.sourceType === 'PROJECT' && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-800">
              <strong>Remaining unbilled amount:</strong> {selectedRecord.currency || 'IDR'} {Number(selectedRecord.remainingToInvoice).toLocaleString('en-US')}
            </div>
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={handleUploadSubmit}>
          <Form.Item
            name="invoiceNumber"
            label="Invoice Number"
            rules={[{ required: true, message: 'Please enter invoice number' }]}
          >
            <Input placeholder="e.g. INV/2026/05/001" />
          </Form.Item>

          <Form.Item
            name="soSdSapNumber"
            label="SO/SD SAP Number"
            rules={[{ required: true, message: 'Please enter SO/SD SAP Number' }]}
          >
            <Input placeholder="e.g. 1234567890" />
          </Form.Item>

          <div className="flex gap-4">
            <Form.Item
              name="invoiceDate"
              label="Invoice Date"
              rules={[{ required: true, message: 'Please select invoice date' }]}
              className="flex-1"
            >
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item
              name="dueDate"
              label="Due Date"
              rules={[{ required: true, message: 'Please select due date' }]}
              className="flex-1"
            >
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>
          </div>

          {selectedRecord?.sourceType === 'PROJECT' && (
            <>
              <Form.Item
                name="description"
                label="Invoice Description"
                rules={[{ required: true, message: 'Please enter a description' }]}
              >
                <Input placeholder="e.g. Termin 1 - 30% Progress" />
              </Form.Item>

              <Form.Item
                name="amount"
                label="Billing Amount (Rp)"
                rules={[{ required: true, message: 'Please enter an amount' }]}
              >
                <InputNumber
                  className="w-full"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                  min={1}
                  max={selectedRecord?.remainingToInvoice}
                />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="remarks"
            label="Remarks (Optional)"
          >
            <Input.TextArea rows={2} placeholder="Add any notes for this invoice..." />
          </Form.Item>

          <Form.Item label="Upload Invoice File (PDF)" required>
            <Upload
              accept=".pdf"
              maxCount={1}
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
            >
              <Button icon={<UploadOutlined />}>Select PDF File</Button>
            </Upload>
          </Form.Item>

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={creating} icon={<UploadOutlined />}>
              Upload & Submit
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ReadyToInvoice;

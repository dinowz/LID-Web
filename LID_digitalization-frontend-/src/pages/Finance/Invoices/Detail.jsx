import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Space, Button, message, Tag, Row, Col, Timeline, Divider, Modal, Upload, Input, Form, InputNumber, Alert, DatePicker } from 'antd';
import { ArrowLeftOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, UploadOutlined, FileProtectOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoiceById, updateInvoiceData, updateInvoiceStatus, markInvoiceAsPaid } from '../../../services/invoice.service';
import usePermissions from '../../../hooks/usePermissions';
import dayjs from 'dayjs';
import { getFileUrl, getFileViewUrl } from '../../../utils/file';

const { Title, Text } = Typography;

const STATUS_COLORS = { DRAFT: 'default', SENT: 'blue', PAID: 'success', OVERDUE: 'error', CANCELLED: 'default' };

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [form] = Form.useForm();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusModal, setStatusModal] = useState({ open: false, newStatus: null });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [displayStatus, setDisplayStatus] = useState('');
  const [fileList, setFileList] = useState([]);
  const [editFileList, setEditFileList] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getInvoiceById(id);
      let calcStatus = data.status;
      if (data.status === 'SENT' && data.dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (today > new Date(data.dueDate)) calcStatus = 'OVERDUE';
      }
      setDisplayStatus(calcStatus);
      setInvoice(data);

      form.setFieldsValue({
        invoiceDate: data.invoiceDate ? dayjs(data.invoiceDate) : null,
        dueDate: data.dueDate ? dayjs(data.dueDate) : null,
        remarks: data.remarks || '',
      });
      editForm.setFieldsValue({
        invoiceNumber: data.invoiceNumber || '',
        invoiceDate: data.invoiceDate ? dayjs(data.invoiceDate) : null,
        dueDate: data.dueDate ? dayjs(data.dueDate) : null,
        subtotalAmount: parseFloat(data.subtotalAmount),
        taxAmount: parseFloat(data.taxAmount),
        remarks: data.remarks || '',
        soSdSapNumber: data.soSdSapNumber || '',
      });
    } catch (error) {
      message.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const isEditable = invoice?.status === 'DRAFT';

  const handleSaveDraft = async (values) => {
    setSaving(true);
    try {
      await updateInvoiceData(id, {
        invoiceDate: values.invoiceDate?.toISOString(),
        dueDate: values.dueDate?.toISOString(),
        remarks: values.remarks
      });
      message.success('Draft saved successfully');
      loadData();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (values) => {
    setSaving(true);
    try {
      if (editFileList.length > 0) {
        const formData = new FormData();
        if (values.invoiceNumber) formData.append('invoiceNumber', values.invoiceNumber);
        if (values.invoiceDate) formData.append('invoiceDate', values.invoiceDate.toISOString());
        if (values.dueDate) formData.append('dueDate', values.dueDate.toISOString());
        if (values.soSdSapNumber) formData.append('soSdSapNumber', values.soSdSapNumber);
        if (values.remarks) formData.append('remarks', values.remarks);
        if (values.subtotalAmount !== undefined) formData.append('subtotalAmount', values.subtotalAmount);
        if (values.taxAmount !== undefined) formData.append('taxAmount', values.taxAmount);
        formData.append('file', editFileList[0].originFileObj);

        await updateInvoiceData(id, formData);
      } else {
        await updateInvoiceData(id, {
          ...values,
          invoiceDate: values.invoiceDate?.toISOString(),
          dueDate: values.dueDate?.toISOString(),
        });
      }
      message.success('Invoice updated successfully');
      setEditModalOpen(false);
      setEditFileList([]);
      loadData();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    try {
      if (statusModal.newStatus === 'PAID') {
        const formData = new FormData();
        if (statusModal.note) formData.append('changeNote', statusModal.note);
        if (fileList.length > 0) {
          formData.append('file', fileList[0].originFileObj);
        }
        await markInvoiceAsPaid(id, formData);
      } else {
        await updateInvoiceStatus(id, statusModal.newStatus, statusModal.note);
      }
      message.success(`Status updated to ${statusModal.newStatus}`);
      setStatusModal({ open: false, newStatus: null });
      setFileList([]);
      loadData();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  if (loading || !invoice) return null;

  const itemColumns = [
    { title: 'No', key: 'no', width: 50, render: (_, __, i) => i + 1 },
    { title: 'Description', dataIndex: 'description', key: 'desc' },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'center', render: v => parseFloat(v) },
    { title: 'UoM', dataIndex: 'uom', key: 'uom', width: 80 },
    { title: 'Unit Price', dataIndex: 'unitPrice', key: 'price', align: 'right', render: v => parseFloat(v).toLocaleString('en-US') },
    { title: 'Line Total', dataIndex: 'lineTotal', key: 'total', align: 'right', render: v => <Text strong>{parseFloat(v).toLocaleString('en-US')}</Text> },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto mb-10 px-4">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/finance/invoices')} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Invoice: {invoice.invoiceNumber || 'DRAFT'}</Title>
            <Tag color={STATUS_COLORS[displayStatus]} className="mt-1">{displayStatus}</Tag>
          </div>
        </Space>
        <Space>
          {permissions.canEditInvoice && !['PAID', 'CANCELLED'].includes(invoice.status) && (
            <Button icon={<EditOutlined />} onClick={() => setEditModalOpen(true)}>Edit Invoice</Button>
          )}
          {isEditable && permissions.canEditInvoice && (
            <Button type="primary" icon={<SendOutlined />} onClick={() => setStatusModal({ open: true, newStatus: 'SENT' })}>Send Invoice</Button>
          )}
          {(displayStatus === 'SENT' || displayStatus === 'OVERDUE') && permissions.canEditInvoice && (
            <Button type="primary" className="bg-green-600 border-green-600" icon={<CheckCircleOutlined />} onClick={() => setStatusModal({ open: true, newStatus: 'PAID' })}>Mark as Paid</Button>
          )}
          {invoice.paymentProofUrl && (
            <Button
              className="border-green-600 text-green-600 hover:text-green-700 hover:border-green-700"
              icon={<DownloadOutlined />}
              onClick={() => {
                window.open(getFileUrl(invoice.paymentProofUrl), '_blank');
              }}
            >
              Download Payment Proof
            </Button>
          )}
        </Space>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full lg:w-0 space-y-5">

          <Card title="Line Items" className="rounded-xl shadow-sm !mb-4" bordered={false}>
            <Table
              columns={itemColumns}
              dataSource={invoice.details}
              rowKey="id"
              pagination={false}
              size="middle"
            />
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between"><Text type="secondary">Subtotal:</Text><Text>{parseFloat(invoice.subtotalAmount).toLocaleString('en-US')}</Text></div>
                {parseFloat(invoice.taxAmount) > 0 && (
                  <div className="flex justify-between"><Text type="secondary">Tax:</Text><Text>{parseFloat(invoice.taxAmount).toLocaleString('en-US')}</Text></div>
                )}
                <Divider style={{ margin: '8px 0' }} />
                <div className="flex justify-between"><Text strong>Total:</Text><Text strong className="text-lg text-blue-600">{invoice.currency} {parseFloat(invoice.totalAmount).toLocaleString('en-US')}</Text></div>
              </div>
            </div>
          </Card>
          <Card title="Invoice Information" className="rounded-xl shadow-sm" bordered={false}>
            <Row gutter={16}>
              <Col span={12}>
                <div className="mb-4">
                  <Text type="secondary" className="block text-xs mb-1">Customer</Text>
                  <div className="font-semibold">{invoice.customer?.name || '-'}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="mb-4">
                  <Text type="secondary" className="block text-xs mb-1">Source Reference</Text>
                  <div className="font-semibold">
                    {invoice.purchaseOrder?.poNumber || (invoice.sourceType === 'SERVICE' && invoice.service?.serviceNumber) || '-'}
                  </div>
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div className="mb-4">
                  <Text type="secondary" className="block text-xs mb-1">SO/SD SAP Number</Text>
                  <div className="font-semibold">{invoice.soSdSapNumber || '-'}</div>
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div className="mb-4">
                  <Text type="secondary" className="block text-xs mb-1">Invoice Date</Text>
                  <div className="font-semibold">{invoice.invoiceDate ? dayjs(invoice.invoiceDate).format('DD/MM/YYYY') : '-'}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="mb-4">
                  <Text type="secondary" className="block text-xs mb-1">Due Date</Text>
                  <div className="font-semibold">{invoice.dueDate ? dayjs(invoice.dueDate).format('DD/MM/YYYY') : '-'}</div>
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <div className="mb-2">
                  <Text type="secondary" className="block text-xs mb-1">Remarks</Text>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 min-h-[50px] text-sm">
                    {invoice.remarks || <Text type="secondary" italic>No remarks added</Text>}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
          <Card
            title="Invoice Document (PDF)"
            className="rounded-xl shadow-sm !mb-4 !mt-2"
            bordered={false}
            extra={
              invoice.attachmentUrl && (
                <Space>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => window.open(getFileViewUrl(invoice.attachmentUrl), '_blank')}
                  >
                    Open in New Tab
                  </Button>
                </Space>
              )
            }
          >
            {invoice.attachmentUrl ? (
              <div className="w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50" style={{ height: '700px' }}>
                <iframe
                  src={getFileViewUrl(invoice.attachmentUrl)}
                  title={`Invoice PDF - ${invoice.invoiceNumber || 'Document'}`}
                  className="w-full h-full border-none block"
                />
              </div>
            ) : (
              <Alert
                type="info"
                showIcon
                message="No Invoice PDF Uploaded"
                description="The external invoice document (PDF) has not been uploaded for this invoice yet."
                className="rounded-lg"
              />
            )}
          </Card>

        </div>

        <div className="w-full lg:w-80 space-y-5">
          <Card title="Status History" className="rounded-xl shadow-sm" bordered={false}>
            <Timeline className="mt-2">
              {invoice.histories?.map(h => (
                <Timeline.Item key={h.id} color={h.newStatus === 'PAID' ? 'green' : 'blue'}>
                  <div className="flex flex-col">
                    <Text strong>{h.newStatus}</Text>
                    {h.changeNote && <Text type="secondary" className="text-xs">{h.changeNote}</Text>}
                    <Text type="secondary" className="text-[10px] mt-1">{new Date(h.createdAt).toLocaleString('en-US')}</Text>
                    {h.changer && <Text type="secondary" className="text-[10px]">By: {h.changer.name}</Text>}
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
            {(!invoice.histories || invoice.histories.length === 0) && <Text type="secondary" className="italic text-xs">No history recorded yet</Text>}
          </Card>
        </div>
      </div>

      <Modal
        title={`Confirm Action: Mark as ${statusModal.newStatus}`}
        open={statusModal.open}
        onOk={handleStatusChange}
        onCancel={() => {
          setStatusModal({ open: false, newStatus: null });
          setFileList([]);
        }}
        okText="Confirm"
        okButtonProps={{ type: 'primary', className: statusModal.newStatus === 'PAID' ? 'bg-green-600 border-green-600' : 'bg-blue-600' }}
      >
        <p>Are you sure you want to change the invoice status to <strong>{statusModal.newStatus}</strong>?</p>

        {statusModal.newStatus === 'PAID' && (
          <div className="mb-4 mt-4">
            <Text className="block mb-2">Upload Payment Proof (Optional)</Text>
            <Upload
              accept="image/*,.pdf"
              maxCount={1}
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </div>
        )}

        <Input.TextArea
          className="mt-4"
          placeholder="Optional note..."
          rows={3}
          onChange={(e) => setStatusModal(prev => ({ ...prev, note: e.target.value }))}
        />
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal
        title="Edit Invoice Information"
        open={editModalOpen}
        onOk={() => editForm.submit()}
        onCancel={() => setEditModalOpen(false)}
        width={600}
        confirmLoading={saving}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit} className="mt-4">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="invoiceNumber" label="Invoice Number" rules={[{ required: true }]}>
                <Input placeholder="e.g. INV/2024/05/001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoiceDate" label="Invoice Date">
                <DatePicker className="w-full" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="soSdSapNumber" label="SO/SD SAP Number">
                <Input placeholder="e.g. 1234567890" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remarks" label="Remarks">
                <Input placeholder="Internal notes..." />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Replace Invoice PDF File (Optional)">
            <Upload
              accept=".pdf"
              maxCount={1}
              beforeUpload={() => false}
              fileList={editFileList}
              onChange={({ fileList: newFileList }) => setEditFileList(newFileList)}
            >
              <Button icon={<UploadOutlined />}>Select New PDF File</Button>
            </Upload>
            {invoice.attachmentUrl && editFileList.length === 0 && (
              <Text type="secondary" className="text-xs block mt-1">
                Current file: {invoice.attachmentUrl.split('/').pop()}
              </Text>
            )}
          </Form.Item>

          <Divider orientation="left">Financial Summary</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subtotalAmount" label="Subtotal Amount">
                <InputNumber
                  className="!w-full"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taxAmount" label="Tax Amount (PPN)">
                <InputNumber
                  className="!w-full"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Alert
            type="info"
            showIcon
            message="Item detail adjustment"
            description="Changing totals here will update the summary. To edit specific line items, please use the item table (coming soon)."
            className="mb-4"
          />
        </Form>
      </Modal>
    </div>
  );
};

export default InvoiceDetail;

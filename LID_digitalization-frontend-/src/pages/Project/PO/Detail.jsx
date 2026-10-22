import React, { useState, useEffect } from 'react';
import {
  Card, Table, Typography, Space, Button, message, Tag, Form, Input,
  Row, Col, DatePicker, Select, InputNumber, Modal, Timeline, Steps, Divider, Alert, Upload, Tooltip
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined, MailOutlined,
  UploadOutlined, FileDoneOutlined, SendOutlined, ToolOutlined,
  BellOutlined, CalendarOutlined, WarningOutlined, FilePdfOutlined, EyeOutlined, DownloadOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getPOById, updatePO, sendReminder, revertPOToQuotation } from '../../../services/po.service';
import { getVendors } from '../../../services/master.service';
import usePermissions from '../../../hooks/usePermissions';
import DocumentUpload from '../../../components/DocumentUpload';
import WorkflowHistory from '../../../components/WorkflowHistory';
import { getFileUrl } from '../../../utils/file';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const PO_STATUS_STEPS = ['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'IN_PROGRESS'];

const STATUS_META = {
  REVIEW: { label: 'Review & Input', color: 'blue', icon: <FileDoneOutlined /> },
  PROCESSING: { label: 'Internal PO Created', color: 'orange', icon: <FileDoneOutlined /> },
  WAITING_OC: { label: 'Waiting for Order Confirmation', color: 'purple', icon: <SendOutlined /> },
  READY: { label: 'Vendor Documents Complete', color: 'cyan', icon: <CheckCircleOutlined /> },
  IN_PROGRESS: { label: 'Process to Execution', color: 'green', icon: <ToolOutlined /> },
};


export default function ProjectPODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [form] = Form.useForm();
  const watchedNetValue = Form.useWatch('netValue', form);
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [isRevertModalVisible, setIsRevertModalVisible] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);
  const [vendors, setVendors] = useState([]);

  // Calculate baseline from item breakdown
  const baselineTotal = (po?.details || []).reduce((sum, d) => sum + Number(d.totalPrice || 0), 0);
  const isNetValueBelowBaseline = watchedNetValue !== undefined && watchedNetValue !== null && watchedNetValue !== '' && Number(watchedNetValue) < baselineTotal && baselineTotal > 0;
  const netValueDiff = isNetValueBelowBaseline ? baselineTotal - Number(watchedNetValue) : 0;

  const checkNetValueWarning = (inputNetValue, onConfirm) => {
    const numVal = Number(inputNetValue || 0);
    if (baselineTotal > 0 && numVal < baselineTotal) {
      const diff = baselineTotal - numVal;
      Modal.confirm({
        title: 'Konfirmasi Net Value di Bawah Nilai Rincian Item',
        icon: <WarningOutlined style={{ color: '#d97706' }} />,
        content: (
          <div className="space-y-2 mt-2 text-sm text-gray-600">
            <p>
              Nilai <strong>Net Value</strong> yang Anda masukkan (<strong>{po?.currency || 'IDR'} {numVal.toLocaleString()}</strong>) lebih rendah dari total rincian item PO (<strong>{po?.currency || 'IDR'} {baselineTotal.toLocaleString()}</strong>).
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 text-xs">
              Selisih kurang: <strong>-{po?.currency || 'IDR'} {diff.toLocaleString()}</strong>
            </div>
            <p className="text-xs text-gray-500">
              Pastikan pengurangan nilai ini memang disengaja (misal: terdapat penyesuaian khusus atau diskon). Apakah Anda yakin ingin melanjutkan penyimpanan?
            </p>
          </div>
        ),
        okText: 'Ya, Tetap Lanjutkan',
        cancelText: 'Periksa Kembali',
        okButtonProps: { className: 'bg-amber-600 hover:bg-amber-500 border-amber-600' },
        onOk: () => {
          onConfirm();
        }
      });
    } else {
      onConfirm();
    }
  };

  useEffect(() => {
    getVendors({ active: 'true' })
      .then(data => setVendors(data))
      .catch(() => { });
  }, []);

  useEffect(() => { fetchPO(); }, [id]);

  const fetchPO = async () => {
    try {
      const data = await getPOById(id);
      setPo(data);
    } catch (err) {
      message.error('Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (po) {
      const ext = po.projectDetail || po.serviceDetail || {};
      form.setFieldsValue({
        sdDocument: po.sdDocument,
        poNumber: po.poNumber,
        netValue: po.netValue || po.quotation?.totalPrice || 0,
        currency: po.currency || po.quotation?.currency || 'IDR',
        codeWord: po.codeWord || po.quotation?.inquiry?.codeWord?.code,
        salesOrganization: po.salesOrganization || po.quotation?.creator?.name || 'System Generated',

        // Field ekstensi serviceDetail (since it's project O&M)
        vendorId: ext.vendorId ?? null,
        internalPoFile: ext.internalPoFile ?? null,
        ocFile: ext.ocFile ?? null,
        vendorInvoiceFile: ext.vendorInvoiceFile ?? null,
        serviceStartDate: ext.serviceStartDate ? dayjs(ext.serviceStartDate) : null,
        serviceEndDate: ext.serviceEndDate ? dayjs(ext.serviceEndDate) : null,
        picName: ext.picName || '',
        engineerName: ext.engineerName || '',

        remarks: po.remarks,
        reminderEmail: po.reminderEmail || '',
      });
    }
  }, [po, form]);

  const buildPayload = (values) => ({
    ...values,
    serviceStartDate: values.serviceStartDate ? values.serviceStartDate.toISOString() : null,
    serviceEndDate: values.serviceEndDate ? values.serviceEndDate.toISOString() : null,
  });

  const handleSaveDraft = (values) => {
    checkNetValueWarning(values.netValue, async () => {
      setSaving(true);
      try {
        await updatePO(id, { ...buildPayload(values), status: po.status });
        message.success('Draft saved');
        fetchPO();
      } catch (err) {
        message.error(err?.response?.data?.error || 'Failed to save draft');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleAdvanceStatus = () => {
    const currentIdx = PO_STATUS_STEPS.indexOf(po.status);
    const nextStatus = PO_STATUS_STEPS[currentIdx + 1];
    if (!nextStatus) return;

    form.validateFields().then((values) => {
      checkNetValueWarning(values.netValue, async () => {
        setAdvancing(true);
        try {
          await updatePO(id, { ...buildPayload(values), status: nextStatus });
          const label = STATUS_META[nextStatus]?.label || nextStatus;
          message.success(`PO successfully moved to: ${label}${nextStatus === 'IN_PROGRESS' ? ' — Project Execution created automatically!' : ''}`);
          fetchPO();
        } catch (err) {
          message.error(err?.response?.data?.error || 'Failed to advance PO status');
        } finally {
          setAdvancing(false);
        }
      });
    }).catch(() => {
      message.warning('Please complete all required fields before proceeding.');
    });
  };

  const handleSendReminderTest = async () => {
    const email = form.getFieldValue('reminderEmail');
    if (!email) return message.warning('Please enter a reminder email first');
    await updatePO(id, { reminderEmail: email });
    setSendingReminder(true);
    try {
      await sendReminder(id);
      message.success(`Reminder email successfully sent to ${email}`);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleRevert = async () => {
    if (!revertReason.trim()) return message.warning('Please enter a revert reason');
    setReverting(true);
    try {
      const response = await revertPOToQuotation(id, revertReason);
      message.success('PO successfully reverted to Quotation');
      navigate(`/project/quotations/${response.quotationId}`);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to revert');
    } finally {
      setReverting(false);
      setIsRevertModalVisible(false);
    }
  };

  if (loading || !po) return null;

  const ext = po.projectDetail || po.serviceDetail || {};
  const currentStatusIdx = PO_STATUS_STEPS.indexOf(po.status);
  const nextStatus = PO_STATUS_STEPS[currentStatusIdx + 1];
  const isEditable = po.status !== 'IN_PROGRESS';
  const canEditSAP = po.status === 'REVIEW' || po.status === 'PROCESSING';
  const canEditVendor = po.status === 'WAITING_OC';



  const NEXT_BTN_LABELS = {
    REVIEW: { label: 'Internal PO Created →', icon: <FileDoneOutlined /> },
    PROCESSING: { label: 'PO Confirmation Sent to Vendor →', icon: <SendOutlined /> },
    WAITING_OC: { label: 'OC & Documents Received →', icon: <CheckCircleOutlined /> },
    READY: { label: 'Process to Execution →', icon: <ToolOutlined /> },
  };

  const itemColumns = [
    { title: 'No', key: 'no', width: 55, render: (_, __, i) => i + 1 },
    {
      title: 'Item', key: 'item',
      render: (_, r) => (
        <span className="font-medium">
          {r.service?.serviceName || r.sparePart?.partName || r.note || 'Project Scope'}
        </span>
      )
    },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 70, align: 'center' },
    { title: 'Type', dataIndex: 'itemType', key: 'type', width: 110, render: t => <Tag color="blue">{t}</Tag> },
    {
      title: 'Total', dataIndex: 'totalPrice', key: 'total', align: 'right',
      render: v => <Text strong>{parseFloat(v).toLocaleString('en-US')}</Text>
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto mb-10 px-4">

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100 print:hidden">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/project/po')} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Project Purchase Order Setup</Title>
            <Text type="secondary">
              {po.quotation ? `Quotation Ref: ${po.quotation.quotationNumber}` : ''}
            </Text>
          </div>
        </Space>
        <Space>
          {po.status === 'REVIEW' && permissions.canEditPO && (
            <Button danger onClick={() => setIsRevertModalVisible(true)}>
              Revert to Quotation
            </Button>
          )}
          {isEditable && permissions.canEditPO && (
            <Button icon={<SaveOutlined />} onClick={() => form.submit()} loading={saving}>
              Save Draft
            </Button>
          )}
          {nextStatus && isEditable && permissions.canEditPO && (
            <Button
              type="primary"
              icon={NEXT_BTN_LABELS[po.status]?.icon}
              className={po.status === 'READY' ? 'bg-green-600 border-green-600' : 'bg-blue-600'}
              onClick={handleAdvanceStatus}
              loading={advancing}
            >
              {NEXT_BTN_LABELS[po.status]?.label}
            </Button>
          )}
        </Space>
      </div>

      {/* Progress Steps */}
      <Card className="rounded-xl shadow-sm border-gray-100 print:hidden" bodyStyle={{ padding: '16px 24px' }}>
        <Steps
          current={currentStatusIdx}
          size="small"
          items={PO_STATUS_STEPS.map((s) => ({
            title: STATUS_META[s].label,
            status: s === po.status ? 'process' : currentStatusIdx > PO_STATUS_STEPS.indexOf(s) ? 'finish' : 'wait',
          }))}
        />
      </Card>

      {/* IN_PROGRESS Banner */}
      {po.status === 'IN_PROGRESS' && (
        <Alert
          message="PO Ready for Execution"
          description="All documents are complete. Project Execution has been created automatically. PO can no longer be edited."
          type="success"
          showIcon
          className="rounded-xl !mt-5"
        />
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full lg:w-0">
          <Form form={form} layout="vertical" onFinish={handleSaveDraft} disabled={!isEditable || !permissions.canEditPO}>
            <div className="space-y-5">
              {/* === Quotation Reference Card === */}
              <Card title="Quotation Reference" className="rounded-xl shadow-sm !mt-5" bordered={false}>
                <Row gutter={24}>
                  <Col span={8}>
                    <div className="mb-4">
                      <Text type="secondary" className="block text-xs uppercase">Customer</Text>
                      <Text strong className="text-lg">{po.quotation?.inquiry?.customer?.name || '-'}</Text>
                    </div>
                    <div className="mb-4">
                      <Text type="secondary" className="block text-xs uppercase">Subject</Text>
                      <Text>{po.quotation?.inquiry?.subject || '-'}</Text>
                    </div>
                    <div>
                      <Text type="secondary" className="block text-xs uppercase">Total</Text>
                      <Text strong className="text-xl text-blue-700">
                        {parseFloat(po.netValue || po.quotation?.totalPrice || 0).toLocaleString('en-US')} {po.currency}
                      </Text>
                    </div>
                  </Col>
                  <Col span={16}>
                    <Text type="secondary" className="block text-xs uppercase mb-2">Item Breakdown</Text>
                    <div className="max-h-52 overflow-y-auto">
                      <Table columns={itemColumns} dataSource={po.details || []} rowKey="id" pagination={false} size="small" />
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* === CARD 1: SAP Info (REVIEW+) === */}
              <Card
                title={
                  <div className="flex justify-between items-center w-full">
                    <span>Internal SAP Purchase Order <Tag color="red" className="ml-2">Inter_PO → WAITING_OC</Tag></span>
                    {!canEditSAP && isEditable && <Tag color="warning">Locked: Finish current step first</Tag>}
                  </div>
                }
                className={`rounded-xl shadow-sm !mt-5 ${!canEditSAP ? 'bg-gray-50 opacity-80' : ''}`}
                bordered={false}
              >
                <fieldset disabled={!canEditSAP || !isEditable} className="border-none p-0 m-0">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="SD Document" name="sdDocument">
                        <Input placeholder="E.g. 560977" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Purchase Order Number" name="poNumber" rules={[{ required: canEditSAP, message: 'PO Number is required' }]}>
                        <Input placeholder="E.g. 177/PO/SCRI/TRD" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label={`Net Value (${po.currency || ''})`} name="netValue" rules={[{ required: canEditSAP, message: 'Net Value is required' }]}>
                        <InputNumber
                          className="!w-full"
                          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={v => v.replace(/\$\s?|(,*)/g, '')}
                        />
                      </Form.Item>
                      {isNetValueBelowBaseline && (
                        <Alert
                          type="warning"
                          showIcon
                          className="!mb-4 rounded-lg text-xs"
                          message={
                            <div>
                              <span className="font-semibold text-amber-800">Perhatian: Net Value di bawah total rincian item!</span>
                              <div className="text-gray-600 mt-0.5">
                                Total rincian: <strong className="text-gray-900">{po.currency || 'IDR'} {baselineTotal.toLocaleString()}</strong>
                                {' '}(Selisih: <strong className="text-amber-700">-{po.currency || 'IDR'} {netValueDiff.toLocaleString()}</strong>).
                              </div>
                            </div>
                          }
                        />
                      )}
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Currency" name="currency">
                        <Select disabled options={[{ label: 'IDR', value: 'IDR' }, { label: 'EUR', value: 'EUR' }, { label: 'USD', value: 'USD' }]} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="Vendor / Sub-contractor" name="vendorId" rules={[{ required: canEditSAP, message: 'Vendor is required' }]}>
                        <Select
                          showSearch allowClear placeholder="Search & select vendor..."
                          optionFilterProp="label"
                          filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
                          options={vendors.map(v => ({ value: v.id, label: `[${v.vendorCode}] ${v.vendorName}` }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Vendor PIC Name" name="picName">
                        <Input placeholder="Vendor PIC Name" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="Code Word" name="codeWord">
                        <Input placeholder="E.g. INDARUNG 5" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Sales Organization" name="salesOrganization">
                        <Input disabled className="bg-gray-50 text-gray-700 font-semibold" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="Remark" name="remarks">
                    <Input.TextArea rows={2} placeholder="Operational or business notes..." />
                  </Form.Item>
                  <Text type="secondary" className="block mb-3 text-xs">
                    Upload Internal PO document from SAP (PDF). Required to advance status to <strong>PROCESSING</strong>.
                  </Text>
                  <Form.Item name="internalPoFile" label="Internal PO File (SAP PDF)" rules={[{ required: canEditSAP, message: 'Internal PO file upload is required' }]}>
                    <DocumentUpload poId={id} poType="PROJECT" documentType="internalPoFile" label="Internal PO PDF" disabled={!canEditSAP || !isEditable || !permissions.canEditPO} />
                  </Form.Item>
                  {ext.internalPoUploadedAt && (
                    <Text type="secondary" className="text-xs"><CalendarOutlined className="mr-1" /> Uploaded: {new Date(ext.internalPoUploadedAt).toLocaleString('en-US')}</Text>
                  )}
                </fieldset>
              </Card>
              {/* === CARD 3: Dokumen Vendor (WAITING_OC → READY) === */}
              <Card
                title={
                  <div className="flex justify-between items-center w-full">
                    <span>Vendor Order Confirmation <Tag color="purple" className="ml-2">WAITING_OC → READY</Tag></span>
                    {!canEditVendor && isEditable && <Tag color="warning">Locked: Wait for step 3</Tag>}
                  </div>
                }
                className={`rounded-xl shadow-sm !mt-5 ${!canEditVendor ? 'bg-gray-50 opacity-80' : ''}`}
                bordered={false}
              >
                <fieldset disabled={!canEditVendor || !isEditable} className="border-none p-0 m-0">
                  <Text type="secondary" className="block mb-3 text-xs">
                    Upload Order Confirmation and Vendor Invoice. Required to move to <strong>READY</strong> status.
                  </Text>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="ocFile" label="Order Confirmation (OC)" rules={[{ required: canEditVendor, message: 'OC upload is required' }]}>
                        <DocumentUpload poId={id} poType="PROJECT" documentType="ocFile" label="Vendor OC" disabled={!canEditVendor || !isEditable || !permissions.canEditPO} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="vendorInvoiceFile" label="Vendor Invoice" rules={[{ required: canEditVendor, message: 'Invoice upload is required' }]}>
                        <DocumentUpload poId={id} poType="PROJECT" documentType="vendorInvoiceFile" label="Vendor Invoice" disabled={!canEditVendor || !isEditable || !permissions.canEditPO} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider className="my-3" />
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="serviceStartDate" label={<span>Estimated Work Start <WarningOutlined className="text-orange-500" /> Required</span>} rules={[{ required: canEditVendor, message: 'Start date is required' }]}>
                        <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Start date" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="serviceEndDate" label={<span>Estimated Work Completion <WarningOutlined className="text-orange-500" /> Required</span>} rules={[{ required: canEditVendor, message: 'End date is required' }]}>
                        <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="End date" />
                      </Form.Item>
                    </Col>
                  </Row>
                  {ext.ocReceivedAt && (
                    <Text type="secondary" className="text-xs"><CalendarOutlined className="mr-1" /> OC received: {new Date(ext.ocReceivedAt).toLocaleString('en-US')}</Text>
                  )}
                </fieldset>
              </Card>


            </div>
          </Form>
        </div>

        {/* === RIGHT SIDEBAR === */}
        <div className="w-full lg:w-80 space-y-5 print:hidden">

          {/* Uploaded Documents Summary */}
          <Card title="Uploaded Documents" className="rounded-xl shadow-sm border-gray-100 !mt-5" headStyle={{ backgroundColor: '#fafafa' }}>
            <div className="space-y-3">
              {[
                { label: 'Customer PO', file: po.customerPoFile, color: 'blue' },
                { label: 'Internal PO', file: ext.internalPoFile },
                { label: 'Order Confirmation', file: ext.ocFile },
                { label: 'Vendor Invoice', file: ext.vendorInvoiceFile },
                { label: 'Project Report', file: ext.projectReportFile }
              ].map((doc, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                  <div className="flex items-center gap-2">
                    <FilePdfOutlined className={doc.file ? `text-${doc.color || 'red'}-500` : "text-gray-300"} />
                    <Text className={`text-xs ${doc.file ? "font-medium" : "text-gray-400"}`}>{doc.label}</Text>
                  </div>
                  {doc.file ? (
                    <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => window.open(getFileUrl(doc.file), '_blank')}>Download</Button>
                  ) : (
                    <Text type="secondary" className="text-[10px] italic">Not uploaded</Text>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Workflow History */}
          <WorkflowHistory
            histories={[
              ...(po.quotation?.inquiry?.histories || []).map(h => ({ ...h, type: 'INQUIRY' })),
              ...(po.quotation?.histories || []).map(h => ({ ...h, type: 'QUOTATION' })),
              ...(po.histories || []).map(h => ({ ...h, type: 'PO' })),
              ...(po.projectExecutions || []).flatMap(e =>
                (e.histories || []).map(h => ({ ...h, type: 'EXECUTION' }))
              )
            ]}
            className="!mt-5"
          />
        </div>
      </div>

      {/* Revert Modal */}
      <Modal
        title="Revert PO to Quotation"
        open={isRevertModalVisible}
        onOk={handleRevert}
        onCancel={() => setIsRevertModalVisible(false)}
        confirmLoading={reverting}
        okText="Confirm Revert"
        okButtonProps={{ danger: true }}
      >
        <p className="mb-4 text-gray-600">
          This will remove the PO configuration and revert the Quotation to <strong>ACTIVE</strong> status.
        </p>
        <Input.TextArea rows={3} placeholder="Revert reason..." value={revertReason} onChange={e => setRevertReason(e.target.value)} />
      </Modal>
    </div>
  );
}

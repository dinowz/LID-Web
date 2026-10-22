import React, { useState, useEffect } from 'react';
import {
  Card, Table, Typography, Space, Button, message, Tag, Form, Input,
  Row, Col, DatePicker, Select, InputNumber, Modal, Timeline, Steps, Divider, Alert, Upload
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined, MailOutlined,
  UploadOutlined, FileDoneOutlined, SendOutlined, ToolOutlined, ArrowRightOutlined,
  CalendarOutlined, WarningOutlined, BellOutlined, LockOutlined, RollbackOutlined, FilePdfOutlined, EyeOutlined, DownloadOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getPOById, updatePO, sendReminder, revertPOToQuotation } from '../../services/po.service';
import { getVendors } from '../../services/master.service';
import DocumentUpload from '../../components/DocumentUpload';
import { getFileUrl } from '../../utils/file';
import usePermissions from '../../hooks/usePermissions';
import useUnsavedChangesWarning from '../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../components/UnsavedChangesModal';
import WorkflowHistory from '../../components/WorkflowHistory';
import SplitPoModal from '../Sparepart/PO/SplitPoModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_META = {
  REVIEW: { label: 'Review & Input', color: 'blue', icon: <FileDoneOutlined /> },
  PROCESSING: { label: 'Internal PO Created', color: 'orange', icon: <FileDoneOutlined /> },
  WAITING_OC: { label: 'Waiting for Order Confirmation', color: 'purple', icon: <SendOutlined /> },
  MANUFACTURING: { label: 'In Manufacturing', color: 'gold', icon: <ToolOutlined /> },
  READY: { label: 'Vendor Documents Complete', color: 'cyan', icon: <CheckCircleOutlined /> },
  COMPLETED: { label: 'Proceed to execution', color: 'green', icon: <CheckCircleOutlined /> },
};

// FakeUpload has been replaced with the real DocumentUpload component

export default function SharedPODetail({ backPath = '/service/po', moduleLabel = 'Service' }) {
  const PO_STATUS_STEPS = moduleLabel === 'Spare Part'
    ? ['REVIEW', 'PROCESSING', 'WAITING_OC', 'MANUFACTURING', 'READY', 'COMPLETED']
    : ['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'COMPLETED'];
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [form] = Form.useForm();
  const watchedNetValue = Form.useWatch('netValue', form);
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();
  const [advancing, setAdvancing] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [isRevertModalVisible, setIsRevertModalVisible] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);
  const [isSplitModalVisible, setIsSplitModalVisible] = useState(false);
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
      const ext = po.serviceDetail || po.sparePartDetail || {};
      form.setFieldsValue({
        sdDocument: po.sdDocument,
        poNumber: po.poNumber,
        netValue: po.netValue || po.quotation?.totalPrice || 0,
        currency: po.currency || po.quotation?.currency || 'IDR',
        codeWord: po.codeWord || po.quotation?.inquiry?.codeWord?.code || po.tfs?.inquiry?.codeWord?.code,
        salesOrganization: po.salesOrganization || po.quotation?.creator?.name || 'System Generated',
        // Field ekstensi Service
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
        setIsDirty(false);
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
          setIsDirty(false);
          const label = STATUS_META[nextStatus]?.label || nextStatus;
          message.success(`PO successfully moved to: ${label}${nextStatus === 'COMPLETED' ? ' — Execution created automatically!' : ''}`);

          if (nextStatus === 'COMPLETED') {
            message.success('PO successfully moved to Execution!');
            navigate(moduleLabel === 'Service' ? '/service/executions' : '/project/executions');
            return;
          }
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
    if (!email) return message.warning('Please enter reminder email first');
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
    if (!revertReason.trim()) return message.warning('Please enter revert reason');
    setReverting(true);
    try {
      const response = await revertPOToQuotation(id, revertReason);
      message.success('PO successfully reverted to Quotation');
      navigate(`/quotations/${response.quotationId}`);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to revert');
    } finally {
      setReverting(false);
      setIsRevertModalVisible(false);
    }
  };

  if (loading || !po) return null;

  const ext = po.serviceDetail || po.sparePartDetail || {};
  const currentStatusIdx = PO_STATUS_STEPS.indexOf(po.status);
  const nextStatus = PO_STATUS_STEPS[currentStatusIdx + 1];
  const isEditable = po.status !== 'COMPLETED';
  const canEditSAP = po.status === 'REVIEW' || po.status === 'PROCESSING';
  const canEditVendor = po.status === 'WAITING_OC' || po.status === 'READY';



  const NEXT_BTN_LABELS = {
    REVIEW: { label: <span>Internal PO Created <ArrowRightOutlined /></span>, icon: <FileDoneOutlined /> },
    PROCESSING: { label: <span>Confirm PO Sent to Vendor <ArrowRightOutlined /></span>, icon: <SendOutlined /> },
    WAITING_OC: { label: <span>OC & Documents Received <ArrowRightOutlined /></span>, icon: <CheckCircleOutlined /> },
    READY: { label: <span>Process to Execution <ArrowRightOutlined /></span>, icon: <ToolOutlined /> },
  };

  // Build lookup maps: poDetail.quotationDetailId -> quotationDetail -> inquiryDetail
  const quotationDetailMap = {};
  (po.quotation?.details || []).forEach(qd => {
    quotationDetailMap[qd.id?.toString()] = qd;
  });
  const inquiryDetailMap = {};
  (po.quotation?.inquiry?.details || []).forEach(id => {
    inquiryDetailMap[id.id?.toString()] = id;
  });

  // Helper: get inquiry detail for a PO detail row
  const getInquiryDetail = (poDetail) => {
    const quotationDetailId = poDetail.quotationDetailId?.toString();
    const quotationDetail = quotationDetailMap[quotationDetailId];
    const inquiryDetailId = quotationDetail?.inquiryDetailId?.toString();
    return inquiryDetailMap[inquiryDetailId] || null;
  };

  // Filter: for mixed service external, only show PURCHASE items (not TFS) in PO
  const isMixedExternal = po.quotation?.inquiry?.requestType === 'SERVICE_EXTERNAL';
  const poItemsToShow = po.quotation
    ? (isMixedExternal
      ? (po.details || []).filter(d => {
        const inqDetail = getInquiryDetail(d);
        return !inqDetail || inqDetail.serviceSubType !== 'TFS';
      })
      : (po.details || []))
    : null;

  const itemColumns = [
    { title: 'No', key: 'no', width: 55, render: (_, __, i) => i + 1 },
    {
      title: 'Item', key: 'item',
      render: (_, r) => {
        const inqDetail = getInquiryDetail(r);
        const itemName = inqDetail?.requestedItemName || r.service?.serviceName || r.sparePart?.partName || 'Untracked Item';
        return <span className="font-medium">{itemName}</span>;
      }
    },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 70, align: 'center' },
    { title: 'Type', dataIndex: 'itemType', key: 'type', width: 110, render: t => <Tag>{t}</Tag> },
    {
      title: 'Total', dataIndex: 'totalPrice', key: 'total', align: 'right',
      render: v => <Text strong>{parseFloat(v).toLocaleString()}</Text>
    },
  ];

  const getStatusAlert = () => {
    switch (po.status) {
      case 'REVIEW':
        return (
          <Alert
            message={`Status: Review & Input ${moduleLabel} PO`}
            description="Please complete SD Document and Purchase Order Number before proceeding."
            type="info"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      case 'PROCESSING':
        return (
          <Alert
            message="Status: Internal PO Created"
            description="Internal PO has been entered. Ensure documents have been sent to vendor for confirmation."
            type="warning"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      case 'WAITING_OC':
        return (
          <Alert
            message="Status: Waiting for Order Confirmation"
            description="Waiting for OC and Invoice from vendor. Upload these documents to proceed."
            type="warning"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      case 'READY':
        return (
          <Alert
            message="Status: Documents Complete"
            description={`All documents verified. PO is ready to move to ${moduleLabel} Execution.`}
            type="success"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      case 'COMPLETED':
        return (
          <Alert
            message={`Status: COMPLETED (${moduleLabel} Execution)`}
            description={`This PO is in the ${moduleLabel.toLowerCase()} execution phase. Data can no longer be modified.`}
            type="success"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <UnsavedChangesModal blocker={blocker} />
      <div className="space-y-4 max-w-7xl mx-auto mb-10 px-4">
        {/* Header ... */}
        <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100 print:hidden">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)} />
            <div>
              <Title level={4} style={{ margin: 0 }}>{moduleLabel} Purchase Order Setup</Title>
              <Text type="secondary">
                {po.quotation ? `Ref Quotation: ${po.quotation.quotationNumber}` : `Ref TFS: ${po.tfs?.tfsNumber}`}
              </Text>
            </div>
          </Space>
          <Space>
            {po.status === 'REVIEW' && (po.details || []).length > 1 && permissions.canEditPO && (
              <Button
                icon={<BranchesOutlined />}
                onClick={() => setIsSplitModalVisible(true)}
                className="bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                Split PO
              </Button>
            )}
            {po.status === 'REVIEW' && permissions.canEditPO && (
              <Button danger icon={<RollbackOutlined />} onClick={() => setIsRevertModalVisible(true)}>
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

        {/* Sibling POs Banner if partial PO exists */}
        {po.siblingPOs && po.siblingPOs.length > 0 && (
          <Alert
            type="info"
            showIcon
            className="rounded-xl border-blue-200 bg-blue-50/70 !mb-4"
            style={{ marginBottom: 16 }}
            message={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-blue-900">
                    Partial PO Terhubung ({po.siblingPOs.length + 1} PO dari Penawaran yang sama):
                  </span>
                  <span className="text-xs text-blue-700 ml-2">
                    PO Saat Ini: <strong>{po.poNumber || `#${po.id}`}</strong>
                  </span>
                </div>
                <Space size="small" wrap>
                  <Text className="text-xs text-gray-500">Buka PO Saudara:</Text>
                  {po.siblingPOs.map(sib => (
                    <Button
                      key={sib.id}
                      size="small"
                      type="link"
                      onClick={() => navigate(`/po/${sib.id}`)}
                      className="bg-white border border-blue-300 rounded px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      {sib.poNumber || `PO #${sib.id}`} ({sib.status})
                    </Button>
                  ))}
                </Space>
              </div>
            }
          />
        )}

        {/* Progress Steps */}
        <Card className="rounded-xl shadow-sm border-gray-100 print:hidden" bodyStyle={{ padding: '16px 24px' }}>
          <div className="overflow-x-auto pb-4 -mb-4">
            <div className="min-w-[750px]">
              <Steps
                current={currentStatusIdx}
                size="small"
                items={PO_STATUS_STEPS.map((s) => ({
                  title: STATUS_META[s]?.label || s,
                  status: s === po.status ? 'process' : currentStatusIdx > PO_STATUS_STEPS.indexOf(s) ? 'finish' : 'wait',
                }))}
              />
            </div>
          </div>
        </Card>

        {/* Status Alert */}
        {getStatusAlert()}

        {/* Form Section */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 w-full lg:w-0">
            <Form form={form} layout="vertical" onFinish={handleSaveDraft} disabled={!permissions.canEditPO} onValuesChange={() => setIsDirty(true)}>
              <div className="space-y-5">

                {/* === Quotation / TFS Reference Card === */}
                <Card title={po.quotation ? "Quotation Reference" : "TFS Reference"} className="rounded-xl shadow-sm !mt-5" bordered={false}>
                  <Row gutter={24}>
                    <Col span={8}>
                      <div className="mb-4">
                        <Text type="secondary" className="block text-xs uppercase">Customer</Text>
                        <Text strong className="text-lg">{po.quotation?.inquiry?.customer?.name || po.tfs?.inquiry?.customer?.name || '-'}</Text>
                      </div>
                      <div className="mb-4">
                        <Text type="secondary" className="block text-xs uppercase">Subject</Text>
                        <Text>{po.quotation?.inquiry?.subject || po.tfs?.inquiry?.subject || '-'}</Text>
                      </div>
                      <div>
                        <Text type="secondary" className="block text-xs uppercase">Total</Text>
                        <Text strong className="text-xl text-blue-700">
                          {parseFloat(po.netValue || po.quotation?.totalPrice || 0).toLocaleString()} {po.currency}
                        </Text>
                        {po.hasDp && (
                          <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
                            <div className="flex justify-between">
                              <span className="text-amber-800 font-medium">Down Payment ({po.dpPercent}%):</span>
                              <span className="font-bold text-amber-800">{parseFloat(po.dpAmount || 0).toLocaleString()} {po.currency}</span>
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <span className="text-gray-600 font-medium">Balance ({100 - (po.dpPercent || 0)}%):</span>
                              <span className="font-bold text-gray-700">{parseFloat((po.netValue || 0) - (po.dpAmount || 0)).toLocaleString()} {po.currency}</span>
                            </div>
                            <Tag color={po.dpInvoiced ? "green" : "gold"} className="mt-1.5">
                              {po.dpInvoiced ? "DP Invoiced" : "DP Unbilled"}
                            </Tag>
                          </div>
                        )}
                      </div>
                    </Col>
                    <Col span={16}>
                      <Text type="secondary" className="block text-xs uppercase mb-2">
                        Item Breakdown
                      </Text>

                      <div className="max-h-52 overflow-auto">
                        {po.quotation ? (
                          <Table
                            columns={itemColumns}
                            dataSource={poItemsToShow || []}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            scroll={{ x: 'max-content' }}
                          />
                        ) : (
                          <Table
                            columns={[
                              {
                                title: 'Division',
                                dataIndex: 'name',
                                key: 'name',
                                width: 180,
                              },
                              {
                                title: 'Qty Personnel',
                                dataIndex: 'qty',
                                key: 'qty',
                                align: 'center',
                                width: 120,
                              },
                            ]}
                            dataSource={po.tfs?.divisions || []}
                            rowKey={(r, i) => i}
                            pagination={false}
                            size="small"
                            scroll={{ x: 'max-content' }}
                          />
                        )}
                      </div>
                    </Col>
                  </Row>
                </Card>

                {/* === CARD 1: SAP Info (REVIEW+) === */}
                <Card
                  title={
                    <div className="flex justify-between items-center w-full">
                      <span>Purchase Order Internal SAP <Tag color="red" className="ml-2">Inter_PO <ArrowRightOutlined /> WAITING_OC</Tag></span>
                      {!canEditSAP && isEditable && <Tag color="warning" icon={<LockOutlined />}>Locked: Finish current step first</Tag>}
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
                        <Form.Item label="Vendor" name="vendorId" rules={[{ required: canEditSAP, message: 'Vendor must be selected' }]}>
                          <Select
                            showSearch allowClear placeholder="Search & select vendor..."
                            optionFilterProp="label"
                            filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
                            options={vendors.map(v => ({ value: v.id, label: `[${v.vendorCode}] ${v.vendorName}` }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Code Word" name="codeWord">
                          <Input placeholder="E.g. INDARUNG 5" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Sales Organization" name="salesOrganization">
                          <Input disabled className="bg-gray-50 text-gray-700 font-semibold" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="Remark" name="remarks">
                      <Input.TextArea rows={2} placeholder="Business notes..." />
                    </Form.Item>
                    <Text type="secondary" className="block mb-3 text-xs">
                      Upload Internal PO document from SAP (PDF). Required to advance status to <strong>PROCESSING</strong>.
                    </Text>
                    <Form.Item name="internalPoFile" label="Internal PO File (SAP PDF)" rules={[{ required: canEditSAP, message: 'Internal PO file upload is required' }]}>
                      <DocumentUpload poId={id} poType={moduleLabel === 'Service' ? 'SERVICE' : 'PROJECT'} documentType="internalPoFile" label="PO Internal PDF" disabled={!canEditSAP || !isEditable || !permissions.canEditPO} />
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
                      <span>Vendor Order Confirmation <Tag color="purple" className="ml-2">WAITING_OC <ArrowRightOutlined /> READY</Tag></span>
                      {!canEditVendor && isEditable && <Tag color="warning" icon={<LockOutlined />}>Locked: Wait for step 3</Tag>}
                    </div>
                  }
                  className={`rounded-xl shadow-sm !mt-5 ${!canEditVendor ? 'bg-gray-50 opacity-80' : ''}`}
                  bordered={false}
                >
                  <div className="border-none p-0 m-0">
                    <Text type="secondary" className="block mb-3 text-xs">
                      Upload Order Confirmation (Required) {moduleLabel === 'Service' ? 'and Vendor Invoice (Optional)' : 'and Vendor Invoice (Required)'}. Also complete service details. {moduleLabel === 'Service' && 'Vendor Invoice can be uploaded anytime after reaching this step.'}
                    </Text>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="ocFile" label="Order Confirmation (OC)" rules={[{ required: canEditVendor, message: 'OC upload is required' }]}>
                          <DocumentUpload poId={id} poType={moduleLabel === 'Service' ? 'SERVICE' : 'PROJECT'} documentType="ocFile" label="OC Vendor" disabled={!canEditVendor || !isEditable || !permissions.canEditPO} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="vendorInvoiceFile"
                          label={`Vendor Invoice ${moduleLabel === 'Service' ? '(Optional)' : ''}`}
                          rules={moduleLabel !== 'Service' ? [{ required: canEditVendor, message: 'Invoice upload is required' }] : []}
                        >
                          <DocumentUpload
                            poId={id}
                            poType={moduleLabel === 'Service' ? 'SERVICE' : 'PROJECT'}
                            documentType="vendorInvoiceFile"
                            label="Invoice Vendor"
                            disabled={moduleLabel === 'Service' ? (currentStatusIdx < 2 || !permissions.canEditPO) : (!canEditVendor || !isEditable || !permissions.canEditPO)}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Divider className="my-3" />
                    <Text type="secondary" className="block mb-3 text-xs font-semibold">Service Execution Details</Text>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="serviceStartDate" label={<span>Start Implementation Date <WarningOutlined className="text-orange-500" /> Required</span>} rules={[{ required: canEditVendor, message: 'Start date is required' }]}>
                          <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Start date" disabled={!canEditVendor || !isEditable} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="serviceEndDate" label={<span>End Implementation Date <WarningOutlined className="text-orange-500" /> Required</span>} rules={[{ required: canEditVendor, message: 'End date is required' }]}>
                          <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="End date" disabled={!canEditVendor || !isEditable} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="picName" label="PIC Name">
                          <Input placeholder="Nama PIC lapangan" disabled={!canEditVendor || !isEditable} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="engineerName" label="Engineer Name">
                          <Input placeholder="Nama Engineer bertugas" disabled={!canEditVendor || !isEditable} />
                        </Form.Item>
                      </Col>
                    </Row>
                    {ext.ocReceivedAt && (
                      <Text type="secondary" className="text-xs"><CalendarOutlined className="mr-1" /> OC received: {new Date(ext.ocReceivedAt).toLocaleString('en-US')}</Text>
                    )}
                  </div>
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
                  { label: 'Vendor Invoice', file: ext.vendorInvoiceFile }
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
                ...(po.quotation?.inquiry?.histories || po.tfs?.inquiry?.histories || []).map(h => ({ ...h, type: 'INQUIRY' })),
                ...(po.quotation?.histories || [])
                  .filter(h => h.newStatus !== 'EXECUTED')
                  .map(h => ({ ...h, type: 'QUOTATION' })),
                ...(po.histories || []).map(h => ({ ...h, type: 'PO' })),
                ...(po.serviceExecutions || []).flatMap(d =>
                  (d.histories || []).map(h => ({ ...h, type: 'EXECUTION' }))
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
            This will delete the PO configuration and revert the Quotation to <strong>ACTIVE</strong> status.
          </p>
          <Input.TextArea rows={3} placeholder="Revert reason..." value={revertReason} onChange={e => setRevertReason(e.target.value)} />
        </Modal>

        {/* Split PO Modal */}
        <SplitPoModal
          visible={isSplitModalVisible}
          onClose={() => setIsSplitModalVisible(false)}
          po={po}
          onSuccess={() => fetchPO()}
        />
      </div>
    </>
  );
}

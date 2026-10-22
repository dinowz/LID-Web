import React, { useState, useEffect } from 'react';
import {
  Card, Table, Typography, Space, Button, message, Tag, Form, Input,
  Row, Col, DatePicker, Select, InputNumber, Modal, Timeline, Steps, Divider, Alert, Upload
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined, MailOutlined,
  UploadOutlined, FileDoneOutlined, CarOutlined, SendOutlined, BellOutlined, WarningOutlined,
  ArrowRightOutlined, CalendarOutlined, LockOutlined, RollbackOutlined, FilePdfOutlined, EyeOutlined, ToolOutlined, DownloadOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getPOById, updatePO, revertPOToQuotation } from '../../../services/po.service';
import { getVendors } from '../../../services/master.service';
import usePermissions from '../../../hooks/usePermissions';
import { getFileUrl } from '../../../utils/file';
import DocumentUpload from '../../../components/DocumentUpload';
import WorkflowHistory from '../../../components/WorkflowHistory';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';
import SplitPoModal from './SplitPoModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const PO_STATUS_STEPS = ['REVIEW', 'PROCESSING', 'WAITING_OC', 'MANUFACTURING', 'READY', 'COMPLETED'];

const STATUS_META = {
  REVIEW: { label: 'Review & Input', color: 'blue', icon: <FileDoneOutlined /> },
  PROCESSING: { label: 'Internal PO Created', color: 'orange', icon: <FileDoneOutlined /> },
  WAITING_OC: { label: 'Waiting for Order Confirmation', color: 'purple', icon: <SendOutlined /> },
  MANUFACTURING: { label: 'Manufacturing', color: 'gold', icon: <ToolOutlined /> },
  READY: { label: 'Vendor Documents Complete', color: 'cyan', icon: <CheckCircleOutlined /> },
  COMPLETED: { label: 'Purchase Order Completed', color: 'green', icon: <CheckCircleOutlined /> },
};

// Note: FakeUpload has been replaced with the real DocumentUpload component

const PODetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [form] = Form.useForm();
  const watchedNetValue = Form.useWatch('netValue', form);
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();
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
      const sp = po.sparePartDetail || {}; // ekstensi spare-part
      form.setFieldsValue({
        sdDocument: po.sdDocument,
        poNumber: po.poNumber,
        netValue: po.netValue || po.quotation?.totalPrice || 0,
        currency: po.currency || po.quotation?.currency || 'IDR',
        codeWord: po.codeWord || po.quotation?.inquiry?.codeWord?.code || po.tfs?.inquiry?.codeWord?.code,
        salesOrganization: po.salesOrganization || po.quotation?.creator?.name || 'System Generated',
        // Field ekstensi sparePartDetail
        shipToPartyName: sp.shipToPartyName || po.quotation?.inquiry?.customer?.name || po.tfs?.inquiry?.customer?.name,
        expectedTo: sp.expectedTo ? dayjs(sp.expectedTo) : null,
        vendorId: sp.vendorId ?? null,
        vendorType: sp.vendorType || 'EXTERNAL',
        internalPoFile: sp.internalPoFile ?? null,
        vendorQuotationFile: sp.vendorQuotationFile ?? null,
        otherQuotationFiles: sp.otherQuotationFiles ?? [],
        ocFile: sp.ocFile ?? null,
        vendorInvoiceFile: sp.vendorInvoiceFile ?? null,
        vendorPackingListFile: sp.vendorPackingListFile ?? null,
        bastFile: sp.bastFile ?? null,
        qcCheckFile: sp.qcCheckFile ?? null,
        estimatedProductionDone: sp.estimatedProductionDone ? dayjs(sp.estimatedProductionDone) : null,
        estimatedReadyToShip: sp.estimatedReadyToShip ? dayjs(sp.estimatedReadyToShip) : null,
        remarks: po.remarks,
      });
    }
  }, [po, form]);


  const buildPayload = (values) => ({
    ...values,
    expectedTo: values.expectedTo ? values.expectedTo.toISOString() : null,
    estimatedProductionDone: values.estimatedProductionDone ? values.estimatedProductionDone.toISOString() : null,
    estimatedReadyToShip: values.estimatedReadyToShip ? values.estimatedReadyToShip.toISOString() : null,
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
          message.success(`PO successfully moved to: ${label}${nextStatus === 'COMPLETED' ? ' — Delivery created automatically!' : ''}`);
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

  const handleRevert = async () => {
    if (!revertReason.trim()) return message.warning('Enter revert reason');
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

  const handleRemoveOtherQuotation = (fileUrlToRemove) => {
    const currentFiles = form.getFieldValue('otherQuotationFiles') || [];
    const updatedFiles = currentFiles.filter(url => url !== fileUrlToRemove);
    form.setFieldsValue({ otherQuotationFiles: updatedFiles });
  };

  if (loading || !po) return null;

  const sp = po.sparePartDetail || {}; // helper shortcut
  const currentStatusIdx = PO_STATUS_STEPS.indexOf(po.status);
  const nextStatus = PO_STATUS_STEPS[currentStatusIdx + 1];
  const isEditable = po.status !== 'COMPLETED';
  const canEditSAP = po.status === 'REVIEW' || po.status === 'PROCESSING';
  const canEditVendor = po.status === 'WAITING_OC' || po.status === 'MANUFACTURING' || po.status === 'READY';


  const NEXT_BTN_LABELS = {
    REVIEW: { label: <span>Internal PO Created <ArrowRightOutlined /></span>, icon: <FileDoneOutlined /> },
    PROCESSING: { label: <span>PO Confirmation Sent to Vendor <ArrowRightOutlined /></span>, icon: <SendOutlined /> },
    WAITING_OC: { label: <span>Move to Manufacturing <ArrowRightOutlined /></span>, icon: <ToolOutlined /> },
    MANUFACTURING: { label: <span>Documents Complete <ArrowRightOutlined /></span>, icon: <CheckCircleOutlined /> },
    READY: { label: <span>Mark as Completed <ArrowRightOutlined /></span>, icon: <CheckCircleOutlined /> },
  };

  const getStatusAlert = () => {
    switch (po.status) {
      case 'REVIEW':
        return (
          <Alert
            message="Status: REVIEW & INPUT"
            description="Complete SD Document and PO Number data from SAP before proceeding to the next process."
            type="info"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      case 'PROCESSING':
        return (
          <Alert
            message="Status: INTERNAL PO CREATED"
            description="Internal PO has been created. Ensure documents have been sent to the vendor to obtain confirmation (OC)."
            type="warning"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      case 'WAITING_OC':
        return (
          <Alert
            message="Status: WAITING FOR ORDER CONFIRMATION"
            description="Waiting for OC, Invoice, and Packing List documents from the vendor. Upload these documents to proceed."
            type="warning"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      case 'READY':
        return (
          <Alert
            message="Status: VENDOR DOCUMENTS COMPLETE"
            description="All vendor documents have been received. PO is ready to be processed for Delivery creation."
            type="success"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      case 'MANUFACTURING':
        return (
          <Alert
            message="Status: MANUFACTURING"
            description="Manufacturing is in progress. Please upload vendor documents (Invoice, Packing List) once the goods are ready."
            type="warning"
            showIcon
            icon={<ToolOutlined />}
            className="rounded-xl !mt-5"
          />
        );
      case 'COMPLETED':
        return (
          <Alert
            message="Status: COMPLETED (Delivery Process)"
            description="The purchase order has been completed and sent to the delivery process. Data can no longer be changed."
            type="success"
            showIcon
            className="rounded-xl !mt-5"
          />
        );
      default:
        return null;
    }
  };

  const itemColumns = [
    { title: 'No', key: 'no', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Item', key: 'item',
      render: (_, r) => {
        let description = r.service?.serviceName || r.sparePart?.partName || 'Untracked Item';

        const qDetails = po?.quotation?.details || [];
        const iDetails = po?.quotation?.inquiry?.details || [];

        if (r.quotationDetailId) {
          const qd = qDetails.find(q => String(q.id) === String(r.quotationDetailId));
          if (qd && qd.inquiryDetailId) {
            const idet = iDetails.find(i => String(i.id) === String(qd.inquiryDetailId));
            if (idet) {
              description = idet.requestedItemName || idet.requestDescription || description;
            }
          }
        }

        return (
          <span className="font-medium">
            {description}
          </span>
        );
      }
    },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 65, align: 'center' },
    { title: 'Type', dataIndex: 'itemType', key: 'type', width: 100, render: t => <Tag>{t}</Tag> },
    {
      title: 'Dimensi (P×L×T)',
      key: 'dimensions',
      width: 140,
      render: (_, r) => (
        r.sparePart?.dimensions
          ? <Text className="text-xs text-gray-600">{r.sparePart.dimensions}</Text>
          : <Text type="secondary" className="text-xs">-</Text>
      )
    },
    {
      title: 'Berat (kg)',
      key: 'weightKg',
      width: 100,
      align: 'right',
      render: (_, r) => (
        r.sparePart?.weightKg
          ? <Text className="text-xs">{parseFloat(r.sparePart.weightKg).toLocaleString('en-US')} kg</Text>
          : <Text type="secondary" className="text-xs">-</Text>
      )
    },
    {
      title: 'Total', dataIndex: 'totalPrice', key: 'total', align: 'right', width: 130,
      render: v => <Text strong>{parseFloat(v).toLocaleString()}</Text>
    },
  ];

  return (
    <>
      <UnsavedChangesModal blocker={blocker} />
      <div className="space-y-4 max-w-7xl mx-auto mb-10 px-4">

        {/* Header */}
        <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100 print:hidden">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/po')} />
            <div>
              <Title level={4} style={{ margin: 0 }}>Purchase Order Setup</Title>
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
                  <Text className="text-xs text-gray-500">Buka PO sebelumnya:</Text>
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
        <Card
          className="rounded-xl shadow-sm border-gray-100 print:hidden"
          bodyStyle={{ padding: '16px 24px' }}
        >
          <div className="overflow-x-auto pb-3">
            <div className="min-w-max">
              <Steps
                current={currentStatusIdx}
                size="small"
                responsive={false}
                items={PO_STATUS_STEPS.map((s) => ({
                  title: (
                    <div className="min-w-[140px] max-w-[180px] whitespace-normal text-center leading-tight">
                      {STATUS_META[s]?.label || s}
                    </div>
                  ),
                  status:
                    s === po.status
                      ? 'process'
                      : currentStatusIdx > PO_STATUS_STEPS.indexOf(s)
                        ? 'finish'
                        : 'wait',
                }))}
              />
            </div>
          </div>
        </Card>

        {/* ── Status Alert ── */}
        {getStatusAlert()}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 w-full lg:w-0">
            <Form form={form} layout="vertical" onFinish={handleSaveDraft} disabled={!isEditable || !permissions.canEditPO} onValuesChange={() => setIsDirty(true)}>
              <div className="space-y-5">

                {/* === Quotation / TFS Reference Card === */}
                <Card title={po.quotation ? "Quotation Reference" : "TFS Reference"} className="rounded-xl shadow-sm !mt-5" bordered={false}>



                  {/* Customer / Subject / Total — 2-column layout below breakdown */}
                  <Row gutter={24}>
                    <Col xs={24} sm={12}>
                      <div className="mb-3">
                        <Text type="secondary" className="block text-xs uppercase mb-0.5">Customer</Text>
                        <Text strong className="text-base">
                          {po.quotation?.inquiry?.customer?.name || po.tfs?.inquiry?.customer?.name || '-'}
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary" className="block text-xs uppercase mb-0.5">Subject</Text>
                        <Text className="text-sm leading-snug">
                          {po.quotation?.inquiry?.subject || po.tfs?.inquiry?.subject || '-'}
                        </Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                        <Text type="secondary" className="block text-xs uppercase mb-1">Total PO</Text>
                        <Text strong className="text-2xl text-blue-700 block">
                          {parseFloat(po.netValue || po.quotation?.totalPrice || 0).toLocaleString()} {po.currency}
                        </Text>
                        {po.quotation?.currency && po.quotation.currency !== po.currency && (
                          <Text type="secondary" className="text-xs">
                            Ref Quotation: {parseFloat(po.quotation.totalPrice || 0).toLocaleString()} {po.quotation.currency}
                          </Text>
                        )}
                        {po.hasDp && (
                          <div className="mt-2 pt-2 border-t border-blue-200">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-amber-800 font-semibold">Down Payment ({po.dpPercent}%):</span>
                              <span className="font-bold text-amber-800">
                                {parseFloat(po.dpAmount || 0).toLocaleString()} {po.currency}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs mt-0.5">
                              <span className="text-blue-800 font-semibold">Balance ({100 - (po.dpPercent || 0)}%):</span>
                              <span className="font-bold text-blue-800">
                                {parseFloat((po.netValue || 0) - (po.dpAmount || 0)).toLocaleString()} {po.currency}
                              </span>
                            </div>
                            <div className="mt-1">
                              <Tag color={po.dpInvoiced ? "green" : "gold"}>
                                {po.dpInvoiced ? "DP Invoiced" : "DP Unbilled (Ready to Invoice)"}
                              </Tag>
                            </div>
                          </div>
                        )}
                      </div>
                    </Col>
                  </Row>
                  {/* Item Breakdown — full width */}
                  <Text type="secondary" className="block text-xs uppercase mb-2">Item Breakdown</Text>
                  <div className="overflow-x-auto mb-5">
                    {po.quotation ? (
                      <Table
                        columns={itemColumns}
                        dataSource={po.details || []}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        scroll={{ x: 700 }}
                      />
                    ) : (
                      <Table
                        columns={[
                          { title: 'Division', dataIndex: 'name', key: 'name' },
                          { title: 'Person Qty', dataIndex: 'qty', key: 'qty', align: 'center' },
                        ]}
                        dataSource={po.tfs?.divisions || []}
                        rowKey={(r, i) => i}
                        pagination={false}
                        size="small"
                      />
                    )}
                  </div>
                </Card>

                {/* === CARD 1: SAP Info (REVIEW+) === */}
                <Card
                  title={
                    <div className="flex justify-between items-center w-full">
                      <span>SAP Internal Purchase Order <Tag color="red" className="ml-2">Inter_PO <ArrowRightOutlined /> WAITING_OC</Tag></span>
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
                          <Select options={[{ label: 'IDR', value: 'IDR' }, { label: 'EUR', value: 'EUR' }, { label: 'USD', value: 'USD' }]} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={[18, 18]}>
                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Vendor"
                          name="vendorId"
                          rules={[
                            {
                              required: canEditSAP,
                              message: 'Vendor must be selected',
                            },
                          ]}
                        >
                          <Select
                            showSearch
                            allowClear
                            placeholder="Search & select vendor..."
                            optionFilterProp="label"
                            filterOption={(input, option) =>
                              String(option?.label ?? '')
                                .toLowerCase()
                                .includes(input.toLowerCase())
                            }
                            options={vendors.map((v) => ({
                              value: v.id,
                              label: `[${v.vendorCode}] ${v.vendorName}`,
                            }))}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Vendor Type"
                          name="vendorType"
                          rules={[
                            {
                              required: canEditSAP,
                              message: 'Vendor type must be selected',
                            },
                          ]}
                        >
                          <Select
                            placeholder="Select vendor type..."
                            options={[
                              {
                                label: 'IC (Inter-Company)',
                                value: 'IC',
                              },
                              {
                                label: 'External',
                                value: 'EXTERNAL',
                              },
                            ]}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Ship to Party Name"
                          name="shipToPartyName"
                        >
                          <Input
                            placeholder="E.g. PT. Super Crete Indonesia"
                            style={{ width: '100%' }}
                          />
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
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Expected TO (Delivery)" name="expectedTo">
                          <DatePicker className="w-full" format="DD/MM/YYYY" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="Remark" name="remarks">
                      <Input.TextArea rows={2} placeholder="Logistics or business notes..." />
                    </Form.Item>
                    <Text type="secondary" className="block mb-3 text-xs">
                      Upload Internal PO document from SAP (PDF). Required to advance status to <strong>PROCESSING</strong>.
                    </Text>
                    <Form.Item name="internalPoFile" label="Internal PO File (SAP PDF)" rules={[{ required: canEditSAP, message: 'Internal PO file upload is required' }]}>
                      <DocumentUpload poId={id} poType="SPARE_PART" documentType="internalPoFile" label="Internal PO PDF" disabled={!canEditSAP || !isEditable || !permissions.canEditPO} />
                    </Form.Item>
                    {sp.internalPoUploadedAt && (
                      <Text type="secondary" className="text-xs mb-3 block"><CalendarOutlined className="mr-1" /> Uploaded: {new Date(sp.internalPoUploadedAt).toLocaleString('en-US')}</Text>
                    )}

                    {/* Upload QUOTATION (Mandatory) */}
                    <Form.Item name="vendorQuotationFile" label="Quotation Vendor Utama (PDF)" rules={[{ required: canEditSAP, message: 'Vendor quotation file is required' }]}>
                      <DocumentUpload poId={id} poType="SPARE_PART" documentType="vendorQuotationFile" label="Quotation Utama PDF" disabled={!canEditSAP || !isEditable || !permissions.canEditPO} />
                    </Form.Item>

                    {/* Upload OTHER QUOTATIONS (Optional & Multiple) */}
                    <Form.Item name="otherQuotationFiles" label="Other Quotation References (PDF)">
                      <DocumentUpload
                        multiple
                        poId={id}
                        poType="SPARE_PART"
                        documentType="otherQuotationFiles"
                        label="Add Other Quotation Reference"
                        disabled={!canEditSAP || !isEditable || !permissions.canEditPO}
                      />
                    </Form.Item>
                  </fieldset>
                </Card>
                {/* === CARD 3: Dokumen Vendor (WAITING_OC → READY) === */}
                <Card
                  title={
                    <div className="flex justify-between items-center w-full">
                      <span>Order Confirmation Vendor <Tag color="purple" className="ml-2">WAITING_OC <ArrowRightOutlined /> MANUFACTURING <ArrowRightOutlined /> READY</Tag></span>
                      {!canEditVendor && isEditable && <Tag color="warning" icon={<LockOutlined />}>Locked: Wait for step 3</Tag>}
                    </div>
                  }
                  className={`rounded-xl shadow-sm !mt-5 ${!canEditVendor ? 'bg-gray-50 opacity-80' : ''}`}
                  bordered={false}
                >
                  <fieldset disabled={!canEditVendor || !isEditable} className="border-none p-0 m-0">
                    <Text type="secondary" className="block mb-3 text-xs">
                      Upload Order Confirmation, Vendor Invoice, and Packing List after the vendor sends confirmation. Required to move to <strong>READY</strong> status.
                    </Text>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="ocFile" label="Order Confirmation (OC)" rules={[{ required: po.status === 'WAITING_OC', message: 'OC upload is required' }]}>
                          <DocumentUpload poId={id} poType="SPARE_PART" documentType="ocFile" label="Vendor OC" disabled={!canEditVendor || !isEditable || !permissions.canEditPO} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="vendorInvoiceFile" label="Vendor Invoice" rules={[{ required: po.status === 'MANUFACTURING', message: 'Invoice upload is required' }]}>
                          <DocumentUpload poId={id} poType="SPARE_PART" documentType="vendorInvoiceFile" label="Vendor Invoice" disabled={!canEditVendor || !isEditable || !permissions.canEditPO} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="vendorPackingListFile" label="Vendor Packing List" rules={[{ required: po.status === 'MANUFACTURING', message: 'Packing List upload is required' }]}>
                          <DocumentUpload poId={id} poType="SPARE_PART" documentType="vendorPackingListFile" label="Packing List" disabled={!canEditVendor || !isEditable || !permissions.canEditPO} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16} className="mt-3">
                      <Col span={12}>
                        <Form.Item
                          name="bastFile"
                          label={`BAST ${form.getFieldValue('vendorType') === 'EXTERNAL' ? '(Mandatory)' : '(Optional)'}`}
                          rules={[{
                            required: po.status === 'MANUFACTURING' && form.getFieldValue('vendorType') === 'EXTERNAL',
                            message: 'BAST upload is required for External vendors'
                          }]}
                        >
                          <DocumentUpload poId={id} poType="SPARE_PART" documentType="bastFile" label="BAST"
                            disabled={!canEditVendor || !isEditable || !permissions.canEditPO} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="qcCheckFile" label="QC Check (Optional)">
                          <DocumentUpload poId={id} poType="SPARE_PART" documentType="qcCheckFile" label="QC Check"
                            disabled={!canEditVendor || !isEditable || !permissions.canEditPO} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Divider className="my-3" />
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="estimatedProductionDone" label="Estimated Production Completion">
                          <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Production completion date" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="estimatedReadyToShip" label={<span>Estimated Ready to Ship <WarningOutlined className="text-orange-500" /> Required</span>} rules={[{ required: po.status === 'MANUFACTURING', message: 'Estimated ready to ship date is required' }]}>
                          <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Ready to ship date" />
                        </Form.Item>
                      </Col>
                    </Row>
                    {sp.ocReceivedAt && (
                      <Text type="secondary" className="text-xs"><CalendarOutlined className="mr-1" /> OC received: {new Date(sp.ocReceivedAt).toLocaleString('en-US')}</Text>
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
                  { label: 'Internal PO', file: sp.internalPoFile },
                  { label: 'Vendor Quotation', file: sp.vendorQuotationFile },
                  { label: 'Order Confirmation', file: sp.ocFile },
                  { label: 'Vendor Invoice', file: sp.vendorInvoiceFile },
                  { label: 'Packing List', file: sp.vendorPackingListFile },
                  { label: 'BAST', file: sp.bastFile },
                  { label: 'QC Check', file: sp.qcCheckFile }
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
                {Array.isArray(sp.otherQuotationFiles) && sp.otherQuotationFiles.map((fileUrl, index) => (
                  <div key={`other-${index}`} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                    <div className="flex items-center gap-2">
                      <FilePdfOutlined className="text-red-500" />
                      <Text className="text-xs font-medium">Other Quote Ref {index + 1}</Text>
                    </div>
                    <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => window.open(getFileUrl(fileUrl), '_blank')}>Download</Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Workflow History */}
            <WorkflowHistory
              histories={[
                ...(po.quotation?.inquiry?.histories || po.tfs?.inquiry?.histories || []).map(h => ({ ...h, type: 'INQUIRY' })),
                ...(po.quotation?.histories || []).map(h => ({ ...h, type: 'QUOTATION' })),
                ...(po.histories || []).map(h => ({ ...h, type: 'PO' })),
                ...(po.deliveries || []).flatMap(d =>
                  (d.histories || []).map(h => ({ ...h, type: 'DELIVERY', deliveryNo: d.deliveryNumber }))
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
            This will remove the PO configuration and return the Quotation to <strong>ACTIVE</strong> status.
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
};

export default PODetail;

import React, { useState, useEffect } from 'react';
import {
  Card, Table, Typography, Tag, Button, message, Form, Input, InputNumber,
  DatePicker, Select, Divider, Modal, Timeline, Space, Tooltip, Row, Col, Badge, Alert
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, TruckOutlined, EnvironmentOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, PlusOutlined, DeleteOutlined,
  InfoCircleOutlined, LockOutlined, SyncOutlined, InboxOutlined, SendOutlined, TrophyOutlined,
  CloseCircleOutlined, FileTextOutlined, CheckOutlined, FilePdfOutlined, DownloadOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getDeliveryById, updateDeliveryTracking, updateDeliveryStatus, createDelivery, deleteDeliveryItem, generateDeliveryNote } from '../../../services/delivery.service';
import { getForwarders } from '../../../services/master.service';
import DocumentUpload from '../../../components/DocumentUpload';
import WorkflowHistory from '../../../components/WorkflowHistory';
import usePermissions from '../../../hooks/usePermissions';
import { getFileUrl } from '../../../utils/file';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';
import SplitDeliveryModal from './SplitDeliveryModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  REVIEW_LOGISTIC: { color: 'default', label: 'Review Logistic', dot: <SyncOutlined /> },
  PACKED: { color: 'cyan', label: 'Packed', dot: <InboxOutlined /> },
  SHIPPED: { color: 'blue', label: 'Shipped', dot: <TruckOutlined /> },
  IN_TRANSIT: { color: 'geekblue', label: 'In Transit', dot: <SendOutlined /> },
  DELIVERED: { color: 'green', label: 'Delivered', dot: <CheckCircleOutlined /> },
  DELAYED: { color: 'red', label: 'Delayed', dot: <WarningOutlined /> },
  COMPLETED: { color: 'success', label: 'Completed', dot: <TrophyOutlined /> },
  CANCELLED: { color: 'default', label: 'Cancelled', dot: <CloseCircleOutlined /> }
};

const TIMELINE_COLOR = { DELIVERY: '#f97316', PO: '#22c55e', QUOTATION: '#3b82f6', INQUIRY: '#a855f7' };

const NEXT_ACTIONS = {
  REVIEW_LOGISTIC: [{ status: 'PACKED', label: 'Mark as Packed', icon: <CheckCircleOutlined />, type: 'primary' }],
  PACKED: [{ status: 'SHIPPED', label: 'Mark as Shipped', icon: <TruckOutlined />, type: 'primary' }],
  SHIPPED: [{ status: 'IN_TRANSIT', label: 'Mark as In Transit', icon: <TruckOutlined />, type: 'primary' }],
  IN_TRANSIT: [
    { status: 'DELIVERED', label: 'Mark as Delivered', icon: <CheckCircleOutlined />, type: 'primary', className: 'bg-green-600 border-green-600' },
    { status: 'DELAYED', label: 'Mark as Delayed', icon: <WarningOutlined />, type: 'default', danger: true }
  ],
  DELIVERED: [{ status: 'COMPLETED', label: 'Complete Delivery', icon: <CheckCircleOutlined />, type: 'primary', className: 'bg-green-700 border-green-700' }],
  DELAYED: [{ status: 'IN_TRANSIT', label: 'Resume Shipment', icon: <TruckOutlined />, type: 'default' }]
};

// Panduan langkah per status
const STATUS_GUIDANCE = {
  REVIEW_LOGISTIC: {
    type: 'info',
    message: <span><FileTextOutlined className="mr-2" /> Step 1 — Logistics Review & Tracking Input</span>,
    description: 'Periksa item pengiriman di bawah, lalu isi semua data Tracking (AWB, Kurir, Lokasi, Tanggal, Berat, Dimensi) dan klik "Save Tracking Info". Tombol "Mark as Packed" akan aktif setelah semua data tersimpan.'
  },
  PACKED: {
    type: 'warning',
    message: <span><InboxOutlined className="mr-2" /> Step 2 — Items Packed</span>,
    description: 'Items have been packed and tracking data is saved. Click "Mark as Shipped" to continue. Tracking data is now locked from editing.'
  },
  SHIPPED: {
    type: 'info',
    message: <span><TruckOutlined className="mr-2" /> Step 3 — Items Shipped</span>,
    description: 'Items have been shipped. Tracking data is now locked. Monitor the shipment and update the status to "In Transit" when the items are on their way.'
  },
  IN_TRANSIT: {
    type: 'info',
    message: <span><SendOutlined className="mr-2" /> Step 4 — In Transit</span>,
    description: 'Items are on their way to the customer. Mark as "Delivered" when the items have been received, or "Delayed" if there are any obstacles.'
  },
  DELIVERED: {
    type: 'success',
    message: <span><CheckCircleOutlined className="mr-2" /> Step 5 — Items Received</span>,
    description: 'Items have been received by the customer. Click "Complete Delivery" to officially close and complete this shipment document.'
  },
  DELAYED: {
    type: 'error',
    message: <span><WarningOutlined className="mr-2" /> Shipment Delayed</span>,
    description: 'The shipment is experiencing delays. Coordinate with the courier/vendor and click "Resume Shipment" when the shipment is back on track.'
  },
  COMPLETED: {
    type: 'success',
    message: <span><TrophyOutlined className="mr-2" /> Shipment Completed</span>,
    description: 'This shipment document has been closed. All data is read-only and cannot be changed.'
  },
  CANCELLED: {
    type: 'error',
    message: <span><CloseCircleOutlined className="mr-2" /> Shipment Cancelled</span>,
    description: 'This shipment has been cancelled. All data is read-only.'
  }
};

const DeliveryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [trackingForm] = Form.useForm();
  const [statusForm] = Form.useForm();
  const [delivery, setDelivery] = useState(null);
  const currentProof = Form.useWatch('proofOfDelivery', statusForm);
  const [forwarders, setForwarders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();
  const [statusModal, setStatusModal] = useState({ open: false, action: null });
  const [isSplitModalVisible, setIsSplitModalVisible] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [noteForm] = Form.useForm();
  const [generatingNote, setGeneratingNote] = useState(false);

  useEffect(() => {
    fetchDelivery();
    fetchForwarders();
  }, [id]);

  const fetchForwarders = async () => {
    try {
      const data = await getForwarders({ active: true });
      setForwarders(data);
    } catch (error) {
      console.error('Failed to load forwarders:', error);
    }
  };

  const fetchDelivery = async () => {
    try {
      const data = await getDeliveryById(id);
      setDelivery(data);

      // Auto-fill berat & dimensi dari master spare part (jika field masih kosong)
      const spareItems = (data.items || []).filter(item => item.poDetail?.sparePart);
      const autoWeightKg = data.weightKg
        ? parseFloat(data.weightKg)
        : spareItems.reduce((sum, item) => {
          const w = parseFloat(item.poDetail?.sparePart?.weightKg || 0);
          const qty = parseFloat(item.qtyDelivered || item.poDetail?.qty || 1);
          return sum + (w * qty);
        }, 0) || null;
      const autoDimensions = data.dimensions
        || (spareItems[0]?.poDetail?.sparePart?.dimensions ?? '');

      trackingForm.setFieldsValue({
        trackingNumber: data.trackingNumber || '',
        shippingService: data.shippingService || '',
        currentLocation: data.currentLocation || '',
        targetDeliveryDate: data.targetDeliveryDate ? dayjs(data.targetDeliveryDate) : null,
        logisticNote: data.logisticNote || '',
        clientPoNumber: data.clientPoNumber || '',
        packingList: data.packingList || '',
        reminderEmail: data.reminderEmail || '',
        weightKg: autoWeightKg,
        dimensions: autoDimensions,
        freightCost: data.freightCost ? parseFloat(data.freightCost) : null,
        forwarderPoFile: data.forwarderPoFile ?? null,
        forwarderQuotationFile: data.forwarderQuotationFile ?? null,
        forwarderInvoiceFile: data.forwarderInvoiceFile ?? null,
        otherForwarderQuotationFiles: data.otherForwarderQuotationFiles ?? []
      });
    } catch {
      message.error('Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTracking = async (values) => {
    setSaving(true);
    try {
      await updateDeliveryTracking(id, {
        ...values,
        targetDeliveryDate: values.targetDeliveryDate ? values.targetDeliveryDate.toISOString() : null
      });
      setIsDirty(false);
      message.success(isGeneralTrackingEditable ? 'Tracking info saved' : 'Freight Cost & Forwarder info updated');
      fetchDelivery();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (action) => {
    statusForm.resetFields();
    setStatusModal({ open: true, action });
  };

  const handleConfirmStatusUpdate = async () => {
    try {
      const values = await statusForm.validateFields();
      await updateDeliveryStatus(id, {
        newStatus: statusModal.action.status,
        location: values.location,
        note: values.note,
        delayReason: values.delayReason,
        proofOfDelivery: values.proofOfDelivery,
        giNumber: values.giNumber
      });
      message.success(`Status updated to ${statusModal.action.label}`);
      setStatusModal({ open: false, action: null });
      fetchDelivery();
    } catch (err) {
      if (err?.response?.data?.error) {
        message.error(err.response.data.error);
      }
    }
  };

  const openNoteModal = () => {
    noteForm.setFieldsValue({
      deliveryMethod: delivery.deliveryMethod || undefined,
      shippingAddress: delivery.shippingAddress || '',
      pic: delivery.pic || '',
      clientPoNumber: delivery.clientPoNumber || '',
      packingList: delivery.packingList || '',
    });
    setNoteModal(true);
  };

  const handleGenerateNote = async () => {
    try {
      const values = await noteForm.validateFields();
      setGeneratingNote(true);
      const blob = await generateDeliveryNote(id, values);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `delivery-note-${delivery.deliveryNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Delivery Note berhasil di-generate!');
      setNoteModal(false);
      fetchDelivery(); // Refresh supaya data deliveryMethod & shippingAddress update
    } catch (err) {
      if (err?.response?.data?.error) {
        message.error(err.response.data.error);
      } else if (err?.errorFields) {
        // form validation error, do nothing
      } else {
        message.error('Gagal generate Delivery Note');
      }
    } finally {
      setGeneratingNote(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await deleteDeliveryItem(id, itemId);
      message.success('Item removed from delivery');
      fetchDelivery();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to remove item');
    }
  };

  if (loading || !delivery) return null;

  const po = delivery.purchaseOrder;
  const inquiry = po?.quotation?.inquiry;
  const isTerminal = ['COMPLETED', 'CANCELLED'].includes(delivery.status);
  const actions = NEXT_ACTIONS[delivery.status] || [];

  // Form tracking umum (AWB, kurir, tanggal, berat, dimensi) bisa diedit saat status REVIEW_LOGISTIC atau PACKED
  const isGeneralTrackingEditable = ['REVIEW_LOGISTIC', 'PACKED'].includes(delivery.status);

  // Status invoice terkait delivery ini
  const paidInvoice = (delivery.invoices || []).find(inv => inv.status === 'PAID');
  const isInvoiceDone = Boolean(paidInvoice);

  // Freight Cost, Forwarder Invoice dokumen, dan Logistic Note tetap dapat diedit selama invoice belum PAID
  const isFreightCostEditable = permissions.canEditDelivery && delivery.status !== 'CANCELLED' && !isInvoiceDone;

  // Form dapat disimpan jika general tracking editable atau freight cost editable
  const canSaveTrackingForm = (isGeneralTrackingEditable || isFreightCostEditable) && permissions.canEditDelivery;

  // Tombol "Mark as Shipped" terkunci jika tracking belum tersimpan di DB
  const isShippedLocked = delivery.status === 'PACKED' &&
    (!delivery.trackingNumber || !delivery.shippingService);

  // Tombol "Mark as Packed" terkunci jika 6 field tracking belum tersimpan di DB
  const isPackedLocked = delivery.status === 'REVIEW_LOGISTIC' && (
    !delivery.trackingNumber || !delivery.shippingService ||
    !delivery.currentLocation || !delivery.targetDeliveryDate ||
    delivery.weightKg === null || delivery.weightKg === undefined ||
    !delivery.dimensions
  );

  const guidance = STATUS_GUIDANCE[delivery.status];

  // Combined timeline
  const combinedTimeline = [
    ...(delivery.histories || []).map(h => ({ ...h, module: 'DELIVERY' })),
    ...(po?.histories || []).map(h => ({ ...h, module: 'PO' })),
    ...(po?.quotation?.histories || [])
      .filter(h => h.newStatus !== 'EXECUTED')
      .map(h => ({ ...h, module: 'QUOTATION' })),
    ...(inquiry?.histories || []).map(h => ({ ...h, module: 'INQUIRY' }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Item columns
  const itemColumns = [
    { title: '#', key: 'no', width: 40, render: (_, __, i) => i + 1 },
    {
      title: 'Item',
      key: 'item',
      render: (_, r) => {
        const pd = r.poDetail;
        let description = pd?.service?.serviceName || pd?.sparePart?.partName || 'Item';

        const qDetails = delivery?.purchaseOrder?.quotation?.details || [];
        const iDetails = delivery?.purchaseOrder?.quotation?.inquiry?.details || [];

        if (pd?.quotationDetailId) {
          const qd = qDetails.find(q => String(q.id) === String(pd.quotationDetailId));
          if (qd && qd.inquiryDetailId) {
            const idet = iDetails.find(i => String(i.id) === String(qd.inquiryDetailId));
            if (idet) {
              description = idet.requestedItemName || idet.requestDescription || description;
            }
          }
        }

        return <span>{description}</span>;
      }
    },
    { title: 'PO Qty', key: 'poQty', render: (_, r) => parseFloat(r.poDetail?.qty || 0) },
    { title: 'Delivered Qty', dataIndex: 'qtyDelivered', key: 'qtyDelivered', render: v => parseFloat(v) },
    {
      title: 'Dimensi (P×L×T)',
      key: 'dimensions',
      render: (_, r) => {
        const dim = r.poDetail?.sparePart?.dimensions;
        return dim
          ? <Text className="text-xs text-gray-600">{dim}</Text>
          : <Text type="secondary" className="text-xs">-</Text>;
      }
    },
    {
      title: 'Berat (kg)',
      key: 'weightKg',
      align: 'right',
      render: (_, r) => {
        const w = r.poDetail?.sparePart?.weightKg;
        return w
          ? <Text className="text-xs">{parseFloat(w).toLocaleString('en-US')} kg</Text>
          : <Text type="secondary" className="text-xs">-</Text>;
      }
    },
    { title: 'Note', dataIndex: 'note', key: 'note', render: v => v || '-' },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => ['REVIEW_LOGISTIC', 'PACKED'].includes(delivery.status) && permissions.canEditDelivery && (
        <Tooltip title="Remove item from this delivery">
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteItem(r.id)}
          />
        </Tooltip>
      )
    }
  ];

  const getTimelineLabel = (h) => {
    if (h.module === 'DELIVERY') return h.newStatus;
    if (h.module === 'PO') return h.newStatus;
    if (h.module === 'QUOTATION') return h.newStatus;
    if (h.module === 'INQUIRY') return h.newStatusCode || h.newStatus;
    return '-';
  };

  return (
    <>
      <UnsavedChangesModal blocker={blocker} />
      <div className="space-y-6 max-w-7xl mx-auto mb-10 mt-2 px-2">
        {/* Header */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/deliveries')} />
            <div>
              <div className="flex items-center gap-2">
                <Title level={4} style={{ margin: 0 }}>
                  <TruckOutlined className="mr-2 text-blue-600" />
                  {delivery.deliveryNumber}
                </Title>
                <Tag color={STATUS_CONFIG[delivery.status]?.color}>{STATUS_CONFIG[delivery.status]?.label}</Tag>
              </div>
              <Text type="secondary">PO Ref: {po?.poNumber || '-'} | Customer: {inquiry?.customer?.name || '-'}</Text>
            </div>
          </Space>
          <div className='flex gap-2 mt-3'>
            {!isTerminal && permissions.canEditDelivery && actions.map(action => {
              const isShipLocked = action.status === 'SHIPPED' && isShippedLocked;
              const isPackLocked = action.status === 'PACKED' && isPackedLocked;
              if (isShipLocked || isPackLocked) {
                return (
                  <Tooltip
                    key={action.status}
                    title={
                      isPackLocked
                        ? 'Isi dan simpan data Tracking (AWB, Kurir, Lokasi, Tanggal, Berat, Dimensi) terlebih dahulu.'
                        : 'Fill and save Tracking & Logistics Info before proceeding.'
                    }
                  >
                    <Button
                      type={action.type}
                      icon={<LockOutlined />}
                      disabled
                    >
                      {action.label}
                    </Button>
                  </Tooltip>
                );
              }
              return (
                <Button
                  key={action.status}
                  type={action.type}
                  danger={action.danger}
                  icon={action.icon}
                  className={action.className}
                  onClick={() => openStatusModal(action)}
                >
                  {action.label}
                </Button>
              );
            })}
            {permissions.canEditDelivery && (
              <Tooltip title={['REVIEW_LOGISTIC', 'PACKED'].includes(delivery.status) ? "Delivery Note baru dapat di-generate setelah proses mencapai status SHIPPED." : ""}>
                <Button
                  icon={<FilePdfOutlined />}
                  type="default"
                  onClick={openNoteModal}
                  disabled={['REVIEW_LOGISTIC', 'PACKED'].includes(delivery.status)}
                >
                  Generate Delivery Note
                </Button>
              </Tooltip>
            )}
            {permissions.canEditDelivery && (delivery.items || []).length > 1 && ['REVIEW_LOGISTIC', 'PACKED'].includes(delivery.status) && (
              <Button
                icon={<BranchesOutlined />}
                onClick={() => setIsSplitModalVisible(true)}
                className="bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                Split Delivery
              </Button>
            )}
          </div>
        </div>

        {/* Sibling Deliveries Banner if split delivery exists */}
        {delivery.siblingDeliveries && delivery.siblingDeliveries.length > 0 && (
          <Alert
            type="info"
            showIcon
            className="rounded-xl border-blue-200 bg-blue-50/70 !mb-4"
            message={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-blue-900">
                    Split Delivery Terhubung ({delivery.siblingDeliveries.length + 1} Pengiriman untuk PO yang sama):
                  </span>
                  <span className="text-xs text-blue-700 ml-2">
                    Pengiriman Saat Ini: <strong>{delivery.deliveryNumber || `#${delivery.id}`}</strong>
                  </span>
                </div>
                <Space size="small" wrap>
                  <Text className="text-xs text-gray-500">Buka pengiriman lainnya:</Text>
                  {delivery.siblingDeliveries.map(sib => (
                    <Button
                      key={sib.id}
                      size="small"
                      type="link"
                      onClick={() => navigate(`/deliveries/${sib.id}`)}
                      className="bg-white border border-blue-300 rounded px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      {sib.deliveryNumber || `DEL #${sib.id}`} ({sib.status})
                    </Button>
                  ))}
                </Space>
              </div>
            }
          />
        )}

        {/* Step Guidance Banner */}
        {guidance && (
          <Alert
            type={guidance.type}
            message={<span className="font-semibold">{guidance.message}</span>}
            description={guidance.description}
            showIcon
            className="rounded-xl !mb-5"
          />
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Panel: Tracking Info + Items */}
          <div className="flex-1 w-full lg:w-0 space-y-6">

            {/* Delivery Items */}
            <Card title="Items in This Delivery" className="rounded-xl shadow-sm !mb-5" bordered={false}>
              {delivery.items?.length > 0 ? (
                <Table
                  columns={itemColumns}
                  dataSource={delivery.items}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Text type="secondary" className="italic text-sm">
                  No items linked to this delivery. Items will be added when logistics processes the delivery.
                </Text>
              )}
            </Card>
            {/* Tracking Form */}
            <Card
              title={<span><TruckOutlined className="mr-2" />Tracking & Logistics Info</span>}
              className="rounded-xl shadow-sm"
              bordered={false}
              extra={
                isInvoiceDone ? (
                  <Tag icon={<LockOutlined />} color="default">
                    Locked (Invoice #{paidInvoice?.invoiceNumber || ''} Paid)
                  </Tag>
                ) : isGeneralTrackingEditable ? (
                  <Tag color="green">All Fields Editable</Tag>
                ) : isFreightCostEditable ? (
                  <Tag color="blue">
                    Freight & Forwarder Info Editable
                  </Tag>
                ) : (
                  <Tag icon={<LockOutlined />} color="default">Locked</Tag>
                )
              }
            >
              <Form
                form={trackingForm}
                layout="vertical"
                onFinish={async (values) => { await handleSaveTracking(values); setIsDirty(false); }}
                onValuesChange={() => setIsDirty(true)}
              >
                {delivery.giNumber && (
                  <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                    <div>
                      <Text type="secondary" className="block text-xs uppercase text-green-700 mb-1">GI Number (SAP)</Text>
                      <Text strong className="text-lg text-green-800 font-mono tracking-wider">{delivery.giNumber}</Text>
                    </div>
                    <CheckCircleOutlined className="text-green-500 text-3xl opacity-80" />
                  </div>
                )}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Tracking Number (AWB)" name="trackingNumber">
                      <Input
                        placeholder="e.g. JNE1234567890"
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Shipping Service" name="shippingService">
                      <Select
                        placeholder="Select forwarder"
                        options={forwarders.map(f => ({ label: f.name, value: f.name }))}
                        allowClear
                        showSearch
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Current Location" name="currentLocation">
                      <Input
                        prefix={<EnvironmentOutlined className="text-gray-400" />}
                        placeholder="e.g. Pelabuhan Tanjung Priok"
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Target Delivery Date" name="targetDeliveryDate">
                      <DatePicker
                        className="w-full"
                        format="DD/MM/YYYY"
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="No. PO Client"
                      name="clientPoNumber"
                      tooltip="Nomor Purchase Order yang diberikan oleh Client dari sistem mereka"
                    >
                      <Input
                        placeholder="e.g. PO-CLIENT-001"
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Data Packing List"
                      name="packingList"
                      tooltip="Rincian / ringkasan packing list pengiriman"
                    >
                      <Input.TextArea
                        rows={1}
                        placeholder="e.g. Box 1: Spareparts A, Box 2: B..."
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item
                  label="Logistic Note"
                  name="logisticNote"
                  extra={
                    isFreightCostEditable && !isGeneralTrackingEditable ? (
                      <div className="mt-1">
                        <Tag color="blue" className="text-[11px] py-0 px-1.5 leading-5">Editable until Invoice Paid</Tag>
                      </div>
                    ) : null
                  }
                >
                  <Input.TextArea
                    rows={2}
                    placeholder="Internal notes for logistics team..."
                    disabled={!isFreightCostEditable}
                  />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Weight (kg)" name="weightKg">
                      <InputNumber
                        className="!w-full"
                        min={0}
                        step={0.1}
                        precision={2}
                        placeholder="e.g. 12.50"
                        addonAfter="kg"
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Dimension (P×L×T)" name="dimensions">
                      <Input
                        placeholder="e.g. 60x40x30 cm"
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Freight Cost (IDR)"
                      name="freightCost"
                      extra={
                        isFreightCostEditable && !isGeneralTrackingEditable ? (
                          <div className="mt-1">
                            <Tooltip title="Biaya forwarder tetap dapat disesuaikan hingga invoice pengiriman berstatus PAID.">
                              <Tag color="blue" className="text-[11px] py-0 px-1.5 leading-5">Editable until Invoice Paid</Tag>
                            </Tooltip>
                          </div>
                        ) : isInvoiceDone ? (
                          <div className="mt-1">
                            <Tag color="default" className="text-[11px] py-0 px-1.5 leading-5">Locked (Invoice Paid)</Tag>
                          </div>
                        ) : null
                      }
                    >
                      <InputNumber
                        className="!w-full"
                        min={0}
                        step={1000}
                        precision={0}
                        placeholder="e.g. 250000"
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => v.replace(/,/g, '')}
                        addonBefore="IDR"
                        disabled={!isFreightCostEditable}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Divider orientation="left">Forwarder Documents</Divider>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="forwarderPoFile"
                      label="Purchase Order Forwarder (Mandatory)"
                      rules={[{ required: true, message: 'PO Forwarder is required' }]}
                    >
                      <DocumentUpload
                        poId={id}
                        poType="DELIVERY"
                        documentType="forwarderPoFile"
                        label="Upload PO Forwarder"
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="forwarderQuotationFile"
                      label="Forwarder Quotation (Mandatory)"
                      rules={[{ required: true, message: 'Forwarder Quotation is required' }]}
                    >
                      <DocumentUpload
                        poId={id}
                        poType="DELIVERY"
                        documentType="forwarderQuotationFile"
                        label="Upload Quotation"
                        disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="forwarderInvoiceFile"
                      label="Forwarder Invoice (Optional)"
                      extra={
                        isFreightCostEditable && !isGeneralTrackingEditable ? (
                          <div className="mt-1">
                            <Tag color="blue" className="text-[11px] py-0 px-1.5 leading-5">Editable until Invoice Paid</Tag>
                          </div>
                        ) : null
                      }
                    >
                      <DocumentUpload
                        poId={id}
                        poType="DELIVERY"
                        documentType="forwarderInvoiceFile"
                        label="Upload Forwarder Invoice"
                        disabled={!isFreightCostEditable}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="otherForwarderQuotationFiles" label="Other Forwarder Quotation References (Optional)">
                  <DocumentUpload
                    multiple
                    poId={id}
                    poType="DELIVERY"
                    documentType="otherForwarderQuotationFiles"
                    label="Add Other Quotation Reference"
                    disabled={!isGeneralTrackingEditable || !permissions.canEditDelivery}
                  />
                </Form.Item>
                {canSaveTrackingForm && (
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    htmlType="submit"
                    loading={saving}
                    className={!isGeneralTrackingEditable ? 'bg-blue-600 hover:bg-blue-500' : ''}
                  >
                    {isGeneralTrackingEditable ? 'Save Tracking Info' : 'Update Freight Cost & Forwarder Info'}
                  </Button>
                )}
              </Form>
            </Card>



            {/* Delay Info */}
            {delivery.status === 'DELAYED' && delivery.delayReason && (
              <Card className="rounded-xl shadow-sm border-red-200 bg-red-50" bordered={false}>
                <div className="flex items-start gap-2">
                  <WarningOutlined className="text-red-500 text-lg mt-0.5" />
                  <div>
                    <Text strong className="text-red-700">Delay Reason</Text>
                    <p className="text-red-600 mt-1 mb-0">{delivery.delayReason}</p>
                  </div>
                </div>
              </Card>
            )}



            {/* PO Reference */}

          </div>

          {/* Right Sidebar: Workflow Journey */}
          <div className="w-full lg:w-80 space-y-4">
            <Card title="Purchase Order Reference" className="rounded-xl shadow-sm !mb-5" bordered={false}>
              <div className="mb-3">
                <Text type="secondary" className="text-xs uppercase block">Customer</Text>
                <Text strong>{inquiry?.customer?.name || '-'}</Text>
              </div>
              <div className="mb-3">
                <Text type="secondary" className="text-xs uppercase block">PO Number</Text>
                <Text strong>{po?.poNumber || <span className="text-gray-400 italic">No PO#</span>}</Text>
              </div>
              <div className="mb-3">
                <Text type="secondary" className="text-xs uppercase block">SD Document (SAP)</Text>
                <Text strong className="font-mono text-blue-700">{po?.sdDocument || <span className="text-gray-400 italic">No SD#</span>}</Text>
              </div>
              <div className="mb-3">
                <Text type="secondary" className="text-xs uppercase block">Net Value</Text>
                <Text strong className="text-blue-700">{parseFloat(po?.netValue || 0).toLocaleString()} {po?.currency}</Text>
              </div>
              <div className="mb-1">
                <Text type="secondary" className="text-xs uppercase block">Invoice Status</Text>
                {delivery.invoices && delivery.invoices.length > 0 ? (
                  <div className="space-y-1.5 mt-1">
                    {delivery.invoices.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between bg-gray-50 p-1.5 rounded border border-gray-100">
                        <Text strong className="text-xs font-mono">{inv.invoiceNumber || `INV #${inv.id}`}</Text>
                        <Tag color={inv.status === 'PAID' ? 'green' : inv.status === 'SENT' ? 'blue' : 'default'} className="text-[10px] mr-0">
                          {inv.status}
                        </Tag>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary" className="text-xs italic">Not invoiced yet</Text>
                )}
              </div>
            </Card>

            {/* Uploaded Documents Card */}
            <Card title="Uploaded Documents" className="rounded-xl shadow-sm border-gray-100 !mb-4" headStyle={{ backgroundColor: '#fafafa' }}>
              <div className="space-y-3">
                {[
                  { label: 'Proof of Delivery (POD)', file: delivery.proofOfDelivery, color: 'blue' },
                  { label: 'Forwarder PO', file: delivery.forwarderPoFile, color: 'orange' },
                  { label: 'Forwarder Quotation', file: delivery.forwarderQuotationFile, color: 'orange' },
                  { label: 'Forwarder Invoice', file: delivery.forwarderInvoiceFile, color: 'orange' }
                ].map((doc, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                    <div className="flex items-center gap-2">
                      <FileTextOutlined className={`text-${doc.color}-500`} />
                      <span className="text-sm font-medium">{doc.label}</span>
                    </div>
                    {doc.file ? (
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => window.open(getFileUrl(doc.file), '_blank')}
                        icon={<DownloadOutlined />}
                        className={`bg-${doc.color}-600 border-${doc.color}-600`}
                      >
                        Download
                      </Button>
                    ) : (
                      <Text type="secondary" className="text-xs italic">Not uploaded</Text>
                    )}
                  </div>
                ))}
                {Array.isArray(delivery.otherForwarderQuotationFiles) && delivery.otherForwarderQuotationFiles.map((fileUrl, index) => (
                  <div key={`other-fw-${index}`} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                    <div className="flex items-center gap-2">
                      <FilePdfOutlined className="text-orange-500" />
                      <Text className="text-xs font-medium">Other Fw Quote {index + 1}</Text>
                    </div>
                    <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => window.open(getFileUrl(fileUrl), '_blank')}>Download</Button>
                  </div>
                ))}
              </div>
            </Card>
            <WorkflowHistory
              histories={combinedTimeline}
              maxHeight={321}
            />

            {/* Actual Delivery Date */}
            {delivery.actualDeliveryDate && (
              <Card className="rounded-xl shadow-sm bg-green-50 border-green-200 !mt-5" bordered={false}>
                <div className="text-center">
                  <CheckCircleOutlined className="text-green-600 text-2xl mb-1" />
                  <div className="text-green-700 font-semibold">Delivered</div>
                  <Text type="secondary" className="text-xs">
                    {new Date(delivery.actualDeliveryDate).toLocaleDateString('en-US')}
                  </Text>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Generate Delivery Note Modal */}
        <Modal
          title={
            <span>
              <FilePdfOutlined className="mr-2 text-orange-500" />
              Generate Delivery Note
            </span>
          }
          open={noteModal}
          onOk={handleGenerateNote}
          onCancel={() => setNoteModal(false)}
          okText="Generate & Download PDF"
          okButtonProps={{ loading: generatingNote, type: 'primary', icon: <FilePdfOutlined /> }}
          width={600}
          destroyOnClose
        >
          <div className="mt-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500 block">Nomor SD (SAP) dari PO:</span>
              <span className="font-mono font-semibold text-blue-800 text-sm">{po?.sdDocument || 'Tidak ada'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Delivery #:</span>
              <span className="font-mono font-semibold text-gray-700 text-sm">{delivery.deliveryNumber}</span>
            </div>
          </div>
          <Form form={noteForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="No. PO Client"
                  name="clientPoNumber"
                  tooltip="Nomor Purchase Order yang diberikan oleh Client dari sistem mereka"
                >
                  <Input placeholder="e.g. PO-CLIENT-001" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="PIC (Person In Charge)"
                  name="pic"
                  rules={[{ required: true, message: 'Masukkan nama PIC' }]}
                >
                  <Input placeholder="Contoh: Bapak Aditya Nugroho" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              label="Delivery Method"
              name="deliveryMethod"
              rules={[{ required: true, message: 'Pilih metode pengiriman' }]}
            >
              <Select
                placeholder="Pilih metode pengiriman"
                options={[
                  { label: 'Trucking', value: 'Trucking' },
                  { label: 'Courier', value: 'Courier' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label="Data Packing List"
              name="packingList"
              tooltip="Rincian / ringkasan packing list (tersedia untuk Delivery Note PDF)"
            >
              <Input.TextArea
                rows={3}
                placeholder="Contoh: Colly 1 (Box Sparepart), Colly 2 (Seal kit)..."
              />
            </Form.Item>
            <Form.Item
              label="Shipping Address"
              name="shippingAddress"
              rules={[{ required: true, message: 'Masukkan alamat pengiriman' }]}
              extra="Gunakan Enter untuk baris baru."
            >
              <Input.TextArea
                rows={4}
                placeholder={`Contoh:\nBapak Sobri\nPT Semen Baturaja (Persero) TBK\nJl. Raya Tiga Gajah Baturaja\nOgan Komering Ulu 32117\n081284902156`}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* Status Update Modal */}
        <Modal
          title={`Update Status: ${statusModal.action?.label}`}
          open={statusModal.open}
          onOk={handleConfirmStatusUpdate}
          onCancel={() => setStatusModal({ open: false, action: null })}
          okText="Confirm"
          okButtonProps={{
            danger: statusModal.action?.danger,
            type: 'primary'
          }}
        >
          <Form form={statusForm} layout="vertical" className="mt-4">
            {statusModal.action?.status !== 'COMPLETED' && (
              <Form.Item label="Current Location (optional)" name="location">
                <Input prefix={<EnvironmentOutlined />} placeholder="e.g. Jakarta Selatan" />
              </Form.Item>
            )}
            <Form.Item label="Update Note (optional)" name="note">
              <Input.TextArea rows={2} placeholder="Any notes about this status change..." />
            </Form.Item>
            {statusModal.action?.status === 'DELAYED' && (
              <Form.Item
                label="Delay Reason"
                name="delayReason"
                rules={[{ required: true, message: 'Please provide a reason for delay' }]}
              >
                <Input.TextArea rows={3} placeholder="Describe why the delivery is delayed..." />
              </Form.Item>
            )}
            {statusModal.action?.status === 'DELIVERED' && (
              <Form.Item
                label="Proof of Delivery (PDF)"
                name="proofOfDelivery"
                rules={[{ required: true, message: 'Proof of Delivery is required' }]}
                extra="Upload the signed Delivery Order or other POD document."
              >
                <DocumentUpload
                  poId={id}
                  poType="DELIVERY"
                  documentType="proofOfDelivery"
                  label="POD File"
                />
              </Form.Item>
            )}
            {statusModal.action?.status === 'COMPLETED' && (
              <Form.Item
                label="GI Number"
                name="giNumber"
                rules={[{ required: true, message: 'GI Number wajib diisi untuk menyelesaikan pengiriman' }]}
                extra="Masukkan nomor GI (Good Issue) dari SAP."
              >
                <Input placeholder="e.g. 4900012345" />
              </Form.Item>
            )}
          </Form>
        </Modal>

        {/* Split Delivery Modal */}
        <SplitDeliveryModal
          visible={isSplitModalVisible}
          onClose={() => setIsSplitModalVisible(false)}
          delivery={delivery}
          onSuccess={() => fetchDelivery()}
        />
      </div>
    </>
  );
};

export default DeliveryDetail;

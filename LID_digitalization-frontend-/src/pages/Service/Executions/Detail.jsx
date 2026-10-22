import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Form, Select, Input, InputNumber, DatePicker, message, Spin, Row, Col, Progress, Slider, Timeline, Alert, Table, Tabs, Modal, Tooltip } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, SaveOutlined, FileTextOutlined,
  HistoryOutlined, ArrowRightOutlined, ToolOutlined,
  UserOutlined, CalendarOutlined, EyeOutlined, LinkOutlined, DownloadOutlined
} from '@ant-design/icons';
import usePermissions from '../../../hooks/usePermissions';
import dayjs from 'dayjs';
import DocumentUpload from '../../../components/DocumentUpload';
import { getServiceById, updateService } from '../../../services/service.service';
import { getAllTfs, linkTfsToServiceExecution, getTfsAssignmentsByServiceId, updateTfsAssignment } from '../../../services/tfs.service';
import { getMasterDivisions } from '../../../services/master.service';
import { getFileUrl } from '../../../utils/file';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';

const { Option } = Select;
const { TextArea } = Input;

const STATUS_COLOR = { PENDING: 'default', IN_PROGRESS: 'blue', DONE: 'green', CANCELLED: 'red' };
// const SERVICE_TYPE_COLOR = { Repairing: 'red', Cleaning: 'cyan', Maintaining: 'green' };
// const SERVICE_TYPES = ['Repairing', 'Cleaning', 'Maintaining'];

const formatSourceType = (type) => {
  switch (type) {
    case 'EXTERNAL_PURCHASE': return 'External Service';
    case 'IC_TFS': return 'IC - TFS';
    case 'EXTERNAL_TFS': return 'External TFS';
    default: return type || '-';
  }
};

const SOURCE_TYPE_COLOR = {
  'EXTERNAL_PURCHASE': 'purple',
  'IC_TFS': 'blue',
  'EXTERNAL_TFS': 'cyan'
};

export default function ServiceExecutionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const isOnlyTfs = permissions.roles.includes('TFS') && !permissions.roles.includes('ADMIN') && !permissions.roles.includes('SERVICE') && !permissions.roles.includes('PROJECT');
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();
  const [form] = Form.useForm();
  const [tfsData, setTfsData] = useState([]);
  const [tfsLoading, setTfsLoading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [availableTfs, setAvailableTfs] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectedTfsIds, setSelectedTfsIds] = useState([]);
  const [linking, setLinking] = useState(false);

  // Edit TFS Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTfs, setEditingTfs] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm] = Form.useForm();
  const [personnelList, setPersonnelList] = useState([]);

  // Watch for progress and status changes
  const progressVal = Form.useWatch('progressPercentage', form) || 0;
  const currentStatus = Form.useWatch('status', form);

  const fetchService = async () => {
    setLoading(true);
    try {
      const data = await getServiceById(id);
      setService(data);

      form.setFieldsValue({
        status: data.status,
        progressPercentage: data.progressPercentage || 0,
        startDate: data.startDate ? dayjs(data.startDate) : null,
        targetDate: data.targetDate ? dayjs(data.targetDate) : null,
        completedDate: data.completedDate ? dayjs(data.completedDate) : null,
        progressNote: '', // Clear after saving
        issue: '',
        nextAction: '',
        remarks: data.remarks,
        timesheetFile: data.timesheetFile || null,
        sdNumber: data.sdNumber || '',
      });
    } catch {
      message.error('Failed to load service data');
      navigate('/service/executions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchService(); fetchTfs(); }, [id]);

  useEffect(() => {
    getMasterDivisions({ active: true }).then(setPersonnelList).catch(() => { });
  }, []);

  const fetchTfs = async () => {
    setTfsLoading(true);
    try {
      const data = await getTfsAssignmentsByServiceId(id);
      setTfsData(data);
    } catch { /* silently fail */ } finally { setTfsLoading(false); }
  };

  const handleUpdate = async (values) => {
    if (values.status === 'CANCELLED') {
      Modal.confirm({
        title: 'Cancel Service Execution?',
        content: 'Are you sure you want to cancel this Service Execution? This will also clear any linked TFS schedules, and cancel the associated Purchase Order, Quotation, and Inquiry.',
        okText: 'Yes, Cancel it',
        okType: 'danger',
        cancelText: 'No',
        onOk: () => submitUpdate(values)
      });
    } else {
      submitUpdate(values);
    }
  };

  const submitUpdate = async (values) => {
    setSaving(true);
    try {
      const payload = {
        status: values.status,
        progressPercentage: values.progressPercentage,
        progressNote: values.progressNote,
        issue: values.issue,
        nextAction: values.nextAction,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        targetDate: values.targetDate ? values.targetDate.format('YYYY-MM-DD') : null,
        completedDate: values.completedDate ? values.completedDate.format('YYYY-MM-DD') : null,
        remarks: values.remarks,
        sdNumber: values.sdNumber !== undefined ? (values.sdNumber ? values.sdNumber.trim() : null) : undefined,
      };

      await updateService(id, payload);
      setIsDirty(false);
      message.success('Service progress updated');
      fetchService();
    } catch {
      message.error('Failed to update service');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!service) return null;

  const isDone = service.status === 'DONE';
  const isCancelled = service.status === 'CANCELLED';
  const isTerminal = isDone || isCancelled;
  const isPending = currentStatus === 'PENDING';

  const requestType = service.inquiry?.requestType || service.quotation?.inquiry?.requestType || service.purchaseOrder?.quotation?.inquiry?.requestType || null;
  const isExternalPurchase = requestType === 'SERVICE_EXTERNAL_PURCHASE';
  const isMixedExternal = requestType === 'SERVICE_EXTERNAL';
  // For mixed external service (SERVICE_EXTERNAL), always show TFS personnel section alongside service items
  const showTfsSection = !isExternalPurchase || isMixedExternal;

  const requiresTfsFirst = !isExternalPurchase && !isMixedExternal && service.status === 'PENDING' && tfsData.filter(t => t.assignmentType === 'PAID_ASSIGNMENT').length === 0;
  const isFormDisabled = isTerminal || requiresTfsFirst || !permissions.canEditService || isOnlyTfs;
  const isFieldDisabled = isPending || isFormDisabled;

  // Build lookup maps: poDetail.quotationDetailId -> quotationDetail -> inquiryDetail
  const execQuotationDetailMap = {};
  (service.purchaseOrder?.quotation?.details || []).forEach(qd => {
    execQuotationDetailMap[qd.id?.toString()] = qd;
  });
  const execInquiryDetailMap = {};
  (service.purchaseOrder?.quotation?.inquiry?.details || []).forEach(d => {
    execInquiryDetailMap[d.id?.toString()] = d;
  });
  const getExecInquiryDetail = (poDetail) => {
    const quotationDetailId = poDetail.quotationDetailId?.toString();
    const quotationDetail = execQuotationDetailMap[quotationDetailId];
    const inquiryDetailId = quotationDetail?.inquiryDetailId?.toString();
    return execInquiryDetailMap[inquiryDetailId] || null;
  };

  // For mixed external: only show PURCHASE items in execution view (hide TFS items), otherwise show all
  const execPoDetails = isMixedExternal
    ? (service.purchaseOrder?.details || []).filter(d => {
      const inqDetail = getExecInquiryDetail(d);
      return !inqDetail || inqDetail.serviceSubType !== 'TFS';
    })
    : (service.purchaseOrder?.details || []);

  const handleOpenLinkModal = async () => {
    setLinkModalOpen(true);
    setLoadingAvailable(true);
    try {
      const pool = await getAllTfs({ unlinked: true, assignmentType: 'PAID_ASSIGNMENT' });
      setAvailableTfs(pool.filter(t => t.status !== 'CANCELLED'));
    } catch {
      message.error('Failed to load available TFS');
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleLinkTfs = async () => {
    if (selectedTfsIds.length === 0) { message.warning('Select at least one TFS to link'); return; }
    setLinking(true);
    try {
      for (const tfsId of selectedTfsIds) {
        await linkTfsToServiceExecution(tfsId, id);
      }
      message.success(`${selectedTfsIds.length} TFS linked successfully`);
      setLinkModalOpen(false);
      setSelectedTfsIds([]);
      fetchTfs();
    } catch (err) {
      message.error(err.message || 'Failed to link TFS');
    } finally {
      setLinking(false);
    }
  };

  const handleOpenEditTfs = (record) => {
    setEditingTfs(record);
    editForm.setFieldsValue({
      personnelId: record.personnelId,
      title: record.title,
      dateRange: (record.startDate && record.endDate)
        ? [dayjs(record.startDate), dayjs(record.endDate)]
        : null,
      days: record.days,
      hoursPerDay: record.hoursPerDay,
    });
    setEditModalOpen(true);
  };

  const handleSaveEditTfs = async () => {
    try {
      const values = await editForm.validateFields();
      setEditSaving(true);
      await updateTfsAssignment(editingTfs.id, {
        personnelId: values.personnelId,
        title: values.title || null,
        startDate: values.dateRange?.[0]?.format('YYYY-MM-DD') || null,
        endDate: values.dateRange?.[1]?.format('YYYY-MM-DD') || null,
        days: values.days || null,
        hoursPerDay: values.hoursPerDay || null,
      });
      message.success('TFS updated successfully');
      setEditModalOpen(false);
      setEditingTfs(null);
      fetchTfs();
    } catch (err) {
      if (err?.message) message.error(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // Calculate Target vs Actual
  const isOverdue = service.targetDate && !service.completedDate && dayjs().isAfter(dayjs(service.targetDate));
  const completedLate = service.targetDate && service.completedDate && dayjs(service.completedDate).isAfter(dayjs(service.targetDate));

  return (
    <>
      <UnsavedChangesModal blocker={blocker} />
      <div className="space-y-6 max-w-7xl mx-auto mb-10 mt-2">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-800">{service.serviceNumber}</h1>
              <Tag color={STATUS_COLOR[service.status] || 'default'}>{service.status}</Tag>
            </div>
            <p className="text-sm text-gray-500">Service Execution Detail</p>
          </div>
          <div className="flex gap-2">
            <Button icon={<ArrowLeftOutlined style={{ fontSize: 14 }} />} onClick={() => navigate('/service/executions')}>Back</Button>
          </div>
        </div>

        {/* Main Content */}
        <Row gutter={[32, 24]}>
          {/* LEFT COLUMN: Input & Details */}
          <Col xs={24} lg={12}>
            <div className="flex flex-col gap-5">

              {/* Requested Service Details from PO */}
              {execPoDetails.length > 0 && (
                <Card title={<><ToolOutlined style={{ fontSize: 16 }} className="inline mr-2" />Service Items (From PO)</>} size="small" className="rounded-xl shadow-sm border-gray-100">
                  <Table
                    dataSource={execPoDetails}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'No', width: 50, render: (_, __, i) => i + 1 },
                      {
                        title: 'Service Item / Material',
                        render: (_, r) => {
                          const inqDetail = getExecInquiryDetail(r);
                          return inqDetail?.requestedItemName || r.service?.serviceName || r.sparePart?.partName || <span className="italic text-gray-400">No name</span>;
                        }
                      },
                      { title: 'Qty', dataIndex: 'qty', width: 80, align: 'center' },
                      { title: 'Note', dataIndex: 'note', render: v => v || '-' }
                    ]}
                  />
                </Card>
              )}

              {/* TFS Personnel Assignment — Read Only, managed in Scheduled TFS menu */}
              {showTfsSection && (
                <Card
                  title={<><UserOutlined style={{ fontSize: 16 }} className="inline mr-2" />Technical Field Service (Personnel)</>}
                  size="small"
                  className="rounded-xl shadow-sm border-gray-100"
                  extra={
                    permissions.canEditService && !isOnlyTfs && (
                      <Button
                        type="default"
                        size="small"
                        icon={<CalendarOutlined />}
                        onClick={() => navigate(`/tfs/scheduled/create?serviceId=${id}&serviceNumber=${service.serviceNumber}`)}
                      >
                        Scheduled TFS
                      </Button>
                    )
                  }
                >
                  <Table
                    dataSource={tfsData}
                    rowKey="id"
                    loading={tfsLoading}
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: 'No personnel assigned yet — go to Scheduled TFS to assign' }}
                    columns={[
                      { title: 'No.', width: 50, fixed: 'left', render: (_, __, i) => i + 1 },
                      { title: 'Personnel', fixed: 'left', width: 220, render: (_, r) => <><strong>{r.personnel?.name || '-'}</strong><br /><span className="text-xs text-gray-400">{r.personnel?.personnel_code} — {r.personnel?.title}</span></> },
                      { title: 'Task Title', dataIndex: 'title', render: v => v || '-' },
                      {
                        title: 'Start / End Date',
                        render: (_, r) => r.startDate ? `${dayjs(r.startDate).format('DD/MM/YY')} → ${r.endDate ? dayjs(r.endDate).format('DD/MM/YY') : '?'}` : '-'
                      },
                      { title: 'Working Days', dataIndex: 'days', render: v => v ? `${v} Days` : '-' },
                      { title: 'Hours/Day', dataIndex: 'hoursPerDay', render: v => v ? `${v} Hours` : '-' },
                      {
                        title: 'Action',
                        width: 80,
                        align: 'center',
                        render: (_, r) => {
                          if (isOnlyTfs) return '-';
                          if (service?.status === 'IN_PROGRESS') {
                            return (
                              <Tooltip title="Edit Personnel">
                                <Button
                                  type="primary"
                                  ghost
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => handleOpenEditTfs(r)}
                                />
                              </Tooltip>
                            );
                          }
                          return '-';
                        },
                      },
                    ]}
                  />
                </Card>
              )}

              {requiresTfsFirst && !isOnlyTfs && (
                <Alert
                  message="TFS Not Assigned Yet"
                  description={
                    <div>
                      <p>Please assign at least 1 TFS personnel (Paid Assignment) before you can update work progress.</p>
                      <div className="flex gap-2 mt-2">
                        <Button size="small" type="primary" icon={<LinkOutlined />} onClick={handleOpenLinkModal}>Link Available TFS</Button>
                        <Button size="small" onClick={() => navigate(`/tfs/scheduled/create?serviceId=${id}&serviceNumber=${service.serviceNumber}&type=PAID`)}>Create New TFS Schedule →</Button>
                      </div>
                    </div>
                  }
                  type="warning"
                  showIcon
                  className="mb-4 rounded-lg border-yellow-300"
                />
              )}
              <Card title={<><EditOutlined style={{ fontSize: 16 }} className="inline mr-2" />Update Work Progress</>} className="rounded-xl shadow-sm border-gray-100">
                <Form form={form} layout="vertical" onFinish={handleUpdate} disabled={isFormDisabled} onValuesChange={() => setIsDirty(true)}>
                  <Tabs defaultActiveKey="1" items={[
                    {
                      key: '1',
                      label: 'Progress & Status',
                      children: (
                        <>
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                                <Select onChange={(val) => {
                                   if (val === 'DONE') form.setFieldsValue({ progressPercentage: 100 });
                                   if (val === 'CANCELLED') form.setFieldsValue({ progressPercentage: 0 });
                                 }}>
                                   <Option value="PENDING">PENDING</Option>
                                   <Option value="IN_PROGRESS">IN PROGRESS</Option>
                                   <Option value="DONE">DONE</Option>
                                   <Option value="CANCELLED">CANCELLED</Option>
                                 </Select>
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label={`Progress: ${progressVal}%`} name="progressPercentage">
                                <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} disabled={isFieldDisabled} />
                              </Form.Item>
                            </Col>
                          </Row>
                          {isPending && (
                            <Alert
                              message="Status masih PENDING"
                              description="Ubah status ke IN PROGRESS terlebih dahulu untuk dapat mengedit progress."
                              type="info"
                              showIcon
                              className="
                                !mb-3
                                !px-3
                                !py-2
                                !rounded-md
                                [&_.ant-alert-icon]:!text-sm
                                [&_.ant-alert-icon]:!mt-0.5
                                [&_.ant-alert-message]:!text-xs
                                [&_.ant-alert-message]:!font-semibold
                                [&_.ant-alert-description]:!text-[11px]
                                [&_.ant-alert-description]:!leading-4
                              "
                            />
                          )}

                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item name="startDate" label="Actual Start Date">
                                <DatePicker className="w-full" format="DD MMM YYYY" disabled={isFieldDisabled} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="completedDate" label="Actual Completion Date">
                                <DatePicker className="w-full" format="DD MMM YYYY" disabled={isFieldDisabled} />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item name="sdNumber" label="SD Number">
                                <Input placeholder="e.g. SD-2026-0001" disabled={isFieldDisabled} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name="timesheetFile"
                                label="COMPLETION DOCUMENTS (PDF)"
                                rules={[{ required: currentStatus === 'DONE', message: 'Completion document is required for DONE status' }]}
                                extra={
                                  isDone
                                    ? "Service execution has been completed (read-only)"
                                    : currentStatus !== 'DONE'
                                    ? "Unlock by setting status to DONE"
                                    : "Required for completion"
                                }
                              >
                                <DocumentUpload
                                  poId={id}
                                  poType="SERVICE_EXECUTION"
                                  documentType="timesheetFile"
                                  poNumber={service?.serviceNumber}
                                  label="Add Completion Document"
                                  multiple={true}
                                  promptFileName={true}
                                  disabled={isDone || isCancelled || currentStatus !== 'DONE' || !permissions.canEditService}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item name="progressNote" label="Today's Progress">
                            <TextArea rows={3} placeholder="Describe what has been done..." disabled={isFieldDisabled} />
                          </Form.Item>
                        </>
                      )
                    },
                    {
                      key: '2',
                      label: 'Issues & Actions',
                      children: (
                        <>
                          <Form.Item name="issue" label="Issue / Constraint">
                            <TextArea rows={3} placeholder="Are there any issues in the field?" />
                          </Form.Item>
                          <Form.Item name="nextAction" label="Next Action">
                            <TextArea rows={3} placeholder="What is the next action?" />
                          </Form.Item>
                          <Form.Item name="remarks" label="Internal Remarks">
                            <TextArea rows={2} placeholder="Internal notes..." />
                          </Form.Item>
                        </>
                      )
                    }
                  ]} />

                  <div className="flex justify-end mt-4">
                    {permissions.canEditService && !isOnlyTfs && (
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined style={{ fontSize: 16 }} />} loading={saving} disabled={isTerminal} className={isTerminal ? '' : 'bg-primary-600'}>
                        Save Progress
                      </Button>
                    )}
                  </div>
                </Form>
              </Card>

            </div>
          </Col>

          {/* RIGHT COLUMN: Monitoring & Reports */}
          <Col xs={24} lg={10}>
            <div className="flex flex-col gap-5">

              {/* Visual Progress */}
              <Card className="rounded-xl shadow-sm border-gray-100 text-center relative">
                <h3 className="text-gray-500 mb-4 font-medium text-sm">OVERALL PROGRESS</h3>

                {/* Schedule Indicator */}
                <div className="absolute top-4 right-4">
                  {isDone ? (
                    completedLate ? <Tag color="orange" className="m-0 font-bold">COMPLETED LATE</Tag> : <Tag color="green" className="m-0 font-bold">ON TIME</Tag>
                  ) : (
                    isOverdue ? <Tag color="red" className="m-0 font-bold">OVERDUE</Tag> : <Tag color="blue" className="m-0 font-bold">ON TRACK</Tag>
                  )}
                </div>

                <Progress
                  type="dashboard"
                  percent={service.progressPercentage || 0}
                  status={service.status === 'DONE' ? 'success' : (service.progressPercentage === 100 ? 'normal' : 'active')}
                  size={180}
                  strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                />

                {/* Planned vs Actual Summary */}
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center px-4">
                    <span className="text-xs text-gray-500 text-left">Target Completion</span>
                    <span className="text-sm font-medium">{service.targetDate ? dayjs(service.targetDate).locale('en').format('DD MMM YYYY') : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center px-4">
                    <span className="text-xs text-gray-500 text-left">Actual Completion</span>
                    <span className="text-sm font-medium">{service.completedDate ? dayjs(service.completedDate).locale('en').format('DD MMM YYYY') : '-'}</span>
                  </div>
                </div>
              </Card>

              {/* Job Info Summary */}
              <Card className="rounded-xl shadow-sm border-gray-100">
                <Descriptions title="Job Info Summary" bordered column={1} size="small">
                  <Descriptions.Item label="Customer">{service.customerName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Subject">{service.subject || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Location">{service.location || '-'}</Descriptions.Item>
                  <Descriptions.Item label="No. Quotation">{service.quotationNumber || '-'}</Descriptions.Item>
                  <Descriptions.Item label="SD Number">{service.sdNumber || '-'}</Descriptions.Item>
                  <Descriptions.Item label="No. PO">{service.purchaseOrder?.poNumber || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Source">
                    <Tag color={SOURCE_TYPE_COLOR[service.sourceType] || 'default'}>
                      {formatSourceType(service.sourceType)}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Uploaded Documents Summary */}
              <Card title="Uploaded Documents" className="rounded-xl shadow-sm border-gray-100" headStyle={{ backgroundColor: '#fafafa' }}>
                <div className="space-y-3">
                  {(() => {
                    const val = service.timesheetFile;
                    let files = [];
                    if (Array.isArray(val)) {
                      files = val.filter(Boolean);
                    } else if (typeof val === 'string') {
                      const trimmed = val.trim();
                      if (trimmed.startsWith('[')) {
                        try {
                          const parsed = JSON.parse(trimmed);
                          if (Array.isArray(parsed)) files = parsed.filter(Boolean);
                        } catch {
                          files = [trimmed];
                        }
                      } else if (trimmed) {
                        files = [trimmed];
                      }
                    }

                    if (files.length === 0) {
                      return (
                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                          <div className="flex items-center gap-2">
                            <FileTextOutlined className="text-gray-300" />
                            <span className="text-xs text-gray-400">Completion Documents PDF</span>
                          </div>
                          <span className="text-gray-400 text-[10px] italic">Not uploaded</span>
                        </div>
                      );
                    }

                    return files.map((fileUrl, idx) => {
                      const cleanName = fileUrl.split('?')[0].split('/').pop();
                      let decodedName = cleanName;
                      try { decodedName = decodeURIComponent(cleanName); } catch {}

                      return (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <FileTextOutlined className="text-orange-500 shrink-0" />
                            <span className="text-xs font-medium truncate" title={decodedName}>
                              {decodedName || `Completion Document #${idx + 1}`}
                            </span>
                          </div>
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<DownloadOutlined />}
                            onClick={() => window.open(getFileUrl(fileUrl), '_blank')}
                          >
                            Download
                          </Button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Card>

              {/* Timeline History */}
              <Card title={<><HistoryOutlined style={{ fontSize: 18 }} className="inline mr-2" />Change History</>} className="rounded-xl shadow-sm border-gray-100">
                <Timeline>
                  {service.histories && service.histories.length > 0 ? (
                    service.histories.map((h, i) => (
                      <Timeline.Item key={h.id} color={h.newStatus === 'DONE' ? 'green' : 'blue'}>
                        <div className="mb-1 flex items-center justify-between">
                          <Tag color={STATUS_COLOR[h.newStatus] || 'default'} className="text-[10px] m-0">{h.newStatus}</Tag>
                          <span className="text-[10px] text-gray-400">{dayjs(h.createdAt).locale('en').format('DD MMM YYYY, HH:mm')}</span>
                        </div>

                        {h.oldProgress !== h.newProgress && (
                          <div className="text-xs font-medium text-gray-700 mt-1">
                            Progress: <span className="line-through text-gray-400">{h.oldProgress}%</span> <ArrowRightOutlined /> <span className="text-blue-600">{h.newProgress}%</span>
                          </div>
                        )}

                        {h.progressNote && (
                          <div className="mt-2 bg-blue-50/50 p-2 rounded text-xs text-gray-600 border border-blue-100">
                            {h.progressNote}
                          </div>
                        )}
                        {h.issue && (
                          <div className="mt-1 bg-red-50/50 p-2 rounded text-xs text-red-600 border border-red-100">
                            <strong>Issue:</strong> {h.issue}
                          </div>
                        )}
                        {h.nextAction && (
                          <div className="mt-1 bg-green-50/50 p-2 rounded text-xs text-green-600 border border-green-100">
                            <strong>Next:</strong> {h.nextAction}
                          </div>
                        )}

                        {h.changer && (
                          <div className="mt-1 text-[10px] text-gray-400 text-right">
                            By: {h.changer.name}
                          </div>
                        )}
                      </Timeline.Item>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 py-4 text-xs italic">No change history yet</div>
                  )}
                </Timeline>
              </Card>
            </div>
          </Col>
        </Row>

      </div>

      {/* Link TFS Modal */}
      <Modal
        title={<><LinkOutlined className="mr-2" />Link Available TFS to this Service Execution</>}
        open={linkModalOpen}
        onCancel={() => { setLinkModalOpen(false); setSelectedTfsIds([]); }}
        onOk={handleLinkTfs}
        confirmLoading={linking}
        okText={`Link ${selectedTfsIds.length} TFS`}
        okButtonProps={{ disabled: selectedTfsIds.length === 0 }}
        width={700}
      >
        <Table
          dataSource={availableTfs}
          rowKey="id"
          loading={loadingAvailable}
          size="small"
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedTfsIds,
            onChange: (keys) => setSelectedTfsIds(keys),
          }}
          locale={{ emptyText: 'No available TFS schedules found. Create one from the Scheduled TFS menu first.' }}
          columns={[
            { title: 'TFS Number', dataIndex: 'tfsNumber', width: 140, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
            { title: 'Personnel', width: 180, render: (_, r) => <><strong>{r.personnel?.name || '-'}</strong><br /><span className="text-xs text-gray-400">{r.personnel?.personnel_code}</span></> },
            { title: 'Period', render: (_, r) => r.startDate ? `${dayjs(r.startDate).locale('en').format('DD MMM')} → ${r.endDate ? dayjs(r.endDate).locale('en').format('DD MMM YYYY') : '?'}` : '-' },
            { title: 'Days', dataIndex: 'days', width: 70, align: 'center', render: v => v ? `${v}d` : '-' },
          ]}
        />
      </Modal>

      {/* Edit TFS Personnel Modal */}
      <Modal
        title={<><EditOutlined className="mr-2" />Edit TFS Personnel Assignment</>}
        open={editModalOpen}
        onOk={handleSaveEditTfs}
        onCancel={() => { setEditModalOpen(false); setEditingTfs(null); editForm.resetFields(); }}
        confirmLoading={editSaving}
        okText="Save Changes"
        cancelText="Cancel"
        width={560}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item
            name="personnelId"
            label="Personnel"
            rules={[{ required: true, message: 'Please select personnel' }]}
          >
            <Select
              showSearch
              placeholder="Select Personnel"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={personnelList.map(p => ({
                value: p.id,
                label: `[${p.personnel_code}] ${p.name}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="title" label="Task Title">
            <Input placeholder="Task title" />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Schedule Period"
            rules={[{ required: true, message: 'Please select date range' }]}
          >
            <DatePicker.RangePicker
              className="w-full"
              format="DD/MM/YYYY"
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  const diff = dayjs(dates[1]).diff(dayjs(dates[0]), 'day') + 1;
                  if (diff > 0) editForm.setFieldValue('days', diff);
                }
              }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="days" label="Working Days">
                <InputNumber min={1} className="!w-full" placeholder="Days" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hoursPerDay" label="Hours/Day">
                <InputNumber min={1} max={24} className="!w-full" placeholder="Hours" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

    </>
  );
}

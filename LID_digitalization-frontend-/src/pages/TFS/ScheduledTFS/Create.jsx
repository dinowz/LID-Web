import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Form, Input, Select, DatePicker, Button, Row, Col, message, Spin,
  Alert, Descriptions, Tag, Modal,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, CalendarOutlined, UserOutlined,
  SearchOutlined, InfoCircleOutlined, CheckCircleOutlined,
  DollarOutlined, GiftOutlined, CoffeeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { searchServices, createTfsAssignment, createStandaloneTfsAssignment, updateTfsAssignment, getAllTfs } from '../../../services/tfs.service';
import { getMasterDivisions } from '../../../services/master.service';
import usePermissions from '../../../hooks/usePermissions';

const { TextArea } = Input;

const ASSIGNMENT_TYPES = [
  {
    value: 'PAID_ASSIGNMENT',
    label: 'Paid Assignment',
    description: 'Penugasan berbayar, terkait Service Execution',
    icon: <DollarOutlined />,
    color: '#1677ff',
    bgColor: '#e6f4ff',
    borderColor: '#91caff',
  },
  {
    value: 'FREE_ASSIGNMENT',
    label: 'Free Assignment',
    description: 'Penugasan internal tanpa billing',
    icon: <GiftOutlined />,
    color: '#52c41a',
    bgColor: '#f6ffed',
    borderColor: '#b7eb8f',
  },
  {
    value: 'DAY_OFF',
    label: 'Day Off',
    description: 'Cuti / hari libur personel',
    icon: <CoffeeOutlined />,
    color: '#8c8c8c',
    bgColor: '#fafafa',
    borderColor: '#d9d9d9',
  },
];

export default function ScheduledTFSCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const prefilledServiceId = searchParams.get('serviceId');
  const prefilledServiceNumber = searchParams.get('serviceNumber');
  const prefilledType = searchParams.get('type');
  const isEdit = !!editId;

  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const permissions = usePermissions();
  const roles = permissions.roles || [];
  const isOnlyTfs = roles.includes('TFS') && !roles.includes('ADMIN') && !roles.includes('SERVICE');

  const [assignmentType, setAssignmentType] = useState(
    isOnlyTfs ? 'FREE_ASSIGNMENT' :
      (prefilledType === 'FREE' ? 'FREE_ASSIGNMENT' :
        prefilledType === 'DAYOFF' ? 'DAY_OFF' : 'PAID_ASSIGNMENT')
  );

  const [serviceOptions, setServiceOptions] = useState([]);
  const [serviceSearching, setServiceSearching] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [personnelList, setPersonnelList] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [conflictError, setConflictError] = useState(null);
  const [personnelSchedules, setPersonnelSchedules] = useState([]);
  const [fetchingSchedules, setFetchingSchedules] = useState(false);

  const isPaid = assignmentType === 'PAID_ASSIGNMENT';
  const isFreeOrDayOff = assignmentType === 'FREE_ASSIGNMENT' || assignmentType === 'DAY_OFF';
  const isDraft = !currentStatus || currentStatus === 'DRAFT';
  const showDoneButton = isEdit && isFreeOrDayOff && isDraft;

  useEffect(() => {
    getMasterDivisions({ active: true }).then(setPersonnelList).catch(() => { });
  }, []);

  useEffect(() => {
    if (prefilledServiceId && prefilledServiceNumber && !isEdit) {
      const mockService = {
        id: prefilledServiceId,
        serviceNumber: prefilledServiceNumber,
        status: '', sourceType: '', customerName: '', subject: '',
      };
      setSelectedService(mockService);
      form.setFieldsValue({ serviceExecutionId: prefilledServiceId });
      searchServices(prefilledServiceNumber).then(results => {
        const found = results.find(r => r.id === prefilledServiceId);
        if (found) setSelectedService(found);
      }).catch(() => { });
    }
  }, [prefilledServiceId, prefilledServiceNumber, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    setLoadingEdit(true);
    getAllTfs({ serviceExecutionId: prefilledServiceId })
      .then(list => {
        const rec = list.find(t => t.id === editId);
        if (!rec) {
          message.error('TFS record not found');
          navigate('/tfs/scheduled');
          return;
        }
        setAssignmentType(rec.assignmentType || 'PAID_ASSIGNMENT');
        setCurrentStatus(rec.status || 'DRAFT');
        form.setFieldsValue({
          serviceExecutionId: rec.serviceExecution?.id,
          personnelId: rec.personnelId,
          title: rec.title,
          dateRange: (rec.startDate && rec.endDate) ? [dayjs(rec.startDate), dayjs(rec.endDate)] : null,
          days: rec.days,
          hoursPerDay: rec.hoursPerDay,
          jobDescription: rec.jobDescription,
          remarks: rec.remarks,
        });
        if (rec.personnelId) {
          getAllTfs({ personnelId: rec.personnelId }).then(setPersonnelSchedules).catch(() => { });
        }
        if (rec.serviceExecution) {
          setSelectedService({
            id: rec.serviceExecution.id,
            serviceNumber: rec.serviceExecution.serviceNumber,
            status: rec.serviceExecution.status,
            sourceType: rec.serviceExecution.sourceType,
            customerName: '', subject: '',
          });
        }
      })
      .catch(() => message.error('Failed to load TFS data'))
      .finally(() => setLoadingEdit(false));
  }, [isEdit, editId]);

  const handleServiceSearch = async (query = '') => {
    if (query && query.length === 1) { setServiceOptions([]); return; }
    setServiceSearching(true);
    try {
      const results = await searchServices(query);
      setServiceOptions(results);
    } catch {
      message.error('Failed to search services');
    } finally {
      setServiceSearching(false);
    }
  };

  useEffect(() => {
    if (!isEdit && !prefilledServiceId) {
      handleServiceSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, prefilledServiceId]);

  const handleServiceSelect = (value) => {
    const found = serviceOptions.find(s => s.id === value);
    setSelectedService(found || null);
    form.setFieldsValue({ serviceExecutionId: value });
  };

  const handlePersonnelChange = async (value) => {
    form.setFieldsValue({ dateRange: null, days: null });
    if (!value) {
      setPersonnelSchedules([]);
      return;
    }
    setFetchingSchedules(true);
    try {
      const allTfs = await getAllTfs({ personnelId: value });
      setPersonnelSchedules(allTfs);
    } catch {
      message.error('Failed to fetch personnel schedules');
      setPersonnelSchedules([]);
    } finally {
      setFetchingSchedules(false);
    }
    handleConflictCheck();
  };

  const disabledDate = (current) => {
    if (!current) return false;
    return personnelSchedules.some(schedule => {
      if (schedule.status === 'CANCELLED') return false;
      if (isEdit && schedule.id === editId) return false;
      if (!schedule.startDate || !schedule.endDate) return false;
      const start = dayjs(schedule.startDate).startOf('day');
      const end = dayjs(schedule.endDate).endOf('day');
      return (current.isSame(start, 'day') || current.isAfter(start)) &&
        (current.isSame(end, 'day') || current.isBefore(end));
    });
  };

  const handleConflictCheck = () => {
    const values = form.getFieldsValue(['personnelId', 'dateRange']);
    if (!values.personnelId || !values.dateRange || !values.dateRange[0] || !values.dateRange[1]) {
      setConflictError(null);
      return;
    }
    const start = values.dateRange[0].format('YYYY-MM-DD');
    const end = values.dateRange[1].format('YYYY-MM-DD');
    if (dayjs(end).isBefore(dayjs(start))) {
      setConflictError('End date cannot be before start date.');
      return;
    }
    const startD = dayjs(start).startOf('day');
    const endD = dayjs(end).startOf('day');
    const conflict = personnelSchedules.find(t => {
      if (t.status === 'CANCELLED') return false;
      if (isEdit && t.id === editId) return false;
      if (!t.startDate || !t.endDate) return false;

      const itemStart = dayjs(t.startDate).startOf('day');
      const itemEnd = dayjs(t.endDate).startOf('day');

      const startOverlap = startD.isBefore(itemEnd, 'day') || startD.isSame(itemEnd, 'day');
      const endOverlap = endD.isAfter(itemStart, 'day') || endD.isSame(itemStart, 'day');

      return startOverlap && endOverlap;
    });
    if (conflict) {
      setConflictError(`Schedule conflict: Already assigned to "${conflict.serviceExecution?.serviceNumber || 'another task'}" from ${dayjs(conflict.startDate).locale('en').format('DD MMM')} to ${dayjs(conflict.endDate).locale('en').format('DD MMM YYYY')}`);
    } else {
      setConflictError(null);
    }
  };

  const handleDateChange = () => {
    const dateRange = form.getFieldValue('dateRange');
    if (dateRange && dateRange[0] && dateRange[1]) {
      const diff = dayjs(dateRange[1]).diff(dayjs(dateRange[0]), 'day') + 1;
      if (diff > 0) form.setFieldValue('days', diff);
    }
    handleConflictCheck();
  };

  const handleSubmit = async (values) => {
    if (conflictError) { message.warning('Resolve schedule conflict first.'); return; }

    const dateRange = values.dateRange;
    const payload = {
      personnelId: values.personnelId,
      title: values.title || (assignmentType === 'DAY_OFF' ? 'DAY OFF' : null),
      startDate: dateRange && dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : null,
      endDate: dateRange && dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : null,
      days: values.days ? parseInt(values.days, 10) : null,
      hoursPerDay: values.hoursPerDay ? parseInt(values.hoursPerDay, 10) : null,
      jobDescription: values.jobDescription || null,
      remarks: values.remarks || null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateTfsAssignment(editId, payload);
        message.success('Updated successfully');
      } else if (isPaid && (values.serviceExecutionId || selectedService?.id)) {
        // Paid assignment with service execution linked
        const serviceExecutionId = values.serviceExecutionId || selectedService?.id;
        await createTfsAssignment(serviceExecutionId, payload);
        message.success('Paid assignment created successfully');
      } else {
        // Standalone (Free, DayOff, or Paid without service)
        await createStandaloneTfsAssignment({ ...payload, assignmentType });
        message.success('Schedule created successfully');
      }
      navigate('/tfs/scheduled');
    } catch (err) {
      message.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsDone = () => {
    Modal.confirm({
      title: 'Konfirmasi Selesai Schedule',
      content: 'Apakah Anda yakin ingin menyelesaikan schedule ini? Setelah diubah menjadi DONE, status tidak dapat diubah kembali ke DRAFT.',
      okText: 'Ya, Selesai',
      cancelText: 'Batal',
      okButtonProps: { type: 'primary', className: 'bg-green-600 border-green-600' },
      onOk: async () => {
        try {
          const values = await form.validateFields();
          if (conflictError) { message.warning('Resolve schedule conflict first.'); return; }

          const dateRange = values.dateRange;
          const payload = {
            personnelId: values.personnelId,
            title: values.title || (assignmentType === 'DAY_OFF' ? 'DAY OFF' : null),
            startDate: dateRange && dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : null,
            endDate: dateRange && dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : null,
            days: values.days ? parseInt(values.days, 10) : null,
            hoursPerDay: values.hoursPerDay ? parseInt(values.hoursPerDay, 10) : null,
            jobDescription: values.jobDescription || null,
            remarks: values.remarks || null,
            status: 'DONE',
          };

          setSaving(true);
          await updateTfsAssignment(editId, payload);
          message.success('Schedule status updated to DONE');
          navigate('/tfs/scheduled');
        } catch (err) {
          if (err?.errorFields) return;
          message.error(err.message || 'Failed to update status');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  if (loadingEdit) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <CalendarOutlined className="text-primary-600 text-2xl" />
          <div>
            <h1 className="text-xl font-bold text-gray-800 m-0">{isEdit ? 'Edit TFS Schedule' : 'New TFS Schedule'}</h1>
            <p className="text-sm text-gray-500 m-0">Manage personnel assignment details</p>
          </div>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tfs/scheduled')}>Back</Button>
      </div>

      {/* Assignment Type Selection */}
      {!isEdit && (
        <Card title="Step 1: Select Assignment Type" className="rounded-xl shadow-sm border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ASSIGNMENT_TYPES.map(type => {
              const isDisabled = isOnlyTfs && type.value === 'PAID_ASSIGNMENT';
              return (
                <div
                  key={type.value}
                  onClick={() => {
                    if (isDisabled) return;
                    setAssignmentType(type.value);
                    setSelectedService(null);
                    form.resetFields(['serviceExecutionId']);
                  }}
                  className={`rounded-xl p-5 transition-all duration-200 ${
                    isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                  }`}
                  style={{
                    border: `2px solid ${assignmentType === type.value ? type.color : '#e5e7eb'}`,
                    backgroundColor: assignmentType === type.value ? type.bgColor : '#fff',
                    transform: assignmentType === type.value && !isDisabled ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: assignmentType === type.value && !isDisabled ? `0 4px 12px ${type.color}20` : 'none',
                  }}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="text-3xl" style={{ color: type.color }}>{type.icon}</div>
                    <div className="font-semibold text-base" style={{ color: assignmentType === type.value ? type.color : '#374151' }}>
                      {type.label}
                    </div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Show type badge when editing */}
      {isEdit && (
        <Card className="rounded-xl shadow-sm border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Assignment Type:</span>
            <Tag color={
              assignmentType === 'PAID_ASSIGNMENT' ? 'blue' :
                assignmentType === 'FREE_ASSIGNMENT' ? 'green' : 'default'
            }>
              {assignmentType === 'PAID_ASSIGNMENT' ? 'Paid Assignment' :
                assignmentType === 'FREE_ASSIGNMENT' ? 'Free Assignment' : 'Day Off'}
            </Tag>
          </div>
        </Card>
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <div className="flex flex-col gap-5 mt-5">
          {/* Service Selection — Only for Paid Assignment */}
          {isPaid && (
            <Card title={<><SearchOutlined className="mr-2" />{isEdit ? 'Linked Service' : 'Step 2: Select Service (Optional)'}</>} className="rounded-xl shadow-sm border-gray-100">
              {!isEdit && !prefilledServiceId ? (
                <>
                  <Form.Item name="serviceExecutionId" label="Search Service Number">
                    <Select showSearch placeholder="Type service number... (optional for standalone)" filterOption={false} onSearch={handleServiceSearch} onSelect={handleServiceSelect} loading={serviceSearching} className="w-full" allowClear disabled={isOnlyTfs}>
                      {serviceOptions.map(s => (
                        <Select.Option key={s.id} value={s.id}>
                          <span className="font-semibold">{s.serviceNumber}</span> - <span className="text-xs text-gray-400">{s.customerName}</span>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Alert message="Opsional — jika tidak dipilih, jadwal ini akan menjadi standalone dan bisa di-link ke Service Execution nanti." type="info" showIcon className="mt-2" />
                </>
              ) : (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex items-center gap-3">
                  <InfoCircleOutlined className="text-blue-500 text-lg" />
                  <div><span className="font-semibold text-primary-700">{selectedService?.serviceNumber || prefilledServiceNumber}</span></div>
                </div>
              )}
              {selectedService && (
                <Descriptions size="small" column={2} className="!mt-2" bordered>
                  <Descriptions.Item label="Customer">{selectedService.customerName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Subject">{selectedService.subject || '-'}</Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          )}

          {/* Personnel & Schedule */}
          <Card title={<><UserOutlined className="mr-2" />{isPaid ? (isEdit ? 'Personnel & Schedule Details' : 'Step 3: Personnel & Schedule Details') : (isEdit ? 'Personnel & Schedule Details' : 'Step 2: Personnel & Schedule Details')}</>} className="rounded-xl shadow-sm border-gray-100">
            {conflictError && <Alert message="Schedule Conflict" description={conflictError} type="error" showIcon className="mb-5" />}

            <Form.Item name="personnelId" label="Personnel" rules={[{ required: true, message: 'Required' }]}>
              <Select showSearch placeholder="Select Personnel" onChange={handlePersonnelChange} loading={fetchingSchedules}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              >
                {personnelList.map(p => (
                  <Select.Option key={p.id} value={p.id} label={`${p.personnel_code} ${p.name}`}>[{p.personnel_code}] {p.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="title" label="Task Title">
              <Input placeholder={assignmentType === 'DAY_OFF' ? 'DAY OFF' : 'Task title'} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="dateRange" label="Schedule Period" rules={[{ required: true }]}>
                  <DatePicker.RangePicker
                    className="w-full"
                    onChange={handleDateChange}
                    disabledDate={disabledDate}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}><Form.Item name="days" label="Days"><Input type="number" min={1} /></Form.Item></Col>
              <Col span={12}><Form.Item name="hoursPerDay" label="Hrs/Day"><Input type="number" min={1} /></Form.Item></Col>
            </Row>

            <Form.Item name="jobDescription" label="Job Description"><TextArea rows={3} /></Form.Item>
            <Form.Item name="remarks" label="Remarks"><TextArea rows={2} /></Form.Item>

            <div className="flex justify-end gap-3">
              <Button onClick={() => navigate('/tfs/scheduled')}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={!!conflictError}>
                {isEdit ? 'Update' : 'Save'}
              </Button>
              {showDoneButton && (
                <Button
                  type="primary"
                  className="bg-green-600 hover:bg-green-700 border-green-600 text-white"
                  icon={<CheckCircleOutlined />}
                  loading={saving}
                  disabled={!!conflictError}
                  onClick={handleMarkAsDone}
                >
                  Done
                </Button>
              )}
            </div>
          </Card>
        </div>
      </Form>
    </div>
  );
}

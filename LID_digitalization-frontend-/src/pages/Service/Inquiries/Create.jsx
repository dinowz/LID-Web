import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, Divider, Typography, message, Alert, Spin, Modal } from 'antd';
import {
  MinusCircleOutlined, PlusOutlined, ShoppingCartOutlined,
  BankOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  getCustomers,
  getInquiryStatuses,
  getInquiryCodewords,
  getInquiryById,
  createInquiry,
  updateInquiry
} from '../../../services/inquiry.service';
import { createServiceExecutionFromInquiry } from '../../../services/service.service';
import dayjs from 'dayjs';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const MAIN_SERVICE_TYPES = [
  {
    value: 'EXTERNAL',
    label: 'External Service',
    icon: <ShoppingCartOutlined />,
    description: 'External customer service via vendor or TFS.'
  },
  {
    value: 'IC',
    label: 'Inter Company (IC)',
    icon: <BankOutlined />,
    description: 'Utilize TFS for internal group companies.'
  },
];

const INQUIRY_SOURCES = [
  { id: 'OTHERS', sourceName: 'Others' },
  { id: 'PHONE', sourceName: 'Phone' },
  { id: 'EMAIL', sourceName: 'Email' },
];

const UOM_OPTIONS = [
  { value: 'manhour', label: 'Manhour' },
  { value: 'manday', label: 'Manday' },
  { value: 'lot', label: 'Lot' },
];

const ServiceInquiryForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id) || location.pathname.includes('/edit');

  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [mainType, setMainType] = useState('EXTERNAL');
  const [customers, setCustomers] = useState([]);
  const [codeWords, setCodeWords] = useState([]);
  const [inquiryData, setInquiryData] = useState(null);

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [pendingPayload, setPendingPayload] = useState(null);

  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();

  const selectedType = mainType === 'IC' ? 'SERVICE_IC_TFS' : 'SERVICE_EXTERNAL';

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEdit) {
          const [custData, inqData, cwData] = await Promise.all([
            getCustomers(),
            getInquiryById(id),
            getInquiryCodewords(),
          ]);

          setCustomers(Array.isArray(custData) ? custData : []);
          setInquiryData(inqData);
          setCodeWords(Array.isArray(cwData) ? cwData : []);

          const reqType = inqData.requestType || 'SERVICE_EXTERNAL';
          if (reqType === 'SERVICE_IC_TFS') {
            setMainType('IC');
          } else {
            setMainType('EXTERNAL');
          }

          form.setFieldsValue({
            customerId: inqData.customerId ?? undefined,
            codeWordId: inqData.codeWordId ?? undefined,
            sourceCode: inqData.sourceCode ?? undefined,
            subject: inqData.subject,
            description: inqData.description,
            dueDate: inqData.dueDate ? dayjs(inqData.dueDate) : null,
            details: (inqData.details || []).map(d => ({
              requestedItemName: d.requestedItemName,
              qty: d.qty,
              uom: d.uom || 'visit',
              requestDescription: d.requestDescription || '',
              serviceSubType: d.serviceSubType || null,
            })),
          });
        } else {
          const [statData, custData, cwData] = await Promise.all([
            getInquiryStatuses().catch(() => []),
            getCustomers().catch(() => []),
            getInquiryCodewords().catch(() => []),
          ]);

          setStatuses(Array.isArray(statData) ? statData : []);
          setCustomers(Array.isArray(custData) ? custData : []);
          setCodeWords(Array.isArray(cwData) ? cwData : []);
        }
      } catch (err) {
        message.error(err.response?.data?.error || err.message || (isEdit ? 'Failed to load inquiry data' : 'Failed to load reference data'));
        if (isEdit) navigate('/service/inquiries');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEdit, form, navigate]);

  const onFinish = async (values) => {
    const openStatus = statuses.find(s => s.statusCode === 'OPEN') || statuses[0];

    const payload = {
      customerId: values.customerId,
      codeWordId: values.codeWordId,
      subject: values.subject,
      description: values.description || null,
      requestType: selectedType,
      sourceCode: values.sourceCode || null,
      dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
      details: (values.details || []).map((d, i) => ({
        lineNo: i + 1,
        itemType: 'SERVICE',
        serviceSubType: mainType === 'EXTERNAL' ? (d.serviceSubType || null) : null,
        requestedItemName: d.requestedItemName,
        requestDescription: d.requestDescription || '',
        qty: parseFloat(d.qty) || 1,
        uom: d.uom || 'visit',
      })),
    };

    if (!isEdit && openStatus) {
      payload.statusId = openStatus.id;
    }

    if (isEdit) {
      setPendingPayload(payload);
      setChangeNote('');
      setIsReasonModalOpen(true);
    } else {
      setSaving(true);
      try {
        const resData = await createInquiry(payload);
        setIsDirty(false);
        message.success('Service Inquiry created successfully!');

        if (selectedType === 'SERVICE_IC_TFS') {
          const svcData = await createServiceExecutionFromInquiry(resData.id);
          message.success('Service Execution created successfully!');
          navigate(`/tfs/scheduled/create?serviceId=${svcData.id}&serviceNumber=${svcData.serviceNumber}`);
        } else {
          navigate('/service/inquiries');
        }
      } catch (err) {
        message.error(err.response?.data?.error || err.message || 'Failed to create inquiry');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleConfirmUpdate = async () => {
    if (!changeNote || changeNote.trim() === '') {
      message.warning('Harap isi alasan perbaikan / edit data inquiry');
      return;
    }

    setSaving(true);
    try {
      const finalPayload = {
        ...pendingPayload,
        changeNote: changeNote.trim(),
      };
      await updateInquiry(id, finalPayload);
      setIsDirty(false);
      setIsReasonModalOpen(false);
      message.success('Service Inquiry updated successfully!');
      navigate(`/service/inquiries/${id}`);
    } catch (err) {
      message.error(err.response?.data?.error || err.message || 'Failed to update inquiry');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 p-10">
        <Spin size="large" tip="Loading service inquiry data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto mb-10 px-4">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? `Edit Service Inquiry ${inquiryData?.inquiryNumber || ''}` : 'New Service Inquiry'}
          </Title>
          <Text type="secondary">
            {isEdit
              ? 'Update inquiry details and service requirements'
              : 'Fill in the inquiry details and select the service type on the right'}
          </Text>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/service/inquiries/${id}` : '/service/inquiries')}>
          {isEdit ? 'Back to detail' : 'Back to list'}
        </Button>
      </div>

      <UnsavedChangesModal blocker={blocker} />
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Side: Inquiry Form */}
        <div className="flex-1 w-full lg:w-0">
          <Card className="rounded-xl shadow-sm border-gray-100">
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onValuesChange={() => setIsDirty(true)}
              initialValues={{ details: [{ qty: 1, uom: 'visit' }] }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <Form.Item name="customerId" label="Customer" rules={[{ required: true, message: 'Required' }]}>
                  <Select
                    showSearch
                    placeholder="Select Customer..."
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={customers.map(c => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    allowClear
                  />
                </Form.Item>

                <Form.Item name="codeWordId" label="Code Word">
                  <Select
                    showSearch
                    placeholder="Search Code Word..."
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={codeWords.map(cw => ({
                      value: cw.id,
                      label: cw.code,
                    }))}
                    allowClear
                  />
                </Form.Item>

                <Form.Item name="sourceCode" label="Inquiry Source">
                  <Select placeholder="Select Source" allowClear>
                    {INQUIRY_SOURCES.map(s => (
                      <Option key={s.id} value={s.id}>{s.sourceName}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="dueDate" label="Target Due Date">
                  <DatePicker className="w-full" format="DD MMM YYYY" />
                </Form.Item>

                <Form.Item name="subject" label="Subject / Brief" rules={[{ required: true, message: 'Required' }]} className="col-span-2">
                  <Input placeholder="e.g. Mill Gearbox Service Request" />
                </Form.Item>

                <Form.Item name="description" label="Description" className="col-span-2">
                  <TextArea rows={3} placeholder="Customer's detailed requirements..." />
                </Form.Item>
              </div>

              <Divider orientation="left">Detailed Items / Requested Work</Divider>

              <Form.List name="details">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <div key={key} className="p-4 mb-3 bg-gray-50 border border-gray-200 rounded-lg relative">
                        <Button
                          type="text" danger icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                          className="absolute top-2 right-2"
                          disabled={fields.length === 1}
                        />
                        <div className="grid grid-cols-4 gap-4">
                          <Form.Item {...restField} name={[name, 'requestedItemName']} label="Work Name/Item"
                            rules={[{ required: true, message: 'Required' }]} className="col-span-2">
                            <Input placeholder="e.g. Inspection of Separator" />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'qty']} label="Qty">
                            <Input type="number" min={1} />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'uom']}
                            label="UOM"
                            rules={[
                              {
                                required: true,
                                message: 'Please select UOM',
                              },
                            ]}
                          >
                            <Select
                              showSearch
                              placeholder="Select UOM"
                              optionFilterProp="label"
                              options={UOM_OPTIONS}
                              filterOption={(input, option) =>
                                String(option?.label || '')
                                  .toLowerCase()
                                  .includes(input.toLowerCase())
                              }
                            />
                          </Form.Item>

                          {/* Per-item service type selector — only for External */}
                          {mainType === 'EXTERNAL' && (
                            <Form.Item
                              {...restField}
                              name={[name, 'serviceSubType']}
                              label="Service Type"
                              rules={[{ required: true, message: 'Required' }]}
                              className="col-span-2"
                            >
                              <Select placeholder="Select service type">
                                <Option value="PURCHASE">Purchase Service (from Vendor)</Option>
                                <Option value="TFS">Utilize TFS (Personnel)</Option>
                              </Select>
                            </Form.Item>
                          )}

                          <Form.Item {...restField} name={[name, 'requestDescription']} label="Note"
                            className={mainType === 'EXTERNAL' ? 'col-span-2' : 'col-span-4'}>
                            <Input placeholder="Condition, symptoms, or special specifications..." />
                          </Form.Item>
                        </div>
                      </div>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add({ qty: 1, uom: 'visit' })} block icon={<PlusOutlined />}>
                        Add Item
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" size="large" loading={saving} className="w-full bg-primary-600">
                  {isEdit
                    ? 'Save Changes'
                    : (selectedType === 'SERVICE_IC_TFS' ? <span>Save & Proceed to TFS <ArrowLeftOutlined /></span> : 'Save Inquiry')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* Right Side: Type Selector & Guidance */}
        <div className="w-full lg:w-80 space-y-4">
          <Card className="rounded-xl shadow-sm border-gray-100" bodyStyle={{ padding: '20px 16px' }}>
            <Title level={5} style={{ marginBottom: 16 }}>Select Main Type</Title>
            <div className="flex flex-col gap-3">
              {MAIN_SERVICE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setMainType(type.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${mainType === type.value
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${mainType === type.value ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-400'}`}>
                      {type.icon}
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${mainType === type.value ? 'text-primary-700' : 'text-gray-700'}`}>
                        {type.label}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{type.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {selectedType === 'SERVICE_IC_TFS' && (
            <Alert
              type="warning"
              showIcon
              message={<span className="text-xs font-bold">Inter Company TFS</span>}
              description={<span className="text-[11px] leading-relaxed block">Once this inquiry is saved, you will be automatically redirected to the TFS input page.</span>}
              className="rounded-xl !mt-2"
            />
          )}

          {mainType === 'EXTERNAL' && (
            <Alert
              type="info"
              showIcon
              message={<span className="text-xs font-bold">Mixed External Service</span>}
              description={<span className="text-[11px] leading-relaxed block">Each item can be either a <strong>Purchase</strong> from vendor or a <strong>TFS</strong> personnel assignment. Both will go through a single PO flow.</span>}
              className="rounded-xl !mt-2"
            />
          )}

          <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 !mt-3">
            <Text type="secondary" className="text-xs italic block text-center">
              Ensure the service type is correct before saving the inquiry.
            </Text>
          </div>
        </div>
      </div>

      <Modal
        title="Alasan Perbaikan Data Service Inquiry"
        open={isReasonModalOpen}
        onOk={handleConfirmUpdate}
        onCancel={() => setIsReasonModalOpen(false)}
        confirmLoading={saving}
        okText="Simpan Perubahan"
        cancelText="Batal"
      >
        <p className="text-sm text-gray-600 mb-3">
          Silakan masukkan alasan/catatan mengenai pembaruan data Inquiry ini untuk dicatat dalam Workflow History:
        </p>
        <Input.TextArea
          rows={4}
          placeholder="Contoh: Mengubah detail item service dan tanggal due date..."
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default ServiceInquiryForm;

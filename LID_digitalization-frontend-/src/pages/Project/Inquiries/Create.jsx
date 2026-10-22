import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, message, Typography, Divider, Spin, Modal } from 'antd';
import { MinusCircleOutlined, PlusOutlined, BuildOutlined, UpSquareOutlined, ToolOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  getCustomers,
  getCodeWords,
  getInquiryById,
  createInquiry,
  updateInquiry
} from '../../../services/inquiry.service';
import dayjs from 'dayjs';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PROJECT_TYPES = [
  {
    value: 'PROJECT_NEW_PLANT',
    label: 'New Plant',
    description: 'New plant construction project.',
    icon: <BuildOutlined />,
    canContinue: false,
    badge: 'bg-emerald-50 border-emerald-200',
  },
  {
    value: 'PROJECT_UPGRADE',
    label: 'Upgrade',
    description: 'Upgrade/modernization of existing plant.',
    icon: <UpSquareOutlined />,
    canContinue: false,
    badge: 'bg-blue-50 border-blue-200',
  },
  {
    value: 'PROJECT_OM',
    label: 'O&M (Operations & Maintenance)',
    description: 'Comprehensive plant operation and maintenance services.',
    icon: <ToolOutlined />,
    canContinue: true,
    badge: 'bg-violet-50 border-violet-200',
  },
];

const INQUIRY_SOURCES = [
  { id: 'OTHERS', sourceName: 'Others' },
  { id: 'PHONE', sourceName: 'Phone' },
  { id: 'EMAIL', sourceName: 'Email' },
];

export default function ProjectInquiryForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id) || location.pathname.includes('/edit');

  const [customers, setCustomers] = useState([]);
  const [codeWords, setCodeWords] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [inquiryData, setInquiryData] = useState(null);
  const [selectedType, setSelectedType] = useState('PROJECT_OM');

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [pendingPayload, setPendingPayload] = useState(null);

  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEdit) {
          const [custData, cwData, inqData] = await Promise.all([
            getCustomers(),
            getCodeWords(),
            getInquiryById(id),
          ]);
          setCustomers(Array.isArray(custData) ? custData : []);
          setCodeWords(Array.isArray(cwData) ? cwData : []);
          setInquiryData(inqData);
          setSelectedType(inqData.requestType || 'PROJECT_OM');

          form.setFieldsValue({
            customerId: inqData.customerId ?? undefined,
            codeWordId: inqData.codeWordId ?? undefined,
            sourceCode: inqData.sourceCode,
            subject: inqData.subject,
            dueDate: inqData.dueDate ? dayjs(inqData.dueDate) : null,
            description: inqData.description,
            details: (inqData.details || []).map(d => ({
              requestedItemName: d.requestedItemName,
              qty: d.qty,
              uom: d.uom,
              requestDescription: d.requestDescription || '',
            })),
          });
        } else {
          const [custData, cwData] = await Promise.all([
            getCustomers().catch(() => []),
            getCodeWords().catch(() => []),
          ]);
          setCustomers(Array.isArray(custData) ? custData : []);
          setCodeWords(Array.isArray(cwData) ? cwData : []);
        }
      } catch (err) {
        message.error(isEdit ? 'Failed to load inquiry data for editing' : 'Failed to load reference data');
        if (isEdit) navigate('/project/inquiries');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit, form, navigate]);

  const onFinish = async (values) => {
    const projectTypeMap = {
      PROJECT_NEW_PLANT: 'NEW_PLANT',
      PROJECT_UPGRADE: 'UPGRADE',
      PROJECT_OM: 'OM',
    };

    const payload = {
      ...values,
      requestType: selectedType,
      projectType: projectTypeMap[selectedType] || selectedType,
      dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
      details: (values.details || []).map((d, i) => ({
        ...d,
        lineNo: i + 1,
        itemType: 'PROJECT',
        requestDescription: d.requestDescription || '',
        qty: parseFloat(d.qty) || 1,
      })),
    };

    if (isEdit) {
      setPendingPayload(payload);
      setChangeNote('');
      setIsReasonModalOpen(true);
    } else {
      setSaving(true);
      try {
        await createInquiry(payload);
        setIsDirty(false);
        message.success('Your project inquiry has been saved!');
        navigate('/project/inquiries');
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
      message.success('Your project inquiry has been updated!');
      navigate('/project/inquiries');
    } catch (err) {
      message.error(err.response?.data?.error || err.message || 'Failed to update inquiry');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 p-10">
        <Spin size="large" tip="Loading project inquiry data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? `Edit Project Inquiry ${inquiryData?.inquiryNumber || ''}` : 'New Project Inquiry'}
          </Title>
          <Text type="secondary">
            {isEdit
              ? 'Update project type or requirement details'
              : 'Select the project type, then fill in the details of your requirements'}
          </Text>
        </div>
        <Button onClick={() => navigate('/project/inquiries')}>
          {isEdit ? 'Cancel' : 'Back to List'}
        </Button>
      </div>

      <UnsavedChangesModal blocker={blocker} />
      <Card className="rounded-xl shadow-sm border-gray-100 !mb-3">
        <Title level={5} style={{ marginBottom: 16 }}>Project Type</Title>
        <div className="grid grid-cols-3 gap-4">
          {PROJECT_TYPES.map(type => (
            <button key={type.value} type="button" onClick={() => { setSelectedType(type.value); setIsDirty(true); }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${selectedType === type.value ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
              <div className="text-2xl mb-2 text-primary-600">{type.icon}</div>
              <div className="font-semibold text-sm text-gray-800">{type.label}</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">{type.description}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-xl shadow-sm border-gray-100">
        <Form form={form} layout="vertical" onFinish={onFinish}
          onValuesChange={() => setIsDirty(true)}
          initialValues={{ details: [{ qty: 1, uom: 'ls' }] }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <Form.Item name="customerId" label="Customer" rules={[{ required: true, message: 'Please select a customer' }]}>
              <Select
                showSearch
                placeholder="Search & select customer..."
                optionFilterProp="label"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={(Array.isArray(customers) ? customers : []).map(c => ({ value: c.id, label: c.name }))}
                allowClear
              />
            </Form.Item>
            <Form.Item name="codeWordId" label="Code Word">
              <Select
                showSearch
                placeholder="Search & select codeword (optional)..."
                optionFilterProp="label"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={(Array.isArray(codeWords) ? codeWords : []).map(cw => ({ value: cw.id, label: cw.code, title: cw.description }))}
                allowClear
              />
            </Form.Item>
            <Form.Item name="sourceCode" label="Inquiry Source" rules={[{ required: true }]}>
              <Select placeholder="Select a source">
                {INQUIRY_SOURCES.map(s => (
                  <Option key={s.id} value={s.id}>{s.sourceName}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="dueDate" label="Target Completion">
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="subject" label="Project Name / Subject" rules={[{ required: true }]} className="col-span-2">
              <Input placeholder="e.g. O&M Contract 2026 — Pabrik Tuban" />
            </Form.Item>
            <Form.Item name="description" label="General Description" className="col-span-2">
              <TextArea rows={3} placeholder="Detail project requirements..." />
            </Form.Item>
          </div>

          <Divider orientation="left">Scope of Work</Divider>
          {isEdit && (
            <Text type="secondary" className="block mb-4">
              Warning: Modifying items will drop existing bindings on Review if replacing the entire line.
            </Text>
          )}
          <Form.List name="details">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} className="p-4 mb-3 bg-gray-50 border border-gray-200 rounded-lg relative">
                    <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)}
                      className="absolute top-2 right-2" disabled={fields.length === 1} />
                    <div className="grid grid-cols-4 gap-4 mt-2">
                      <Form.Item {...restField} name={[name, 'requestedItemName']} label="Requested Scope/Item"
                        rules={[{ required: true }]} className="col-span-2">
                        <Input placeholder="e.g. Monthly inspection LM56.3+3" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'qty']} label="Qty" rules={[{ required: true }]}>
                        <Input type="number" min={1} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'uom']} label="UOM">
                        <Input placeholder="ls / month / year" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'requestDescription']} label="Item Specific Notes" className="col-span-4">
                        <Input.TextArea rows={1} placeholder="Detail scope or specific conditions..." />
                      </Form.Item>
                    </div>
                  </div>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add({ qty: 1, uom: 'ls' })} block icon={<PlusOutlined />}>
                    Add Item Request
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" loading={saving} block className="bg-primary-600">
              {isEdit ? 'Save Changes' : 'Save Project Inquiry'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="Alasan Perbaikan Data Project Inquiry"
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
          placeholder="Contoh: Mengubah spesifikasi scope item dan tanggal due date..."
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, Divider, Typography, message, Spin, Modal, Checkbox } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  createInquiry,
  getInquiryById,
  updateInquiry,
  getCustomers,
  getCodeWords
} from '../../../services/inquiry.service';
import { getSparePartCategories, createSparePart } from '../../../services/master.service';
import dayjs from 'dayjs';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';

const { Title, Text } = Typography;
const { Option } = Select;

const INQUIRY_SOURCES = [
  { id: 'OTHERS', sourceName: 'Others' },
  { id: 'PHONE', sourceName: 'Phone' },
  { id: 'EMAIL', sourceName: 'Email' },
];

const InquiryForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id) || location.pathname.includes('/edit');

  const [customers, setCustomers] = useState([]);
  const [codeWords, setCodeWords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [inquiryData, setInquiryData] = useState(null);

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [pendingPayload, setPendingPayload] = useState(null);

  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEdit) {
          const [custData, cwData, inqData, catData] = await Promise.all([
            getCustomers(),
            getCodeWords(),
            getInquiryById(id),
            getSparePartCategories({ active: true }).catch(() => [])
          ]);

          setCustomers(custData);
          setCodeWords(cwData);
          setCategories(catData || []);
          setInquiryData(inqData);

          form.setFieldsValue({
            customerId: inqData.customerId ?? undefined,
            codeWordId: inqData.codeWordId ?? undefined,
            sourceCode: inqData.sourceCode,
            subject: inqData.subject,
            requestType: inqData.requestType || 'SPARE_PART',
            dueDate: inqData.dueDate ? dayjs(inqData.dueDate) : null,
            description: inqData.description,
            details: inqData.details && inqData.details.length > 0
              ? inqData.details
              : [{ itemType: 'SPARE_PART', qty: 1 }],
          });
        } else {
          const [custData, cwData, catData] = await Promise.all([
            getCustomers(),
            getCodeWords(),
            getSparePartCategories({ active: true }).catch(() => [])
          ]);
          setCustomers(custData);
          setCodeWords(cwData);
          setCategories(catData || []);
        }
      } catch (err) {
        message.error(isEdit ? 'Failed to load inquiry for editing' : 'Failed to load reference data');
        if (isEdit) navigate('/inquiries');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEdit, form, navigate]);

  const onFinish = async (values) => {
    // 1. Registrasi otomatis ke master sparepart jika ada item yang dicentang
    const itemsToRegister = (values.details || []).filter(d => d.saveToMaster && d.categoryId);
    if (itemsToRegister.length > 0) {
      for (const itm of itemsToRegister) {
        const pCode = itm.requestedPartNumber?.trim();
        const pName = itm.requestedItemName?.trim();
        if (pCode && pName) {
          try {
            await createSparePart({
              partCode: pCode,
              partName: pName,
              uom: itm.uom ? itm.uom.trim().toUpperCase() : 'PCS',
              categoryId: itm.categoryId,
              active: true,
            });
          } catch (err) {
            console.warn(`Master registration note: ${err.response?.data?.error || err.message}`);
          }
        }
      }
    }

    const payload = {
      ...values,
      dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
      details: (values.details || []).map((d, i) => ({
        ...d,
        lineNo: i + 1,
        itemType: d.itemType || 'SPARE_PART',
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
        message.success('Inquiry Created Successfully');
        navigate('/inquiries');
      } catch (err) {
        message.error(err.response?.data?.error || 'Failed to create inquiry');
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
      message.success('Inquiry Updated Successfully');
      navigate('/inquiries');
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to update inquiry');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center items-center">
        <Spin size="large" tip="Loading Inquiry Data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
            {isEdit ? `Edit Inquiry ${inquiryData?.inquiryNumber || ''}` : 'New Inquiry'}
          </Title>
          <Text type="secondary">
            {isEdit
              ? 'Update the raw customer request details'
              : 'Record customer request before assigning to internal mapping'}
          </Text>
        </div>
        <Button onClick={() => navigate('/inquiries')}>
          {isEdit ? 'Cancel' : 'Back to List'}
        </Button>
      </div>

      <UnsavedChangesModal blocker={blocker} />
      <Card className="rounded-xl shadow-sm border-gray-100">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={() => setIsDirty(true)}
          initialValues={{
            requestType: 'SPARE_PART',
            details: [{ itemType: 'SPARE_PART', qty: 1 }],
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {/* Customer — dropdown dari master customer */}
            <Form.Item
              name="customerId"
              label="Customer"
              rules={[{ required: true, message: 'Pilih customer' }]}
            >
              <Select
                showSearch
                placeholder="Search & pilih customer..."
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

            {/* CodeWord — dropdown dari master codeword */}
            <Form.Item
              name="codeWordId"
              label="Code Word"
            >
              <Select
                showSearch
                placeholder="Search & pilih codeword (opsional)..."
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={codeWords.map(cw => ({
                  value: cw.id,
                  label: cw.code,
                  title: cw.description,
                }))}
                allowClear
              />
            </Form.Item>

            <Form.Item
              name="sourceCode"
              label="Inquiry Source"
              rules={[{ required: true, message: 'Select inquiry source' }]}
            >
              <Select placeholder="Select Source">
                {INQUIRY_SOURCES.map((s) => (
                  <Option key={s.id} value={s.id}>
                    {s.sourceName}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="requestType"
              label="Request Type"
              rules={[{ required: true, message: 'Request type is required' }]}
            >
              <Input disabled />
            </Form.Item>

            <Form.Item
              name="subject"
              label="Subject / Brief"
              rules={[{ required: true, message: 'Enter subject' }]}
              className="col-span-2"
            >
              <Input placeholder="e.g. Pump Repair Request" />
            </Form.Item>

            <Form.Item name="dueDate" label="Target Due Date">
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item name="description" label="General Description" className="col-span-2">
              <Input.TextArea
                rows={3}
                placeholder="Customer's general problem or requirement..."
              />
            </Form.Item>
          </div>

          <Divider orientation="left">Inquiry Items (Raw Customer Input)</Divider>
          <Text type="secondary" className="block mb-4">
            {isEdit
              ? 'Warning: Modifying items will drop existing Master Data bindings on Review if replacing the entire line.'
              : 'You do not need to select from Master Data here. Just type what the customer requested. Internal review will map it later.'}
          </Text>

          <Form.List name="details">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div
                    key={key}
                    className="p-4 mb-4 bg-gray-50 border border-gray-200 rounded-lg relative"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(name)}
                      className="absolute top-2 right-2"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                      <Form.Item
                        {...restField}
                        name={[name, 'itemType']}
                        label="Type"
                        rules={[{ required: true, message: 'Type is required' }]}
                      >
                        <Input disabled />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'requestedItemName']}
                        label="Requested Item"
                        rules={[{ required: true, message: 'Enter requested item' }]}
                        className="col-span-2"
                      >
                        <Input placeholder="e.g. Schneider M200 PLC" />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'requestedPartNumber']}
                        label="Part Number (MatNr)"
                        rules={[{ required: true, message: 'Part Number(MatNr) is required' }]}
                      >
                        <Input placeholder="PN or MaNr" />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'qty']}
                        label="Quantity"
                        rules={[{ required: true, message: 'Enter quantity' }]}
                      >
                        <Input type="number" min={1} />
                      </Form.Item>

                      <Form.Item {...restField} name={[name, 'uom']} label="UOM">
                        <Input placeholder="pcs" />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'requestDescription']}
                        label="Item Specific Notes"
                        className="col-span-2"
                      >
                        <Input.TextArea
                          rows={1}
                          placeholder="Specific conditions or symptoms..."
                        />
                      </Form.Item>

                      {/* Opsi Daftarkan ke Master Data Sparepart */}
                      <div className="col-span-1 sm:col-span-2 lg:col-span-4 mt-2 pt-2 border-t border-gray-200">
                        <Form.Item
                          {...restField}
                          name={[name, 'saveToMaster']}
                          valuePropName="checked"
                          className="m-0"
                        >
                          <Checkbox>
                            <span className="text-xs font-medium text-gray-700">Daftarkan ke Master Data Sparepart</span>
                          </Checkbox>
                        </Form.Item>

                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, curValues) =>
                            prevValues?.details?.[name]?.saveToMaster !== curValues?.details?.[name]?.saveToMaster
                          }
                        >
                          {() => {
                            const isChecked = form.getFieldValue(['details', name, 'saveToMaster']);
                            if (!isChecked) return null;
                            return (
                              <div className="mt-2 p-3 bg-blue-50/70 rounded-md border border-blue-200">
                                <Form.Item
                                  {...restField}
                                  name={[name, 'categoryId']}
                                  label={<span className="text-xs font-semibold text-blue-900">Kategori Spare Part *</span>}
                                  rules={[{ required: true, message: 'Pilih kategori spare part' }]}
                                  className="m-0"
                                >
                                  <Select
                                    showSearch
                                    placeholder="Pilih atau cari kategori spare part..."
                                    optionFilterProp="label"
                                    filterOption={(input, option) =>
                                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={categories.map(c => ({
                                      value: c.id,
                                      label: `[${c.categoryCode}] ${c.categoryName}`,
                                    }))}
                                  />
                                </Form.Item>
                                <div className="text-[11px] text-blue-700 mt-1">
                                  ℹ️ Item ini akan otomatis didaftarkan ke Master Data saat Inquiry ini disimpan.
                                </div>
                              </div>
                            );
                          }}
                        </Form.Item>
                      </div>
                    </div>
                  </div>
                ))}

                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add({ itemType: 'SPARE_PART', qty: 1 })}
                    block
                    icon={<PlusOutlined />}
                  >
                    Add Item Request
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={saving}
              className="w-full bg-blue-600"
            >
              {isEdit ? 'Save Edit' : 'Submit Inquiry'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="Alasan Perbaikan Data Inquiry"
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
          placeholder="Contoh: Mengubah kuantitas item dan memperbarui tanggal due date..."
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default InquiryForm;
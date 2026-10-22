import React, { useState } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, message, Typography } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ToolOutlined, ClearOutlined, SettingOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { createServiceExecution } from '../../../services/service.service';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Hardcoded service types (no DB table needed)
const SERVICE_TYPES = [
  { value: 'Repairing', label: <span><ToolOutlined className="mr-2" /> Repairing</span> },
  { value: 'Cleaning', label: <span><ClearOutlined className="mr-2" /> Cleaning</span> },
  { value: 'Maintaining', label: <span><SettingOutlined className="mr-2" /> Maintaining</span> },
];

export default function ServiceExecutionCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const poId = searchParams.get('poId');
  const inquiryId = searchParams.get('inquiryId');
  const sourceTypeParam = searchParams.get('sourceType') || searchParams.get('source');
  const sourceType = sourceTypeParam || (poId ? 'PURCHASE_ORDER' : inquiryId ? 'IC_TFS' : 'PURCHASE_ORDER');

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const engineerName = values.picName
        ? `${values.serviceType}|${values.picName}`
        : values.serviceType || null;
      const payload = {
        sourceType,
        poId: poId || null,
        inquiryId: inquiryId || null,
        engineerName,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        targetDate: values.targetDate ? values.targetDate.format('YYYY-MM-DD') : null,
        sdNumber: values.sdNumber ? values.sdNumber.trim() : null,
        progressNote: values.progressNote || null,
        remarks: values.remarks || null,
      };
      const svc = await createServiceExecution(payload);
      message.success('Service Execution created successfully!');
      navigate(`/service/executions/${svc.id}`);
    } catch (err) {
      message.error(err.message || 'Failed to create service execution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={4} style={{ margin: 0 }}>New Service Execution</Title>
          <Text type="secondary">
            Source: {
              sourceType === 'EXTERNAL_TFS' ? 'External TFS' :
              sourceType === 'IC_TFS' ? 'Inter Company TFS' :
              `Purchase Order${poId ? ` #${poId}` : ''}`
            }
          </Text>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/service/executions')}>Back</Button>
      </div>

      <Card className="rounded-xl shadow-sm border-gray-100">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="serviceType"
            label="Work Type"
            rules={[{ required: true, message: 'Select work type' }]}
          >
            <Select placeholder="-- Select Work Type --" size="large">
              {SERVICE_TYPES.map((t) => (
                <Option key={t.value} value={t.value}>
                  {t.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="picName"
            label="PIC Name"
            rules={[{ required: true, message: 'Enter PIC name' }]}
          >
            <Input placeholder="Person In Charge Name" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="startDate" label="Start Date">
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="targetDate" label="Target Completion">
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
          </div>
          <Form.Item name="sdNumber" label="SD Number">
            <Input placeholder="e.g. SD-2026-0001" />
          </Form.Item>
          <Form.Item name="progressNote" label="Initial Note">
            <TextArea rows={3} placeholder="Details of work to be done..." />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" loading={loading} block className="bg-primary-600">
              Create Service Execution
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

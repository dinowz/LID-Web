import React, { useState } from 'react';
import { Card, Form, Input, Button, DatePicker, message, Typography } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { createProject } from '../../../services/project.service';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function ProjectExecutionCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const poId = searchParams.get('poId');

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        projectType: 'OM',
        poId: poId,
        projectName: values.projectName,
        description: values.description || null,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        targetDate: values.targetDate ? values.targetDate.format('YYYY-MM-DD') : null,
        progressNote: values.progressNote || null,
      };
      await createProject(payload);
      message.success('Project Execution created successfully!');
      navigate('/project/executions');
    } catch (err) {
      message.error(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={4} style={{ margin: 0 }}>New Project Execution (O&M)</Title>
          <Text type="secondary">{poId ? `From PO #${poId}` : 'Manual input'}</Text>
        </div>
        <Button onClick={() => navigate('/project/executions')}>Back</Button>
      </div>
      <Card className="rounded-xl shadow-sm border-gray-100">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="projectName" label="Project Name" rules={[{ required: true }]}>
            <Input placeholder="O&M Contract 2026 — Tuban Plant" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="startDate" label="Start Date">
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="targetDate" label="Target Completion">
              <DatePicker className="w-full" format="DD MMM YYYY" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Project Description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="progressNote" label="Initial Progress Note">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" loading={loading} block className="bg-primary-600">
              Create Project Execution
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, message, Typography, Row, Col, Divider, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import usePermissions from '../../../hooks/usePermissions';
import { getServices } from '../../../services/service.service';
import { getProjects } from '../../../services/project.service';
import { getAllTfs } from '../../../services/tfs.service';
import { createInvoice } from '../../../services/invoice.service';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sourceType, setSourceType] = useState('SERVICE');
  const [services, setServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tfsList, setTfsList] = useState([]);

  useEffect(() => {
    Promise.all([
      getServices({ status: 'DONE' }),
      getProjects({ status: 'DONE' }),
      getAllTfs({ status: 'DONE' }),
    ]).then(([svc, prj, tfs]) => {
      setServices(Array.isArray(svc) ? svc : []);
      setProjects(Array.isArray(prj) ? prj : []);
      setTfsList(Array.isArray(tfs) ? tfs : []);
    }).catch(() => {});
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        sourceType,
        serviceId: values.serviceId || null,
        projectId: values.projectId || null,
        tfsId: values.tfsId || null,
        totalAmount: parseFloat(values.totalAmount),
        currency: values.currency || 'IDR',
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
        remarks: values.remarks || null,
      };
      await createInvoice(payload);
      message.success('Invoice created successfully!');
      navigate('/finance/invoices');
    } catch (err) {
      message.error(err.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={4} style={{ margin: 0 }}>Create Invoice</Title>
          <Text type="secondary">Create a new invoice from completed Service or Project executions</Text>
        </div>
        <Button onClick={() => navigate('/finance/invoices')}>Back</Button>
      </div>

      <Card className="rounded-xl shadow-sm border-gray-100">
        <Form form={form} layout="vertical" onFinish={onFinish} disabled={!permissions.canEditInvoice}>
          <div className="mb-6">
            <p className="font-semibold text-gray-700 mb-3">Invoice Source</p>
            <div className="grid grid-cols-2 gap-4">
              {[{ value: 'SERVICE', label: 'Service', desc: 'From Service Execution' }, { value: 'PROJECT', label: 'Project', desc: 'From Project O&M Execution' }].map(t => (
                <button key={t.value} type="button" onClick={() => { setSourceType(t.value); form.resetFields(['serviceId', 'projectId', 'tfsId']); }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${sourceType === t.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <div className="font-semibold text-gray-800">{t.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Alert type="info" showIcon className="mb-4" message="Only services/projects with DONE status can be invoiced." />

          {sourceType === 'SERVICE' && (
            <Form.Item name="serviceId" label="Select Service Execution">
              <Select placeholder="Select completed service..." showSearch allowClear>
                {services.map(s => <Option key={s.id} value={s.id}>{s.serviceNumber} {s.purchaseOrder ? `— PO: ${s.purchaseOrder.poNumber || '-'}` : ''}</Option>)}
              </Select>
            </Form.Item>
          )}

          {sourceType === 'PROJECT' && (
            <Form.Item name="projectId" label="Select Project Execution">
              <Select placeholder="Select completed project..." showSearch allowClear>
                {projects.map(p => <Option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</Option>)}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="tfsId" label="Related TFS (optional)">
            <Select placeholder="Select TFS if applicable..." showSearch allowClear>
              {tfsList.map(t => <Option key={t.id} value={t.id}>{t.tfsNumber} — {t.customerName}</Option>)}
            </Select>
          </Form.Item>

          <Divider />
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="totalAmount" label="Total Amount" rules={[{ required: true, message: 'Required' }]}>
                <Input type="number" min={0} prefix="IDR" placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="currency" label="Currency" initialValue="IDR">
                <Select>
                  <Option value="IDR">IDR</Option>
                  <Option value="EUR">EUR</Option>
                  <Option value="USD">USD</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dueDate" label="Due Date">
            <DatePicker className="w-full" format="DD MMM YYYY" />
          </Form.Item>

          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" loading={loading} block className="bg-primary-600">
              Create Invoice
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

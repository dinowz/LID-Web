import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message, Space, Typography, Tag, Select, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getServiceCategories, getServices, createService, updateService, deleteService } from '../services/master.service';

const { Title, Text } = Typography;
const { Option } = Select;

const MasterServices = () => {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    try {
      const resData = await getServiceCategories({ active: true });
      setCategories(resData);
    } catch (error) {
      console.error(error);
      message.error('Failed to load categories');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.categoryId = categoryFilter;

      const resData = await getServices(params);
      setData(resData);
    } catch (error) {
      console.error(error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchData(); }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, categoryFilter]);

  const showModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue({
        serviceCode: record.serviceCode,
        serviceName: record.serviceName,
        categoryId: record.categoryId,
        description: record.description,
        serviceScope: record.serviceScope,
        uom: record.uom,
        standardPrice: record.standardPrice,
        estimatedPrice: record.estimatedPrice ?? null,
        currency: record.currency,
        leadTimeDays: record.leadTimeDays,
        targetCustomerType: record.targetCustomerType,
        active: record.active,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        active: true,
        standardPrice: 0,
        leadTimeDays: 0,
        currency: 'IDR',
        targetCustomerType: 'external',
      });
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingRecord(null);
  };

  const handleSave = async (values) => {
    try {
      if (editingRecord) {
        await updateService(editingRecord.id, values);
        message.success('Record updated successfully');
      } else {
        await createService(values);
        message.success('Record created successfully');
      }
      setIsModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.error || 'Failed to save record.');
    }
  };

  const confirmDelete = (record) => {
    setRecordToDelete(record);
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    if (!recordToDelete) return;
    setDeleting(true);
    try {
      await deleteService(recordToDelete.id);
      message.success('Record deleted successfully');
      setDeleteModalVisible(false);
      setRecordToDelete(null);
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to delete record (might be in use)');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'serviceCode', key: 'serviceCode', sorter: (a, b) => a.serviceCode.localeCompare(b.serviceCode) },
    { title: 'Name', dataIndex: 'serviceName', key: 'serviceName' },
    { title: 'Category', dataIndex: ['category', 'categoryName'], key: 'categoryId' },
    { title: 'UOM', dataIndex: 'uom', key: 'uom' },
    { title: 'Standard Price', key: 'standardPrice', render: (_, record) => `${record.currency} ${Number(record.standardPrice).toLocaleString('en-US')}` },
    { title: 'Est. Price', key: 'estimatedPrice', render: (_, record) => record.estimatedPrice ? `${record.currency} ${Number(record.estimatedPrice).toLocaleString('en-US')}` : '-' },
    {
      title: 'Status', dataIndex: 'active', key: 'active', render: (active) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'ACTIVE' : 'INACTIVE'}</Tag>
      )
    },
    {
      title: 'Action', key: 'action', render: (_, record) => (
        <Space size="small">
          <Button type="primary" size='small' ghost icon={<EditOutlined className="text-blue-500" />} onClick={() => showModal(record)} />
          <Button danger icon={<DeleteOutlined />} ghost size='small' onClick={() => confirmDelete(record)} />
        </Space>
      ),
    },
  ];

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Master Service</Title>
          <Text type="secondary">Manage detailed service definitions and terms</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()} className="bg-blue-600 shadow-sm">
          Add Service
        </Button>
      </div>

      <div className="overflow-hidden">
        <div className="mb-3">
          <Input placeholder="Search by Code or Name..." prefix={<SearchOutlined className="text-gray-400" />} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-80 rounded-md" allowClear />
          <div className="flex items-center gap-2 w-full sm:w-auto mt-3">
            <Select placeholder="All Categories" style={{ width: 160 }} allowClear value={categoryFilter} onChange={setCategoryFilter}>
              {categories.map(cat => (<Option key={cat.id} value={cat.id}>{cat.categoryName}</Option>))}
            </Select>
          </div>
        </div>
        <Table
          style={{ width: '100%' }}
          scroll={{ x: 'max-content' }}
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '20', '50', '100']
          }}
        />
      </div>

      <Modal width={800} title={editingRecord ? "Edit Service" : "Add Service"} open={isModalVisible} onOk={() => form.submit()} onCancel={handleCancel} okText={editingRecord ? "Update" : "Create"} centered>
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4 grid grid-cols-2 gap-x-4">
          <Form.Item className="col-span-1" name="serviceCode" label="Service Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="SRV-MNT-123" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item className="col-span-1" name="serviceName" label="Service Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Preventive Maintenance" />
          </Form.Item>

          <Form.Item className="col-span-1" name="categoryId" label="Category" rules={[{ required: true, message: 'Required' }]}>
            <Select placeholder="Select a Category">
              {categories.map(cat => (<Option key={cat.id} value={cat.id}>{cat.categoryName}</Option>))}
            </Select>
          </Form.Item>
          <Form.Item className="col-span-1" name="uom" label="UOM (Unit of Measure)" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="visit / session / day" />
          </Form.Item>

          <Form.Item className="col-span-2" name="serviceScope" label="Service Scope">
            <Input.TextArea rows={2} placeholder="Detailed scope..." />
          </Form.Item>

          <Form.Item className="col-span-2" name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description..." />
          </Form.Item>

          {/* Numerical Section */}
          <Form.Item className="col-span-1" name="standardPrice" label="Standard Price">
            <InputNumber className="!w-full" min={0} stringMode />
          </Form.Item>
          <Form.Item className="col-span-1" name="estimatedPrice" label="Estimated Price">
            <InputNumber className="!w-full" min={0} stringMode placeholder="Optional" />
          </Form.Item>

          <Form.Item className="col-span-1" name="currency" label="Currency">
            <Select>
              <Option value="IDR">IDR</Option>
              <Option value="USD">USD</Option>
              <Option value="EUR">EUR</Option>
            </Select>
          </Form.Item>

          <Form.Item className="col-span-1" name="leadTimeDays" label="Lead Time (Days)">
            <InputNumber className="!w-full" min={0} />
          </Form.Item>
          <Form.Item className="col-span-1" name="targetCustomerType" label="Customer Type">
            <Input placeholder="external or internal" />
          </Form.Item>

          <Form.Item className="col-span-1" name="active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 text-red-500">
            <ExclamationCircleOutlined />
            <span>Permanently Delete Service?</span>
          </div>
        }
        open={deleteModalVisible}
        onOk={executeDelete}
        confirmLoading={deleting}
        onCancel={() => {
          setDeleteModalVisible(false);
          setRecordToDelete(null);
        }}
        okText="Yes, Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        centered
      >
        {recordToDelete && (
          <div>
            <p>This action will permanently remove <b>{recordToDelete.serviceName}</b> from the database.</p>
            <p className="text-gray-500 mt-2">
              Deleting master data might cause errors if this data is referenced by other records.<br />
              <b>Recommendation:</b> Set the status to <b>Inactive</b> instead.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default MasterServices;


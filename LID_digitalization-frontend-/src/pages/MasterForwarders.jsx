import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Popconfirm,
  message, Space, Typography, Tag, Select, Card
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, TruckOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { getForwarders, createForwarder, updateForwarder, deleteForwarder } from '../services/master.service';
import usePermissions from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option } = Select;

const MasterForwarders = () => {
  const permissions = usePermissions();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(undefined);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (activeFilter !== undefined) params.active = activeFilter;
      const resData = await getForwarders(params);
      setData(resData);
    } catch (error) {
      console.error(error);
      message.error('Failed to load forwarder data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => fetchData(), 400);
    return () => clearTimeout(delay);
  }, [searchTerm, activeFilter]);

  const showModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue({
        name: record.name,
        supplierNumber: record.supplierNumber,
        email: record.email,
        phone: record.phone,
        country: record.country,
        active: record.active,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ active: true });
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
        await updateForwarder(editingRecord.id, values);
        message.success('Forwarder updated successfully');
      } else {
        await createForwarder(values);
        message.success('Forwarder added successfully');
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      fetchData();
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.message || 'Failed to save forwarder data');
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
      await deleteForwarder(recordToDelete.id);
      message.success('Forwarder deleted successfully');
      setDeleteModalVisible(false);
      setRecordToDelete(null);
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to delete forwarder (might be in use)');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      title: 'Supplier Number',
      dataIndex: 'supplierNumber',
      key: 'supplierNumber',
      sorter: (a, b) => (a.supplierNumber || '').localeCompare(b.supplierNumber || ''),
      render: (val) => val ? (
        <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          {val}
        </span>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: 'Forwarder Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (val) => <Text strong>{val}</Text>
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      render: (val) => val ? <Tag color="geekblue">{val}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (val) => (
        <Tag color={val ? 'green' : 'red'}>{val ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      hidden: !permissions.canEditMaster,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            icon={<EditOutlined className="text-blue-500" />}
            onClick={() => showModal(record)}
            ghost
            size='small'
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            ghost
            size="small"
            onClick={() => confirmDelete(record)}
          />
        </Space>
      ),
    },
  ].filter(col => !col.hidden);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3 px-1">
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
            Master Forwarders
          </Title>
          <Text type="secondary">Manage shipping and logistics forwarder master data</Text>
        </div>
        {permissions.canEditMaster && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
            className="bg-blue-600 shadow-sm"
          >
            Add Forwarder
          </Button>
        )}
      </div>

      <Card className="rounded-xl shadow-sm border-gray-100">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Search by name, supplier number, or country..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-96 rounded-md"
            allowClear
          />
          <Select
            placeholder="All Status"
            style={{ width: 160 }}
            allowClear
            value={activeFilter}
            onChange={(val) => setActiveFilter(val)}
          >
            <Option value="true">Active</Option>
            <Option value="false">Inactive</Option>
          </Select>
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
      </Card>

      {/* Modal Form */}
      <Modal
        title={
          <span className="flex items-center gap-2">
            <TruckOutlined />
            {editingRecord ? 'Edit Forwarder' : 'Add New Forwarder'}
          </span>
        }
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        okText={editingRecord ? 'Update' : 'Save'}
        cancelText="Cancel"
        centered
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              name="name"
              label="Forwarder Name"
              rules={[{ required: true, message: 'Forwarder name is required' }]}
              className="col-span-2"
            >
              <Input placeholder="E.g. DHL Logistics" />
            </Form.Item>

            <Form.Item
              name="supplierNumber"
              label="Supplier Number"
            >
              <Input placeholder="E.g. SUP-FW-001" />
            </Form.Item>

            <Form.Item name="country" label="Country">
              <Input placeholder="E.g. Germany" />
            </Form.Item>

            <Form.Item name="email" label="Email">
              <Input placeholder="forwarder@email.com" />
            </Form.Item>

            <Form.Item name="phone" label="Phone Number">
              <Input placeholder="+49 228 182-0" />
            </Form.Item>
          </div>

          <Form.Item name="active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 text-red-500">
            <ExclamationCircleOutlined />
            <span>Permanently Delete Forwarder?</span>
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
            <p>This action will permanently remove <b>{recordToDelete.name}</b> from the database.</p>
            <p className="text-gray-500 mt-2">
              Deleting master data might cause errors if this data is referenced by other records.<br />
              <b>Recommendation:</b> Set the status to <b>Inactive</b> instead.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MasterForwarders;

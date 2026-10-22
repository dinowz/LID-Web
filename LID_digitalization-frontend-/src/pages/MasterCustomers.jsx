import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch,
  message, Space, Typography, Tag, Select, Card
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../services/master.service';
import usePermissions from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option } = Select;

const MasterCustomers = () => {
  const permissions = usePermissions();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      const resData = await getCustomers(params);
      setData(resData);
    } catch (error) {
      console.error(error);
      message.error('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => fetchData(), 500);
    return () => clearTimeout(delay);
  }, [searchTerm]);

  const showModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue({
        name: record.name,
        email: record.email,
        phone: record.phone,
        address: record.address,
        customerType: record.customerType || 'LOCAL',
        active: record.active !== undefined ? record.active : true
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
        await updateCustomer(editingRecord.id, values);
        message.success('Customer updated successfully');
      } else {
        await createCustomer(values);
        message.success('Customer added successfully');
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      fetchData();
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.error || 'Gagal menyimpan data');
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
      await deleteCustomer(recordToDelete.id);
      message.success('Customer deleted successfully');
      setDeleteModalVisible(false);
      setRecordToDelete(null);
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to delete customer (might be in use)');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      title: 'Customer Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
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
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'customerType',
      key: 'customerType',
      render: (val) => (
        <Tag color={val === 'FOREIGN' ? 'gold' : 'blue'}>
          {val === 'FOREIGN' ? 'Foreign' : 'Local'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'ACTIVE' : 'INACTIVE'}</Tag>
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
            size='small'
            ghost
            icon={<EditOutlined className="text-blue-500" />}
            onClick={() => showModal(record)}
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
    <Card className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
            Master Customers
          </Title>
          <Text type="secondary">Manage company customer master data</Text>
        </div>
        {permissions.canEditMaster && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
            className="bg-blue-600 shadow-sm"
          >
            Add Customer
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden">
        <div className="mb-3">
          <Input
            placeholder="Search by name, email, or phone..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 rounded-md"
            allowClear
          />
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

      {/* Modal Form */}
      <Modal
        title={
          <span className="flex items-center gap-2">
            <UserOutlined />
            {editingRecord ? 'Edit Customer' : 'Add New Customer'}
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
          <Form.Item
            name="name"
            label="Customer Name"
            rules={[{ required: true, message: 'Customer name is required' }]}
          >
            <Input placeholder="PT. Contoh Industri" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="email" label="Email">
              <Input placeholder="customer@email.com" />
            </Form.Item>
            <Form.Item name="phone" label="Phone Number">
              <Input placeholder="+62 21 1234 5678" />
            </Form.Item>
          </div>

          <Form.Item name="address" label="Address">
            <Input.TextArea rows={3} placeholder="Jl. Industri No. 1, City..." />
          </Form.Item>

          <Form.Item
            name="customerType"
            label="Customer Type"
            rules={[{ required: true }]}
            initialValue="LOCAL"
          >
            <Select>
              <Option value="LOCAL">Local</Option>
              <Option value="FOREIGN">Foreign</Option>
            </Select>
          </Form.Item>

          <Form.Item name="active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 text-red-500">
            <ExclamationCircleOutlined />
            <span>Permanently Delete Customer?</span>
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
              Deleting master data might cause errors if this data is referenced by other records (e.g., Inquiries).<br />
              <b>Recommendation:</b> Set the status to <b>Inactive</b> instead.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default MasterCustomers;

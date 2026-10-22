import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Space, Typography, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getUsers, createUser, updateUser, deleteUser } from '../services/user.service';
import usePermissions from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option } = Select;

const ROLES = [
  'ADMIN',
  'PROCUREMENT',
  'LOGISTIC',
  'FINANCE',
  'PROJECT',
  'TFS',
  'SPARE_PART',
  'SERVICE',
  'MANAGEMENT',
];
const STATUSES = ['PENDING', 'ACTIVE', 'BLOCK'];

const Users = () => {
  const permissions = usePermissions();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const resData = await getUsers(params);
      setUsers(resData);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, roleFilter, statusFilter]);

  const showModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        roles: user.roles || (user.role ? [user.role] : []),
        status: user.status,
      });
    } else {
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingUser(null);
  };

  const handleSave = async (values) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, values);
        message.success('User updated successfully');
      } else {
        await createUser(values);
        message.success('User created successfully');
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      message.error(error.response?.data?.error || 'Failed to save user.');
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
      await deleteUser(recordToDelete.id);
      message.success('User deleted successfully');
      setDeleteModalVisible(false);
      setRecordToDelete(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      message.error(error.response?.data?.error || 'Failed to delete user (might be in use)');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      render: (rolesData, record) => {
        const roles = rolesData || (record.role ? [record.role] : []);
        const roleColors = {
          ADMIN: 'red',
          PROCUREMENT: 'orange',
          LOGISTIC: 'purple',
          FINANCE: 'gold',
          PROJECT: 'cyan',
          TFS: 'geekblue',
          SPARE_PART: 'green',
          SERVICE: 'volcano',
          MANAGEMENT: 'default',
        };

        if (!roles || roles.length === 0) return '-';

        return (
          <Space size={[0, 4]} wrap>
            {roles.map(r => (
              <Tag color={roleColors[r] || 'default'} key={r}>
                <strong>{r}</strong>
              </Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        if (status === 'ACTIVE') color = 'success';
        else if (status === 'BLOCK') color = 'error';
        else if (status === 'PENDING') color = 'warning';

        return (
          <Tag color={color} key={status}>
            {status || 'PENDING'}
          </Tag>
        );
      }
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString('en-US'),
    },
    {
      title: 'Action',
      key: 'action',
      hidden: !permissions.canEditMaster,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            ghost
            size='small'
            icon={<EditOutlined className="text-blue-500" />}
            onClick={() => showModal(record)}
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => confirmDelete(record)}
          />
        </Space>
      ),
    },
  ].filter(col => !col.hidden);

  return (
    <Card className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>User Management</Title>
          <Text type="secondary">Manage internal system access, roles, and profiles</Text>
        </div>
        {permissions.canEditMaster && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
            className="bg-blue-600 shadow-sm"
          >
            Add User
          </Button>
        )}
      </div>

      {/* Primary Data Section */}
      <div className="overflow-hidden">
        {/* Toolbar: Search and Filter */}
        <div className=" mb-3">
          <Input
            placeholder="Search by name or email..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 rounded-md"
            allowClear
          />
          <div className="flex items-center gap-2 mt-3">
            <Select
              placeholder="All Roles"
              style={{ width: 160 }}
              allowClear
              value={roleFilter}
              onChange={(value) => setRoleFilter(value)}
            >
              {ROLES.map(role => (
                <Option key={role} value={role}>{role}</Option>
              ))}
            </Select>
            <Select
              placeholder="All Status"
              style={{ width: 120 }}
              allowClear
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
            >
              {STATUSES.map(status => (
                <Option key={status} value={status}>{status}</Option>
              ))}
            </Select>
          </div>
        </div>

        {/* Data Table */}
        <Table
          style={{ width: '100%' }}
          scroll={{ x: 'max-content' }}
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '20', '50', '100']
          }}
          className="w-full"
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={editingUser ? "Edit User" : "Add New User"}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        okText={editingUser ? "Update" : "Create"}
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          autoComplete="off"
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="John Doe" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter an email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="user@company.com" />
          </Form.Item>

          <Form.Item
            name="roles"
            label="System Roles"
            rules={[{ required: true, message: 'Please select at least one role' }]}
          >
            <Select mode="multiple" placeholder="Select roles">
              {ROLES.map(role => (
                <Option key={role} value={role}>{role}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="Account Status"
            rules={[{ required: true, message: 'Please select a status' }]}
            initialValue="PENDING"
          >
            <Select placeholder="Select status">
              {STATUSES.map(status => (
                <Option key={status} value={status}>{status}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? "New Password (Optional)" : "Initial Password"}
            rules={[
              { required: !editingUser, message: 'Please set an initial password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
            extra={editingUser ? "Leave it blank if you want to keep the current password." : "Admin must set the initial password for new users."}
          >
            <Input.Password placeholder="Enter password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 text-red-500">
            <ExclamationCircleOutlined />
            <span>Permanently Delete User?</span>
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
              <b>Recommendation:</b> Set the status to <b>BLOCK</b> instead.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default Users;


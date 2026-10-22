import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Switch, message, Space, Typography, Tag, Card, Select } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, UserOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getMasterDivisions, createMasterDivision, updateMasterDivision, deleteMasterDivision } from '../services/master.service';

const { Title, Text } = Typography;

const JOB_TITLE_OPTIONS = [
  {
    value: 'Installation Engineer',
    label: 'Installation Engineer',
  },
  {
    value: 'Commissioning Engineer',
    label: 'Commissioning Engineer',
  },
  {
    value: 'EC&I Commissioning Engineer',
    label: 'EC&I Commissioning Engineer',
  },
];

const DIVISION_OPTIONS = [
  {
    value: 'Installation',
    label: 'Installation',
  },
  {
    value: 'Commissioning',
    label: 'Commissioning',
  },
  {
    value: 'EC&I',
    label: 'EC&I',
  },
];

const MasterPersonnel = () => {
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
      const resData = await getMasterDivisions(params);
      setData(resData);
    } catch (error) {
      console.error(error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchData(); }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const showModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue({
        personnel_code: record.personnel_code,
        name: record.name,
        title: record.title,
        division: record.division,
        phone: record.phone,
        email: record.email,
        active: record.active,
        isIdle: record.isIdle,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ active: true, isIdle: true });
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
        await updateMasterDivision(editingRecord.id, values);
        message.success('Personnel updated successfully');
      } else {
        await createMasterDivision(values);
        message.success('Personnel created successfully');
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
      await deleteMasterDivision(recordToDelete.id);
      message.success('Personnel deleted successfully');
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
    { title: 'Code', dataIndex: 'personnel_code', key: 'personnel_code', sorter: (a, b) => a.personnel_code.localeCompare(b.personnel_code) },
    { title: 'Name', dataIndex: 'name', key: 'name', render: (text) => <Space><UserOutlined className="text-gray-400" /> {text}</Space> },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Division', dataIndex: 'division', key: 'division' },
    {
      title: 'Contact', key: 'contact', render: (_, record) => (
        <div className="text-xs">
          <div>{record.phone || '-'}</div>
          <div className="text-gray-500">{record.email || '-'}</div>
        </div>
      )
    },
    {
      title: 'Status', dataIndex: 'active', key: 'active', render: (active) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'ACTIVE' : 'INACTIVE'}</Tag>
      )
    },
    {
      title: 'Availability', key: 'isIdle', render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.isIdle ? 'blue' : 'orange'}>
            {record.isIdle ? 'IDLE' : 'IN SERVICE'}
          </Tag>
          {!record.isIdle && record.currentAssignment?.serviceExecution?.serviceNumber && (
            <Text type="secondary" className="text-[10px] font-mono">
              {record.currentAssignment.serviceExecution.serviceNumber}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Action', key: 'action', align: 'center', render: (_, record) => (
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
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Master Personnel</Title>
          <Text type="secondary">Manage TFS personnel profiles and details</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()} className="bg-blue-600 shadow-sm">
          Add Personnel
        </Button>
      </div>

      <div className="overflow-hidden">
        <div className="mb-3">
          <Input placeholder="Search by Code, Name, or Division..." prefix={<SearchOutlined className="text-gray-400" />} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-80 rounded-md" allowClear />
        </div>
        <Table
          columns={columns}
          dataSource={data}
          style={{ width: '100%' }}
          scroll={{ x: 'max-content' }}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '20', '50', '100']
          }}
        />
      </div>

      <Modal
        title={editingRecord ? 'Edit Personnel' : 'Add Personnel'}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        okText={editingRecord ? 'Update' : 'Create'}
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="mt-4"
          initialValues={{
            active: true,
            isIdle: true,
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="personnel_code"
              label="Personnel Code"
              rules={[
                {
                  required: true,
                  message: 'Code is required',
                },
              ]}
            >
              <Input
                placeholder="E.g. P-001"
                disabled={!!editingRecord}
              />
            </Form.Item>

            <Form.Item
              name="name"
              label="Full Name"
              rules={[
                {
                  required: true,
                  message: 'Name is required',
                },
              ]}
            >
              <Input placeholder="E.g. John Doe" />
            </Form.Item>

            <Form.Item
              name="title"
              label="Job Title"
              rules={[
                {
                  required: true,
                  message: 'Job title is required',
                },
              ]}
            >
              <Select
                placeholder="Select job title"
                options={JOB_TITLE_OPTIONS}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              name="division"
              label="Division"
              rules={[
                {
                  required: true,
                  message: 'Division is required',
                },
              ]}
            >
              <Select
                placeholder="Select division"
                options={DIVISION_OPTIONS}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Phone Number"
            >
              <Input placeholder="E.g. 08123456789" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                {
                  type: 'email',
                  message: 'Please enter a valid email address',
                },
              ]}
            >
              <Input placeholder="E.g. john.doe@example.com" />
            </Form.Item>
          </div>

          <Space size="large">
            <Form.Item
              name="active"
              label="Status"
              valuePropName="checked"
            >
              <Switch
                checkedChildren="Active"
                unCheckedChildren="Inactive"
              />
            </Form.Item>

            <Form.Item
              name="isIdle"
              label="Availability"
              valuePropName="checked"
              tooltip="Now automatically calculated based on today's schedule in Scheduled TFS."
            >
              <Switch
                checkedChildren="Idle"
                unCheckedChildren="In Service"
                disabled
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 text-red-500">
            <ExclamationCircleOutlined />
            <span>Permanently Delete Personnel?</span>
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
              Deleting master data might cause errors if this data is referenced by other records (e.g., Scheduled TFS).<br />
              <b>Recommendation:</b> Set the status to <b>Inactive</b> instead.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default MasterPersonnel;


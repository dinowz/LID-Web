import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch,
  message, Space, Typography, Tag, Card
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getCodeWords, createCodeWord, updateCodeWord, deleteCodeWord } from '../services/master.service';

const { Title, Text } = Typography;

const MasterCodeWords = () => {
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
      const resData = await getCodeWords(params);
      setData(resData);
    } catch (error) {
      console.error(error);
      message.error('Failed to load codeword data');
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
        code: record.code,
        projectNo: record.projectNo,
        millType: record.millType,
        description: record.description,
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
        await updateCodeWord(editingRecord.id, values);
        message.success('Codeword updated successfully');
      } else {
        await createCodeWord(values);
        message.success('Codeword added successfully');
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      fetchData();
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.error || 'Failed to save data. Ensure code is unique.');
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
      await deleteCodeWord(recordToDelete.id);
      message.success('Codeword deleted successfully');
      setDeleteModalVisible(false);
      setRecordToDelete(null);
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to delete codeword (might be in use)');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      sorter: (a, b) => a.code.localeCompare(b.code),
      render: (val) => (
        <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          {val}
        </span>
      ),
    },
    {
      title: 'Project No',
      dataIndex: 'projectNo',
      key: 'projectNo',
      ellipsis: true,
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Mill Type',
      dataIndex: 'millType',
      key: 'millType',
      ellipsis: true,
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'ACTIVE' : 'INACTIVE'}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
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
  ];

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
            Master Codeword
          </Title>
          <Text type="secondary">Manage secret codes (codewords) used in Inquiries</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
          className="bg-blue-600 shadow-sm"
        >
          Add Codeword
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden">
        <div className="mb-3">
          <Input
            placeholder="Search by code, project no, mill type, or description..."
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
            <KeyOutlined />
            {editingRecord ? 'Edit Codeword' : 'Add New Codeword'}
          </span>
        }
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        okText={editingRecord ? 'Update' : 'Save'}
        cancelText="Cancel"
        centered
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: true, message: 'Code is required' }]}
            extra="Code must be unique and cannot be changed after saving."
          >
            <Input
              placeholder="Example: CW-LIND-001"
              className="font-mono"
              disabled={!!editingRecord}
            />
          </Form.Item>

          <Form.Item name="projectNo" label="Project No">
            <Input
              placeholder="Example: P-001"
            />
          </Form.Item>

          <Form.Item name="millType" label="Mill Type">
            <Input
              placeholder="Example: C500"
            />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={3}
              placeholder="Short explanation about this codeword..."
            />
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
            <span>Permanently Delete Codeword?</span>
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
            <p>This action will permanently remove <b>{recordToDelete.code}</b> from the database.</p>
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

export default MasterCodeWords;


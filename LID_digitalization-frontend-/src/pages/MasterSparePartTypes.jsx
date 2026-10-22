import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Switch, message, Space, Typography, Tag, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getSparePartCategories, createSparePartCategory, updateSparePartCategory, deleteSparePartCategory } from '../services/master.service';

const { Title, Text } = Typography;

const MasterSparePartTypes = () => {
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
      const resData = await getSparePartCategories(params);
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
        categoryCode: record.categoryCode,
        categoryName: record.categoryName,
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
        await updateSparePartCategory(editingRecord.id, values);
        message.success('Record updated successfully');
      } else {
        await createSparePartCategory(values);
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
      await deleteSparePartCategory(recordToDelete.id);
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
    { title: 'Part List Number', dataIndex: 'categoryCode', key: 'categoryCode', sorter: (a, b) => a.categoryCode.localeCompare(b.categoryCode) },
    { title: 'Name', dataIndex: 'categoryName', key: 'categoryName' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
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
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Master Type Spare Part</Title>
          <Text type="secondary">Manage top-level spare part categorization</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()} className="bg-blue-600 shadow-sm">
          Add Type
        </Button>
      </div>

      <div className="overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-3">
          <Input placeholder="Search by Code or Name..." prefix={<SearchOutlined className="text-gray-400" />} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-80 rounded-md" allowClear />
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

      <Modal title={editingRecord ? "Edit Type Spare Part" : "Add Type Spare Part"} open={isModalVisible} onOk={() => form.submit()} onCancel={handleCancel} okText={editingRecord ? "Update" : "Create"} centered>
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">
          <Form.Item name="categoryCode" label="Category Part List Number" rules={[{ required: true, message: 'Code is required' }]}>
            <Input placeholder="MEC" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item name="categoryName" label="Category Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Mechanical" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description..." />
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
            <span>Permanently Delete Spare Part Type?</span>
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
            <p>This action will permanently remove <b>{recordToDelete.categoryName}</b> from the database.</p>
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

export default MasterSparePartTypes;


import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Popconfirm,
  message, Space, Typography, Tag, Select, Card
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ShopOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { getVendors, createVendor, updateVendor, deleteVendor } from '../services/master.service';
import usePermissions from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option } = Select;

const MasterVendors = () => {
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
      const resData = await getVendors(params);
      setData(resData);
    } catch (error) {
      console.error(error);
      message.error('Failed to load vendor data');
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
        vendorCode: record.vendorCode,
        vendorName: record.vendorName,
        email: record.email,
        phone: record.phone,
        address: record.address,
        contactPerson: record.contactPerson,
        country: record.country,
        active: record.active,
        supplyCategory: record.supplyCategory,
        productService: record.productService,
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
        await updateVendor(editingRecord.id, values);
        message.success('Vendor updated successfully');
      } else {
        await createVendor(values);
        message.success('Vendor added successfully');
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      fetchData();
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.error || 'Failed to save vendor data');
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
      await deleteVendor(recordToDelete.id);
      message.success('Vendor deleted successfully');
      setDeleteModalVisible(false);
      setRecordToDelete(null);
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to delete vendor (might be in use)');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      title: 'Vendor Code',
      dataIndex: 'vendorCode',
      key: 'vendorCode',
      sorter: (a, b) => a.vendorCode.localeCompare(b.vendorCode),
      render: (val) => (
        <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          {val}
        </span>
      ),
    },
    {
      title: 'Vendor Name',
      dataIndex: 'vendorName',
      key: 'vendorName',
      sorter: (a, b) => a.vendorName.localeCompare(b.vendorName),
    },
    {
      title: 'Supply Category',
      dataIndex: 'supplyCategory',
      key: 'supplyCategory',
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Product & Service',
      dataIndex: 'productService',
      key: 'productService',
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Contact Person',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      render: (val) => val || <Text type="secondary">-</Text>,
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
      title: 'Supply Category',
      dataIndex: 'supplyCategory',
      key: 'supplyCategory',
      render: (val) => val || <Text type="secondary">-</Text>,
    },
    {
      title: 'Product & Service',
      dataIndex: 'productService',
      key: 'productService',
      render: (val) => val || <Text type="secondary">-</Text>,
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
    <Card className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
            Master Vendors
          </Title>
          <Text type="secondary">Manage company vendor / supplier master data</Text>
        </div>
        {permissions.canEditMaster && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
            className="bg-blue-600 shadow-sm"
          >
            Add Vendor
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden">
        <div className="mb-3">
          <Input
            placeholder="Search by code, name, contact person, or country..."
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
            className='!mt-3'
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
      </div>

      {/* Modal Form */}
      <Modal
        title={
          <span className="flex items-center gap-2">
            <ShopOutlined />
            {editingRecord ? 'Edit Vendor' : 'Add New Vendor'}
          </span>
        }
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        okText={editingRecord ? 'Update' : 'Save'}
        cancelText="Cancel"
        centered
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              name="vendorCode"
              label="Vendor Code"
              rules={[{ required: true, message: 'Vendor code is required' }]}
            >
              <Input placeholder="VND-001" disabled={!!editingRecord} />
            </Form.Item>

            <Form.Item
              name="vendorName"
              label="Vendor Name"
              rules={[{ required: true, message: 'Vendor name is required' }]}
            >
              <Input placeholder="PT. Contoh Supplier" />
            </Form.Item>

            <Form.Item name="email" label="Email">
              <Input placeholder="vendor@email.com" />
            </Form.Item>

            <Form.Item name="phone" label="Phone Number">
              <Input placeholder="+62 21 1234 5678" />
            </Form.Item>

            <Form.Item name="contactPerson" label="Contact Person">
              <Input placeholder="PIC Name" />
            </Form.Item>

            <Form.Item name="country" label="Country">
              <Input placeholder="Indonesia" />
            </Form.Item>

            <Form.Item name="supplyCategory" label="Supply Category">
              <Select placeholder="Select supply category...">
                <Option value="producer/manufacture">Producer / Manufacture</Option>
                <Option value="distributor">Distributor</Option>
                <Option value="agent/outlet">Agent / Outlet</Option>
                <Option value="laboratorium/inspection/certification">Laboratorium / Inspection / Certification</Option>
                <Option value="manpower supply">Manpower Supply</Option>
                <Option value="service/maintenance">Service / Maintenance</Option>
                <Option value="forwarder/transporter">Forwarder / Transporter</Option>
                <Option value="other">Other</Option>
              </Select>
            </Form.Item>

            <Form.Item name="productService" label="Product & Service">
              <Input placeholder="E.g. Mechanical Spareparts, Calibration Service" />
            </Form.Item>
          </div>

          <Form.Item name="address" label="Address">
            <Input.TextArea rows={3} placeholder="Jl. Industri No. 1, City..." />
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
            <span>Permanently Delete Vendor?</span>
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
            <p>This action will permanently remove <b>{recordToDelete.vendorName}</b> from the database.</p>
            <p className="text-gray-500 mt-2">
              Deleting master data might cause errors if this data is referenced by other records (e.g., Purchase Orders).<br />
              <b>Recommendation:</b> Set the status to <b>Inactive</b> instead.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default MasterVendors;


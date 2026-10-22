import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message, Space, Typography, Tag, Select, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getSparePartCategories, getSpareParts, createSparePart, updateSparePart, deleteSparePart, getVendors } from '../services/master.service';

const { Title, Text } = Typography;
const { Option } = Select;

const MasterSpareParts = () => {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
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
      const resData = await getSparePartCategories({ active: true });
      setCategories(resData);
    } catch (error) {
      console.error(error);
      message.error('Failed to load categories');
    }
  };

  const fetchVendors = async () => {
    try {
      const resData = await getVendors({ active: true });
      setVendors(resData);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.categoryId = categoryFilter;

      const resData = await getSpareParts(params);
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
    fetchVendors();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchData(); }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, categoryFilter]);

  const showModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue({
        partCode: record.partCode,
        partName: record.partName,
        categoryId: record.categoryId,
        drawingNumber: record.drawingNumber,
        brand: record.brand,
        model: record.model,
        specification: record.specification,
        description: record.description,
        uom: record.uom,
        standardPrice: record.standardPrice,
        estimatedPrice: record.estimatedPrice,
        currency: record.currency,
        leadTimeDays: record.leadTimeDays,
        stockQty: record.stockQty,
        minStock: record.minStock,
        warehouseLocation: record.warehouseLocation,
        supplierName: record.supplierName,
        countryOfOrigin: record.countryOfOrigin,
        weightKg: record.weightKg,
        dimensions: record.dimensions,
        active: record.active,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        active: true,
        standardPrice: 0,
        estimatedPrice: null,
        leadTimeDays: 0,
        stockQty: 0,
        minStock: 0,
        weightKg: 0,
        currency: 'IDR',
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
        await updateSparePart(editingRecord.id, values);
        message.success('Record updated successfully');
      } else {
        await createSparePart(values);
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
      await deleteSparePart(recordToDelete.id);
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
    { title: 'Code', dataIndex: 'partCode', key: 'partCode', sorter: (a, b) => a.partCode.localeCompare(b.partCode) },
    { title: 'Part Name', dataIndex: 'partName', key: 'partName' },
    { title: 'Category', dataIndex: ['category', 'categoryName'], key: 'categoryId' },
    { title: 'Brand', dataIndex: 'brand', key: 'brand' },
    { title: 'Stock Qty', key: 'stockQty', render: (_, record) => `${record.stockQty} ${record.uom}` },
    {
      title: 'Std. Price',
      key: 'standardPrice',
      align: 'right',
      render: (_, r) => r.standardPrice
        ? <span className="text-sm">{r.currency} {parseFloat(r.standardPrice).toLocaleString('en-US')}</span>
        : '-'
    },
    {
      title: 'Est. Price',
      key: 'estimatedPrice',
      align: 'right',
      render: (_, r) => r.estimatedPrice
        ? <span className="text-sm font-medium text-blue-700">{r.currency} {parseFloat(r.estimatedPrice).toLocaleString('en-US')}</span>
        : <span className="text-gray-400 text-xs">-</span>
    },
    { title: 'Location', dataIndex: 'warehouseLocation', key: 'warehouseLocation' },
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
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Master Spare Part</Title>
          <Text type="secondary">Manage detailed part inventory tracking profiles</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()} className="bg-blue-600 shadow-sm">
          Add Spare Part
        </Button>
      </div>

      <div className="overflow-hidden">
        <div className="mb-3">
          <Input placeholder="Search Code, Name, or Brand..." prefix={<SearchOutlined className="text-gray-400" />} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-80 rounded-md" allowClear />
          <div className="mt-3">
            <Select placeholder="All Categories" style={{ width: 220 }} allowClear value={categoryFilter} onChange={setCategoryFilter}>
              {categories.map(cat => (
                <Option key={cat.id} value={cat.id}>
                  {cat.categoryName}{cat.categoryCode ? ` - ${cat.categoryCode}` : ''}
                </Option>
              ))}
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

      <Modal width={1000} title={editingRecord ? "Edit Spare Part" : "Add Spare Part"} open={isModalVisible} onOk={() => form.submit()} onCancel={handleCancel} okText={editingRecord ? "Update" : "Create"} centered>
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4 grid grid-cols-3 gap-x-4">
          <Form.Item className="col-span-1" name="partCode" label="Part Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="SPP-MEC-100" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item className="col-span-1" name="partName" label="Part Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Bearing" />
          </Form.Item>
          <Form.Item className="col-span-1" name="categoryId" label="Category" rules={[{ required: true, message: 'Required' }]}>
            <Select placeholder="Select a Category">
              {categories.map(cat => (
                <Option key={cat.id} value={cat.id}>
                  {cat.categoryName}{cat.categoryCode ? ` - ${cat.categoryCode}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item className="col-span-1" name="drawingNumber" label="Drawing Number">
            <Input placeholder="DWG-001" />
          </Form.Item>
          <Form.Item className="col-span-1" name="brand" label="Brand">
            <Input placeholder="SKF" />
          </Form.Item>

          <Form.Item className="col-span-1" name="model" label="Model">
            <Input placeholder="Model XYZ" />
          </Form.Item>
          <Form.Item className="col-span-1" name="supplierName" label="Supplier">
            <Select
              showSearch
              allowClear
              placeholder="Select vendor..."
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={vendors.map(v => ({ value: v.vendorName, label: v.vendorName }))}
            />
          </Form.Item>
          <Form.Item className="col-span-1" name="countryOfOrigin" label="Origin Country">
            <Input placeholder="Germany" />
          </Form.Item>

          {/* Texts */}
          <Form.Item className="col-span-3" name="specification" label="Specification">
            <Input.TextArea rows={2} placeholder="Dimensions, alloys, sizes..." />
          </Form.Item>

          {/* Inventory and Dimensions */}
          <Form.Item className="col-span-1" name="uom" label="UOM (Unit of Measure)" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="pcs / kg / unit" />
          </Form.Item>
          <Form.Item className="col-span-1" name="stockQty" label="Stock Qty">
            <InputNumber className="!w-full" min={0} stringMode />
          </Form.Item>
          <Form.Item className="col-span-1" name="minStock" label="Minimum Stock">
            <InputNumber className="!w-full" min={0} stringMode />
          </Form.Item>

          <Form.Item className="col-span-1" name="weightKg" label="Weight (kg)">
            <InputNumber className="!w-full" min={0} step={0.1} stringMode />
          </Form.Item>
          <Form.Item className="col-span-1" name="dimensions" label="Dimensions (L x W x H) (m³)">
            <Input placeholder="200 x 150 x 100" />
          </Form.Item>
          <Form.Item className="col-span-1" name="warehouseLocation" label="Warehouse Loc.">
            <Input placeholder="Row B Shelf 4" />
          </Form.Item>
          <Form.Item className="col-span-1" name="leadTimeDays" label="Lead Time (Days)">
            <InputNumber className="!w-full" min={0} />
          </Form.Item>

          <Form.Item className="col-span-1" name="standardPrice" label="Standard Price">
            <InputNumber className="!w-full" min={0} stringMode
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/,/g, '')}
            />
          </Form.Item>
          <Form.Item className="col-span-1" name="estimatedPrice" label="Estimated Price / unit">
            <InputNumber className="!w-full" min={0} stringMode
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/,/g, '')}
              placeholder="Market price estimate"
            />
          </Form.Item>
          <Form.Item className="col-span-1" name="currency" label="Currency">
            <Select>
              <Option value="IDR">IDR</Option>
              <Option value="USD">USD</Option>
              <Option value="EUR">EUR</Option>
            </Select>
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
            <span>Permanently Delete Spare Part?</span>
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
            <p>This action will permanently remove <b>{recordToDelete.partName}</b> from the database.</p>
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

export default MasterSpareParts;


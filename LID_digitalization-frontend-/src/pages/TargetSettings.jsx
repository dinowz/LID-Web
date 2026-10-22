import React, { useRef, useState } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Modal, Form, InputNumber, message, Tag, Button, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getTargets, upsertTarget, deleteTarget } from '../services/target.service';
import api from '../api/axiosClient';

export default function TargetSettings() {
  const actionRef = useRef();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [roles, setRoles] = useState([]);

  React.useEffect(() => {
    api.get('/admin/master/divisions')
      .then(r => {
        const uniqueRoles = [...new Set(r.data.map(d => d.title).filter(Boolean))];
        setRoles(uniqueRoles.map(role => ({ value: role, label: role })));
      })
      .catch(console.error);
  }, []);

  const handleOpenCreate = () => {
    setEditRecord(null);
    form.resetFields();
    form.setFieldsValue({
      year: new Date().getFullYear(),
      target: 0,
      targetSparepart: 0,
      targetService: 0,
      targetProject: 0,
      exchangeRateUsd: 15000,
      exchangeRateEur: 16500,
      roleTargetsList: []
    });
    setModalVisible(true);
  };

  const handleOpenEdit = (record) => {
    setEditRecord(record);
    const roleTargetsList = record.roleTargets ? Object.entries(record.roleTargets).map(([role, days]) => ({ role, days })) : [];
    form.setFieldsValue({
      year: record.year,
      target: record.target,
      targetSparepart: record.targetSparepart || 0,
      targetService: record.targetService || 0,
      targetProject: record.targetProject || 0,
      exchangeRateUsd: record.exchangeRateUsd || 15000,
      exchangeRateEur: record.exchangeRateEur || 16500,
      roleTargetsList
    });
    setModalVisible(true);
  };

  const handleModuleTargetChange = () => {
    const sp = Number(form.getFieldValue('targetSparepart') || 0);
    const sv = Number(form.getFieldValue('targetService') || 0);
    const pr = Number(form.getFieldValue('targetProject') || 0);
    form.setFieldsValue({ target: sp + sv + pr });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const roleTargets = {};
      if (values.roleTargetsList) {
        values.roleTargetsList.forEach(item => {
          if (item && item.role) {
            roleTargets[item.role] = item.days;
          }
        });
      }
      const payload = { ...values, roleTargets };
      await upsertTarget(payload);
      message.success(editRecord ? 'Target updated successfully' : 'Target created successfully');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (err) {
      if (err.errorFields) return;
      message.error('Failed to save target');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record) => {
    setRecordToDelete(record);
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    if (!recordToDelete) return;
    setDeleting(true);
    try {
      await deleteTarget(recordToDelete.id);
      message.success('Target deleted');
      setDeleteModalVisible(false);
      setRecordToDelete(null);
      actionRef.current?.reload();
    } catch {
      message.error('Failed to delete target');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      search: false,
      render: (year) => <Tag color="blue" className="font-bold text-sm px-3 py-0.5">{year}</Tag>
    },
    {
      title: 'Module Target Breakdown (IDR)',
      key: 'moduleBreakdown',
      search: false,
      render: (_, record) => (
        <div className="flex flex-col text-xs space-y-0.5">
          <span><strong className="text-emerald-700">Sparepart:</strong> Rp {Number(record.targetSparepart || 0).toLocaleString('id-ID')}</span>
          <span><strong className="text-blue-700">Service:</strong> Rp {Number(record.targetService || 0).toLocaleString('id-ID')}</span>
          <span><strong className="text-purple-700">Project:</strong> Rp {Number(record.targetProject || 0).toLocaleString('id-ID')}</span>
        </div>
      )
    },
    {
      title: 'Total Target (IDR)',
      dataIndex: 'target',
      key: 'target',
      search: false,
      render: (val) => (
        <span className="font-semibold text-indigo-600 text-sm">
          Rp {Number(val).toLocaleString('id-ID')}
        </span>
      )
    },
    {
      title: 'Global Exchange Rate',
      key: 'exchangeRate',
      search: false,
      render: (_, record) => (
        <div className="flex flex-col text-xs text-gray-500">
          <span>USD: Rp {Number(record.exchangeRateUsd || 15000).toLocaleString('id-ID')}</span>
          <span>EUR: Rp {Number(record.exchangeRateEur || 16500).toLocaleString('id-ID')}</span>
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      search: false,
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
            className="text-blue-600"
          >
            Edit
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <ProTable
        headerTitle="Pipeline Target Settings"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        style={{ width: '100%' }}
        scroll={{ x: 'max-content' }}
        search={false}
        request={async () => {
          try {
            const data = await getTargets();
            return { data, success: true };
          } catch {
            return { data: [], success: false };
          }
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
          >
            Add Target Year
          </Button>
        ]}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['10', '15', '20', '50', '100']
        }}
      />

      <Modal
        title={editRecord ? `Edit Target ${editRecord.year}` : 'Add New Target Year'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        confirmLoading={saving}
        okText="Save"
        width={520}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="year"
            label="Year"
            rules={[{ required: true, message: 'Please input the year' }]}
          >
            <InputNumber
              min={2020}
              max={2100}
              className="!w-full"
              disabled={!!editRecord}
              placeholder="e.g. 2026"
            />
          </Form.Item>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4 border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Annual Module Nominal Targets (IDR)
            </p>

            <Form.Item
              name="targetSparepart"
              label="Target Sparepart (IDR)"
              className="mb-2"
            >
              <InputNumber
                min={0}
                className="!w-full font-semibold"
                placeholder="e.g. 1500000000"
                formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value?.replace(/\Rp\s?|(,*)/g, '')}
                controls={false}
                onChange={handleModuleTargetChange}
              />
            </Form.Item>

            <Form.Item
              name="targetService"
              label="Target Service (IDR)"
              className="mb-2"
            >
              <InputNumber
                min={0}
                className="!w-full font-semibold"
                placeholder="e.g. 1500000000"
                formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value?.replace(/\Rp\s?|(,*)/g, '')}
                controls={false}
                onChange={handleModuleTargetChange}
              />
            </Form.Item>

            <Form.Item
              name="targetProject"
              label="Target Project (IDR)"
              className="mb-2"
            >
              <InputNumber
                min={0}
                className="!w-full font-semibold"
                placeholder="e.g. 2000000000"
                formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value?.replace(/\Rp\s?|(,*)/g, '')}
                controls={false}
                onChange={handleModuleTargetChange}
              />
            </Form.Item>

            <Form.Item
              name="target"
              label="Total Nominal Target (IDR)"
              className="mb-0 pt-2 border-t border-gray-200"
              rules={[{ required: true, message: 'Please input total target nominal' }]}
            >
              <InputNumber
                min={0}
                className="!w-full font-bold text-indigo-700"
                placeholder="Calculated automatically or enter total"
                formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value?.replace(/\Rp\s?|(,*)/g, '')}
                controls={false}
              />
            </Form.Item>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Global Exchange Rates
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="exchangeRateUsd" label="USD to IDR" initialValue={15000} className="mb-0">
                <InputNumber
                  min={0}
                  className="!w-full font-semibold"
                  formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/\Rp\s?|(,*)/g, '')}
                  controls={false}
                />
              </Form.Item>

              <Form.Item name="exchangeRateEur" label="EUR to IDR" initialValue={16500} className="mb-0">
                <InputNumber
                  min={0}
                  className="!w-full font-semibold"
                  formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/\Rp\s?|(,*)/g, '')}
                  controls={false}
                />
              </Form.Item>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 mt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Target Personnel (Days / Year)
            </p>
            <Form.List name="roleTargetsList">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} className="flex gap-2 items-start mb-2">
                      <Form.Item
                        {...restField}
                        name={[name, 'role']}
                        rules={[{ required: true, message: 'Missing role' }]}
                        className="mb-0 flex-1"
                      >
                        <Select
                          showSearch
                          placeholder="Select Role"
                          options={roles}
                          filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'days']}
                        rules={[{ required: true, message: 'Missing days' }]}
                        className="mb-0 w-32"
                      >
                        <InputNumber placeholder="Days" min={1} className="w-full" />
                      </Form.Item>
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                    </div>
                  ))}
                  <Form.Item className="mb-0 mt-2">
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Role Target
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </div>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 text-red-500">
            <ExclamationCircleOutlined />
            <span>Delete Target</span>
          </div>
        }
        open={deleteModalVisible}
        onOk={executeDelete}
        confirmLoading={deleting}
        onCancel={() => {
          setDeleteModalVisible(false);
          setRecordToDelete(null);
        }}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        centered
      >
        {recordToDelete && (
          <p>Are you sure you want to delete target for year {recordToDelete.year}?</p>
        )}
      </Modal>
    </>
  );
}

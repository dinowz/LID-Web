import React, { useState, useEffect } from 'react';
import { Card, Typography, Tag, Table, Divider, Spin, Button, message, Timeline, Space, Modal, Form, Input, Select, Alert } from 'antd';
import { FormOutlined, ArrowLeftOutlined, EditOutlined, FileExcelOutlined, PlusCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getInquiryById, exportInquiryExcel } from '../../../services/inquiry.service';
import { getSpareParts, getSparePartCategories, createSparePart } from '../../../services/master.service';
import usePermissions from '../../../hooks/usePermissions';
import WorkflowHistory from '../../../components/WorkflowHistory';

const { Title, Text } = Typography;
const { Option } = Select;

const InquiryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = usePermissions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // State untuk master data sparepart & kategori
  const [spareParts, setSpareParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [registerForm] = Form.useForm();

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [result, parts, cats] = await Promise.all([
          getInquiryById(id),
          getSpareParts({ active: true }).catch(() => []),
          getSparePartCategories({ active: true }).catch(() => [])
        ]);
        setData(result);
        setSpareParts(parts || []);
        setCategories(cats || []);
      } catch (err) {
        message.error('Failed to load inquiry detail');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const handleExportExcel = async () => {
    try {
      await exportInquiryExcel(id, `Inquiry_${data?.inquiryNumber}_Items.xlsx`);
    } catch (err) {
      message.error('Gagal mengunduh file Excel');
      console.error(err);
    }
  };

  // Helper: cari sparepart di master berdasarkan requestedPartNumber
  const findMasterPart = (item) => {
    const pn = item?.requestedPartNumber?.trim().toLowerCase();
    if (!pn || pn === '-') return null;
    return spareParts.find(sp => sp.partCode?.trim().toLowerCase() === pn);
  };

  const handleOpenRegisterModal = (item) => {
    setSelectedItem(item);
    registerForm.resetFields();
    registerForm.setFieldsValue({
      partCode: item.requestedPartNumber && item.requestedPartNumber !== '-' ? item.requestedPartNumber.trim() : '',
      partName: item.requestedItemName ? item.requestedItemName.trim() : '',
      uom: item.uom ? item.uom.trim().toUpperCase() : 'PCS',
      categoryId: undefined,
    });
    setIsRegisterModalOpen(true);
  };

  const handleRegisterSubmit = async () => {
    try {
      const values = await registerForm.validateFields();
      setRegistering(true);

      const payload = {
        partCode: values.partCode.trim(),
        partName: values.partName.trim(),
        uom: values.uom ? values.uom.trim().toUpperCase() : 'PCS',
        categoryId: values.categoryId,
        active: true,
      };

      const newPart = await createSparePart(payload);
      message.success(`Part "${newPart.partCode}" berhasil didaftarkan ke Master Sparepart!`);

      // Update state spareParts lokal agar badge langsung berubah jadi [In Master]
      setSpareParts(prev => [newPart, ...prev]);
      setIsRegisterModalOpen(false);
    } catch (err) {
      if (err.errorFields) return; // Form validation error
      message.error(err.response?.data?.error || err.message || 'Gagal mendaftarkan sparepart ke master');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Spin size="large" /></div>;
  if (!data) return <div className="p-10 text-center">Inquiry not found</div>;

  const itemColumns = [
    { title: 'Type', dataIndex: 'itemType', key: 'itemType' },
    {
      title: 'Requested Name', dataIndex: 'requestedItemName', key: 'requestedItemName',
      render: (t, r) => (
        <div>
          <Text strong>{t}</Text>
          {r.requestDescription && <p className="text-xs text-gray-500 m-0">{r.requestDescription}</p>}
        </div>
      )
    },
    { title: 'Requested PN', dataIndex: 'requestedPartNumber', key: 'requestedPartNumber' },
    { title: 'Qty', key: 'qty', render: (t, r) => `${r.qty} ${r.uom || ''}` },
    {
      title: 'Master Status',
      key: 'masterStatus',
      render: (_, r) => {
        if (r.itemType !== 'SPARE_PART') return <Tag color="default">-</Tag>;
        const matched = findMasterPart(r);
        if (matched) {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              In Master
            </Tag>
          );
        }
        return (
          <Tag color="orange" icon={<ExclamationCircleOutlined />}>
            Not in Master
          </Tag>
        );
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => {
        if (r.itemType !== 'SPARE_PART') return '-';
        const matched = findMasterPart(r);
        if (matched) {
          return (
            <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded font-mono">
              {matched.partCode}
            </span>
          );
        }
        return (
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusCircleOutlined />}
            onClick={() => handleOpenRegisterModal(r)}
          >
            Save to Master
          </Button>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inquiries')} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1f2937' }}>{data.inquiryNumber}</Title>
            <Text type="secondary">{data.subject}</Text>
          </div>
        </Space>
        <Space wrap>
          <Tag color="purple" style={{ padding: '4px 12px', fontSize: '14px' }}>{data.statusCode}</Tag>

          <Button
            type="primary"
            style={{ backgroundColor: '#107c41', borderColor: '#107c41' }}
            icon={<FileExcelOutlined />}
            onClick={handleExportExcel}
          >
            Export Excel
          </Button>

          {new URLSearchParams(location.search).get('mode') === 'edit' && permissions.canEditInquiry && (
            <Button
              type="default"
              icon={<EditOutlined />}
              disabled={data.statusCode === 'CONVERTED'}
              onClick={() => navigate(`/inquiries/${id}/edit`)}
            >
              Edit Inquiry
            </Button>
          )}
          {new URLSearchParams(location.search).get('mode') === 'edit' && permissions.canEditQuotation && (
            <Button type="primary" icon={<FormOutlined />} disabled={data.statusCode === 'CONVERTED'} onClick={() => navigate(`/quotations/create-from-inquiry/${id}`)}>
              Create Quotation
            </Button>
          )}
        </Space>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-xl shadow-sm border-gray-100">
          <Title level={5}>General Information</Title>
          <Divider className="my-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <Text type="secondary" className="block text-xs">Customer</Text>
              <div className="flex items-center gap-2">
                <Text strong>{data.customer?.name || <span className="text-gray-400">-</span>}</Text>
                {data.customer && (
                  <Tag color={data.customer.customerType === 'FOREIGN' ? 'gold' : 'blue'} className="text-[10px] leading-4">
                    {data.customer.customerType}
                  </Tag>
                )}
              </div>
            </div>
            <div>
              <Text type="secondary" className="block text-xs">Code Word</Text>
              <Text>
                {data.codeWord
                  ? <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{data.codeWord.code}</span>
                  : <span className="text-gray-400">-</span>
                }
              </Text>
            </div>
            <div>
              <Text type="secondary" className="block text-xs">Source</Text>
              <Text>{data.sourceCode || '-'}</Text>
            </div>
            <div>
              <Text type="secondary" className="block text-xs">Request Type</Text>
              <Text>{data.requestType}</Text>
            </div>
            <div>
              <Text type="secondary" className="block text-xs">Inquiry Date</Text>
              <Text>{new Date(data.inquiryDate).toLocaleDateString()}</Text>
            </div>
            <div className="sm:col-span-2">
              <Text type="secondary" className="block text-xs">Description</Text>
              <Text>{data.description || '-'}</Text>
            </div>
          </div>

          <Title level={5} className="mt-8">Requested Items</Title>
          <Table columns={itemColumns} dataSource={data.details} pagination={false} rowKey="id" className="mt-3" scroll={{ x: 'max-content' }} />
        </Card>

        <div className="lg:col-span-1">
          <WorkflowHistory
            histories={(data.histories || []).map(h => ({ ...h, type: 'INQUIRY' }))}
          />
        </div>
      </div>

      {/* Modal Daftarkan ke Master Data Sparepart */}
      <Modal
        title={
          <Space>
            <PlusCircleOutlined className="text-blue-600" />
            <span className="font-semibold text-gray-800">Daftarkan Item ke Master Data Sparepart</span>
          </Space>
        }
        open={isRegisterModalOpen}
        onOk={handleRegisterSubmit}
        onCancel={() => setIsRegisterModalOpen(false)}
        confirmLoading={registering}
        okText="Simpan ke Master"
        cancelText="Batal"
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          className="mb-4 text-xs"
          message="Item ini akan otomatis tersimpan ke Master Data Sparepart dan siap digunakan saat pembuatan penawaran harga (Quotation)."
        />

        <Form form={registerForm} layout="vertical">
          <Form.Item
            name="partCode"
            label="Part Number (MatNr)"
            rules={[
              { required: true, message: 'Part Number (MatNr) wajib diisi' },
              { whitespace: true, message: 'Part Number tidak boleh hanya spasi' }
            ]}
          >
            <Input placeholder="e.g. MTR-15KW-001 / BRG-6204-ZZ" />
          </Form.Item>

          <Form.Item
            name="partName"
            label="Part Name"
            rules={[
              { required: true, message: 'Nama Part wajib diisi' },
              { whitespace: true, message: 'Nama Part tidak boleh hanya spasi' }
            ]}
          >
            <Input placeholder="e.g. Bearing 6204-ZZ" />
          </Form.Item>

          <Form.Item
            name="uom"
            label="Satuan (UOM)"
            rules={[{ required: true, message: 'Satuan (UOM) wajib diisi' }]}
          >
            <Input placeholder="PCS" />
          </Form.Item>

          <Form.Item
            name="categoryId"
            label="Kategori Spare Part"
            rules={[{ required: true, message: 'Pilih kategori spare part' }]}
          >
            <Select
              showSearch
              placeholder="Cari atau pilih Kategori (e.g. BEARING, VALVE)..."
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map(c => ({
                value: c.id,
                label: `[${c.categoryCode}] ${c.categoryName}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InquiryDetail;

import React, { useState, useMemo } from 'react';
import { Modal, Table, Typography, Space, Button, message, Input, Row, Col, Alert, Tag } from 'antd';
import { BranchesOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { splitDelivery } from '../../../services/delivery.service';

const { Text } = Typography;

const SplitDeliveryModal = ({ visible, onClose, delivery, onSuccess }) => {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [splitting, setSplitting] = useState(false);

  if (!delivery) return null;

  const allItems = delivery.items || [];

  // Quotation & Inquiry details mapping
  const qDetails = useMemo(() => delivery?.purchaseOrder?.quotation?.details || [], [delivery]);
  const iDetails = useMemo(() => delivery?.purchaseOrder?.quotation?.inquiry?.details || [], [delivery]);

  const getItemDescription = (item) => {
    const pd = item.poDetail;
    let description = pd?.service?.serviceName || pd?.sparePart?.partName || 'Item';
    let partNumber = pd?.sparePart?.partNumber || pd?.sparePart?.partCode || null;

    if (pd?.quotationDetailId) {
      const qd = qDetails.find(q => String(q.id) === String(pd.quotationDetailId));
      if (qd) {
        if (qd.sparePart?.partCode) partNumber = qd.sparePart.partCode;
        if (qd.inquiryDetailId) {
          const idet = iDetails.find(i => String(i.id) === String(qd.inquiryDetailId));
          if (idet) {
            description = idet.requestedItemName || idet.requestDescription || description;
            if (idet.requestedPartNumber) partNumber = idet.requestedPartNumber;
          }
        }
      }
    }
    return { description, partNumber };
  };

  const selectedItems = allItems.filter(it => selectedRowKeys.includes(it.id));
  const remainingItems = allItems.filter(it => !selectedRowKeys.includes(it.id));

  const isFormValid = selectedRowKeys.length > 0 && selectedRowKeys.length < allItems.length;

  const handleConfirmSplit = async () => {
    if (!isFormValid) {
      return message.warning('Pilih minimal 1 item untuk dipindah dan sisakan minimal 1 item di Delivery saat ini.');
    }

    setSplitting(true);
    try {
      const result = await splitDelivery(delivery.id, {
        deliveryItemIds: selectedRowKeys,
        remarks: remarks.trim() || undefined
      });

      message.success('Delivery berhasil dipecah!');
      onClose();

      Modal.confirm({
        title: 'Delivery Berhasil Di-split!',
        icon: <CheckCircleOutlined className="text-green-500" />,
        content: (
          <div>
            <p>
              Sebanyak <strong>{selectedItems.length} item</strong> telah dipindahkan ke Delivery Baru{' '}
              <strong>#{result.newDeliveryNumber || result.newDeliveryId}</strong>.
            </p>
            <p className="text-xs text-gray-500">
              Apakah Anda ingin membuka halaman Delivery Baru tersebut sekarang?
            </p>
          </div>
        ),
        okText: 'Buka Delivery Baru',
        cancelText: 'Tetap di Delivery Ini',
        okButtonProps: { className: 'bg-primary-600' },
        onOk: () => {
          navigate(`/deliveries/${result.newDeliveryId}`);
        },
        onCancel: () => {
          if (onSuccess) onSuccess(result);
        }
      });
    } catch (err) {
      message.error(err?.response?.data?.error || 'Gagal memecah Delivery');
    } finally {
      setSplitting(false);
    }
  };

  const columns = [
    {
      title: 'Item / Part Description',
      key: 'desc',
      render: (_, r) => {
        const { description, partNumber } = getItemDescription(r);
        return (
          <div>
            <div className="font-semibold text-gray-800 text-sm">
              {description}
            </div>
            {partNumber && (
              <div className="text-xs text-gray-500">P/N: {partNumber}</div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Qty Pengiriman',
      key: 'qty',
      width: 130,
      align: 'center',
      render: (_, r) => {
        const qty = parseFloat(r.qtyDelivered || r.poDetail?.qty || 0);
        const uom = r.poDetail?.sparePart?.uom || 'PCS';
        return (
          <span className="font-semibold">
            {qty} {uom}
          </span>
        );
      }
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  return (
    <Modal
      title={
        <Space>
          <BranchesOutlined className="text-amber-500 text-lg" />
          <span>Split Delivery #{delivery.deliveryNumber || delivery.id}</span>
        </Space>
      }
      open={visible}
      onCancel={() => {
        setSelectedRowKeys([]);
        setRemarks('');
        onClose();
      }}
      width={750}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={splitting}>
          Batal
        </Button>,
        <Button
          key="confirm"
          type="primary"
          icon={<BranchesOutlined />}
          onClick={handleConfirmSplit}
          loading={splitting}
          disabled={!isFormValid}
          className="bg-amber-600 hover:bg-amber-700 border-amber-600"
        >
          Konfirmasi Split Delivery
        </Button>
      ]}
    >
      <div className="space-y-4">
        <Alert
          message="Petunjuk Pemisahan Delivery (Split Delivery)"
          description="Centang item yang ingin dipindahkan ke pengiriman baru. Sisakan minimal 1 item di pengiriman saat ini. Setiap Delivery hasil pemisahan akan memiliki nomor pengiriman (Delivery Number), nomor resi, jadwal forwarder, dan bukti tanda terima (POD) sendiri."
          type="info"
          showIcon
          className="rounded-lg"
        />

        {/* Table of items with Checkbox selection */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={allItems}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </div>

        {/* Live Calculation / Count Preview */}
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
              <div className="text-xs font-semibold text-blue-900 mb-1 flex items-center justify-between">
                <span>Delivery Saat Ini (Sisa):</span>
                <Tag color="blue">{remainingItems.length} Item</Tag>
              </div>
              <div className="text-sm text-blue-800">
                {remainingItems.length > 0 ? (
                  <span>Akan tetap berada di pengiriman #{delivery.deliveryNumber || delivery.id}</span>
                ) : (
                  <span className="text-red-600 font-medium">Harus menyisakan minimal 1 item</span>
                )}
              </div>
            </div>
          </Col>

          <Col span={12}>
            <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl">
              <div className="text-xs font-semibold text-amber-900 mb-1 flex items-center justify-between">
                <span>Delivery Baru (Hasil split):</span>
                <Tag color="gold">{selectedItems.length} Item</Tag>
              </div>
              <div className="text-sm text-amber-800">
                {selectedItems.length > 0 ? (
                  <span>Akan dipindahkan ke Delivery Baru</span>
                ) : (
                  <span className="text-gray-500 italic">Belum ada item dipilih</span>
                )}
              </div>
            </div>
          </Col>
        </Row>

        {/* Remarks Input */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
          <span className="block text-xs font-semibold text-gray-700">
            Catatan Pemisahan Pengiriman (Opsional)
          </span>
          <Input.TextArea
            rows={2}
            placeholder="e.g. Dipisah karena pengiriman batch 2 menunggu konfirmasi ekspedisi darat"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            disabled={splitting}
          />
        </div>

        {selectedRowKeys.length === allItems.length && allItems.length > 0 && (
          <Alert
            message="Peringatan"
            description="Tidak bisa memindahkan seluruh item. Sisakan minimal 1 item di pengiriman saat ini."
            type="warning"
            showIcon
          />
        )}
      </div>
    </Modal>
  );
};

export default SplitDeliveryModal;

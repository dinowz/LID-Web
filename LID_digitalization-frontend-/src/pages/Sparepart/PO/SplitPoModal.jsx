import React, { useState, useMemo } from 'react';
import { Modal, Table, Typography, Space, Button, message, Input, Row, Col, Alert, Tag } from 'antd';
import { BranchesOutlined, ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { splitPO } from '../../../services/po.service';

const { Text, Title } = Typography;

const SplitPoModal = ({ visible, onClose, po, onSuccess }) => {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [newPoNumber, setNewPoNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [splitting, setSplitting] = useState(false);

  if (!po) return null;

  const allDetails = po.details || [];

  // Mapping Quotation Detail & Inquiry Detail
  const qDetailsMap = useMemo(() => {
    const map = {};
    (po?.quotation?.details || []).forEach(qd => {
      map[String(qd.id)] = qd;
    });
    return map;
  }, [po?.quotation?.details]);

  const inqDetailsMap = useMemo(() => {
    const map = {};
    (po?.quotation?.inquiry?.details || []).forEach(id => {
      map[String(id.id)] = id;
    });
    return map;
  }, [po?.quotation?.inquiry?.details]);

  const getQuotationData = (r) => {
    const qDetail = qDetailsMap[String(r.quotationDetailId)];
    const inqDetail = qDetail ? inqDetailsMap[String(qDetail.inquiryDetailId)] : null;
    return { qDetail, inqDetail };
  };

  const getItemUnitPrice = (r) => {
    const { qDetail } = getQuotationData(r);
    if (qDetail) {
      const qQty = Number(qDetail.qty || 1);
      const sellPrice = Number(qDetail.sellPriceCalc || 0);
      if (sellPrice > 0 && qQty > 0) {
        return Math.round(sellPrice / qQty);
      }
      if (qDetail.unitPrice !== undefined && qDetail.unitPrice !== null) {
        return Number(qDetail.unitPrice);
      }
    }
    return Number(r.unitPrice || 0);
  };

  const getItemTotalPrice = (r) => {
    const { qDetail } = getQuotationData(r);
    if (qDetail) {
      const sellPrice = Number(qDetail.sellPriceCalc || 0);
      if (sellPrice > 0) {
        return Math.round(sellPrice);
      }
      if (qDetail.totalPrice !== undefined && qDetail.totalPrice !== null) {
        return Number(qDetail.totalPrice);
      }
    }
    return Number(r.totalPrice || 0);
  };

  const selectedItems = allDetails.filter(d => selectedRowKeys.includes(d.id));
  const remainingItems = allDetails.filter(d => !selectedRowKeys.includes(d.id));

  const selectedTotal = selectedItems.reduce((acc, it) => acc + getItemTotalPrice(it), 0);
  const remainingTotal = remainingItems.reduce((acc, it) => acc + getItemTotalPrice(it), 0);

  const hasDp = Boolean(po.hasDp);
  const dpPercent = Number(po.dpPercent || 0);
  const selectedDp = hasDp ? Math.round((selectedTotal * dpPercent) / 100) : 0;
  const remainingDp = hasDp ? Math.round((remainingTotal * dpPercent) / 100) : 0;

  const isFormValid = selectedRowKeys.length > 0 && selectedRowKeys.length < allDetails.length;

  const handleConfirmSplit = async () => {
    if (!isFormValid) {
      return message.warning('Pilih minimal 1 item untuk dipindah dan sisakan minimal 1 item di PO saat ini.');
    }

    setSplitting(true);
    try {
      const result = await splitPO(po.id, {
        detailIds: selectedRowKeys,
        newPoNumber: newPoNumber.trim() || undefined,
        remarks: remarks.trim() || undefined
      });

      message.success('Purchase Order berhasil dipecah!');
      onClose();

      // Show confirmation dialog to allow opening the new PO or staying
      Modal.confirm({
        title: 'PO Berhasil Dipecah!',
        icon: <CheckCircleOutlined className="text-green-500" />,
        content: (
          <div>
            <p>
              Sebanyak <strong>{selectedItems.length} item</strong> telah dipindahkan ke PO Baru
              <strong> #{newPoNumber || result.newPoId}</strong>.
            </p>
            <p className="text-xs text-gray-500">
              Apakah Anda ingin membuka halaman PO Baru tersebut sekarang?
            </p>
          </div>
        ),
        okText: 'Buka PO Baru',
        cancelText: 'Tetap di PO Ini',
        okButtonProps: { className: 'bg-primary-600' },
        onOk: () => {
          navigate(`/po/${result.newPoId}`);
        },
        onCancel: () => {
          if (onSuccess) onSuccess(result);
        }
      });
    } catch (err) {
      message.error(err?.response?.data?.error || 'Gagal memecah Purchase Order');
    } finally {
      setSplitting(false);
    }
  };

  const columns = [
    {
      title: 'Item / Part Description',
      key: 'desc',
      render: (_, r) => {
        const { qDetail, inqDetail } = getQuotationData(r);
        const itemName =
          inqDetail?.requestedItemName ||
          inqDetail?.requestDescription ||
          qDetail?.note ||
          r.note ||
          r.sparePart?.partName ||
          r.service?.serviceName ||
          'Item';

        const partNumber =
          inqDetail?.requestedPartNumber ||
          qDetail?.sparePart?.partCode ||
          r.sparePart?.partNumber;

        return (
          <div>
            <div className="font-semibold text-gray-800 text-sm">
              {itemName}
            </div>
            {partNumber && (
              <div className="text-xs text-gray-500">P/N: {partNumber}</div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Qty',
      key: 'qty',
      width: 100,
      align: 'center',
      render: (_, r) => {
        const { qDetail, inqDetail } = getQuotationData(r);
        const qty = qDetail?.qty !== undefined ? Number(qDetail.qty) : Number(r.qty);
        const uom = inqDetail?.uom || r.sparePart?.uom || 'PCS';
        return (
          <span className="font-semibold">
            {qty} {uom}
          </span>
        );
      }
    },
    {
      title: `Unit Price (${po.currency || 'IDR'})`,
      key: 'unitPrice',
      align: 'right',
      width: 140,
      render: (_, r) => getItemUnitPrice(r).toLocaleString('en-US')
    },
    {
      title: `Total Price (${po.currency || 'IDR'})`,
      key: 'totalPrice',
      align: 'right',
      width: 150,
      render: (_, r) => (
        <span className="font-semibold text-gray-900">
          {getItemTotalPrice(r).toLocaleString('en-US')}
        </span>
      )
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
          <span>Split Purchase Order #{po.poNumber || po.id}</span>
        </Space>
      }
      open={visible}
      onCancel={() => {
        setSelectedRowKeys([]);
        setNewPoNumber('');
        setRemarks('');
        onClose();
      }}
      width={800}
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
          Konfirmasi Split PO
        </Button>
      ]}
    >
      <div className="space-y-4">
        <Alert
          message="Petunjuk Pemisahan PO"
          description="Centang item yang ingin dipindahkan ke Purchase Order baru. Sisakan minimal 1 item di PO asal. Setiap PO hasil pemisahan akan memiliki nomor PO, alur vendor, dan delivery sendiri."
          type="info"
          showIcon
          className="rounded-lg !mb-4"
        />

        {/* Table of items */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={allDetails}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </div>

        {/* Live Calculation Preview */}
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
              <div className="text-xs font-semibold text-blue-900 mb-1 flex items-center justify-between">
                <span>PO Saat Ini (Sisa setelah split):</span>
                <Tag color="blue">{remainingItems.length} Item</Tag>
              </div>
              <div className="text-lg font-bold text-blue-800">
                {po.currency || 'IDR'} {remainingTotal.toLocaleString('en-US')}
              </div>
              {hasDp && (
                <div className="text-xs text-blue-700 mt-1 pt-1 border-t border-blue-200/60 flex justify-between">
                  <span>DP {dpPercent}%:</span>
                  <strong>{po.currency || 'IDR'} {remainingDp.toLocaleString('en-US')}</strong>
                </div>
              )}
            </div>
          </Col>

          <Col span={12}>
            <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl">
              <div className="text-xs font-semibold text-amber-900 mb-1 flex items-center justify-between">
                <span>PO Baru (Hasil split):</span>
                <Tag color="gold">{selectedItems.length} Item</Tag>
              </div>
              <div className="text-lg font-bold text-amber-800">
                {po.currency || 'IDR'} {selectedTotal.toLocaleString('en-US')}
              </div>
              {hasDp && (
                <div className="text-xs text-amber-700 mt-1 pt-1 border-t border-amber-300/60 flex justify-between">
                  <span>DP {dpPercent}%:</span>
                  <strong>{po.currency || 'IDR'} {selectedDp.toLocaleString('en-US')}</strong>
                </div>
              )}
            </div>
          </Col>
        </Row>

        {/* Form Inputs for New PO */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
          <div>
            <span className="block text-xs font-semibold text-gray-700 mb-1">
              Nomor PO Baru / PO Customer (Opsional)
            </span>
            <Input
              placeholder="e.g. 4500123456 atau PO-CUSTOMER-B (dapat diisi nanti di tahap Review)"
              value={newPoNumber}
              onChange={e => setNewPoNumber(e.target.value)}
              disabled={splitting}
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-gray-700 mb-1">
              Catatan Pemisahan (Opsional)
            </span>
            <Input.TextArea
              rows={2}
              placeholder="e.g. Dipisah untuk batch pengiriman Q2 / Beda department pemesan"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              disabled={splitting}
            />
          </div>
        </div>

        {selectedRowKeys.length === allDetails.length && (
          <Alert
            message="Peringatan"
            description="Tidak bisa memindahkan seluruh item. Sisakan minimal 1 item di PO saat ini."
            type="warning"
            showIcon
          />
        )}
      </div>
    </Modal>
  );
};

export default SplitPoModal;

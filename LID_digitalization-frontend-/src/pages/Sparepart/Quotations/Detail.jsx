import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Space, Button, message, Tag, Divider, Modal, Input, Select, Timeline, Alert, Spin, Upload } from 'antd';
import {
  ArrowLeftOutlined, RollbackOutlined, SendOutlined,
  CheckCircleOutlined, DownloadOutlined, ReloadOutlined, EditOutlined,
  InboxOutlined, EyeOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuotationById, revertQuotationToInquiry, updateQuotation, downloadQuotationPdf, getQuotationPdfBlob } from '../../../services/quotation.service';
import { createPOFromQuotation } from '../../../services/po.service';
import usePermissions from '../../../hooks/usePermissions';
import WorkflowHistory from '../../../components/WorkflowHistory';

const { Title, Text } = Typography;

const QuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = usePermissions();
  const isEditMode = new URLSearchParams(location.search).get('mode') === 'edit';

  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [creatingPO, setCreatingPO] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [isRevertModalVisible, setIsRevertModalVisible] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

  // Upload PO Modal
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Close Loss Modal
  const [isLossModalVisible, setIsLossModalVisible] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossDetail, setLossDetail] = useState('');
  const [submittingLoss, setSubmittingLoss] = useState(false);

  // PDF inline state
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const blobUrlRef = useRef(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        window.URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const fetchQuotation = async () => {
    try {
      const data = await getQuotationById(id);
      setQuotation(data);
    } catch (err) {
      message.error('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  const loadPdf = async () => {
    setPdfLoading(true);
    setPdfError(false);
    // Revoke previous blob URL if any
    if (blobUrlRef.current) {
      window.URL.revokeObjectURL(blobUrlRef.current);
      setPdfBlobUrl(null);
    }
    try {
      const blobData = await getQuotationPdfBlob(id);
      const url = window.URL.createObjectURL(new Blob([blobData], { type: 'application/pdf' }));
      blobUrlRef.current = url;
      setPdfBlobUrl(url);
    } catch (err) {
      setPdfError(true);
      // Blob error: parse the actual backend error message from the blob response
      try {
        const errorBlob = err?.response?.data;
        if (errorBlob instanceof Blob) {
          const text = await errorBlob.text();
          const parsed = JSON.parse(text);
          message.error(`PDF Error: ${parsed.error || text}`);
        } else {
          message.error(`Failed to load PDF: ${err?.response?.data?.error || err.message || 'Unknown error'}`);
        }
      } catch {
        message.error('Failed to load PDF. Please check backend logs for details.');
      }
    } finally {
      setPdfLoading(false);
    }
  };

  // Load quotation data then auto-load PDF
  useEffect(() => {
    const init = async () => {
      await fetchQuotation();
      await loadPdf();
    };
    init();
  }, [id]);

  const handleUpdateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await updateQuotation(id, { status: newStatus });
      message.success(`Status updated to ${newStatus}`);
      await fetchQuotation();
      await loadPdf(); // Reload PDF setelah status berubah
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmitLoss = async () => {
    if (!lossReason) return message.warning('Please select a Loss Reason');
    setSubmittingLoss(true);
    try {
      await updateQuotation(id, { status: 'CLOSE_LOSS', lossReason, lossDetail });
      message.success('Quotation closed as Loss');
      setIsLossModalVisible(false);
      setLossReason('');
      setLossDetail('');
      await fetchQuotation();
      await loadPdf();
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to update status');
    } finally {
      setSubmittingLoss(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadQuotationPdf(id, quotation?.quotationNumber);
    } catch (err) {
      message.error('Failed to download PDF. Ensure the backend is running.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleRevert = async () => {
    if (!revertReason.trim()) {
      return message.warning('Please provide a reason to revert to inquiry');
    }
    setReverting(true);
    try {
      const response = await revertQuotationToInquiry(id, revertReason);
      message.success('Quotation reverted to Inquiry successfully');
      navigate(`/inquiries/${response.inquiryId}`);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to revert');
    } finally {
      setReverting(false);
      setIsRevertModalVisible(false);
    }
  };

  const handleCreatePO = () => {
    if (quotation.status !== 'SENT') {
      return message.warning('Quotation must be SENT before creating a Purchase Order');
    }
    setIsUploadModalVisible(true);
  };

  const handleConfirmPO = async () => {
    if (!selectedFile) {
      return message.error('Please upload the Customer PO PDF file first.');
    }

    setCreatingPO(true);
    try {
      const formData = new FormData();
      formData.append('poType', 'SPARE_PART');
      formData.append('file', selectedFile);

      const response = await createPOFromQuotation(id, formData);

      message.success('Purchase Order Created Successfully!');
      navigate(`/po/${response.id}`);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to create Purchase Order');
    } finally {
      setCreatingPO(false);
      setIsUploadModalVisible(false);
    }
  };

  if (loading || !quotation) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" tip="Loading quotation data..." />
      </div>
    );
  }

  const getStatusAlert = () => {
    switch (quotation.status) {
      case 'DRAFT':
        return (
          <Alert
            message="Quotation Status: DRAFT"
            description="This document is still a draft. Please review and click 'Mark as Sent' to send the quotation to the customer before proceeding to PO."
            type="info"
            showIcon
            icon={<SendOutlined />}
            className="rounded-xl border-blue-100 bg-blue-50"
          />
        );
      case 'SENT':
        return (
          <Alert
            message="Quotation Status: SENT"
            description="Quotation has been sent to the customer. You can now proceed to create a Purchase Order (PO)."
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            className="rounded-xl border-green-100 bg-green-50"
          />
        );
      case 'REALIZED':
        const poCount = (quotation.purchaseOrders || []).length;
        return (
          <Alert
            message="Quotation Status: REALIZED"
            description={
              <div>
                <p>This quotation has been processed into Purchase Order {poCount > 1 ? `(${poCount} POs)` : ''}.</p>
                {quotation.purchaseOrders && quotation.purchaseOrders.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-semibold text-gray-700">Daftar PO Terhubung:</span>
                    {quotation.purchaseOrders.map((p, idx) => (
                      <Tag
                        key={p.id}
                        color="blue"
                        className="cursor-pointer hover:opacity-80 py-0.5 px-2 font-medium"
                        onClick={() => navigate(`/po/${p.id}`)}
                      >
                        {p.poNumber || `PO #${idx + 1}`} ({p.status})
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            }
            type="success"
            showIcon
            className="rounded-xl"
          />
        );
      case 'CLOSE_LOSS':
        return (
          <Alert
            message="Quotation Status: CLOSE LOSS"
            description={
              <div>
                <p>This quotation has been closed as Loss. Cannot proceed to the next step.</p>
                {quotation.lossReason && (
                  <div className="mt-2">
                    <strong>Reason:</strong> {quotation.lossReason}
                  </div>
                )}
                {quotation.lossDetail && (
                  <div className="mt-1">
                    <strong>Detail:</strong> {quotation.lossDetail}
                  </div>
                )}
              </div>
            }
            type="error"
            showIcon
            className="rounded-xl"
          />
        );
      default:
        return null;
    }
  };

  const statusColor = {
    DRAFT: 'default',
    SENT: 'processing',
    REALIZED: 'success',
    CLOSE_LOSS: 'error',
  }[quotation.status] || 'default';

  return (
    <div className="space-y-4 mb-10">

      {/* ── Top Action Bar ── */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-white px-5 py-4 rounded-xl shadow-sm border border-gray-100">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quotations')} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Quotation: {quotation.quotationNumber}
              <Tag color={statusColor} className="!ml-3 text-sm">{quotation.status}</Tag>
            </Title>
            <Text type="secondary">Inquiry Ref: {quotation.inquiry?.inquiryNumber}</Text>
          </div>
        </Space>

        <Space wrap>
          <Button
            icon={<EyeOutlined />}
            onClick={() => navigate(`/quotations/${id}/edit?mode=view`)}
          >
            View Form Detail
          </Button>
          {isEditMode && quotation.status === 'DRAFT' && permissions.canEditQuotation && (
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/quotations/${id}/edit`)}
            >
              Edit Quotation
            </Button>
          )}
          {isEditMode && quotation.status === 'DRAFT' && permissions.canEditQuotation && (
            <Button type="primary" icon={<SendOutlined />} onClick={() => handleUpdateStatus('SENT')} loading={updating}>
              Mark as Sent
            </Button>
          )}
          {isEditMode && quotation.status === 'SENT' && (
            <>
              {permissions.canEditQuotation && (
                <Button danger onClick={() => setIsLossModalVisible(true)} loading={updating}>
                  Close as Loss
                </Button>
              )}
              {permissions.canCreateSparepartPO && (
                <Button
                  type="primary"
                  loading={creatingPO}
                  onClick={handleCreatePO}
                  className="bg-blue-600"
                >
                  Continue to Purchase Order
                </Button>
              )}
            </>
          )}
          {isEditMode && quotation.status === 'REALIZED' && (
            <>
              {quotation.purchaseOrders && quotation.purchaseOrders.length > 1 ? (
                <Space size="small">
                  {quotation.purchaseOrders.map((p, idx) => (
                    <Button
                      key={p.id}
                      type="primary"
                      onClick={() => navigate(`/po/${p.id}`)}
                      className="bg-blue-600 hover:bg-blue-700 text-xs"
                    >
                      View PO {p.poNumber || `#${idx + 1}`}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Button
                  type="primary"
                  onClick={() => {
                    const poId = quotation.purchaseOrders?.[0]?.id || quotation.purchaseOrder?.id;
                    if (poId) navigate(`/po/${poId}`);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!quotation.purchaseOrders?.[0]?.id && !quotation.purchaseOrder?.id}
                >
                  View Purchase Order
                </Button>
              )}
            </>
          )}
          {isEditMode && ['DRAFT', 'SENT', 'CLOSE_LOSS'].includes(quotation.status) && permissions.canEditQuotation && (
            <Button icon={<RollbackOutlined />} onClick={() => setIsRevertModalVisible(true)} danger>
              Revert to Inquiry
            </Button>
          )}
          {permissions.canEditQuotation && (
            <>
              <Button icon={<ReloadOutlined />} onClick={loadPdf} loading={pdfLoading}>
                Reload PDF
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadPdf}
                loading={downloadingPdf}
                className="bg-green-600 text-white border-green-600"
              >
                Download PDF
              </Button>
            </>
          )}
        </Space>
      </div>

      {/* ── Status Alert ── */}
      {getStatusAlert()}

      {/* ── Main Content: PDF iframe + History Sidebar ── */}
      <div className="flex flex-col lg:flex-row gap-4 items-start mt-6">

        {/* PDF Viewer */}
        <div className="flex-1 w-full rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-gray-100"
          style={{ minHeight: '85vh' }}>
          {pdfLoading && (
            <div className="flex flex-col items-center justify-center h-full py-24 text-gray-500">
              <Spin size="large" />
              <p className="mt-4 text-sm">Loading PDF document...</p>
            </div>
          )}
          {pdfError && !pdfLoading && (
            <div className="flex flex-col items-center justify-center h-full py-24 text-gray-400">
              <p className="text-base font-semibold text-red-400">Failed to load PDF</p>
              <p className="text-sm mb-4">Ensure the backend is running correctly.</p>
              <Button icon={<ReloadOutlined />} onClick={loadPdf}>Try Again</Button>
            </div>
          )}
          {pdfBlobUrl && !pdfLoading && (
            <iframe
              src={pdfBlobUrl}
              title={`Quotation PDF - ${quotation.quotationNumber}`}
              style={{
                width: '100%',
                height: '85vh',
                border: 'none',
                display: 'block',
              }}
            />
          )}
        </div>

        {/* History Sidebar */}
        <div className="w-full lg:w-72 shrink-0">
          <WorkflowHistory quotation={quotation} />
        </div>
      </div>

      {/* Upload PO Modal */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined className="text-blue-500" />
            <span>Upload Customer Purchase Order (PO)</span>
          </Space>
        }
        open={isUploadModalVisible}
        onOk={handleConfirmPO}
        onCancel={() => {
          setIsUploadModalVisible(false);
          setSelectedFile(null);
        }}
        confirmLoading={creatingPO}
        okText="Verify & Create PO"
        cancelText="Cancel"
        okButtonProps={{ disabled: !selectedFile, className: 'bg-blue-600' }}
        width={500}
      >
        <div className="space-y-4">
          <Alert
            message="Mandatory Action"
            description="To proceed with the internal PO creation, you must upload the official Purchase Order document received from the customer (PDF format only)."
            type="info"
            showIcon
          />

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors mt-2">
            <Upload.Dragger
              accept=".pdf"
              maxCount={1}
              beforeUpload={(file) => {
                const isPdf = file.type === 'application/pdf';
                if (!isPdf) {
                  message.error('You can only upload PDF files!');
                  return Upload.LIST_IGNORE;
                }
                setSelectedFile(file);
                return false; // Prevent auto-upload
              }}
              onRemove={() => setSelectedFile(null)}
              fileList={selectedFile ? [selectedFile] : []}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined className="text-blue-500" />
              </p>
              <p className="ant-upload-text font-medium">Click or drag PDF file to this area</p>
              <p className="ant-upload-hint text-xs">
                Support for a single PDF upload. Max size: 15MB.
              </p>
            </Upload.Dragger>
          </div>

          {selectedFile && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircleOutlined className="text-green-500" />
                <Text strong size="small">{selectedFile.name}</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </Text>
            </div>
          )}
        </div>
      </Modal>

      {/* Revert Modal */}
      <Modal
        title="Revert Quotation to Inquiry"
        open={isRevertModalVisible}
        onOk={handleRevert}
        onCancel={() => setIsRevertModalVisible(false)}
        confirmLoading={reverting}
        okText="Confirm Revert"
        okButtonProps={{ danger: true }}
      >
        <p className="mb-4 text-gray-600">
          This will delete the current quotation completely and revert the original inquiry back to the <strong>OPEN</strong> status.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Reason for reverting..."
          value={revertReason}
          onChange={(e) => setRevertReason(e.target.value)}
        />
      </Modal>

      {/* Close Loss Modal */}
      <Modal
        title="Close Quotation as Loss"
        open={isLossModalVisible}
        onOk={handleSubmitLoss}
        onCancel={() => { setIsLossModalVisible(false); setLossReason(''); setLossDetail(''); }}
        confirmLoading={submittingLoss}
        okText="Confirm Close Loss"
        okButtonProps={{ danger: true }}
      >
        <p className="mb-4 text-gray-600">
          Please provide the reason why this quotation was not won.
        </p>
        <div className="mb-3">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Loss Reason <span className="text-red-500">*</span></label>
          <Select
            className="w-full"
            placeholder="Select a reason"
            value={lossReason || undefined}
            onChange={(v) => setLossReason(v)}
            options={[
              { value: 'Price Level', label: 'Price Level' },
              { value: 'Budget', label: 'Budget' },
              { value: 'Technical Specification', label: 'Technical Specification' },
              { value: 'Other', label: 'Other' },
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Detail / Notes</label>
          <Input.TextArea
            rows={4}
            placeholder="Provide more detail about the reason..."
            value={lossDetail}
            onChange={(e) => setLossDetail(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default QuotationDetail;

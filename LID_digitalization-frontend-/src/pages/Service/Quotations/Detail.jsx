import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Space, Button, message, Tag, Divider, Modal, Input, Select, Timeline, Alert, Spin, Upload, Table } from 'antd';
import {
  ArrowLeftOutlined, RollbackOutlined, SendOutlined,
  CheckCircleOutlined, DownloadOutlined, ReloadOutlined, ToolOutlined, EditOutlined,
  InboxOutlined, LinkOutlined, EyeOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuotationById, revertQuotationToInquiry, updateQuotation, downloadQuotationPdf, getQuotationPdfBlob, acceptQuotationWithPO } from '../../../services/quotation.service';
import { createPOFromQuotation } from '../../../services/po.service';
import { createServiceExecutionFromQuotation } from '../../../services/service.service';
import usePermissions from '../../../hooks/usePermissions';
import WorkflowHistory from '../../../components/WorkflowHistory';
import dayjs from 'dayjs';
import { getAllTfs, linkTfsToServiceExecution } from '../../../services/tfs.service';

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
  const [approving, setApproving] = useState(false);
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

  // TFS Selection Modal state (for creating service execution with TFS link)
  const [tfsModalOpen, setTfsModalOpen] = useState(false);
  const [availableTfs, setAvailableTfs] = useState([]);
  const [loadingTfs, setLoadingTfs] = useState(false);
  const [selectedTfsIds, setSelectedTfsIds] = useState([]);

  const isTfsOnlyExternal = quotation ? (
    quotation.inquiry?.requestType === 'SERVICE_EXTERNAL_TFS' ||
    (quotation.inquiry?.requestType === 'SERVICE_EXTERNAL' &&
      quotation.inquiry?.details?.length > 0 &&
      quotation.inquiry?.details?.every(d => d.serviceSubType === 'TFS'))
  ) : false;

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
      console.error('Fetch Quotation Error:', err);
      const errMsg = err?.response?.data?.error || err.message || 'Unknown error';
      message.error(`Failed to load quotation: ${errMsg}`);
      // navigate('/service/quotations');
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

  // Load quotation data then PDF sequentially
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await fetchQuotation();
        await loadPdf();
      } catch (err) {
        console.error('Init Error:', err);
      } finally {
        setLoading(false);
      }
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
      navigate(`/service/inquiries/${response.inquiryId}`);
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
      formData.append('file', selectedFile);


      if (isTfsOnlyExternal) {
        await acceptQuotationWithPO(id, formData);
        message.success('Quotation Accepted Successfully with PO Document!');
        setIsUploadModalVisible(false);
        fetchQuotation();
      } else {
        formData.append('poType', 'SERVICE');
        const response = await createPOFromQuotation(id, formData);

        message.success('Purchase Order Created Successfully!');
        navigate(`/service/po/${response.id}`);
      }
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to process Customer PO');
    } finally {
      setCreatingPO(false);
      setIsUploadModalVisible(false);
    }
  };

  const handleCreateServiceExecution = async () => {
    // Step 1: Fetch available TFS pool for selection
    setTfsModalOpen(true);
    setLoadingTfs(true);
    try {
      const pool = await getAllTfs({ unlinked: true, assignmentType: 'PAID_ASSIGNMENT' });
      setAvailableTfs(pool.filter(t => t.status !== 'CANCELLED'));
    } catch {
      message.error('Failed to load available TFS schedules');
    } finally {
      setLoadingTfs(false);
    }
  };

  const handleConfirmCreateServiceExecution = async () => {
    setApproving(true);
    try {
      const svc = await createServiceExecutionFromQuotation(id);

      // Step 2: Link selected TFS to the new service execution
      if (selectedTfsIds.length > 0) {
        for (const tfsId of selectedTfsIds) {
          try {
            await linkTfsToServiceExecution(tfsId, svc.id);
          } catch (linkErr) {
            console.warn(`Failed to link TFS ${tfsId}:`, linkErr.message);
          }
        }
      }

      message.success('Service Execution created successfully!');
      setTfsModalOpen(false);
      setSelectedTfsIds([]);
      navigate(`/service/executions/${svc.id}`);
    } catch (err) {
      message.error(err.message || 'Failed to create Service Execution');
    } finally {
      setApproving(false);
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
      case 'REALIZED':
        return (
          <Alert
            message="Quotation Status: REALIZED"
            description={isTfsOnlyExternal ? "This quotation has been approved. Proceed to create a Service Execution." : "This quotation has been processed into a Purchase Order. Changes to this quotation are no longer possible."}
            type="success"
            showIcon
            className="rounded-xl"
          />
        );
      case 'EXECUTED':
        return (
          <Alert
            message="Quotation Status: EXECUTED"
            description="Service Execution has been started. Quotation is now executed and read-only."
            type="success"
            showIcon
            className="rounded-xl border-purple-100 bg-purple-50"
          />
        );
      case 'SENT':
        return (
          <Alert
            message="Quotation Status: SENT"
            description={isTfsOnlyExternal
              ? "Quotation has been sent to the customer. Please click 'Accept Quotation' to proceed to creating a Service Execution."
              : "Quotation has been sent to the customer. You can now proceed to create a Purchase Order (PO)."}
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            className="rounded-xl border-green-100 bg-green-50"
          />
        );
      case 'DRAFT':
        return (
          <Alert
            message="Quotation Status: DRAFT"
            description={isTfsOnlyExternal
              ? "This document is still a draft. Please review and click 'Mark as Sent' to send the quotation to the customer before proceeding to Service Execution."
              : "This document is still a draft. Please review and click 'Mark as Sent' to send the quotation to the customer before proceeding to PO."}
            type="info"
            showIcon
            icon={<SendOutlined />}
            className="rounded-xl border-blue-100 bg-blue-50"
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
                  <div className="mt-2"><strong>Reason:</strong> {quotation.lossReason}</div>
                )}
                {quotation.lossDetail && (
                  <div className="mt-1"><strong>Detail:</strong> {quotation.lossDetail}</div>
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
    EXECUTED: 'purple',
    CLOSE_LOSS: 'error',
  }[quotation.status] || 'default';

  return (
    <div className="space-y-4 mb-10">
      {/* ── Top Action Bar ── */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-white px-5 py-4 rounded-xl shadow-sm border border-gray-100">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/service/quotations')} />
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
            onClick={() => navigate(`/service/quotations/${id}/edit?mode=view`)}
          >
            View Form Detail
          </Button>
          {quotation.status === 'DRAFT' && permissions.canEditServiceQuotation && (
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/service/quotations/${id}/edit`)}
            >
              Edit Quotation
            </Button>
          )}
          {quotation.status === 'DRAFT' && permissions.canEditServiceQuotation && (
            <Button type="primary" icon={<SendOutlined />} onClick={() => handleUpdateStatus('SENT')} loading={updating}>
              Mark as Sent
            </Button>
          )}
          {quotation.status === 'SENT' && isTfsOnlyExternal && permissions.canEditServiceQuotation && (
            <Button type="primary" onClick={() => setIsUploadModalVisible(true)} className="bg-green-600">
              Accept Quotation
            </Button>
          )}
          {quotation.status === 'REALIZED' && isTfsOnlyExternal && !quotation.serviceExecutions?.length && permissions.canEditServiceQuotation && (
            <Button type="primary" icon={<ToolOutlined />} className="bg-purple-600" loading={approving} onClick={handleCreateServiceExecution}>
              Create Service Execution
            </Button>
          )}
          {quotation.status === 'SENT' && permissions.canEditServiceQuotation && (
            <Button danger onClick={() => setIsLossModalVisible(true)} loading={updating}>
              Close as Loss
            </Button>
          )}
          {quotation.status === 'SENT' && !isTfsOnlyExternal && permissions.canCreateServicePO && (
            <Button
              type="primary"
              loading={creatingPO}
              onClick={handleCreatePO}
              className="bg-blue-600"
            >
              Continue to Purchase Order
            </Button>
          )}
          {quotation.status === 'REALIZED' && !isTfsOnlyExternal && permissions.canCreateServicePO && (
            <Button disabled>PO Already Created</Button>
          )}
          {['DRAFT', 'SENT', 'CLOSE_LOSS'].includes(quotation.status) && permissions.canEditServiceQuotation && (
            <Button icon={<RollbackOutlined />} onClick={() => setIsRevertModalVisible(true)} danger>
              Revert to Inquiry
            </Button>
          )}
          {permissions.canEditServiceQuotation && (
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
            description={
              isTfsOnlyExternal
                ? "To accept this quotation and proceed to Service Execution, you must upload the official Purchase Order document received from the customer (PDF format only)."
                : "To proceed with the internal PO creation, you must upload the official Purchase Order document received from the customer (PDF format only)."
            }
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

      {/* TFS Selection Modal (when creating Service Execution) */}
      <Modal
        title={<><LinkOutlined className="mr-2" />Create Service Execution & Link TFS</>}
        open={tfsModalOpen}
        onCancel={() => { setTfsModalOpen(false); setSelectedTfsIds([]); }}
        onOk={handleConfirmCreateServiceExecution}
        confirmLoading={approving}
        okText={selectedTfsIds.length > 0 ? `Create & Link ${selectedTfsIds.length} TFS` : 'Create without TFS'}
        width={700}
      >
        <Alert
          message="Select TFS Personnel to Link"
          description="Choose available TFS schedules to link to this Service Execution. You can also create the Service Execution without linking and link TFS later from the detail page."
          type="info"
          showIcon
          className="!mb-4"
        />
        <Table
          dataSource={availableTfs}
          rowKey="id"
          loading={loadingTfs}
          size="small"
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedTfsIds,
            onChange: (keys) => setSelectedTfsIds(keys),
          }}
          locale={{ emptyText: 'No standalone TFS schedules available. You can create the Service Execution and link TFS later.' }}
          columns={[
            { title: 'TFS Number', dataIndex: 'tfsNumber', width: 140, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
            { title: 'Personnel', width: 180, render: (_, r) => <><strong>{r.personnel?.name || '-'}</strong><br /><span className="text-xs text-gray-400">{r.personnel?.personnel_code}</span></> },
            { title: 'Period', render: (_, r) => r.startDate ? `${dayjs(r.startDate).locale('en').format('DD MMM')} → ${r.endDate ? dayjs(r.endDate).locale('en').format('DD MMM YYYY') : '?'}` : '-' },
            { title: 'Days', dataIndex: 'days', width: 70, align: 'center', render: v => v ? `${v}d` : '-' },
          ]}
        />
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

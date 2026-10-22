import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Card, Button, Tag, Divider, Typography, message, Spin,
  Table, Timeline, Space
} from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, EditOutlined } from '@ant-design/icons';
import usePermissions from '../../../hooks/usePermissions';
import { getInquiryById } from '../../../services/inquiry.service';
import { createServiceExecutionFromInquiry } from '../../../services/service.service';
import WorkflowHistory from '../../../components/WorkflowHistory';

const { Title, Text } = Typography;

const SERVICE_CATEGORY_META = {
  EXTERNAL_PURCHASE: { label: 'External Purchase', color: 'blue', next: 'Create Quotation' },
  EXTERNAL_TFS: { label: 'External TFS', color: 'purple', next: 'Create Quotation' },
  EXTERNAL: { label: 'External Service', color: 'geekblue', next: 'Create Quotation' },
  IC_TFS: { label: 'IC – TFS', color: 'orange', next: 'Create Service Execution' },
};

const getCategoryKey = (requestType) => {
  if (requestType === 'SERVICE_EXTERNAL_PURCHASE') return 'EXTERNAL_PURCHASE';
  if (requestType === 'SERVICE_EXTERNAL_TFS') return 'EXTERNAL_TFS';
  if (requestType === 'SERVICE_EXTERNAL') return 'EXTERNAL';
  if (requestType === 'SERVICE_IC_TFS') return 'IC_TFS';
  return null;
};

const inquiryClosed = (inquiry) =>
  inquiry.statusCode === 'CLOSED' || inquiry.statusCode === 'REJECTED';

const ServiceInquiryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = usePermissions();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchInquiry = async () => {
      try {
        const data = await getInquiryById(id);
        setInquiry(data);
      } catch {
        message.error('Failed to load inquiry');
        navigate('/service/inquiries');
      } finally {
        setLoading(false);
      }
    };
    fetchInquiry();
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!inquiry) return null;

  const catKey = getCategoryKey(inquiry.requestType);
  const catMeta = catKey ? SERVICE_CATEGORY_META[catKey] : null;

  const isConverted = inquiry.statusCode === 'CONVERTED';

  // next-step link (for External/Purchase flows)
  const nextLink = `/service/quotations/create-from-inquiry/${inquiry.id}`;

  // IC_TFS: auto-create service execution via API
  const handleCreateServiceExecution = async () => {
    setCreating(true);
    try {
      const svc = await createServiceExecutionFromInquiry(inquiry.id);
      message.success('Service Execution created successfully!');
      navigate(`/service/executions/${svc.id}`);
    } catch (err) {
      message.error(err.message || 'Failed to create Service Execution');
    } finally {
      setCreating(false);
    }
  };

  const itemColumns = [
    {
      title: 'Type', dataIndex: 'itemType', key: 'itemType',
      render: t => <Tag color={t === 'SERVICE' ? 'blue' : 'green'}>{t}</Tag>
    },
    {
      title: 'Service Type', dataIndex: 'serviceSubType', key: 'serviceSubType',
      render: t => t
        ? <Tag color={t === 'TFS' ? 'purple' : 'cyan'}>{t === 'TFS' ? 'TFS' : 'Purchase'}</Tag>
        : <span className="text-gray-400 text-xs">-</span>
    },
    {
      title: 'Requested Name', key: 'name',
      render: (_, r) => (
        <div>
          <Text strong>{r.requestedItemName || '-'}</Text>
          {r.requestDescription && (
            <p className="text-xs text-gray-500 m-0">{r.requestDescription}</p>
          )}
        </div>
      )
    },
    { title: 'Qty', key: 'qty', render: (_, r) => `${r.qty} ${r.uom || ''}` },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* ─── Header ─── */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/service/inquiries')} />
          <div>
            <div className="flex items-center gap-3">
              <Title level={4} style={{ margin: 0 }}>{inquiry.inquiryNumber}</Title>
              {catKey && (
                <Tag color={SERVICE_CATEGORY_META[catKey]?.color}>
                  {SERVICE_CATEGORY_META[catKey]?.label}
                </Tag>
              )}
              <Tag color={isConverted ? 'purple' : 'default'}>
                {inquiry.statusCode || '-'}
              </Tag>
            </div>
            <Text type="secondary">{inquiry.subject}</Text>
          </div>
        </Space>

        <Space>
          {new URLSearchParams(location.search).get('mode') === 'edit' && permissions.canEditServiceInquiry && (
            <Button
              type="default"
              icon={<EditOutlined />}
              disabled={isConverted}
              onClick={() => navigate(`/service/inquiries/${id}/edit`)}
            >
              Edit Inquiry
            </Button>
          )}
          {new URLSearchParams(location.search).get('mode') === 'edit' && catMeta && !inquiryClosed(inquiry) && catKey !== 'IC_TFS' && permissions.canEditServiceQuotation && (
            <Link to={nextLink}>
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                disabled={isConverted}
                className="bg-primary-600"
              >
                {catMeta.next}
              </Button>
            </Link>
          )}
          {new URLSearchParams(location.search).get('mode') === 'edit' && catKey === 'IC_TFS' && !inquiryClosed(inquiry) && permissions.canEditServiceInquiry && (
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              loading={creating}
              disabled={isConverted}
              className="bg-primary-600"
              onClick={handleCreateServiceExecution}
            >
              {isConverted ? 'Created' : 'Create Service Execution'}
            </Button>
          )}
        </Space>
      </div>

      {/* ─── Body  : 2/3 info + 1/3 history ─── */}
      <div className="grid grid-cols-3 gap-6">

        {/* Left — General Info + Items */}
        <div className="col-span-2 space-y-6">
          <Card className="rounded-xl shadow-sm border-gray-100">
            <Title level={5}>General Information</Title>
            <Divider className="my-3" />
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <Text type="secondary" className="block text-xs">Customer</Text>
                <Text strong>{inquiry.customer?.name || '-'}</Text>
              </div>
              <div>
                <Text type="secondary" className="block text-xs">Source</Text>
                <Text>{inquiry.sourceCode || '-'}</Text>
              </div>
              <div>
                <Text type="secondary" className="block text-xs">Request Type</Text>
                <Text>{inquiry.requestType}</Text>
              </div>
              <div>
                <Text type="secondary" className="block text-xs">Inquiry Date</Text>
                <Text>
                  {inquiry.inquiryDate
                    ? new Date(inquiry.inquiryDate).toLocaleDateString('en-US')
                    : '-'}
                </Text>
              </div>
              {inquiry.dueDate && (
                <div>
                  <Text type="secondary" className="block text-xs">Target Completion</Text>
                  <Text>{new Date(inquiry.dueDate).toLocaleDateString('en-US')}</Text>
                </div>
              )}
              <div className="col-span-2">
                <Text type="secondary" className="block text-xs">Description</Text>
                <Text>{inquiry.description || '-'}</Text>
              </div>
            </div>

            <Title level={5} className="mt-6">Requested Items</Title>
            <Table
              columns={itemColumns}
              dataSource={inquiry.details || []}
              pagination={false}
              rowKey="id"
              className="mt-3"
              size="middle"
            />
          </Card>
        </div>

        {/* Right — Status History */}
        <div className="col-span-1">
          <WorkflowHistory
            histories={(inquiry.histories || []).map(h => ({ ...h, type: 'INQUIRY' }))}
          />
        </div>

      </div>
    </div>
  );
};

export default ServiceInquiryDetail;

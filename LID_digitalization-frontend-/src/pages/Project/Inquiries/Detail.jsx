import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Card, Button, Tag, Divider, Typography, message, Spin,
  Table, Timeline, Space
} from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, EditOutlined } from '@ant-design/icons';
import usePermissions from '../../../hooks/usePermissions';
import WorkflowHistory from '../../../components/WorkflowHistory';
import { getInquiryById } from '../../../services/inquiry.service';

const { Title, Text } = Typography;

const PROJECT_CATEGORY_META = {
  PROJECT_NEW_PLANT: { label: 'New Plant', color: 'yellow' },
  PROJECT_UPGRADE: { label: 'Upgrade', color: 'blue' },
  PROJECT_OM: { label: 'O&M', color: 'violet', next: 'Create Quotation' },
};

const inquiryClosed = (inquiry) =>
  inquiry.statusCode === 'CLOSED' || inquiry.statusCode === 'REJECTED';

const ProjectInquiryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = usePermissions();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInquiry = async () => {
      try {
        const data = await getInquiryById(id);
        setInquiry(data);
      } catch {
        message.error('Failed to load inquiry');
        navigate('/project/inquiries');
      } finally {
        setLoading(false);
      }
    };
    fetchInquiry();
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!inquiry) return null;

  const catMeta = PROJECT_CATEGORY_META[inquiry.requestType];
  const isConverted = inquiry.statusCode === 'CONVERTED';

  const itemColumns = [
    {
      title: 'Type', dataIndex: 'itemType', key: 'itemType',
      render: t => <Tag color={t === 'PROJECT' ? 'blue' : 'green'}>{t}</Tag>
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/project/inquiries')} />
          <div>
            <div className="flex items-center gap-2">
              <Title level={4} style={{ margin: 0 }}>{inquiry.inquiryNumber}</Title>
              {catMeta && (
                <Tag color={catMeta.color}>
                  {catMeta.label}
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
          {new URLSearchParams(location.search).get('mode') === 'edit' && permissions.canEditInquiry && (
            <Button
              type="default"
              icon={<EditOutlined />}
              disabled={isConverted}
              onClick={() => navigate(`/project/inquiries/${id}/edit`)}
            >
              Edit Inquiry
            </Button>
          )}
          {/* Proceeding to quotation is temporarily disabled */}
          {new URLSearchParams(location.search).get('mode') === 'edit' && catMeta?.next && !inquiryClosed(inquiry) && permissions.canEditQuotation && (
            <Link to={`/project/quotations/create-from-inquiry/${inquiry.id}`}>
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                disabled={isConverted}
                className="bg-primary-600"
              >
                {isConverted ? 'Create Quotation' : catMeta.next}
              </Button>
            </Link>
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
                <Text strong>{inquiry.customer?.name || inquiry.customerName || '-'}</Text>
              </div>
              <div>
                <Text type="secondary" className="block text-xs">Code Word</Text>
                <Text>{inquiry.codeWord?.code || '-'}</Text>
              </div>
              <div>
                <Text type="secondary" className="block text-xs">Source</Text>
                <Text>{inquiry.sourceCode || '-'}</Text>
              </div>
              <div>
                <Text type="secondary" className="block text-xs">Request Type</Text>
                <Text>{catMeta?.label || inquiry.requestType}</Text>
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

        {/* Right — Workflow History */}
        <div className="col-span-1">
          <WorkflowHistory
            histories={(inquiry.histories || []).map(h => ({ ...h, type: 'INQUIRY' }))}
          />
        </div>

      </div>
    </div>
  );
};

export default ProjectInquiryDetail;

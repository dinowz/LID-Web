import React from 'react';
import { Card, Timeline, Tag, Typography } from 'antd';
import { EnvironmentOutlined, WarningOutlined } from '@ant-design/icons';

const { Text } = Typography;

const MODULE_COLOR = {
  INQUIRY: 'purple',
  QUOTATION: 'blue',
  PO: 'green',
  DELIVERY: 'orange',
  EXECUTION: 'orange',
  INVOICE: 'cyan',
};

export const extractQuotationWorkflowHistories = (quotation) => {
  if (!quotation) return [];

  const invoiceList = [
    ...(quotation.invoices || []),
    ...(quotation.purchaseOrder?.invoices || [])
  ].reduce((acc, inv) => {
    if (inv && !acc.some(existing => String(existing.id) === String(inv.id))) {
      acc.push(inv);
    }
    return acc;
  }, []);

  return [
    // 1. Inquiry histories
    ...(quotation.inquiry?.histories || quotation.tfs?.inquiry?.histories || []).map(h => ({ ...h, type: 'INQUIRY' })),
    // 2. Quotation histories
    ...(quotation.histories || []).map(h => ({ ...h, type: 'QUOTATION' })),
    // 3. Purchase Order histories
    ...(quotation.purchaseOrder?.histories || []).map(h => ({
      ...h,
      type: 'PO',
      docNumber: quotation.purchaseOrder?.poNumber
    })),
    // 4. Delivery histories (from PO)
    ...(quotation.purchaseOrder?.deliveries || []).flatMap(d =>
      (d.histories || []).map(h => ({
        ...h,
        type: 'DELIVERY',
        deliveryNumber: d.deliveryNumber
      }))
    ),
    // 5. Invoices (from PO or Quotation)
    ...invoiceList.flatMap(inv =>
      (inv.histories || []).map(h => ({
        ...h,
        type: 'INVOICE',
        invoiceNumber: inv.invoiceNumber
      }))
    )
  ];
};

const WorkflowHistory = ({
  histories = [],
  quotation = null,
  title = 'Workflow History',
  maxHeight = 320,
  className = '',
}) => {
  // Normalize & sort histories descending by createdAt
  const sortedHistories = React.useMemo(() => {
    const rawList = quotation
      ? [...histories, ...extractQuotationWorkflowHistories(quotation)]
      : histories;

    if (!Array.isArray(rawList)) return [];

    return [...rawList]
      .map((h) => {
        const moduleType = (h.module || h.type || 'INQUIRY').toUpperCase();
        const statusLabel =
          h.newStatus ||
          h.newStatusCode ||
          h.status ||
          '';

        return {
          ...h,
          moduleType,
          statusLabel,
          createdAtDate: h.createdAt ? new Date(h.createdAt) : new Date(0),
        };
      })
      .sort((a, b) => b.createdAtDate - a.createdAtDate);
  }, [histories, quotation]);

  return (
    <Card
      title={title}
      className={`rounded-xl shadow-sm border-gray-100 ${className}`}
      headStyle={{ backgroundColor: '#fafafa' }}
      bodyStyle={{
        maxHeight,
        overflowY: 'auto',
        paddingRight: 12,
      }}
    >
      <Timeline>
        {sortedHistories.map((h, idx) => {
          const color = MODULE_COLOR[h.moduleType] || '#6b7280';
          const docLabel = h.deliveryNo || h.deliveryNumber || h.invoiceNumber || h.docNumber;

          return (
            <Timeline.Item key={idx} color={color}>
              <div className="flex flex-col gap-0.5 break-words">
                <Tag
                  color={color}
                  className="w-fit text-[10px] mb-0.5"
                >
                  {h.moduleType}
                  {docLabel ? ` (${docLabel})` : ''}
                </Tag>

                <Text strong className="text-[12px] break-words">
                  {h.statusLabel}
                </Text>

                {h.location && (
                  <Text
                    type="secondary"
                    className="text-[11px] flex items-center gap-1 break-words"
                  >
                    <EnvironmentOutlined /> {h.location}
                  </Text>
                )}

                {(h.changeNote || h.note) && (
                  <Text
                    type="secondary"
                    className="text-[10px] italic break-words"
                  >
                    {h.changeNote || h.note}
                  </Text>
                )}

                {h.delayReason && (
                  <Text
                    type="danger"
                    className="text-[10px] flex items-center gap-1 break-words"
                  >
                    <WarningOutlined /> {h.delayReason}
                  </Text>
                )}

                {h.createdAt && (
                  <Text type="secondary" className="text-[10px]">
                    {new Date(h.createdAt).toLocaleString('en-US')}
                  </Text>
                )}

                {h.changer && (
                  <Text type="secondary" className="text-[10px]">
                    By: {h.changer.name}
                  </Text>
                )}
              </div>
            </Timeline.Item>
          );
        })}
      </Timeline>

      {sortedHistories.length === 0 && (
        <Text type="secondary" className="italic text-xs block text-center py-2">
          No history recorded yet
        </Text>
      )}
    </Card>
  );
};

export default WorkflowHistory;

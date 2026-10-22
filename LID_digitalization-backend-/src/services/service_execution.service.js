const prisma = require('../config/prisma');

const generateServiceNumber = async (tx, { inquiryId, quotationId, poId } = {}) => {
  const client = tx || prisma;
  let seq = '';

  if (quotationId) {
    const q = await client.quotation.findUnique({
      where: { id: BigInt(quotationId) }
    });
    if (q && q.quotationNumber) {
      seq = q.quotationNumber.replace('QUO-', '').split('-R')[0];
    }
  } else if (inquiryId) {
    const inq = await client.inquiry.findUnique({
      where: { id: BigInt(inquiryId) }
    });
    if (inq && inq.inquiryNumber) {
      seq = inq.inquiryNumber.replace('INQ-', '');
    }
  } else if (poId) {
    const po = await client.purchaseOrder.findUnique({
      where: { id: BigInt(poId) },
      include: { quotation: true }
    });
    if (po && po.quotation && po.quotation.quotationNumber) {
      seq = po.quotation.quotationNumber.replace('QUO-', '').split('-R')[0];
    }
  }

  if (seq) {
    return `SVC-${seq}`;
  }

  const year = new Date().getFullYear();
  return `SVC-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const createServiceExecutionFromInquiry = async (tx, inquiryId, userId) => {
  const client = tx || prisma;
  
  const inquiry = await client.inquiry.findUnique({
    where: { id: BigInt(inquiryId) },
  });

  if (!inquiry) throw new Error('Inquiry not found');
  if (inquiry.statusCode === 'CONVERTED') {
    throw new Error('Inquiry has already been converted to a Service Execution');
  }

  const serviceNumber = await generateServiceNumber(client, { inquiryId });

  const service = await client.serviceExecution.create({
    data: {
      serviceNumber,
      sourceType: 'IC_TFS',
      inquiryId: BigInt(inquiryId),
      status: 'PENDING',
      remarks: `Auto-generated from Inquiry IC #${inquiry.inquiryNumber}`,
      createdBy: userId ? Number(userId) : null,
      statusChangedAt: new Date(),
      lastActivityAt: new Date()
    }
  });

  // Update inquiry status
  await client.inquiry.update({
    where: { id: BigInt(inquiryId) },
    data: { statusCode: 'CONVERTED' }
  });

  // Also add history
  await client.inquiryStatusHistory.create({
    data: {
      inquiryId: BigInt(inquiryId),
      oldStatusCode: inquiry.statusCode,
      newStatusCode: 'CONVERTED',
      changeNote: 'Created Service Execution (IC TFS)',
      changedBy: userId ? Number(userId) : null
    }
  });

  return service;
};

const createServiceExecutionFromQuotation = async (tx, quotationId, userId) => {
  const client = tx || prisma;
  
  const quotation = await client.quotation.findUnique({
    where: { id: BigInt(quotationId) },
  });

  if (!quotation) throw new Error('Quotation not found');

  const serviceNumber = await generateServiceNumber(client, { quotationId });

  const service = await client.serviceExecution.create({
    data: {
      serviceNumber,
      sourceType: 'EXTERNAL_TFS',
      quotationId: BigInt(quotationId),
      status: 'PENDING',
      remarks: `Auto-generated from Quotation External #${quotation.quotationNumber}`,
      createdBy: userId ? Number(userId) : null,
      statusChangedAt: new Date(),
      lastActivityAt: new Date()
    }
  });

  // Update quotation status
  await client.quotation.update({
    where: { id: BigInt(quotationId) },
    data: { status: 'EXECUTED' }
  });

  // Also add history
  await client.quotationStatusHistory.create({
    data: {
      quotationId: BigInt(quotationId),
      oldStatus: quotation.status,
      newStatus: 'EXECUTED',
      changeNote: 'Created Service Execution',
      changedBy: userId ? Number(userId) : null
    }
  });

  return service;
};

const autoCreateServiceExecutionForPO = async (tx, poId, poNumber, userId) => {
  const client = tx || prisma;
  
  const po = await client.purchaseOrder.findUnique({
    where: { id: BigInt(poId) },
    include: { serviceDetail: true }
  });

  const serviceNumber = await generateServiceNumber(client, { poId });

  const sourceType = 'EXTERNAL_PURCHASE';
  const svcExt = po.serviceDetail || {};

  const startDate = svcExt.serviceStartDate 
    ? new Date(svcExt.serviceStartDate) 
    : null;

  const targetDate = svcExt.serviceEndDate 
    ? new Date(svcExt.serviceEndDate) 
    : null;

  const service = await client.serviceExecution.create({
    data: {
      serviceNumber,
      sourceType,
      poId: BigInt(poId),
      status: 'PENDING',
      startDate,
      targetDate,
      remarks: `Auto-generated from PO #${poNumber || poId}`,
      createdBy: userId ? Number(userId) : null,
      statusChangedAt: new Date(),
      lastActivityAt: new Date()
    }
  });

  return service;
};

module.exports = {
  generateServiceNumber,
  autoCreateServiceExecutionForPO,
  createServiceExecutionFromInquiry,
  createServiceExecutionFromQuotation
};

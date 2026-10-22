const prisma = require('../config/prisma');

const INQUIRY_START_NUMBER = parseInt(process.env.INQUIRY_START_NUMBER, 10) || 1;

const generateInquiryNumber = async (tx) => {
  const client = tx || prisma;
  const lastInquiry = await client.inquiry.findFirst({
    orderBy: { id: 'desc' },
    select: { inquiryNumber: true }
  });

  let nextSeq = INQUIRY_START_NUMBER;
  if (lastInquiry && lastInquiry.inquiryNumber) {
    const match = lastInquiry.inquiryNumber.match(/\d+/);
    if (match) {
      nextSeq = parseInt(match[0], 10) + 1;
    }
  }

  const seq = String(nextSeq).padStart(5, '0');
  return `INQ-${seq}`;
};

const getInquiryStatuses = async () => {
  // Hardcoded inquiry statuses (no DB changes)
  return [
    { id: 1, statusCode: 'OPEN', statusName: 'Open' },
    { id: 2, statusCode: 'FOLLOW_UP', statusName: 'Follow Up' },
    { id: 3, statusCode: 'CLOSED', statusName: 'Closed' },
  ];
};

const getInquirySources = async () => {
  // Hardcoded inquiry sources (no DB changes)
  return [
    { id: 1, sourceCode: 'WEB', sourceName: 'Web' },
    { id: 2, sourceCode: 'PHONE', sourceName: 'Phone' },
    { id: 3, sourceCode: 'EMAIL', sourceName: 'Email' },
  ];
};

const getInquiries = async (filters) => {
  const { year, ...restFilters } = filters;

  const where = { ...restFilters };

  if (year) {
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
    where.createdAt = {
      gte: startOfYear,
      lte: endOfYear
    };
  }

  return await prisma.inquiry.findMany({
    where,
    include: {
      customer: true,
      codeWord: true,
      details: true,
      creator: true,
      updater: true,
      quotations: true,
    },
    orderBy: { createdAt: 'desc' }
  });
};

const getInquiryById = async (id) => {
  return await prisma.inquiry.findUnique({
    where: { id: BigInt(id) },
    include: {
      customer: true,
      codeWord: true,
      details: true,
      creator: true,
      updater: true,
      histories: {
        include: { changer: true },
        orderBy: { createdAt: 'desc' }
      },
      quotations: true
    }
  });
};

const createInquiry = async (data, userId) => {
  const { customerId, codeWordId, sourceCode, requestType, subject, description, dueDate, details } = data;

  if (requestType === 'SPARE_PART' && details && details.length > 0) {
    for (let i = 0; i < details.length; i++) {
      if (!details[i].requestedPartNumber || details[i].requestedPartNumber.trim() === '') {
        throw new Error(`Part Number (PN) wajib diisi untuk setiap item pada Inquiry Spare Part (Item ke-${i + 1}).`);
      }
    }
  }

  const now = new Date();
  const inquiryNumber = await generateInquiryNumber();
  const inqData = {
    inquiryNumber,
    inquiryDate: now,
    statusCode: 'OPEN',
    sourceCode: sourceCode || null,
    requestType,
    subject,
    description: description || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    statusChangedAt: now,
    lastActivityAt: now,
  };

  if (userId) inqData.creator = { connect: { id: Number(userId) } };
  if (customerId) inqData.customer = { connect: { id: Number(customerId) } };
  if (codeWordId) inqData.codeWord = { connect: { id: Number(codeWordId) } };

  if (details && details.length > 0) {
    inqData.details = {
      create: details.map((d, i) => ({
        lineNo: i + 1,
        itemType: d.itemType || 'SERVICE',
        serviceSubType: d.serviceSubType || null,
        requestDescription: d.requestDescription != null ? d.requestDescription : '',
        requestedItemName: d.requestedItemName || null,
        requestedPartNumber: d.requestedPartNumber || null,
        qty: d.qty || 1,
        uom: d.uom || null,
      }))
    };
  }

  const result = await prisma.inquiry.create({
    data: inqData,
    include: { details: true, customer: true, codeWord: true, creator: true }
  });

  await prisma.inquiryStatusHistory.create({
    data: {
      inquiryId: result.id,
      newStatusCode: 'OPEN',
      changedBy: userId ? Number(userId) : null,
      changeNote: "Inquiry Created"
    }
  });

  return result;
};


const updateInquiry = async (id, data, userId) => {
  const existingInquiry = await prisma.inquiry.findUnique({
    where: { id: BigInt(id) },
    select: { statusCode: true }
  });

  const { changeNote, ...restData } = data;
  const {
    customerId,
    codeWordId,
    sourceCode,
    requestType,
    subject,
    description,
    dueDate,
    details
  } = restData;

  if (requestType === 'SPARE_PART' && details && details.length > 0) {
    for (let i = 0; i < details.length; i++) {
      if (!details[i].requestedPartNumber || details[i].requestedPartNumber.trim() === '') {
        throw new Error(`Part Number (PN) wajib diisi untuk setiap item pada Inquiry Spare Part (Item ke-${i + 1}).`);
      }
    }
  }

  const updatePayload = {
    requestType,
    subject,
    description,
    dueDate: dueDate ? new Date(dueDate) : null,
    sourceCode: sourceCode || null,
    lastActivityAt: new Date(),
  };

  if (customerId) updatePayload.customer = { connect: { id: Number(customerId) } };
  else updatePayload.customerId = null;

  if (codeWordId) updatePayload.codeWord = { connect: { id: Number(codeWordId) } };
  else updatePayload.codeWordId = null;

  if (userId) updatePayload.updater = { connect: { id: Number(userId) } };

  if (details) {
    await prisma.inquiryDetail.deleteMany({
      where: { inquiryId: BigInt(id) }
    });

    updatePayload.details = {
      create: details.map((d, i) => ({
        lineNo: i + 1,
        itemType: d.itemType || 'SERVICE',
        serviceSubType: d.serviceSubType || null,
        requestDescription: d.requestDescription != null ? d.requestDescription : '',
        requestedItemName: d.requestedItemName,
        requestedPartNumber: d.requestedPartNumber,
        qty: d.qty || 1,
        uom: d.uom,
      }))
    };
  }

  const updatedResult = await prisma.inquiry.update({
    where: { id: BigInt(id) },
    data: updatePayload,
    include: { details: true, customer: true, codeWord: true, updater: true }
  });

  const currentStatusCode = existingInquiry?.statusCode || updatedResult.statusCode || 'OPEN';

  const noteText = changeNote && changeNote.trim() !== '' ? changeNote.trim() : "Inquiry Data Updated";
  const formattedNote = noteText.toLowerCase().startsWith('update:') ? noteText : `Update: ${noteText}`;

  await prisma.inquiryStatusHistory.create({
    data: {
      inquiryId: BigInt(id),
      oldStatusCode: currentStatusCode,
      newStatusCode: currentStatusCode,
      changedBy: userId ? Number(userId) : null,
      changeNote: formattedNote
    }
  });

  return updatedResult;
};

const deleteInquiry = async (id) => {
  return await prisma.inquiry.delete({
    where: { id: BigInt(id) }
  });
};

const updateInquiryStatus = async (id, newStatusCode, changeNote, userId) => {
  const inquiry = await prisma.inquiry.findUnique({ where: { id: BigInt(id) } });
  if (!inquiry) throw new Error("Inquiry not found");

  const oldStatusCode = inquiry.statusCode;

  const now = new Date();
  const updatedInq = await prisma.inquiry.update({
    where: { id: BigInt(id) },
    data: {
      statusCode: newStatusCode,
      updatedBy: userId ? Number(userId) : null,
      statusChangedAt: now,
      lastActivityAt: now,
    },
  });

  await prisma.inquiryStatusHistory.create({
    data: {
      inquiryId: BigInt(id),
      oldStatusCode: oldStatusCode,
      newStatusCode: newStatusCode,
      changedBy: userId ? Number(userId) : null,
      changeNote
    }
  });

  return updatedInq;
};



module.exports = {
  getInquiryStatuses,
  getInquirySources,
  getInquiries,
  getInquiryById,
  createInquiry,
  updateInquiry,
  deleteInquiry,
  updateInquiryStatus
};

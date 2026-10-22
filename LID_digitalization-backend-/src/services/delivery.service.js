const prisma = require('../config/prisma');
const nodemailer = require('nodemailer');
const path = require('path');
const { generatePdfFromTemplate } = require('./pdf.service');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ─── Helper ──────────────────────────────────────────────────────────────────

const generateDeliveryNumber = async (tx, poId) => {
  const client = tx || prisma;
  let baseNumber = null;
  if (poId) {
    const po = await client.purchaseOrder.findUnique({
      where: { id: BigInt(poId) },
      include: { quotation: true }
    });
    if (po && po.quotation && po.quotation.quotationNumber) {
      const cleanSeq = po.quotation.quotationNumber.replace('QUO-', '').split('-R')[0];
      baseNumber = `DEL-${cleanSeq}`;
    }
  }

  if (!baseNumber) {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    baseNumber = `DEL-${yyyymm}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Check if baseNumber is already used
  const existing = await client.delivery.findUnique({
    where: { deliveryNumber: baseNumber }
  });

  if (!existing) {
    return baseNumber;
  }

  // If already used (e.g. split delivery), append suffix: DEL-00006-1, DEL-00006-2, etc.
  let suffix = 1;
  while (true) {
    const candidate = `${baseNumber}-${suffix}`;
    const existsCandidate = await client.delivery.findUnique({
      where: { deliveryNumber: candidate }
    });
    if (!existsCandidate) {
      return candidate;
    }
    suffix++;
  }
};

// ─── Queries ─────────────────────────────────────────────────────────────────

const getDeliveries = async (filters = {}) => {
  const { year, ...restFilters } = filters;
  const where = {};
  if (restFilters.status) where.status = restFilters.status;
  if (restFilters.poId) where.poId = BigInt(restFilters.poId);
  
  if (year) {
    where.createdAt = {
      gte: new Date(`${year}-01-01T00:00:00.000Z`),
      lte: new Date(`${year}-12-31T23:59:59.999Z`),
    };
  }

  if (restFilters.poType) {
    if (filters.poType === 'SPARE_PART') {
      where.purchaseOrder = {
        OR: [
          { poType: 'SPARE_PART' },
          { quotation: { inquiry: { requestType: 'SPARE_PART' } } }
        ]
      };
    } else if (filters.poType === 'SERVICE') {
      where.purchaseOrder = {
        OR: [
          { poType: 'SERVICE' },
          { quotation: { inquiry: { requestType: { startsWith: 'SERVICE_' } } } }
        ]
      };
    } else if (filters.poType === 'PROJECT') {
      where.purchaseOrder = {
        OR: [
          { poType: 'PROJECT' },
          { quotation: { inquiry: { requestType: { startsWith: 'PROJECT_' } } } }
        ]
      };
    }
  }

  return await prisma.delivery.findMany({
    where,
    include: {
      purchaseOrder: {
        include: {
          quotation: {
            include: { inquiry: { include: { customer: true } } }
          }
        }
      },
      items: { include: { poDetail: { include: { service: true, sparePart: true } } } },
      histories: { orderBy: { createdAt: 'desc' }, take: 1 },
      creator: true,
      updater: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

const getDeliveryById = async (id) => {
  const delivery = await prisma.delivery.findUnique({
    where: { id: BigInt(id) },
    include: {
      purchaseOrder: {
        include: {
          details: { include: { service: true, sparePart: true } },
          histories: { orderBy: { createdAt: 'desc' }, include: { changer: true } },
          quotation: {
            include: {
              details: true,
              inquiry: {
                include: {
                  customer: true,
                  codeWord: true,
                  details: true,
                  histories: { orderBy: { createdAt: 'desc' }, include: { changer: true } }
                }
              },
              histories: { orderBy: { createdAt: 'desc' }, include: { changer: true } }
            }
          }
        }
      },
      items: { include: { poDetail: { include: { service: true, sparePart: true } } } },
      histories: { orderBy: { createdAt: 'desc' }, include: { changer: true } },
      creator: true,
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          paymentDate: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (delivery && delivery.poId) {
    delivery.siblingDeliveries = await prisma.delivery.findMany({
      where: {
        poId: delivery.poId,
        id: { not: delivery.id }
      },
      select: {
        id: true,
        deliveryNumber: true,
        status: true,
        createdAt: true
      },
      orderBy: { id: 'asc' }
    });
  }

  return delivery;
};

// ─── Mutations ────────────────────────────────────────────────────────────────

const createDelivery = async (poId, itemSelections = [], userId) => {
  return await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: BigInt(poId) },
      include: { details: true }
    });
    if (!po) throw new Error(`Purchase Order not found for ID ${poId}`);
    if (po.status !== 'IN_PROGRESS' && po.status !== 'COMPLETED') {
      throw new Error('Delivery can only be created for PO in COMPLETED or IN_PROGRESS status');
    }

    const deliveryNumber = await generateDeliveryNumber(tx, poId);

    const delivery = await tx.delivery.create({
      data: {
        deliveryNumber,
        poId: BigInt(poId),
        status: 'REVIEW_LOGISTIC',
        clientPoNumber: null,
        createdBy: userId ? Number(userId) : null,
        ...(itemSelections.length > 0 && {
          items: {
            create: itemSelections.map(item => ({
              poDetailId: BigInt(item.poDetailId),
              qtyDelivered: item.qtyDelivered || 0,
              note: item.note || null
            }))
          }
        })
      },
      include: { items: true }
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: null,
        newStatus: 'REVIEW_LOGISTIC',
        note: `Delivery created manually for PO #${po.poNumber || poId}`,
        changedBy: userId ? Number(userId) : null
      }
    });

    return delivery;
  });
};

const updateDeliveryTracking = async (id, data, userId) => {
  const {
    trackingNumber, shippingService, currentLocation,
    targetDeliveryDate, logisticNote, reminderEmail,
    weightKg, dimensions, freightCost,
    forwarderPoFile, forwarderQuotationFile, otherForwarderQuotationFiles,
    forwarderInvoiceFile, clientPoNumber, packingList
  } = data;

  return await prisma.$transaction(async (tx) => {
    const current = await tx.delivery.findUnique({
      where: { id: BigInt(id) },
      include: {
        invoices: {
          select: { id: true, invoiceNumber: true, status: true }
        }
      }
    });

    if (!current) throw new Error('Delivery not found');

    const paidInvoice = current.invoices?.find(inv => inv.status === 'PAID');
    if (paidInvoice) {
      const currentFreight = current.freightCost !== null ? parseFloat(current.freightCost) : null;
      const newFreight = freightCost !== undefined && freightCost !== null && freightCost !== '' ? parseFloat(freightCost) : null;
      if (freightCost !== undefined && newFreight !== currentFreight) {
        throw new Error(`Freight Cost tidak dapat diubah karena Invoice #${paidInvoice.invoiceNumber || paidInvoice.id} sudah berstatus PAID (selesai).`);
      }
      if (forwarderInvoiceFile !== undefined && forwarderInvoiceFile !== current.forwarderInvoiceFile) {
        throw new Error(`Dokumen Invoice Forwarder tidak dapat diubah karena Invoice #${paidInvoice.invoiceNumber || paidInvoice.id} sudah berstatus PAID (selesai).`);
      }
    }

    // If status is post-PACKED (SHIPPED, IN_TRANSIT, DELIVERED, COMPLETED), general tracking is locked
    const isPostPacked = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(current.status);

    const updatedFreight = freightCost !== undefined && freightCost !== null && freightCost !== '' ? parseFloat(freightCost) : null;
    const currentFreight = current.freightCost !== null ? parseFloat(current.freightCost) : null;
    const isFreightChanged = updatedFreight !== currentFreight && freightCost !== undefined;

    const updated = await tx.delivery.update({
      where: { id: BigInt(id) },
      data: {
        ...(!isPostPacked && trackingNumber !== undefined && { trackingNumber }),
        ...(!isPostPacked && shippingService !== undefined && { shippingService }),
        ...(!isPostPacked && currentLocation !== undefined && { currentLocation }),
        ...(!isPostPacked && targetDeliveryDate !== undefined && { targetDeliveryDate: targetDeliveryDate ? new Date(targetDeliveryDate) : null }),
        ...(logisticNote !== undefined && { logisticNote }),
        ...(reminderEmail !== undefined && { reminderEmail }),
        ...(!isPostPacked && weightKg !== undefined && { weightKg: weightKg !== null && weightKg !== '' ? parseFloat(weightKg) : null }),
        ...(!isPostPacked && dimensions !== undefined && { dimensions: dimensions || null }),
        ...(freightCost !== undefined && { freightCost: updatedFreight }),
        ...(!isPostPacked && forwarderPoFile !== undefined && { forwarderPoFile }),
        ...(!isPostPacked && forwarderQuotationFile !== undefined && { forwarderQuotationFile }),
        ...(!isPostPacked && otherForwarderQuotationFiles !== undefined && { otherForwarderQuotationFiles }),
        ...(forwarderInvoiceFile !== undefined && { forwarderInvoiceFile }),
        ...(clientPoNumber !== undefined && { clientPoNumber }),
        ...(packingList !== undefined && { packingList }),
        updatedBy: userId ? Number(userId) : null
      }
    });

    if (isFreightChanged) {
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: current.id,
          oldStatus: current.status,
          newStatus: current.status,
          note: `Freight Cost diperbarui dari IDR ${(currentFreight || 0).toLocaleString('id-ID')} menjadi IDR ${(updatedFreight || 0).toLocaleString('id-ID')}`,
          changedBy: userId ? Number(userId) : null
        }
      });
    }

    return updated;
  });
};

const updateDeliveryStatus = async (id, data, userId) => {
  const { newStatus, location, note, delayReason, giNumber } = data;

  return await prisma.$transaction(async (tx) => {
    const current = await tx.delivery.findUnique({ where: { id: BigInt(id) } });
    if (!current) throw new Error('Delivery not found');

    const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED'];
    if (TERMINAL_STATUSES.includes(current.status)) {
      throw new Error(`Cannot update status from ${current.status}`);
    }

    if (newStatus === 'DELAYED' && !delayReason) {
      throw new Error('delay_reason is required when marking as DELAYED');
    }

    if (newStatus === 'PACKED') {
      const missing = [];
      if (!current.trackingNumber)    missing.push('Tracking Number (AWB)');
      if (!current.shippingService)   missing.push('Shipping Service');
      if (!current.currentLocation)   missing.push('Current Location');
      if (!current.targetDeliveryDate) missing.push('Target Delivery Date');
      if (current.weightKg === null || current.weightKg === undefined) missing.push('Weight (kg)');
      if (!current.dimensions)        missing.push('Dimension (P×L×T)');
      if (!current.forwarderPoFile)        missing.push('Purchase Order Forwarder (PDF)');
      if (!current.forwarderQuotationFile) missing.push('Quotation Forwarder (PDF)');
      if (missing.length > 0) {
        throw new Error(`Lengkapi data berikut sebelum menandai sebagai PACKED: ${missing.join(', ')}`);
      }
    }

    const { proofOfDelivery } = data;
    if (newStatus === 'DELIVERED' && !proofOfDelivery && !current.proofOfDelivery) {
      throw new Error('Proof of Delivery (PDF) is required when marking as DELIVERED');
    }

    if (newStatus === 'COMPLETED' && !giNumber) {
      throw new Error('GI Number is required when marking as COMPLETED');
    }

    const updateData = {
      status: newStatus,
      ...(location && { currentLocation: location }),
      ...(newStatus === 'DELAYED' && { delayReason }),
      ...(newStatus === 'DELIVERED' && { actualDeliveryDate: new Date() }),
      ...(proofOfDelivery && { proofOfDelivery }),
      ...(newStatus === 'COMPLETED' && giNumber && { giNumber }),
      updatedBy: userId ? Number(userId) : null
    };

    const updated = await tx.delivery.update({
      where: { id: BigInt(id) },
      data: updateData
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: updated.id,
        oldStatus: current.status,
        newStatus,
        location: location || null,
        note: note || null,
        delayReason: delayReason || null,
        changedBy: userId ? Number(userId) : null
      }
    });

    return updated;
  });
};

// ─── Email (Overdue) ──────────────────────────────────────────────────────────

const sendOverdueEmail = async (delivery) => {
  if (!delivery.reminderEmail) return;

  const customer = delivery.purchaseOrder?.quotation?.inquiry?.customer?.name || '-';
  const poNumber = delivery.purchaseOrder?.poNumber || delivery.poId.toString();

  const mailOptions = {
    from: process.env.SMTP_USER || '"Digitalization System" <no-reply@example.com>',
    to: delivery.reminderEmail,
    subject: `⚠️ OVERDUE: Delivery ${delivery.deliveryNumber} has passed target date`,
    html: `
      <h2>Delivery Overdue Alert</h2>
      <p>Delivery <strong>${delivery.deliveryNumber}</strong> has passed its target delivery date.</p>
      <p><strong>PO Number:</strong> ${poNumber}</p>
      <p><strong>Customer:</strong> ${customer}</p>
      <p><strong>Target Date:</strong> ${delivery.targetDeliveryDate ? new Date(delivery.targetDeliveryDate).toLocaleDateString() : '-'}</p>
      <p><strong>Current Status:</strong> ${delivery.status}</p>
      <p>Please update the delivery status and provide a delay reason immediately.</p>
      <hr />
      <em>LIND Digitalization System</em>
    `
  };

  return await transporter.sendMail(mailOptions);
};

const checkOverdueDeliveries = async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const overdueDeliveries = await prisma.delivery.findMany({
    where: {
      status: { notIn: ['COMPLETED', 'CANCELLED', 'DELIVERED'] },
      targetDeliveryDate: { lt: yesterday },
      reminderEmail: { not: null }
    },
    include: {
      purchaseOrder: {
        include: {
          quotation: { include: { inquiry: { include: { customer: true } } } }
        }
      }
    }
  });

  const results = [];
  for (const d of overdueDeliveries) {
    try {
      const info = await sendOverdueEmail(d);
      results.push({ deliveryId: d.id.toString(), status: 'sent', messageId: info?.messageId });
    } catch (err) {
      results.push({ deliveryId: d.id.toString(), status: 'error', error: err.message });
    }
  }
  return results;
};

const deleteDeliveryItem = async (deliveryId, itemId) => {
  return await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: { id: BigInt(deliveryId) }
    });
    if (!delivery) throw new Error('Delivery not found');
    if (['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'COMPLETED', 'CANCELLED'].includes(delivery.status)) {
      throw new Error('Cannot delete items after delivery has been shipped or completed');
    }

    return await tx.deliveryItem.delete({
      where: { id: BigInt(itemId) }
    });
  });
};

// ─── Hard Delete ─────────────────────────────────────────────────────────────

const deleteDelivery = async (id) => {
  const delivery = await prisma.delivery.findUnique({ where: { id: BigInt(id) } });
  if (!delivery) throw new Error('Delivery not found');

  // Collect file paths to clean up
  const filesToDelete = [delivery.proofOfDelivery].filter(Boolean);

  // Hard delete — cascade will remove items and histories via schema relations
  await prisma.delivery.delete({ where: { id: BigInt(id) } });

  // Clean up physical files after successful DB delete
  if (filesToDelete.length > 0) {
    const { deleteFiles } = require('../utils/file.utils');
    deleteFiles(filesToDelete);
  }

  return { deleted: true };
};

// ─── Generate Delivery Note PDF ──────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDateDDMMMMYYYY(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

const generateDeliveryNotePdf = async (id, { deliveryMethod, shippingAddress, pic, clientPoNumber, packingList }) => {
  // 1. Save deliveryMethod & shippingAddress to DB
  await prisma.delivery.update({
    where: { id: BigInt(id) },
    data: {
      ...(deliveryMethod !== undefined && { deliveryMethod }),
      ...(shippingAddress !== undefined && { shippingAddress }),
      ...(pic !== undefined && { pic }),
      ...(clientPoNumber !== undefined && { clientPoNumber }),
      ...(packingList !== undefined && { packingList }),
    }
  });

  // 2. Fetch full delivery data
  const delivery = await prisma.delivery.findUnique({
    where: { id: BigInt(id) },
    include: {
      items: {
        include: {
          poDetail: {
            include: { service: true, sparePart: true }
          }
        }
      },
      purchaseOrder: {
        include: {
          quotation: {
            include: {
              details: true,
              inquiry: {
                include: { 
                  customer: true,
                  details: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!delivery) throw new Error('Delivery not found');

  // 3. Build items array for template
  const quotationDetails = delivery.purchaseOrder?.quotation?.details || [];
  const inquiryDetails = delivery.purchaseOrder?.quotation?.inquiry?.details || [];

  const items = delivery.items.map((item) => {
    const pd = item.poDetail;
    let description = pd?.service?.serviceName || pd?.sparePart?.partName || 'Item';

    if (pd?.quotationDetailId) {
      const qd = quotationDetails.find(q => q.id === pd.quotationDetailId);
      if (qd && qd.inquiryDetailId) {
        const idet = inquiryDetails.find(i => i.id === qd.inquiryDetailId);
        if (idet) {
          description = idet.requestedItemName || idet.requestDescription || description;
        }
      }
    }

    const ordered = parseFloat(pd?.qty || 0);
    const delivered = parseFloat(item.qtyDelivered || 0);
    const outstanding = Math.max(0, ordered - delivered);

    return {
      description,
      ordered: ordered % 1 === 0 ? ordered.toFixed(0) : ordered.toFixed(2),
      delivered: delivered % 1 === 0 ? delivered.toFixed(0) : delivered.toFixed(2),
      outstanding: outstanding % 1 === 0 ? outstanding.toFixed(0) : outstanding.toFixed(2),
    };
  });

  // 4. Build template data
  const customer = delivery.purchaseOrder?.quotation?.inquiry?.customer;
  const applicantDetail = customer ? `${customer.name || ''}<br>${(customer.address || '').replace(/\n/g, '<br>')}` : '-';
  const forwarderDetail = delivery.shippingService || '-';

  const templateData = {
    date: formatDateDDMMMMYYYY(delivery.targetDeliveryDate),
    deliveryNoteNumber: delivery.deliveryNumber,
    deliveryMethod: deliveryMethod || delivery.deliveryMethod || '-',
    shippingAddress: (shippingAddress || delivery.shippingAddress || '').replace(/\n/g, '<br>'),
    logisticNote: delivery.logisticNote ? delivery.logisticNote.replace(/\n/g, '<br>') : '',
    applicantDetail,
    forwarderDetail,
    items,
    pic: pic || delivery.pic || '',

    // Prepared data for delivery note PDF
    sdDocument: delivery.purchaseOrder?.sdDocument || '-',
    sdNumber: delivery.purchaseOrder?.sdDocument || '-',
    soSdSapNumber: delivery.purchaseOrder?.sdDocument || '-',
    clientPoNumber: delivery.clientPoNumber || '-',
    poNumber: delivery.purchaseOrder?.poNumber || '-',
    customerPoNumber: delivery.clientPoNumber || '-',
    packingList: delivery.packingList || '-',
    packingListNumber: delivery.packingList || '-',
    packingListData: delivery.packingList ? delivery.packingList.replace(/\n/g, '<br>') : '-',
    packingListDisplay: delivery.packingList && delivery.packingList.trim()
      ? (/^packing\s*list/i.test(delivery.packingList.trim())
          ? delivery.packingList.trim()
          : `packing list: ${delivery.packingList.trim()}`)
      : 'packing list: -'
  };

  // 5. Generate PDF
  const templatePath = path.join(__dirname, '../templates/delivery/delivery-note-template.html');
  const pdfBuffer = await generatePdfFromTemplate(templatePath, templateData, { singlePage: true });
  return pdfBuffer;
};

// ─── Auto-create (called from po.service.js) ──────────────────────────────────

const autoCreateDeliveryForPO = async (tx, poId, poNumber, userId) => {
  const deliveryNumber = await generateDeliveryNumber(tx, poId);

  // 1. Fetch PO Details to get items
  const po = await tx.purchaseOrder.findUnique({
    where: { id: BigInt(poId) },
    include: { details: true }
  });

  if (!po) throw new Error(`Purchase Order not found: ${poId}`);

  // 2. Create Delivery with all items from PO
  const delivery = await tx.delivery.create({
    data: {
      deliveryNumber,
      poId: BigInt(poId),
      clientPoNumber: null,
      status: 'REVIEW_LOGISTIC',
      createdBy: userId ? Number(userId) : null,
      items: {
        create: (po.details || []).map(d => ({
          poDetailId: d.id,
          qtyDelivered: d.qty, // Default to full quantity
          note: 'Initial auto-created item'
        }))
      }
    }
  });

  await tx.deliveryStatusHistory.create({
    data: {
      deliveryId: delivery.id,
      oldStatus: null,
      newStatus: 'REVIEW_LOGISTIC',
      note: `Delivery auto-created with ${po.details?.length || 0} items. PO #${poNumber || poId} moved to IN_PROGRESS.`,
      changedBy: userId ? Number(userId) : null
    }
  });

  return delivery;
};

const splitDelivery = async (originDeliveryId, { deliveryItemIds, remarks }, userId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch origin delivery
    const originDelivery = await tx.delivery.findUnique({
      where: { id: BigInt(originDeliveryId) },
      include: {
        items: true,
        purchaseOrder: true
      }
    });

    if (!originDelivery) throw new Error('Delivery tidak ditemukan');
    if (['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(originDelivery.status)) {
      throw new Error(`Delivery dengan status "${originDelivery.status}" tidak dapat di-split. Hanya status persiapan (REVIEW_LOGISTIC atau PACKED) yang dapat di-split.`);
    }

    if (!Array.isArray(deliveryItemIds) || deliveryItemIds.length === 0) {
      throw new Error('Pilih minimal 1 item untuk dipindahkan ke Delivery baru');
    }

    const allItemIds = originDelivery.items.map(i => String(i.id));
    const selectedItemIds = deliveryItemIds.map(String);

    const invalidIds = selectedItemIds.filter(id => !allItemIds.includes(id));
    if (invalidIds.length > 0) {
      throw new Error('Satu atau lebih item yang dipilih tidak berada di Delivery ini');
    }

    if (selectedItemIds.length >= allItemIds.length) {
      throw new Error('Tidak dapat memindahkan seluruh item. Sisakan minimal 1 item di Delivery saat ini');
    }

    // 2. Generate new delivery number
    const newDeliveryNumber = await generateDeliveryNumber(tx, originDelivery.poId);

    // 3. Create new delivery
    const newDelivery = await tx.delivery.create({
      data: {
        deliveryNumber: newDeliveryNumber,
        poId: originDelivery.poId,
        clientPoNumber: originDelivery.clientPoNumber || null,
        packingList: originDelivery.packingList || null,
        status: 'REVIEW_LOGISTIC',
        logisticNote: remarks || `Split dari Delivery #${originDelivery.deliveryNumber || originDelivery.id}`,
        createdBy: userId ? Number(userId) : null
      }
    });

    // 4. Move selected deliveryItem records to new delivery
    await tx.deliveryItem.updateMany({
      where: { id: { in: selectedItemIds.map(BigInt) } },
      data: { deliveryId: newDelivery.id }
    });

    // 5. Audit history for both deliveries
    const movedCount = selectedItemIds.length;
    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: originDelivery.id,
        oldStatus: originDelivery.status,
        newStatus: originDelivery.status,
        note: `Split ${movedCount} item ke Delivery baru #${newDelivery.deliveryNumber}`,
        changedBy: userId ? Number(userId) : null
      }
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: newDelivery.id,
        oldStatus: null,
        newStatus: 'REVIEW_LOGISTIC',
        note: `Dibuat dari split Delivery #${originDelivery.deliveryNumber} membawa ${movedCount} item`,
        changedBy: userId ? Number(userId) : null
      }
    });

    return {
      success: true,
      originalDeliveryId: originDelivery.id,
      newDeliveryId: newDelivery.id,
      newDeliveryNumber: newDelivery.deliveryNumber
    };
  });
};

module.exports = {
  getDeliveries,
  getDeliveryById,
  createDelivery,
  splitDelivery,
  updateDeliveryTracking,
  updateDeliveryStatus,
  checkOverdueDeliveries,
  autoCreateDeliveryForPO,
  deleteDeliveryItem,
  deleteDelivery,
  generateDeliveryNotePdf
};

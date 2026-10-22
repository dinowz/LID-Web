const prisma = require('../config/prisma');
const { deleteFile } = require('../utils/file.utils');

// Helper: Menghitung harga jual satuan resmi dari Quotation Detail
const getCalculatedUnitSellPrice = (qDetail, poDetail) => {
  if (!qDetail) {
    return Number(poDetail?.unitPrice || 0);
  }

  const sellPrice = Number(qDetail.sellPriceCalc || 0);
  const qty = Number(qDetail.qty || 1);

  // 1. Jika sudah ada sellPriceCalc hasil kalkulasi parameter (> 0)
  if (sellPrice > 0 && qty > 0) {
    return Math.round(sellPrice / qty);
  }

  // 2. Fallback untuk data lama atau tanpa markup parameter
  const baseUnitPrice = Number(qDetail.unitPrice || 0);
  const unitDiscount = qty > 0 ? (Number(qDetail.discount || 0) / qty) : 0;
  return Math.max(Math.round(baseUnitPrice - unitDiscount), 0);
};
const generateInvoiceNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `INV/${year}/${month}/`;
  
  const latestInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      invoiceNumber: 'desc'
    }
  });

  let nextSeq = 1;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const parts = latestInvoice.invoiceNumber.split('/');
    const lastSeqStr = parts[parts.length - 1];
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seq = String(nextSeq).padStart(3, '0');
  return `${prefix}${seq}`;
};

// ── Business Logic ────────────────────────────────────────────────────────────

const getReadyToInvoiceList = async (year) => {
  const dateFilter = year ? {
    gte: new Date(`${year}-01-01T00:00:00.000Z`),
    lte: new Date(`${year}-12-31T23:59:59.999Z`),
  } : undefined;

  const [deliveries, services, projects, dpPurchaseOrders] = await Promise.all([
    // 1. Deliveries
    prisma.delivery.findMany({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        invoices: { none: {} },
        ...(dateFilter && {
          OR: [
            { actualDeliveryDate: dateFilter },
            { AND: [{ actualDeliveryDate: null }, { createdAt: dateFilter }] }
          ]
        })
      },
      include: {
        items: { include: { poDetail: { include: { sparePart: true } } } },
        purchaseOrder: {
          include: { quotation: { include: { details: true, inquiry: { include: { customer: true } } } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    
    // 2. Services
    prisma.serviceExecution.findMany({
      where: {
        status: { in: ['DONE', 'COMPLETED'] },
        invoices: { none: {} },
        ...(dateFilter && {
          OR: [
            { completedDate: dateFilter },
            { AND: [{ completedDate: null }, { createdAt: dateFilter }] }
          ]
        })
      },
      include: {
        purchaseOrder: {
          include: { 
            details: true,
            quotation: { include: { details: true, inquiry: { include: { customer: true } } } } 
          }
        },
        inquiry: { include: { customer: true } },
        quotation: { include: { details: true, inquiry: { include: { customer: true } } } },
        tfsAssignments: { include: { personnel: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),

    // 3. Projects (Partial Payment allowed)
    prisma.projectExecution.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'DONE', 'COMPLETED'] },
        ...(dateFilter && {
          OR: [
            { completedDate: dateFilter },
            { AND: [{ completedDate: null }, { updatedAt: dateFilter }] },
            { AND: [{ completedDate: null }, { createdAt: dateFilter }] }
          ]
        })
      },
      include: {
        purchaseOrder: {
          include: { 
            details: true,
            quotation: { include: { details: true, inquiry: { include: { customer: true } } } } 
          }
        },
        invoices: {
          where: { status: { not: 'CANCELLED' } }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),

    // 4. Down Payment for Sparepart POs (Unbilled DP)
    prisma.purchaseOrder.findMany({
      where: {
        hasDp: true,
        dpInvoiced: false,
        status: { not: 'CANCELLED' },
        ...(dateFilter && { createdAt: dateFilter })
      },
      include: {
        quotation: {
          include: { inquiry: { include: { customer: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const list = [];

  // Map Down Payment POs (Trigger 1)
  dpPurchaseOrders.forEach(po => {
    const dpPercent = Number(po.dpPercent || 0);
    const dpAmount = Number(po.dpAmount || 0);
    const customer = po.quotation?.inquiry?.customer;

    list.push({
      id: po.id.toString(),
      sourceType: 'DELIVERY',
      isDp: true,
      hasDp: true,
      dpPercent,
      referenceNumber: `${po.poNumber || `PO-${po.id}`} (DP ${dpPercent}%)`,
      sdNumber: po.sdDocument || null,
      poNumber: po.poNumber,
      currency: po.currency || 'IDR',
      customerName: customer?.name || 'Unknown',
      customerId: customer?.id,
      completionDate: po.createdAt,
      status: po.status,
      billingStatus: 'OPEN',
      totalAmount: dpAmount,
      items: [{
        description: `Down Payment (${dpPercent}%) - ${po.poNumber || 'PO'}`,
        qty: 1,
        uom: 'lot',
        unitPrice: dpAmount,
        total: dpAmount
      }]
    });
  });

  // Map Deliveries (Trigger 2: Pelunasan 80% if PO has DP)
  deliveries.forEach(d => {
    const qDetails = d.purchaseOrder?.quotation?.details || [];
    const po = d.purchaseOrder;
    const hasDp = Boolean(po?.hasDp && Number(po?.dpAmount || 0) > 0);
    const dpPercent = Number(po?.dpPercent || 0);
    const dpAmount = hasDp ? Number(po.dpAmount || 0) : 0;

    const baseItems = d.items.map(item => {
      const matchedQDetail = qDetails.find(qd => 
        (item.poDetail?.inquiryDetailId && qd.inquiryDetailId === item.poDetail.inquiryDetailId) ||
        (item.poDetail?.sparePartId && qd.mappedSparePartId === item.poDetail.sparePartId)
      );
      const unitPrice = getCalculatedUnitSellPrice(matchedQDetail, item.poDetail);
      return {
        description: item.poDetail?.sparePart?.partName || 'Sparepart Item',
        qty: item.qtyDelivered,
        uom: item.poDetail?.sparePart?.uom || 'pcs',
        unitPrice: unitPrice,
        total: Number(item.qtyDelivered) * unitPrice
      };
    });

    const fullDeliveryTotal = baseItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const remainingToInvoice = hasDp ? Math.max(fullDeliveryTotal - dpAmount, 0) : fullDeliveryTotal;

    list.push({
      id: d.id.toString(),
      sourceType: 'DELIVERY',
      isDp: false,
      hasDp,
      dpPercent: hasDp ? dpPercent : undefined,
      alreadyBilled: hasDp ? dpAmount : 0,
      remainingToInvoice: remainingToInvoice,
      referenceNumber: d.deliveryNumber,
      sdNumber: d.purchaseOrder?.sdDocument || null,
      poNumber: d.purchaseOrder?.poNumber,
      currency: d.purchaseOrder?.currency || 'IDR',
      customerName: d.purchaseOrder?.quotation?.inquiry?.customer?.name || 'Unknown',
      customerId: d.purchaseOrder?.quotation?.inquiry?.customerId,
      completionDate: d.actualDeliveryDate,
      status: d.status,
      billingStatus: 'OPEN',
      items: hasDp
        ? [
            ...baseItems,
            {
              description: `Deduction Down Payment (${dpPercent}%)`,
              qty: 1,
              uom: 'lot',
              unitPrice: -dpAmount,
              total: -dpAmount
            }
          ]
        : baseItems
    });
  });

  // Map Services
  services.forEach(s => {
    const actualQuotation = s.quotation || s.purchaseOrder?.quotation;
    let customer = actualQuotation?.inquiry?.customer || s.inquiry?.customer;
                
    const qDetails = actualQuotation?.details || s.purchaseOrder?.details || [];
    list.push({
      id: s.id.toString(),
      sourceType: 'SERVICE',
      referenceNumber: s.serviceNumber,
      sdNumber: s.sdNumber || s.purchaseOrder?.sdDocument || null,
      poNumber: s.purchaseOrder?.poNumber,
      currency: actualQuotation?.currency || s.purchaseOrder?.currency || 'IDR',
      customerName: customer?.name || 'Unknown',
      customerId: customer?.id,
      completionDate: s.completedDate || s.targetDate,
      status: s.status,
      billingStatus: 'OPEN',
      items: [
        ...qDetails.map(item => {
          const unitPrice = getCalculatedUnitSellPrice(item, null);
          const qty = Number(item.qty || 1);
          return {
            description: item.description || item.note || 'Service Item',
            qty: qty,
            uom: item.uom || 'Lot',
            unitPrice: unitPrice,
            total: qty * unitPrice
          };
        }),
        ...(s.tfsAssignments || []).map(tfs => ({
          description: `TFS: ${tfs.personnel?.name || 'Unknown'} - ${tfs.jobDescription || tfs.title || 'Work Log'}`,
          qty: tfs.days || 0,
          uom: 'days',
          hours: tfs.hoursPerDay,
          unitPrice: 0, // Price is usually at the Service Item level
          total: 0
        }))
      ]
    });
  });

  // Map Projects
  projects.forEach(p => {
    // Check if total invoices < PO netValue
    const poNetValue = Number(p.purchaseOrder?.quotation?.totalPrice || p.purchaseOrder?.netValue || 0);
    const totalInvoiced = p.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const qDetails = p.purchaseOrder?.quotation?.details || p.purchaseOrder?.details || [];
    
    // Only add if there is still unbilled amount
    if (totalInvoiced < poNetValue) {
      list.push({
        id: p.id.toString(),
        sourceType: 'PROJECT',
        referenceNumber: p.projectNumber,
        sdNumber: p.purchaseOrder?.sdDocument || null,
        poNumber: p.purchaseOrder?.poNumber,
        currency: p.purchaseOrder?.currency || 'IDR',
        customerName: p.purchaseOrder?.quotation?.inquiry?.customer?.name || 'Unknown',
        customerId: p.purchaseOrder?.quotation?.inquiry?.customerId,
        completionDate: p.completedDate || p.updatedAt,
        status: p.status,
        billingStatus: totalInvoiced === 0 ? 'OPEN' : 'PARTIAL',
        poNetValue: poNetValue,
        totalInvoiced: totalInvoiced,
        remainingToInvoice: poNetValue - totalInvoiced,
        items: qDetails.map(item => ({
          description: item.description || 'Project Item',
          qty: item.qty,
          uom: item.uom,
          unitPrice: Number(item.unitPrice || 0),
          total: Number(item.qty || 0) * Number(item.unitPrice || 0)
        }))
      });
    }
  });

  // Sort unified list by date descending
  list.sort((a, b) => new Date(b.completionDate || 0) - new Date(a.completionDate || 0));

  return list;
};

const createInvoiceFromDelivery = async (deliveryId, userId) => {
  return await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: { id: BigInt(deliveryId) },
      include: {
        items: {
          include: {
            poDetail: true
          }
        },
        purchaseOrder: {
          include: {
            quotation: {
              include: {
                details: true,
                inquiry: { include: { customer: true } }
              }
            }
          }
        }
      }
    });

    if (!delivery) throw new Error('Delivery not found');
    if (delivery.status !== 'DELIVERED' && delivery.status !== 'COMPLETED') {
      throw new Error('Delivery must be DELIVERED or COMPLETED to be invoiced');
    }

    // Check if invoice already exists
    const existing = await tx.invoice.findFirst({
      where: { deliveryId: BigInt(deliveryId) }
    });
    if (existing) throw new Error('Invoice already exists for this Delivery');

    const po = delivery.purchaseOrder;
    const quotation = po?.quotation;
    const inquiry = quotation?.inquiry;
    const customer = inquiry?.customer;
    const qDetails = quotation?.details || [];

    // Calculate subtotal from delivery items using quotation pricing
    let subtotal = 0;
    const detailsData = delivery.items.map(item => {
      const matchedQDetail = qDetails.find(qd => 
        (item.poDetail?.inquiryDetailId && qd.inquiryDetailId === item.poDetail.inquiryDetailId) ||
        (item.poDetail?.sparePartId && qd.mappedSparePartId === item.poDetail.sparePartId)
      );
      const unitPrice = getCalculatedUnitSellPrice(matchedQDetail, item.poDetail);
      const lineTotal = Number(item.qtyDelivered) * unitPrice;
      subtotal += lineTotal;
      return {
        deliveryDetailId: item.id,
        description: item.poDetail?.note || 'Item from Delivery',
        qty: item.qtyDelivered,
        uom: 'pcs', // Default
        unitPrice: unitPrice,
        discount: 0,
        lineTotal: lineTotal
      };
    });

    const hasDp = Boolean(po?.hasDp && Number(po?.dpAmount || 0) > 0);
    const dpAmount = hasDp ? Number(po.dpAmount || 0) : 0;
    const dpPercent = Number(po?.dpPercent || 0);

    if (hasDp) {
      detailsData.push({
        description: `Deduction Down Payment (${dpPercent}%)`,
        qty: 1,
        uom: 'lot',
        unitPrice: -dpAmount,
        discount: 0,
        lineTotal: -dpAmount
      });
    }

    const finalSubtotal = hasDp ? Math.max(subtotal - dpAmount, 0) : subtotal;
    const taxAmount = 0; // Default 0, Finance will input later
    const totalAmount = finalSubtotal + taxAmount;

    const invoiceNumber = await generateInvoiceNumber();
    const today = new Date();

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        sourceType: 'DELIVERY',
        isDp: false,
        dpPercent: hasDp ? dpPercent : null,
        dpDeduction: hasDp ? dpAmount : 0,
        deliveryId: delivery.id,
        poId: po?.id,
        quotationId: quotation?.id,
        customerId: customer?.id,
        soSdSapNumber: po?.sdDocument || null,
        invoiceDate: today,
        currency: po?.currency || 'IDR',
        exchangeRate: po?.exchangeRate || 1,
        subtotalAmount: finalSubtotal,
        taxAmount,
        totalAmount,
        status: 'DRAFT',
        createdBy: userId,
        details: {
          create: detailsData
        },
        histories: {
          create: {
            newStatus: 'DRAFT',
            changedBy: userId,
            changeNote: 'Auto-generated from Delivery'
          }
        }
      },
      include: { details: true, customer: true, delivery: true, purchaseOrder: true }
    });

    return invoice;
  });
};

const updateInvoiceStatus = async (invoiceId, newStatus, userId, changeNote, paymentProofUrl = null) => {
  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: BigInt(invoiceId) } });
    if (!invoice) throw new Error('Invoice not found');

    const allowedTransitions = {
      'DRAFT': ['SENT', 'CANCELLED'],
      'SENT': ['PAID', 'OVERDUE', 'CANCELLED'],
      'OVERDUE': ['PAID', 'CANCELLED'],
      'PAID': [],
      'CANCELLED': []
    };

    if (!allowedTransitions[invoice.status]?.includes(newStatus)) {
      throw new Error(`Cannot transition from ${invoice.status} to ${newStatus}`);
    }

    const updated = await tx.invoice.update({
      where: { id: BigInt(invoiceId) },
      data: {
        status: newStatus,
        updatedBy: userId,
        ...(newStatus === 'PAID' && { paymentDate: new Date() }),
        ...(paymentProofUrl && { paymentProofUrl })
      }
    });

    await tx.invoiceStatusHistory.create({
      data: {
        invoiceId: BigInt(invoiceId),
        oldStatus: invoice.status,
        newStatus,
        changeNote,
        changedBy: userId
      }
    });

    return updated;
  });
};

const updateInvoiceData = async (invoiceId, data, userId) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: BigInt(invoiceId) } });
  if (!invoice) throw new Error('Invoice not found');
  
  const LOCKED_STATUSES = ['PAID', 'CANCELLED'];
  if (LOCKED_STATUSES.includes(invoice.status)) {
    throw new Error(`Invoice with status ${invoice.status} cannot be edited.`);
  }

  const subtotalAmount = data.subtotalAmount !== undefined ? parseFloat(data.subtotalAmount) : parseFloat(invoice.subtotalAmount);
  const taxAmount = data.taxAmount !== undefined ? parseFloat(data.taxAmount) : parseFloat(invoice.taxAmount);
  const totalAmount = subtotalAmount + taxAmount;
  const remainingAmount = totalAmount - parseFloat(invoice.paidAmount || 0);

  return await prisma.$transaction(async (tx) => {
    if (data.details && Array.isArray(data.details)) {
      for (const d of data.details) {
        if (d.id) {
          await tx.invoiceDetail.update({
            where: { id: BigInt(d.id) },
            data: {
              unitPrice: d.unitPrice !== undefined ? parseFloat(d.unitPrice) : undefined,
              lineTotal: d.lineTotal !== undefined ? parseFloat(d.lineTotal) : undefined,
              qty: d.qty !== undefined ? parseFloat(d.qty) : undefined,
              description: d.description || undefined,
            }
          });
        }
      }
    }
    
    // Cleanup old PDF file if a new file is uploaded
    if (data.attachmentUrl && invoice.attachmentUrl && data.attachmentUrl !== invoice.attachmentUrl) {
      deleteFile(invoice.attachmentUrl);
    }
    
    // eslint-disable-next-line no-unused-vars
    const { 
      details, 
      id: _id, 
      subtotalAmount: _s, 
      taxAmount: _t, 
      totalAmount: _to, 
      remainingAmount: _r, 
      invoiceDate: _idate, 
      dueDate: _ddate, 
      soSdSapNumber,
      ...restData 
    } = data;

    return await tx.invoice.update({
      where: { id: BigInt(invoiceId) },
      data: {
        ...restData,
        subtotalAmount,
        taxAmount,
        totalAmount,
        remainingAmount,
        soSdSapNumber: soSdSapNumber !== undefined ? soSdSapNumber : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
        updatedBy: userId
      }
    });
  });
};

const uploadExternalInvoice = async (invoiceId, data, fileUrl, userId) => {
  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: BigInt(invoiceId) } });
    if (!invoice) throw new Error('Invoice not found');

    // Cleanup old file if re-uploading
    if (fileUrl && invoice.attachmentUrl && fileUrl !== invoice.attachmentUrl) {
      deleteFile(invoice.attachmentUrl);
    }

    // Validasi duplikasi nomor invoice
    if (data.invoiceNumber && data.invoiceNumber !== invoice.invoiceNumber) {
      const duplicate = await tx.invoice.findFirst({
        where: {
          invoiceNumber: data.invoiceNumber,
          id: { not: BigInt(invoiceId) }
        }
      });
      if (duplicate) {
        throw new Error(`Nomor Invoice '${data.invoiceNumber}' sudah terdaftar dalam sistem.`);
      }
    }

    const updated = await tx.invoice.update({
      where: { id: BigInt(invoiceId) },
      data: {
        invoiceNumber: data.invoiceNumber || invoice.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : invoice.invoiceDate,
        dueDate: data.dueDate ? new Date(data.dueDate) : invoice.dueDate,
        attachmentUrl: fileUrl || invoice.attachmentUrl,
        remarks: data.remarks || invoice.remarks,
        soSdSapNumber: data.soSdSapNumber || invoice.soSdSapNumber,
        status: 'SENT',
        updatedBy: userId
      }
    });

    await tx.invoiceStatusHistory.create({
      data: {
        invoiceId: BigInt(invoiceId),
        oldStatus: invoice.status,
        newStatus: 'SENT',
        changeNote: 'Uploaded external invoice',
        changedBy: userId
      }
    });

    return updated;
  });
};

const getAllInvoices = async (params = {}) => {
  const { year } = params;
  const where = {};
  if (year) {
    where.invoiceDate = {
      gte: new Date(`${year}-01-01T00:00:00.000Z`),
      lte: new Date(`${year}-12-31T23:59:59.999Z`),
    };
  }

  return await prisma.invoice.findMany({
    where,
    include: {
      customer: true,
      purchaseOrder: true,
      service: true,
      creator: true,
      updater: true,
    },
    orderBy: { createdAt: 'desc' }
  });
};

const getInvoiceById = async (id) => {
  return await prisma.invoice.findUnique({
    where: { id: BigInt(id) },
    include: {
      customer: true,
      delivery: true,
      purchaseOrder: true,
      quotation: true,
      service: true,
      details: true,
      histories: {
        include: { changer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
};

const createInvoiceFromService = async (serviceId, userId) => {
  return await prisma.$transaction(async (tx) => {
    const service = await tx.serviceExecution.findUnique({
      where: { id: BigInt(serviceId) },
      include: {
        tfsAssignments: {
          include: { personnel: true }
        },
        purchaseOrder: {
          include: { quotation: { include: { inquiry: { include: { customer: true } } } } }
        },
        inquiry: { include: { customer: true } },
        quotation: { include: { inquiry: { include: { customer: true } } } }
      }
    });

    if (!service) throw new Error('Service not found');

    const existing = await tx.invoice.findFirst({
      where: { serviceId: BigInt(serviceId) }
    });
    if (existing) throw new Error('Invoice already exists for this Service');

    const po = service.purchaseOrder;
    const quotation = po?.quotation || service.quotation;
    const inquiry = quotation?.inquiry || service.inquiry;
    const customer = inquiry?.customer;

    let subjectDesc = `Service: ${service.serviceNumber}`;
    if (service.poId) {
      subjectDesc = po?.quotation?.inquiry?.subject || subjectDesc;
    } else if (service.quotationId) {
      subjectDesc = quotation?.inquiry?.subject || subjectDesc;
    }

    let subtotal = 0;
    const detailsData = [];

    // Main Service item: selalu mengutamakan quotation.totalPrice
    subtotal = Number(quotation?.totalPrice || po?.netValue || 0);
    detailsData.push({
      description: subjectDesc,
      qty: 1,
      uom: 'Lot',
      unitPrice: subtotal,
      discount: 0,
      lineTotal: subtotal
    });

    // TFS Timesheet items
    if (service.tfsAssignments && service.tfsAssignments.length > 0) {
      service.tfsAssignments.forEach(tfs => {
        const days = parseFloat(tfs.days || 0);
        const hours = parseFloat(tfs.hoursPerDay || 0);
        if (days > 0 || hours > 0) {
          const desc = `TFS - ${tfs.personnel?.name || 'Engineer'} (${days} Days, ${hours} Hours/Day)`;
          detailsData.push({
            description: desc,
            qty: 1,
            uom: 'Ls',
            unitPrice: 0,
            discount: 0,
            lineTotal: 0
          });
        }
      });
    }

    const taxAmount = 0;
    const totalAmount = subtotal + taxAmount;
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        sourceType: 'SERVICE',
        serviceId: service.id,
        poId: po?.id,
        quotationId: quotation?.id,
        customerId: customer?.id,
        invoiceDate: new Date(),
        currency: quotation?.currency || po?.currency || 'IDR',
        exchangeRate: quotation?.exchangeRate || po?.exchangeRate || 1,
        subtotalAmount: subtotal,
        taxAmount,
        totalAmount,
        status: 'DRAFT',
        createdBy: userId,
        details: { create: detailsData },
        histories: {
          create: {
            newStatus: 'DRAFT',
            changedBy: userId,
            changeNote: 'Auto-generated from Service Execution'
          }
        }
      },
      include: { details: true, customer: true, service: true, purchaseOrder: true }
    });

    return invoice;
  });
};

const createInvoiceFromProject = async (projectId, data, userId) => {
  return await prisma.$transaction(async (tx) => {
    const project = await tx.projectExecution.findUnique({
      where: { id: BigInt(projectId) },
      include: {
        purchaseOrder: {
          include: { quotation: { include: { inquiry: { include: { customer: true } } } } }
        }
      }
    });

    if (!project) throw new Error('Project not found');

    const po = project.purchaseOrder;
    if (!po) throw new Error('Project must be linked to a Purchase Order to be invoiced');

    const amount = Number(data.amount || 0);
    const description = data.description || `Project Progress - ${project.projectNumber}`;

    if (amount <= 0) throw new Error('Invoice amount must be greater than 0');

    // Check remaining value
    const existingInvoices = await tx.invoice.findMany({
      where: { projectId: BigInt(projectId), status: { not: 'CANCELLED' } }
    });
    
    const totalInvoiced = existingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const poNetValue = Number(po.netValue || 0);
    
    if (totalInvoiced + amount > poNetValue) {
      throw new Error(`Cannot invoice ${amount}. Remaining unbilled amount is ${poNetValue - totalInvoiced}`);
    }

    const quotation = po.quotation;
    const inquiry = quotation?.inquiry;
    const customer = inquiry?.customer;

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        sourceType: 'PROJECT',
        projectId: project.id,
        poId: po.id,
        quotationId: quotation?.id,
        customerId: customer?.id,
        invoiceDate: new Date(),
        currency: po.currency || 'IDR',
        exchangeRate: po.exchangeRate || 1,
        subtotalAmount: amount,
        taxAmount: 0,
        totalAmount: amount,
        status: 'DRAFT',
        createdBy: userId,
        details: {
          create: [{
            description: description,
            qty: 1,
            uom: 'lot',
            unitPrice: amount,
            discount: 0,
            lineTotal: amount
          }]
        },
        histories: {
          create: {
            newStatus: 'DRAFT',
            changedBy: userId,
            changeNote: `Generated partial invoice from Project`
          }
        }
      },
      include: { details: true, customer: true, project: true, purchaseOrder: true }
    });

    return invoice;
  });
};

// Hapus invoice DRAFT yang gagal diproses (safety rollback)
const deleteDraftInvoice = async (invoiceId) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: BigInt(invoiceId) } });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'DRAFT') {
    throw new Error('Hanya invoice berstatus DRAFT yang dapat dihapus melalui rollback.');
  }

  return await prisma.$transaction(async (tx) => {
    // Hapus detail invoice terlebih dahulu
    await tx.invoiceDetail.deleteMany({ where: { invoiceId: BigInt(invoiceId) } });
    // Hapus riwayat status
    await tx.invoiceStatusHistory.deleteMany({ where: { invoiceId: BigInt(invoiceId) } });
    // Hapus invoice
    await tx.invoice.delete({ where: { id: BigInt(invoiceId) } });
    return { success: true };
  });
};

const createInvoiceFromPoDp = async (poId, userId) => {
  return await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: BigInt(poId) },
      include: {
        quotation: {
          include: { inquiry: { include: { customer: true } } }
        }
      }
    });

    if (!po) throw new Error('Purchase Order not found');
    if (!po.hasDp || Number(po.dpAmount || 0) <= 0) {
      throw new Error('Purchase Order ini tidak memiliki skema Down Payment (DP)');
    }
    if (po.dpInvoiced) {
      throw new Error('Invoice Down Payment untuk Purchase Order ini sudah pernah dibuat');
    }

    const quotation = po.quotation;
    const inquiry = quotation?.inquiry;
    const customer = inquiry?.customer;
    const dpAmount = Number(po.dpAmount || 0);
    const dpPercent = Number(po.dpPercent || 0);

    const invoiceNumber = await generateInvoiceNumber();
    const today = new Date();

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        sourceType: 'DELIVERY',
        isDp: true,
        dpPercent: dpPercent,
        poId: po.id,
        quotationId: quotation?.id,
        customerId: customer?.id,
        soSdSapNumber: po.sdDocument || null,
        invoiceDate: today,
        currency: po.currency || 'IDR',
        exchangeRate: po.exchangeRate || 1,
        subtotalAmount: dpAmount,
        taxAmount: 0,
        totalAmount: dpAmount,
        status: 'DRAFT',
        createdBy: userId,
        details: {
          create: [{
            description: `Down Payment (${dpPercent}%) - PO ${po.poNumber || po.id}`,
            qty: 1,
            uom: 'lot',
            unitPrice: dpAmount,
            discount: 0,
            lineTotal: dpAmount
          }]
        },
        histories: {
          create: {
            newStatus: 'DRAFT',
            changedBy: userId,
            changeNote: `Auto-generated Down Payment (${dpPercent}%) from Purchase Order`
          }
        }
      },
      include: { details: true, customer: true, purchaseOrder: true }
    });

    // Mark PO as dpInvoiced
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        dpInvoiced: true,
        dpInvoiceId: invoice.id
      }
    });

    return invoice;
  });
};

module.exports = {
  getReadyToInvoiceList,
  createInvoiceFromDelivery,
  createInvoiceFromPoDp,
  createInvoiceFromService,
  createInvoiceFromProject,
  updateInvoiceStatus,
  updateInvoiceData,
  uploadExternalInvoice,
  getAllInvoices,
  getInvoiceById,
  deleteDraftInvoice
};

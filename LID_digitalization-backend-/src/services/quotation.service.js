const prisma = require('../config/prisma');
const path = require('path');

const generateQuotationNumber = () => {
  const yy = new Date().getFullYear().toString().slice(-2);
  const mm = ('0' + (new Date().getMonth() + 1)).slice(-2);
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `QUO-${yy}${mm}-${randomStr}`;
};

const getQuotations = async (filters = {}) => {
  const { quotationType, ...rest } = filters;

  const where = {
    ...rest,
    NOT: {
      AND: [
        { status: 'REJECTED' },
        { lossReason: 'REVERTED_TO_INQUIRY' }
      ]
    }
  };

  if (quotationType) {
    if (quotationType === 'SPARE_PART') {
      where.OR = [
        { quotationType: 'SPARE_PART' },
        { inquiry: { requestType: 'SPARE_PART' } }
      ];
    } else if (quotationType === 'SERVICE') {
      where.OR = [
        { quotationType: 'SERVICE' },
        { inquiry: { requestType: { startsWith: 'SERVICE_' } } }
      ];
    } else if (quotationType === 'PROJECT') {
      where.OR = [
        { quotationType: 'PROJECT' },
        { inquiry: { requestType: { startsWith: 'PROJECT_' } } }
      ];
    }
  }

  return await prisma.quotation.findMany({
    where,
    include: {
      inquiry: {
        include: {
          customer: true,
          codeWord: true,
          details: true,
        }
      },
      details: {
        include: {
          sparePart: true,
          service: true,
        }
      },
      creator: true,
      updater: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

const getQuotationById = async (id) => {
  return await prisma.quotation.findUnique({
    where: { id: BigInt(id) },
    include: {
      details: {
        include: {
          service: true,
          sparePart: true
        }
      },
      inquiry: {
        include: {
          customer: true,
          codeWord: true,
          details: true,
          histories: { 
            orderBy: { createdAt: 'desc' },
            include: { changer: { select: { id: true, name: true } } }
          }
        }
      },
      sparePartDetail: {
        include: {
          endCustomer: true
        }
      },
      serviceDetail: true,
      projectDetail: true,
      purchaseOrders: {
        include: {
          histories: {
            orderBy: { createdAt: 'desc' },
            include: { changer: { select: { id: true, name: true } } }
          },
          deliveries: {
            include: {
              histories: {
                orderBy: { createdAt: 'desc' },
                include: { changer: { select: { id: true, name: true } } }
              }
            }
          },
          invoices: {
            include: {
              histories: {
                orderBy: { createdAt: 'desc' },
                include: { changer: { select: { id: true, name: true } } }
              }
            }
          }
        }
      },
      invoices: {
        include: {
          histories: {
            orderBy: { createdAt: 'desc' },
            include: { changer: { select: { id: true, name: true } } }
          }
        }
      },
      serviceExecutions: true,
      histories: {
        orderBy: { createdAt: 'desc' },
        include: { changer: { select: { id: true, name: true } } }
      }
    }
  });

  if (quotation) {
    quotation.purchaseOrder = quotation.purchaseOrders?.[0] || null;
  }

  return quotation;
};

const createQuotationFromInquiry = async (inquiryId, data, userId) => {
  const {
    details,
    basePrice,
    globalDiscount,
    margin,
    totalPrice,
    remarks,
    currency,
    exchangeRate,
    quotationType,
    forecast,
    clientInquiryDate,
    customerInquiryNumber,
    sparePartDetail,
    serviceDetail,
    projectDetail
  } = data;

  const inquiry = await prisma.inquiry.findUnique({
    where: { id: BigInt(inquiryId) },
    select: { inquiryNumber: true }
  });

  let quotationNumber = `QUO-${String(inquiryId).padStart(5, '0')}`;
  if (inquiry && inquiry.inquiryNumber) {
    // Replaces leading INQ- or INQ with QUO- (e.g. INQ-31440-R1 -> QUO-31440-R1)
    quotationNumber = inquiry.inquiryNumber.replace(/^INQ-?/i, 'QUO-');
  }

  const now = new Date();
  const quoData = {
    quotationNumber,
    customerInquiryNumber: customerInquiryNumber || null,
    inquiry: { connect: { id: BigInt(inquiryId) } },
    status: 'DRAFT',
    basePrice,
    globalDiscount: globalDiscount || 0,
    margin: margin || 0,
    totalPrice,
    currency: currency || 'IDR',
    exchangeRate: exchangeRate || 1,
    remarks,
    quotationType: quotationType || null,
    forecast: forecast || 'NORMAL',
    clientInquiryDate: clientInquiryDate ? new Date(clientInquiryDate) : null,
    statusChangedAt: now,
    lastActivityAt: now,
    ...(userId ? { creator: { connect: { id: Number(userId) } } } : {}),
  };

  // Validation for Spare Part Commercial Terms
  if (quotationType === 'SPARE_PART' || sparePartDetail) {
    if (!sparePartDetail) {
      throw new Error('Commercial Terms wajib diisi untuk Spare Part Quotation.');
    }
    if (!sparePartDetail.deliveryDateDesc || !sparePartDetail.deliveryDateDesc.trim()) {
      throw new Error('Commercial Terms: Delivery Date Description wajib diisi.');
    }
    if (!sparePartDetail.paymentTerms || !sparePartDetail.paymentTerms.trim()) {
      throw new Error('Commercial Terms: Payment Terms wajib diisi.');
    }
    if (!sparePartDetail.paymentConditions || !sparePartDetail.paymentConditions.trim()) {
      throw new Error('Commercial Terms: Payment Conditions wajib diisi.');
    }
    if (!sparePartDetail.deliveryTerms || !sparePartDetail.deliveryTerms.trim()) {
      throw new Error('Commercial Terms: Delivery Terms wajib diisi.');
    }
    if (!sparePartDetail.bankDetails || !sparePartDetail.bankDetails.trim()) {
      throw new Error('Commercial Terms: Bank Details wajib dipilih.');
    }
  }

  // Attach sparePartDetail extension if provided
  if (sparePartDetail) {
    quoData.sparePartDetail = {
      create: {
        endCustomerId: sparePartDetail.endCustomerId ? Number(sparePartDetail.endCustomerId) : null,
        location: sparePartDetail.location || null,
        projectNo: sparePartDetail.projectNo || null,
        additionalInformation: sparePartDetail.additionalInformation || null,
        validityDays: sparePartDetail.validityDays || 30,
        attentionTitle: sparePartDetail.attentionTitle || null,
        attention: sparePartDetail.attention || null,
        deliveryDateDesc: sparePartDetail.deliveryDateDesc || null,
        deliveryTerms: sparePartDetail.deliveryTerms || null,
        deliveryTermsShort: sparePartDetail.deliveryTermsShort || null,
        paymentTerms: sparePartDetail.paymentTerms || null,
        paymentConditions: sparePartDetail.paymentConditions || null,
        bankDetails: sparePartDetail.bankDetails || null,
        // Price Calculation Parameters
        vendorSource: sparePartDetail.vendorSource || 'LOG',
        handlingPct: sparePartDetail.handlingPct !== undefined ? sparePartDetail.handlingPct : 10,
        canonPct: sparePartDetail.canonPct !== undefined ? sparePartDetail.canonPct : 0,
        commissionPct: sparePartDetail.commissionPct || 0,
        overheadPct: sparePartDetail.overheadPct || 0,
        freightPct: sparePartDetail.freightPct || 0,
        customPct: sparePartDetail.customPct || 0,
        sellPriceCalc: sparePartDetail.sellPriceCalc || 0,
        hasDp: Boolean(sparePartDetail.hasDp),
        dpPercent: sparePartDetail.hasDp ? (sparePartDetail.dpPercent || 0) : 0,
        dpAmount: sparePartDetail.hasDp ? (sparePartDetail.dpAmount || 0) : 0,
      }
    };
  }

  // Attach serviceDetail extension if provided
  if (serviceDetail) {
    quoData.serviceDetail = {
      create: {
        location: serviceDetail.location || null,
        projectNo: serviceDetail.projectNo || null,
        millType: serviceDetail.millType || null,
        attentionTitle: serviceDetail.attentionTitle || null,
        attention: serviceDetail.attention || null,
        validityDays: serviceDetail.validityDays || 30,
        scopeOfWork: serviceDetail.scopeOfWork || null,
        paymentTerms: serviceDetail.paymentTerms || null,
        paymentConditions: serviceDetail.paymentConditions || null,
        engineerQtyDesc: serviceDetail.engineerQtyDesc || null,
        pricingType: serviceDetail.pricingType || 'standard',
        pricingConditionText: serviceDetail.pricingConditionText || null,
        paymentMethod: serviceDetail.paymentMethod || null,
        paymentRequirement: serviceDetail.paymentRequirement || null,
        tcType: serviceDetail.tcType || 'standard',
        tcItems: serviceDetail.tcItems || null,
      }
    };
  }

  // Attach projectDetail extension if provided
  if (projectDetail) {
    quoData.projectDetail = {
      create: {
        location: projectDetail.location || null,
        projectNo: projectDetail.projectNo || null,
        projectTitle: projectDetail.projectTitle || null,
        projectSiteName: projectDetail.projectSiteName || null,
        projectSiteAddress: projectDetail.projectSiteAddress || null,
        projectDuration: projectDetail.projectDuration || null,
        attentionTitle: projectDetail.attentionTitle || null,
        attention: projectDetail.attention || null,
        validityDays: projectDetail.validityDays || 30,
        paymentTerms: projectDetail.paymentTerms || null,
        paymentConditions: projectDetail.paymentConditions || null,
      }
    };
  }

  if (details && details.length > 0) {
    quoData.details = {
      create: details.map((d, i) => {
        const detailData = {
          lineNo: i + 1,
          itemType: d.itemType,
          qty: d.qty || 1,
          unitPrice: d.unitPrice || 0,
          discount: d.discount || 0,
          totalPrice: d.totalPrice || 0,
          isAlternative: d.isAlternative || false,
          note: d.note,
          inquiryDetailId: d.inquiryDetailId ? BigInt(d.inquiryDetailId) : null,
          // Per-item price calculation parameters
          vendorSource: d.vendorSource || 'LOG',
          handlingPct: d.handlingPct !== undefined ? d.handlingPct : 10,
          canonPct: d.canonPct !== undefined ? d.canonPct : 0,
          commissionPct: d.commissionPct || 0,
          overheadPct: d.overheadPct || 0,
          freightPct: d.freightPct || 0,
          customPct: d.customPct || 0,
          sellPriceCalc: d.sellPriceCalc || 0,
        };

        if (d.mappedServiceId) {
          detailData.service = { connect: { id: BigInt(d.mappedServiceId) } };
        }

        if (d.mappedSparePartId) {
          detailData.sparePart = { connect: { id: BigInt(d.mappedSparePartId) } };
        }

        return detailData;
      }),
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingActive = await tx.quotation.findFirst({
      where: {
        inquiryId: BigInt(inquiryId),
        status: { in: ['DRAFT', 'SENT', 'APPROVED'] }
      },
    });

    if (existingActive) {
      throw new Error(`Active Quotation already exists for Inquiry ID ${inquiryId}`);
    }

    const quotation = await tx.quotation.create({
      data: quoData,
      include: { details: true },
    });

    const inquiry = await tx.inquiry.findUnique({
      where: { id: BigInt(inquiryId) },
    });

    const oldStatusCode = inquiry.statusCode;

    await tx.inquiry.update({
      where: { id: BigInt(inquiryId) },
      data: {
        statusCode: 'CONVERTED',
        ...(userId ? { updater: { connect: { id: Number(userId) } } } : {}),
      },
    });

    await tx.inquiryStatusHistory.create({
      data: {
        inquiryId: BigInt(inquiryId),
        oldStatusCode: oldStatusCode,
        newStatusCode: 'CONVERTED',
        changedBy: userId ? Number(userId) : null,
        changeNote: `Converted to Quotation ${quotation.quotationNumber}`,
      },
    });

    return quotation;
  });

  return result;
};

const revertQuotationToInquiry = async (id, userId, reason) => {
  return await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUnique({
      where: { id: BigInt(id) },
      include: { inquiry: true }
    });

    if (!quotation) throw new Error("Quotation not found");

    const oldInquiryNumber = quotation.inquiry.inquiryNumber;
    const oldStatusCode = quotation.inquiry.statusCode;
    const isDraftRevert = quotation.status === 'DRAFT';

    let newInquiryNumber = oldInquiryNumber;
    let updatedQuotationNumber = quotation.quotationNumber;

    if (isDraftRevert) {
      // Revert from DRAFT (internal draf correction):
      // Keep inquiryNumber unchanged, but append timestamp suffix to quotationNumber
      // so the original quotationNumber is freed for future quotation creation without unique constraint error.
      updatedQuotationNumber = `${quotation.quotationNumber}-DISCARDED-${Date.now()}`;
    } else {
      // Revert from SENT/official status:
      // Increment revision suffix -R<N> on inquiryNumber
      const baseInquiryNumber = oldInquiryNumber.split('-R')[0];

      // Count previous official (non-DRAFT) reverts for this inquiry
      const officialRevertCount = await tx.quotationStatusHistory.count({
        where: {
          quotation: { inquiryId: quotation.inquiryId },
          oldStatus: { not: 'DRAFT' },
          changeNote: { contains: 'Reverted' }
        }
      });

      const nextRev = officialRevertCount + 1;
      newInquiryNumber = `${baseInquiryNumber}-R${nextRev}`;
    }

    // Update status and inquiryNumber of Inquiry
    await tx.inquiry.update({
      where: { id: quotation.inquiryId },
      data: {
        inquiryNumber: newInquiryNumber,
        statusCode: 'OPEN',
        ...(userId ? { updater: { connect: { id: Number(userId) } } } : {}),
      }
    });

    await tx.inquiryStatusHistory.create({
      data: {
        inquiryId: quotation.inquiryId,
        oldStatusCode: oldStatusCode,
        newStatusCode: 'OPEN',
        changedBy: userId ? Number(userId) : null,
        changeNote: `Reverted from Quotation ${quotation.quotationNumber} (Inquiry: ${newInquiryNumber}). Reason: ${reason || 'N/A'}`
      }
    });

    // Update status and quotationNumber of Quotation
    await tx.quotation.update({
      where: { id: BigInt(id) },
      data: {
        quotationNumber: updatedQuotationNumber,
        status: 'REJECTED',
        lossReason: 'REVERTED_TO_INQUIRY',
        lossDetail: reason || 'Reverted back to Inquiry for revision',
        ...(userId ? { updater: { connect: { id: Number(userId) } } } : {}),
      }
    });

    await tx.quotationStatusHistory.create({
      data: {
        quotationId: BigInt(id),
        oldStatus: quotation.status,
        newStatus: 'REJECTED',
        changedBy: userId ? Number(userId) : null,
        changeNote: `Reverted back to Inquiry (${newInquiryNumber}). Reason: ${reason || 'N/A'}`
      }
    });

    return quotation.inquiryId;
  });
};

const generateQuotationPdf = async (id) => {
  const quotation = await getQuotationById(id);
  if (!quotation) throw new Error('Quotation not found');

  // Determine quotation type
  const isProjectQuotation =
    quotation.quotationType === 'PROJECT' ||
    quotation.projectDetail != null ||
    (quotation.inquiry?.requestType && quotation.inquiry.requestType.startsWith('PROJECT_'));

  const isServiceQuotation =
    !isProjectQuotation && (
      quotation.quotationType === 'SERVICE' ||
      quotation.serviceDetail != null ||
      (quotation.inquiry?.requestType && quotation.inquiry.requestType.startsWith('SERVICE_'))
    );

  let templatePath;
  if (isProjectQuotation) {
    templatePath = path.join(__dirname, '../templates/quotation/quotation-project-template-docx-like.html');
  } else if (isServiceQuotation) {
    templatePath = path.join(__dirname, '../templates/quotation/quotation-service-template-docx-like.html');
  } else {
    templatePath = path.join(__dirname, '../templates/quotation/quotation-template-docx-like.html');
  }

  // Format date: dd.MM.yyyy
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = ('0' + d.getUTCDate()).slice(-2);
    const month = ('0' + (d.getUTCMonth() + 1)).slice(-2);
    const year = d.getUTCFullYear();
    return `${day}.${month}.${year}`;
  };

  // Format date long: "06 March 2025"
  const formatDateLong = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatAmount = (amount, currency) => {
    if (amount === null || amount === undefined) return '0';
    const num = Math.round(Number(amount));
    if (isNaN(num)) return '0';
    const locale = (currency === 'EUR' || currency === 'USD') ? 'en-US' : 'id-ID';
    return num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const sp = quotation.sparePartDetail || null;
  const sv = quotation.serviceDetail || null;
  const pj = quotation.projectDetail || null;
  // Ensure details is always a safe array
  const details = Array.isArray(quotation.details) ? quotation.details : [];

  // --- PROJECT QUOTATION LOGIC ---
  if (isProjectQuotation) {
    const validityDays = pj?.validityDays || 30;
    const validityDate = new Date(quotation.createdAt);
    validityDate.setDate(validityDate.getDate() + validityDays);

    const isLocal = quotation.inquiry?.customer?.customerType !== 'FOREIGN';
    const displayCurrency = isLocal ? 'IDR' : (quotation.currency || 'IDR');
    const displayExRate = isLocal ? (Number(quotation.exchangeRate) || 1) : 1;

    // Build project items from quotation details
    const projectItems = details
      .filter(d => !d.isAlternative)
      .map((d, i) => {
        const inqDetail = quotation.inquiry?.details?.find(id => id.id === d.inquiryDetailId);
        const itemTitle = d.sparePart?.partName || d.service?.serviceName ||
          (inqDetail ? (inqDetail.requestedItemName || inqDetail.requestDescription) : '-');
        const itemDescription = d.sparePart?.description || d.service?.description ||
          (inqDetail ? inqDetail.requestDescription : '');
        const safeQty = isNaN(Number(d.qty)) ? 1 : Number(d.qty);
        return {
          pos: (i + 1) * 10,
          title: itemTitle || '-',
          description: itemDescription !== itemTitle ? (itemDescription || '') : '',
          note: d.note || '',
          qty: safeQty,
          unit: d.sparePart?.uom || d.service?.uom || (inqDetail?.uom) || 'LOT',
          unitPriceStr: formatAmount(Number(d.unitPrice) * displayExRate, displayCurrency),
          totalPriceStr: formatAmount(Number(d.totalPrice) * displayExRate, displayCurrency),
        };
      });

    const totalNormal = details
      .filter(d => !d.isAlternative)
      .reduce((sum, d) => sum + (isNaN(Number(d.totalPrice)) ? 0 : Number(d.totalPrice)), 0);

    const projectData = {
      // Quotation base
      quotationNumber: quotation.quotationNumber,
      quotationDateFormatted: formatDate(quotation.createdAt),
      currency: displayCurrency,

      // Project detail
      location: pj?.location || '',
      projectNo: pj?.projectNo || '',
      projectTitle: pj?.projectTitle || '',
      projectSiteName: pj?.projectSiteName || '',
      projectSiteAddress: pj?.projectSiteAddress || '',
      projectDuration: pj?.projectDuration || '',
      projectLocation: pj?.location || '',
      attentionTitle: pj?.attentionTitle || '',
      attention: pj?.attention || '',
      paymentTerms: pj?.paymentTerms || '',

      // Validity
      validityDateFormattedShort: formatDate(validityDate),

      // Inquiry
      inquiryNumber: quotation.inquiry?.inquiryNumber || '-',
      customerInquiryNumber: quotation.customerInquiryNumber || quotation.inquiry?.inquiryNumber || '-',
      inquiryDateFormatted: formatDate(quotation.inquiry?.inquiryDate || quotation.inquiry?.createdAt),

      // Customer
      customerName: quotation.inquiry?.customer?.name || '-',
      customerAddress: quotation.inquiry?.customer?.address || '-',

      // Hardcoded PIC & company contact
      picName: 'Hendra Tjhai',
      picPhone: '+62 21 5712232 ext 103',
      picEmail: 'Hendra.Tjhai@loesche.com',
      faxNo: '+62 21 5712266',

      // Items & totals
      projectItems,
      totalPriceStr: formatAmount(totalNormal * displayExRate, displayCurrency),

      remarks: quotation.remarks || '',

      // Signature (will be empty string if no file; CSS hides it)
      signatureImageUrl: '',
    };

    const { generatePdfFromTemplate } = require('./pdf.service');
    const pdfBuffer = await generatePdfFromTemplate(templatePath, projectData);
    const filename = `${quotation.quotationNumber}.pdf`;
    return { pdfBuffer, filename };
  }

  // --- SPAREPART / SERVICE QUOTATION LOGIC (existing) ---
  // Calculate validity date safely
  const validityDays = isServiceQuotation ? (Number(sv?.validityDays) || 30) : (Number(sp?.validityDays) || 30);
  const validityDate = quotation.createdAt ? new Date(quotation.createdAt) : new Date();
  validityDate.setDate(validityDate.getDate() + validityDays);

  const safeNum = (val) => { const n = Number(val); return isNaN(n) ? 0 : n; };

  const globalSp = quotation.sparePartDetail;

  const calculateItemPdfPrice = (detail) => {
    const qty = safeNum(detail.qty) || 1;
    const unitPrice = safeNum(detail.unitPrice) || 0;
    const itemBasePrice = qty * unitPrice;

    const hp = isServiceQuotation ? 0 : (detail.handlingPct !== undefined && detail.handlingPct !== null ? safeNum(detail.handlingPct) : (safeNum(globalSp?.handlingPct) || 10)) / 100;
    const oh = isServiceQuotation ? 0 : (detail.overheadPct !== undefined && detail.overheadPct !== null ? safeNum(detail.overheadPct) : (safeNum(globalSp?.overheadPct) || 0)) / 100;
    const fr = isServiceQuotation ? 0 : (detail.freightPct !== undefined && detail.freightPct !== null ? safeNum(detail.freightPct) : (safeNum(globalSp?.freightPct) || 0)) / 100;
    const cu = isServiceQuotation ? 0 : (detail.customPct !== undefined && detail.customPct !== null ? safeNum(detail.customPct) : (safeNum(globalSp?.customPct) || 0)) / 100;
    const cp = isServiceQuotation ? 0 : (detail.canonPct !== undefined && detail.canonPct !== null ? safeNum(detail.canonPct) : (safeNum(globalSp?.canonPct) || 0)) / 100;
    const cm = isServiceQuotation ? 0 : (detail.commissionPct !== undefined && detail.commissionPct !== null ? safeNum(detail.commissionPct) : (safeNum(globalSp?.commissionPct) || 0)) / 100;

    const itemAfterHandling = Math.round(itemBasePrice * (1 + hp));
    const itemAfterOverhead = Math.round(itemAfterHandling * (1 + oh));
    const itemAfterFreight  = Math.round(itemAfterOverhead * (1 + fr));
    const itemAfterCustom   = Math.round(itemAfterFreight * (1 + cu));

    const itemSubTotal = itemAfterCustom;
    const totalDeductionPct = cp + cm;
    const rawSellPrice = totalDeductionPct < 1 ? itemSubTotal / (1 - totalDeductionPct) : itemSubTotal;
    const itemSellPriceBeforeDiscount = Math.round(rawSellPrice);

    const itemDiscount = Math.round(safeNum(detail.discount));
    const finalItemSellPrice = Math.max(itemSellPriceBeforeDiscount - itemDiscount, 0);
    const finalUnitSellPrice = qty > 0 ? finalItemSellPrice / qty : 0;

    return {
      finalItemSellPrice,
      finalUnitSellPrice
    };
  };

  const isLocal = quotation.inquiry?.customer?.customerType !== 'FOREIGN';
  const displayCurrency = isLocal ? 'IDR' : (quotation.currency || 'IDR');
  const displayExRate = isLocal ? (Number(quotation.exchangeRate) || 1) : 1;

  // Split details into normal vs alternative
  const normalItems = details
    .filter(d => !d.isAlternative)
    .map((d, i) => {
      const inqDetail = quotation.inquiry?.details?.find(id => String(id.id) === String(d.inquiryDetailId));
      const fallbackDesc = inqDetail ? (inqDetail.requestedItemName || inqDetail.requestDescription) : '-';
      const customerRequest = inqDetail ? (inqDetail.requestedItemName || inqDetail.requestDescription) : '';

      const { finalUnitSellPrice, finalItemSellPrice } = calculateItemPdfPrice(d);
      const itemUom = d.sparePart?.uom || d.service?.uom || inqDetail?.uom || 'PCS';

      return {
        pos: (i + 1) * 10,
        qtyStr: `${safeNum(d.qty)} ${itemUom}`,
        matNr: inqDetail?.requestedPartNumber || d.sparePart?.partCode || '-',
        description: d.sparePart?.partName || d.service?.serviceName || fallbackDesc,
        customerRequest: customerRequest || '',
        note: d.note || '',
        unitPriceStr: formatAmount(finalUnitSellPrice * displayExRate, displayCurrency),
        netValueStr: formatAmount(finalItemSellPrice * displayExRate, displayCurrency),
        rawFinalSellPrice: finalItemSellPrice
      };
    });

  const alternativeItems = details
    .filter(d => d.isAlternative)
    .map((d, i) => {
      const inqDetail = quotation.inquiry?.details?.find(id => String(id.id) === String(d.inquiryDetailId));
      const fallbackDesc = inqDetail ? (inqDetail.requestedItemName || inqDetail.requestDescription) : '-';
      const customerRequest = inqDetail ? (inqDetail.requestedItemName || inqDetail.requestDescription) : '';

      const { finalUnitSellPrice, finalItemSellPrice } = calculateItemPdfPrice(d);
      const itemUom = d.sparePart?.uom || d.service?.uom || inqDetail?.uom || 'PCS';

      return {
        pos: (i + 1) * 10,
        qtyStr: `${safeNum(d.qty)} ${itemUom}`,
        matNr: inqDetail?.requestedPartNumber || d.sparePart?.partCode || '-',
        description: d.sparePart?.partName || d.service?.serviceName || fallbackDesc,
        customerRequest: customerRequest || '',
        note: d.note || '',
        unitPriceStr: formatAmount(finalUnitSellPrice * displayExRate, displayCurrency),
        netValueStr: formatAmount(finalItemSellPrice * displayExRate, displayCurrency),
      };
    });

  // Total excluding alternatives
  const subTotalNormal = normalItems.reduce((sum, item) => sum + item.rawFinalSellPrice, 0);

  // globalDiscount adalah nilai nominal (bukan persentase)
  const globalDiscountAmount = Number(quotation.globalDiscount || 0);
  const totalNormal = subTotalNormal - globalDiscountAmount;

  const data = {
    // Quotation base info
    quotationNumber: quotation.quotationNumber,
    quotationDateFormatted: formatDate(quotation.createdAt),
    currency: displayCurrency,

    // Inquiry info
    inquiryNumber: quotation.inquiry?.inquiryNumber || '-',
    customerInquiryNumber: quotation.customerInquiryNumber || quotation.inquiry?.inquiryNumber || '-',
    inquiryDateFormatted: formatDate(quotation.clientInquiryDate || quotation.inquiry?.inquiryDate || quotation.inquiry?.createdAt),
    inquiryDateLong: formatDateLong(quotation.clientInquiryDate || quotation.inquiry?.inquiryDate || quotation.inquiry?.createdAt),
    inquirySourceDesc: quotation.inquiry?.sourceCode === 'EMAIL' ? 'email' :
      quotation.inquiry?.sourceCode === 'PHONE' ? 'phone call' :
        quotation.inquiry?.sourceCode === 'WEB' ? 'web request' : 'inquiry',

    // Customer (bill-to)
    customerName: quotation.inquiry?.customer?.name || '-',
    customerAddress: quotation.inquiry?.customer?.address || '-',

    // Spare part extension fields
    endCustomerName: sp?.endCustomer?.name || '',
    location: isServiceQuotation ? (sv?.location || '') : (sp?.location || ''),
    projectNo: isServiceQuotation ? (sv?.projectNo || '') : (sp?.projectNo || ''),
    millType: sv?.millType || '',
    additionalInformation: sp?.additionalInformation || '',
    validityDateFormattedShort: formatDate(validityDate),
    validityDateFormatted: formatDateLong(validityDate),
    attentionTitle: isServiceQuotation ? (sv?.attentionTitle || '') : (sp?.attentionTitle || ''),
    attention: isServiceQuotation ? (sv?.attention || '') : (sp?.attention || ''),
    deliveryDateDesc: sp?.deliveryDateDesc || '',
    deliveryTerms: sp?.deliveryTerms || '',
    deliveryTermsShort: sp?.deliveryTermsShort || '',
    paymentTerms: isServiceQuotation 
      ? (sv?.paymentTerms || '30 days') 
      : (sp?.paymentTerms || 'nett by T/T within 30 days upon the delivery and receipt of invoice'),
    paymentConditions: isServiceQuotation ? (sv?.paymentConditions || '') : (sp?.paymentConditions || ''),
    bankDetails: sp?.bankDetails || '',

    // Service extension fields
    scopeOfWork: sv?.scopeOfWork || '',
    engineerQtyDesc: sv?.engineerQtyDesc || '',

    // Items & totals
    normalItems,
    alternativeItems,
    hasAlternatives: alternativeItems.length > 0,
    subTotalStr: formatAmount(subTotalNormal * displayExRate, displayCurrency),
    hasGlobalDiscount: globalDiscountAmount > 0,
    discountAmountStr: formatAmount(globalDiscountAmount * displayExRate, displayCurrency),
    totalPriceStr: formatAmount(totalNormal * displayExRate, displayCurrency),

    remarks: quotation.remarks || '',

    pricingConditionText: sv?.pricingConditionText || '- The above rates are for a normal working time for 48 hours per week\n- Equivalent to 8 hours / day from monday to saturday\n- Travel time is considered as working time',
    paymentMethod: sv?.paymentMethod || '',
    paymentRequirement: sv?.paymentRequirement || '',
    paymentRequirements: sv?.paymentRequirement || '',
    ...(sv?.tcItems || []).reduce((acc, item) => {
      if (item.no) {
        const keySuffix = item.no.replace(/\./g, '_').replace(/_+$/, '');
        acc[`showTC_${keySuffix}`] = true;
        const textVal = item.text || '';
        acc[`tcText_${keySuffix}`] = textVal;
        const tcHtml = textVal
          .split('\n\n')
          .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
          .join('');
        acc[`tcTextHtml_${keySuffix}`] = tcHtml;
        // Override support: when item is N/A or customized, inject override class & HTML
        const isOverride = item.checked === true || textVal === 'N/A' || (item.originalText && textVal !== item.originalText && textVal !== '');
        acc[`tcOverrideClass_${keySuffix}`] = isOverride ? 'is-override' : '';
        acc[`tcOverrideHtml_${keySuffix}`] = isOverride ? tcHtml : '';
      }
      return acc;
    }, {})
  };

  const { generatePdfFromTemplate } = require('./pdf.service');
  const pdfBuffer = await generatePdfFromTemplate(templatePath, data);

  const filename = `${quotation.quotationNumber}.pdf`;
  return { pdfBuffer, filename };
};

const updateQuotationData = async (id, data, userId) => {
  const {
    details,
    basePrice,
    globalDiscount,
    margin,
    totalPrice,
    remarks,
    currency,
    exchangeRate,
    quotationType,
    forecast,
    clientInquiryDate,
    customerInquiryNumber,
    sparePartDetail,
    serviceDetail,
    projectDetail
  } = data;

  return await prisma.$transaction(async (tx) => {
    const current = await tx.quotation.findUnique({
      where: { id: BigInt(id) },
      include: {
        purchaseOrders: true,
        sparePartDetail: true,
        serviceDetail: true,
        projectDetail: true
      }
    });

    if (!current) throw new Error('Quotation not found');
    if (current.purchaseOrders && current.purchaseOrders.length > 0) {
      throw new Error('Cannot edit quotation that already has a Purchase Order');
    }

    // Status check: Only DRAFT or SENT allowed for editing as per user request
    if (current.status !== 'DRAFT' && current.status !== 'SENT') {
      throw new Error(`Cannot edit quotation with status ${current.status}. Only DRAFT or SENT quotations can be revised.`);
    }

    // Validation for Spare Part Commercial Terms
    const isSparePartQuotation = current.quotationType === 'SPARE_PART' || current.sparePartDetail != null;
    if (isSparePartQuotation || sparePartDetail) {
      if (!sparePartDetail) {
        throw new Error('Commercial Terms wajib diisi untuk Spare Part Quotation.');
      }
      if (!sparePartDetail.deliveryDateDesc || !sparePartDetail.deliveryDateDesc.trim()) {
        throw new Error('Commercial Terms: Delivery Date Description wajib diisi.');
      }
      if (!sparePartDetail.paymentTerms || !sparePartDetail.paymentTerms.trim()) {
        throw new Error('Commercial Terms: Payment Terms wajib diisi.');
      }
      if (!sparePartDetail.deliveryTerms || !sparePartDetail.deliveryTerms.trim()) {
        throw new Error('Commercial Terms: Delivery Terms wajib diisi.');
      }
      if (!sparePartDetail.bankDetails || !sparePartDetail.bankDetails.trim()) {
        throw new Error('Commercial Terms: Bank Details wajib dipilih.');
      }
    }

    const now = new Date();

    // 1. Record Quotation Status History for revision
    await tx.quotationStatusHistory.create({
      data: {
        quotationId: BigInt(id),
        oldStatus: current.status,
        newStatus: current.status,
        changeNote: 'Quotation revised/updated',
        changedBy: userId ? Number(userId) : null
      }
    });

    // 2. Update basic quotation data
    const updatedQuotation = await tx.quotation.update({
      where: { id: BigInt(id) },
      data: {
        basePrice,
        globalDiscount: globalDiscount !== undefined ? globalDiscount : current.globalDiscount,
        margin: margin !== undefined ? margin : current.margin,
        totalPrice,
        currency: currency || current.currency,
        exchangeRate: exchangeRate || current.exchangeRate,
        remarks: remarks !== undefined ? remarks : current.remarks,
        quotationType: quotationType || current.quotationType,
        forecast: forecast || current.forecast || 'NORMAL',
        clientInquiryDate: clientInquiryDate ? new Date(clientInquiryDate) : current.clientInquiryDate,
        customerInquiryNumber: customerInquiryNumber !== undefined ? (customerInquiryNumber || null) : current.customerInquiryNumber,
        lastActivityAt: now,
        updatedBy: userId ? Number(userId) : null,
      }
    });

    // 2. Update Details: Delete and Re-create
    if (details) {
      await tx.quotationDetail.deleteMany({
        where: { quotationId: BigInt(id) }
      });

      await tx.quotationDetail.createMany({
        data: details.map((d, i) => ({
          quotationId: BigInt(id),
          lineNo: i + 1,
          itemType: d.itemType,
          qty: d.qty || 1,
          unitPrice: d.unitPrice || 0,
          discount: d.discount || 0,
          margin: d.margin || 0,
          totalPrice: d.totalPrice || 0,
          isAlternative: d.isAlternative || false,
          note: d.note,
          inquiryDetailId: d.inquiryDetailId ? BigInt(d.inquiryDetailId) : null,
          mappedServiceId: d.mappedServiceId ? BigInt(d.mappedServiceId) : null,
          mappedSparePartId: d.mappedSparePartId ? BigInt(d.mappedSparePartId) : null,
          // Per-item price calculation parameters
          vendorSource: d.vendorSource || 'LOG',
          handlingPct: d.handlingPct !== undefined ? d.handlingPct : 10,
          canonPct: d.canonPct !== undefined ? d.canonPct : 0,
          commissionPct: d.commissionPct || 0,
          overheadPct: d.overheadPct || 0,
          freightPct: d.freightPct || 0,
          customPct: d.customPct || 0,
          sellPriceCalc: d.sellPriceCalc || 0,
        }))
      });
    }

    // 3. Update Sparepart Detail
    if (sparePartDetail) {
      const spData = {
        endCustomerId: sparePartDetail.endCustomerId ? Number(sparePartDetail.endCustomerId) : null,
        location: sparePartDetail.location || null,
        projectNo: sparePartDetail.projectNo || null,
        additionalInformation: sparePartDetail.additionalInformation || null,
        validityDays: sparePartDetail.validityDays || 30,
        attentionTitle: sparePartDetail.attentionTitle || null,
        attention: sparePartDetail.attention || null,
        deliveryDateDesc: sparePartDetail.deliveryDateDesc || null,
        deliveryTerms: sparePartDetail.deliveryTerms || null,
        deliveryTermsShort: sparePartDetail.deliveryTermsShort || null,
        paymentTerms: sparePartDetail.paymentTerms || null,
        paymentConditions: sparePartDetail.paymentConditions || null,
        bankDetails: sparePartDetail.bankDetails || null,
        // Price Calculation Parameters
        vendorSource: sparePartDetail.vendorSource || 'LOG',
        handlingPct: sparePartDetail.handlingPct !== undefined ? sparePartDetail.handlingPct : 10,
        canonPct: sparePartDetail.canonPct !== undefined ? sparePartDetail.canonPct : 0,
        commissionPct: sparePartDetail.commissionPct || 0,
        overheadPct: sparePartDetail.overheadPct || 0,
        freightPct: sparePartDetail.freightPct || 0,
        customPct: sparePartDetail.customPct || 0,
        sellPriceCalc: sparePartDetail.sellPriceCalc || 0,
        hasDp: Boolean(sparePartDetail.hasDp),
        dpPercent: sparePartDetail.hasDp ? (sparePartDetail.dpPercent || 0) : 0,
        dpAmount: sparePartDetail.hasDp ? (sparePartDetail.dpAmount || 0) : 0,
      };

      if (current.sparePartDetail) {
        await tx.quotationSparePart.update({
          where: { quotationId: BigInt(id) },
          data: spData
        });
      } else {
        await tx.quotationSparePart.create({
          data: {
            ...spData,
            quotationId: BigInt(id)
          }
        });
      }
    }

    // 4. Update Service Detail
    if (serviceDetail) {
      const svData = {
        location: serviceDetail.location || null,
        projectNo: serviceDetail.projectNo || null,
        millType: serviceDetail.millType || null,
        attentionTitle: serviceDetail.attentionTitle || null,
        attention: serviceDetail.attention || null,
        validityDays: serviceDetail.validityDays || 30,
        scopeOfWork: serviceDetail.scopeOfWork || null,
        paymentTerms: serviceDetail.paymentTerms || null,
        paymentConditions: serviceDetail.paymentConditions || null,
        engineerQtyDesc: serviceDetail.engineerQtyDesc || null,
        pricingType: serviceDetail.pricingType || 'standard',
        pricingConditionText: serviceDetail.pricingConditionText || null,
        paymentMethod: serviceDetail.paymentMethod || null,
        paymentRequirement: serviceDetail.paymentRequirement || null,
        tcType: serviceDetail.tcType || 'standard',
        tcItems: serviceDetail.tcItems || null,
      };

      if (current.serviceDetail) {
        await tx.quotationService.update({
          where: { quotationId: BigInt(id) },
          data: svData
        });
      } else {
        await tx.quotationService.create({
          data: {
            ...svData,
            quotationId: BigInt(id)
          }
        });
      }
    }

    // 5. Update Project Detail
    if (projectDetail) {
      const pjData = {
        location: projectDetail.location || null,
        projectNo: projectDetail.projectNo || null,
        projectTitle: projectDetail.projectTitle || null,
        projectSiteName: projectDetail.projectSiteName || null,
        projectSiteAddress: projectDetail.projectSiteAddress || null,
        projectDuration: projectDetail.projectDuration || null,
        attentionTitle: projectDetail.attentionTitle || null,
        attention: projectDetail.attention || null,
        validityDays: projectDetail.validityDays || 30,
        paymentTerms: projectDetail.paymentTerms || null,
        paymentConditions: projectDetail.paymentConditions || null,
      };

      if (current.projectDetail) {
        await tx.quotationProject.update({
          where: { quotationId: BigInt(id) },
          data: pjData
        });
      } else {
        await tx.quotationProject.create({
          data: {
            ...pjData,
            quotationId: BigInt(id)
          }
        });
      }
    }

    return updatedQuotation;
  });
};

const deleteQuotation = async (id) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: BigInt(id) },
    include: { purchaseOrders: true }
  });
  if (!quotation) throw new Error('Quotation not found');
  if (quotation.purchaseOrders && quotation.purchaseOrders.length > 0) {
    throw new Error('Quotation tidak bisa dihapus karena sudah memiliki Purchase Order');
  }

  await prisma.quotation.delete({ where: { id: BigInt(id) } });
  return { deleted: true };
};

const acceptTfsQuotationWithPo = async (id, userId, customerPoFile) => {
  return await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUnique({
      where: { id: BigInt(id) }
    });

    if (!quotation) throw new Error('Quotation not found');
    if (quotation.status !== 'SENT') throw new Error('Only SENT Quotations can be accepted.');

    const updated = await tx.quotation.update({
      where: { id: BigInt(id) },
      data: {
        status: 'REALIZED',
        customerPoFile,
        statusChangedAt: new Date(),
        lastActivityAt: new Date(),
        updatedBy: userId ? Number(userId) : null
      }
    });

    await tx.quotationStatusHistory.create({
      data: {
        quotationId: BigInt(id),
        oldStatus: quotation.status,
        newStatus: 'REALIZED',
        changeNote: 'Customer accepted with PO Document',
        changedBy: userId ? Number(userId) : null
      }
    });

    return updated;
  });
};

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotationFromInquiry,
  revertQuotationToInquiry,
  updateQuotationData,
  generateQuotationPdf,
  deleteQuotation,
  acceptTfsQuotationWithPo
};

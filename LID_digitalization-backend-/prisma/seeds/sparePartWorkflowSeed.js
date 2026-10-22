const seedSparePartWorkflow = async (prisma) => {
  console.log('Seeding Dummy Spare Part Workflows...');

  // ==============================
  // VALID STATUS LIST
  // ==============================
  const VALID_STATUS = {
    inquiry: ['OPEN', 'CONVERTED'],
    quotation: ['DRAFT', 'SENT', 'REALIZED', 'CLOSE_LOSS'],
    po: ['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'IN_PROGRESS'],
    delivery: [
      'REVIEW_LOGISTIC',
      'PACKED',
      'SHIPPED',
      'IN_TRANSIT',
      'DELIVERED',
      'COMPLETED',
    ],
  };

  const validateStatus = (type, status) => {
    if (!VALID_STATUS[type].includes(status)) {
      throw new Error(
        `Invalid ${type} status: ${status}. Valid statuses: ${VALID_STATUS[type].join(', ')}`
      );
    }
  };

  // ==============================
  // Ambil Master Data
  // ==============================
  const user = await prisma.user.findFirst();
  const customer = await prisma.customer.findFirst();
  const codeWord = await prisma.codeWord.findFirst();
  const vendor = await prisma.vendor.findFirst();
  const sparePart = await prisma.masterSparePart.findFirst();

  if (!user || !customer || !codeWord || !vendor || !sparePart) {
    console.warn('⚠️ Master data tidak lengkap, melewati seeder workflow dummy.');
    return;
  }

  // ==============================
  // Helper create dummy workflow
  // ==============================
  const createWorkflow = async (suffix, options) => {
    const {
      inquiryStatus = 'OPEN',
      quotationStatus = 'DRAFT',
      poStatus = 'REVIEW',
      deliveryStatus = 'REVIEW_LOGISTIC',
      stopAt = 'DELIVERY', // INQUIRY, QUOTATION, PO, DELIVERY
    } = options;

    validateStatus('inquiry', inquiryStatus);
    validateStatus('quotation', quotationStatus);
    validateStatus('po', poStatus);
    validateStatus('delivery', deliveryStatus);

    const baseCode = `DUMMY-${suffix}`;

    // ==========================================
    // 1. CREATE INQUIRY
    // ==========================================
    const inquiry = await prisma.inquiry.create({
      data: {
        inquiryNumber: `INQ-${baseCode}`,
        sourceCode: `SRC-${baseCode}`,
        statusCode: inquiryStatus,
        requestType: 'SPARE_PART',
        subject: `Permintaan Spare Part Mesin Dummy ${suffix}`,
        inquiryDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        customerId: customer.id,
        codeWordId: codeWord.id,
        createdById: user.id,
        updatedById: user.id,
        details: {
          create: [
            {
              lineNo: 1,
              itemType: 'SPARE_PART',
              requestedItemName: sparePart.partName,
              requestedPartNumber: sparePart.partCode,
              requestDescription: `Pengadaan ${sparePart.partName}`,
              qty: 10,
              uom: sparePart.uom,
            },
          ],
        },
      },
      include: { details: true },
    });

    if (stopAt === 'INQUIRY') return inquiry;

    // ==========================================
    // 2. CREATE QUOTATION
    // ==========================================
    const inqDetail = inquiry.details[0];

    const unitPrice =
      parseFloat(sparePart.standardPrice) > 0
        ? parseFloat(sparePart.standardPrice)
        : 1500000;

    const qty = parseFloat(inqDetail.qty);
    const totalPrice = unitPrice * qty;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: `QUO-${baseCode}`,
        inquiryId: inquiry.id,
        status: quotationStatus,
        basePrice: totalPrice,
        totalPrice: totalPrice,
        currency: 'IDR',
        leadTimeDays: 14,
        createdBy: user.id,
        details: {
          create: [
            {
              inquiryDetailId: inqDetail.id,
              lineNo: 1,
              itemType: 'SPARE_PART',
              mappedSparePartId: sparePart.id,
              qty: qty,
              unitPrice: unitPrice,
              totalPrice: totalPrice,
              leadTimeDays: 14,
            },
          ],
        },
      },
      include: { details: true },
    });

    if (stopAt === 'QUOTATION') return quotation;

    // ==========================================
    // 3. CREATE PURCHASE ORDER
    // ==========================================
    const quoDetail = quotation.details[0];

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${baseCode}`,
        quotationId: quotation.id,
        poType: 'SPARE_PART',
        status: poStatus,
        netValue: totalPrice,
        currency: 'IDR',
        createdBy: user.id,
        details: {
          create: [
            {
              quotationDetailId: quoDetail.id,
              itemType: 'SPARE_PART',
              mappedSparePartId: sparePart.id,
              qty: qty,
              unitPrice: unitPrice,
              totalPrice: totalPrice,
            },
          ],
        },
        sparePartDetail: {
          create: {
            vendorId: vendor.id,
            shipToPartyName: 'Gudang Pabrik Utama',
            expectedTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            internalPoUploadedAt: new Date(),
          },
        },
      },
      include: { details: true },
    });

    if (stopAt === 'PO') return po;

    // ==========================================
    // 4. CREATE DELIVERY
    // ==========================================
    const poDetail = po.details[0];

    const isDelivered =
      deliveryStatus === 'DELIVERED' || deliveryStatus === 'COMPLETED';

    const delivery = await prisma.delivery.create({
      data: {
        deliveryNumber: `DEL-${baseCode}`,
        poId: po.id,
        status: deliveryStatus,
        targetDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        actualDeliveryDate: isDelivered ? new Date() : null,
        createdBy: user.id,
        items: {
          create: [
            {
              poDetailId: poDetail.id,
              qtyDelivered: isDelivered ? qty : 0,
            },
          ],
        },
      },
    });

    if (stopAt === 'DELIVERY') return delivery;

    // ==========================================
    // 5. CREATE INVOICE
    // ==========================================
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${baseCode}`,
        sourceType: 'DELIVERY',
        deliveryId: delivery.id,
        poId: po.id,
        quotationId: quotation.id,
        customerId: customer.id,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: 'IDR',
        exchangeRate: 1,
        subtotalAmount: totalPrice,
        taxAmount: 0,
        totalAmount: totalPrice,
        status: options.invoiceStatus || 'DRAFT',
        createdBy: user.id,
        details: {
          create: [
            {
              description: `Tagihan Delivery ${delivery.deliveryNumber}`,
              qty: 1,
              uom: 'lot',
              unitPrice: totalPrice,
              lineTotal: totalPrice,
            }
          ]
        }
      }
    });

    if (options.invoiceStatus === 'PAID') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: totalPrice,
          remainingAmount: 0,
          paymentDate: new Date(),
          paymentNote: 'Lunas via Transfer Bank',
        }
      });
    }

    return invoice;
  };

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(2, 14);

  try {
    // Set 1: Inquiry baru / belum convert
    await createWorkflow(`${timestamp}-1`, {
      inquiryStatus: 'OPEN',
      stopAt: 'INQUIRY',
    });
    console.log('   - Generated Set 1: Inquiry OPEN');

    // Set 2: Quotation Draft
    await createWorkflow(`${timestamp}-2`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'DRAFT',
      stopAt: 'QUOTATION',
    });
    console.log('   - Generated Set 2: Quotation DRAFT');

    // Set 3: Quotation Sent
    await createWorkflow(`${timestamp}-3`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'SENT',
      stopAt: 'QUOTATION',
    });
    console.log('   - Generated Set 3: Quotation SENT');

    // Set 4: Quotation Realized masuk PO Review
    await createWorkflow(`${timestamp}-4`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'REVIEW',
      stopAt: 'PO',
    });
    console.log('   - Generated Set 4: PO REVIEW');

    // Set 5: PO Processing
    await createWorkflow(`${timestamp}-5`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'PROCESSING',
      stopAt: 'PO',
    });
    console.log('   - Generated Set 5: PO PROCESSING');

    // Set 6: PO Waiting OC
    await createWorkflow(`${timestamp}-6`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'WAITING_OC',
      stopAt: 'PO',
    });
    console.log('   - Generated Set 6: PO WAITING_OC');

    // Set 7: PO Ready
    await createWorkflow(`${timestamp}-7`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'READY',
      stopAt: 'PO',
    });
    console.log('   - Generated Set 7: PO READY');

    // Set 8: Delivery Review Logistic
    await createWorkflow(`${timestamp}-8`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      deliveryStatus: 'REVIEW_LOGISTIC',
      stopAt: 'DELIVERY',
    });
    console.log('   - Generated Set 8: Delivery REVIEW_LOGISTIC');

    // Set 9: Delivery Packed
    await createWorkflow(`${timestamp}-9`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      deliveryStatus: 'PACKED',
      stopAt: 'DELIVERY',
    });
    console.log('   - Generated Set 9: Delivery PACKED');

    // Set 10: Delivery Shipped
    await createWorkflow(`${timestamp}-10`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      deliveryStatus: 'SHIPPED',
      stopAt: 'DELIVERY',
    });
    console.log('   - Generated Set 10: Delivery SHIPPED');

    // Set 11: Delivery In Transit
    await createWorkflow(`${timestamp}-11`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      deliveryStatus: 'IN_TRANSIT',
      stopAt: 'DELIVERY',
    });
    console.log('   - Generated Set 11: Delivery IN_TRANSIT');

    // Set 12: Delivery Delivered
    await createWorkflow(`${timestamp}-12`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      deliveryStatus: 'DELIVERED',
      stopAt: 'DELIVERY',
    });
    console.log('   - Generated Set 12: Delivery DELIVERED');

    // Set 13: Delivery Completed
    await createWorkflow(`${timestamp}-13`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      deliveryStatus: 'COMPLETED',
      stopAt: 'DELIVERY',
    });
    console.log('   - Generated Set 13: Delivery COMPLETED');

    // Set 14: Quotation Close Loss
    await createWorkflow(`${timestamp}-14`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'CLOSE_LOSS',
      stopAt: 'QUOTATION',
    });
    console.log('   - Generated Set 14: Quotation CLOSE_LOSS');

    // Set 15: Invoice DRAFT
    await createWorkflow(`${timestamp}-15`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      deliveryStatus: 'COMPLETED',
      invoiceStatus: 'DRAFT',
      stopAt: 'INVOICE',
    });
    console.log('   - Generated Set 15: Invoice DRAFT');

    // Set 16: Invoice PAID
    await createWorkflow(`${timestamp}-16`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      deliveryStatus: 'COMPLETED',
      invoiceStatus: 'PAID',
      stopAt: 'INVOICE',
    });
    console.log('   - Generated Set 16: Invoice PAID');

    console.log('✅ Dummy Spare Part Workflows seeded successfully.');
  } catch (err) {
    console.error('❌ Error seeding dummy workflow:', err);
    throw err;
  }
};

module.exports = {
  seedSparePartWorkflow,
};
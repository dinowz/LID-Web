const seedProjectWorkflow = async (prisma) => {
  console.log('Seeding Dummy Project Workflows...');

  // ==============================
  // VALID STATUS LIST
  // ==============================
  const VALID_STATUS = {
    inquiry: ['OPEN', 'CONVERTED'],
    quotation: ['DRAFT', 'SENT', 'REALIZED', 'CLOSE_LOSS'],
    po: ['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'IN_PROGRESS'],
    projectExecution: [
      'PENDING',
      'IN_PROGRESS',
      'DONE',
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
  const serviceItem = await prisma.masterServiceItem.findFirst();

  if (!user || !customer || !codeWord || !vendor || !serviceItem) {
    console.warn('⚠️ Master data tidak lengkap, melewati seeder workflow dummy Project.');
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
      projectExecutionStatus = 'PENDING',
      stopAt = 'PROJECT', // INQUIRY, QUOTATION, PO, PROJECT
    } = options;

    validateStatus('inquiry', inquiryStatus);
    validateStatus('quotation', quotationStatus);
    validateStatus('po', poStatus);
    if (stopAt === 'PROJECT') {
      validateStatus('projectExecution', projectExecutionStatus);
    }

    const baseCode = `DUMMY-PRJ-${suffix}`;

    // ==========================================
    // 1. CREATE INQUIRY
    // ==========================================
    const inquiry = await prisma.inquiry.create({
      data: {
        inquiryNumber: `INQ-${baseCode}`,
        sourceCode: `SRC-${baseCode}`,
        statusCode: inquiryStatus,
        requestType: 'PROJECT_OM',
        subject: `Permintaan Project O&M Dummy ${suffix}`,
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
              itemType: 'SERVICE',
              requestedItemName: serviceItem.serviceName,
              requestDescription: `Pelaksanaan Project ${serviceItem.serviceName}`,
              qty: 1,
              uom: 'Lot',
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
      parseFloat(serviceItem.standardPrice) > 0
        ? parseFloat(serviceItem.standardPrice)
        : 50000000;

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
        leadTimeDays: 30,
        createdBy: user.id,
        details: {
          create: [
            {
              inquiryDetailId: inqDetail.id,
              lineNo: 1,
              itemType: 'SERVICE',
              mappedServiceId: serviceItem.id,
              qty: qty,
              unitPrice: unitPrice,
              totalPrice: totalPrice,
              leadTimeDays: 30,
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
        poType: 'PROJECT',
        status: poStatus,
        netValue: totalPrice,
        currency: 'IDR',
        createdBy: user.id,
        details: {
          create: [
            {
              quotationDetailId: quoDetail.id,
              itemType: 'SERVICE',
              mappedServiceId: serviceItem.id,
              qty: qty,
              unitPrice: unitPrice,
              totalPrice: totalPrice,
            },
          ],
        },
        projectDetail: {
          create: {
            vendorId: vendor.id,
            internalPoUploadedAt: new Date(),
            serviceStartDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            serviceEndDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { details: true, projectDetail: true },
    });

    if (stopAt === 'PO') return po;

    // ==========================================
    // 4. CREATE PROJECT EXECUTION
    // ==========================================
    const isDone = projectExecutionStatus === 'DONE';

    const projectExecution = await prisma.projectExecution.create({
      data: {
        projectNumber: `PRJ-${baseCode}`,
        poId: po.id,
        projectName: inquiry.subject,
        projectType: 'OM',
        status: projectExecutionStatus,
        progressPercentage: isDone ? 100 : (projectExecutionStatus === 'IN_PROGRESS' ? 50 : 0),
        startDate: po.projectDetail?.serviceStartDate,
        targetDate: po.projectDetail?.serviceEndDate,
        completedDate: isDone ? new Date() : null,
        createdBy: user.id,
      },
    });

    if (stopAt === 'PROJECT') return projectExecution;

    // ==========================================
    // 5. CREATE INVOICE
    // ==========================================
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${baseCode}`,
        sourceType: 'PROJECT',
        projectId: projectExecution.id,
        poId: po.id,
        quotationId: quotation.id,
        customerId: customer.id,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: 'IDR',
        exchangeRate: 1,
        subtotalAmount: totalPrice, // Full amount for dummy
        taxAmount: 0,
        totalAmount: totalPrice,
        status: options.invoiceStatus || 'DRAFT',
        createdBy: user.id,
        details: {
          create: [
            {
              description: `Tagihan Project ${projectExecution.projectNumber}`,
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

    // Set 5: PO Ready
    await createWorkflow(`${timestamp}-5`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'READY',
      stopAt: 'PO',
    });
    console.log('   - Generated Set 5: PO READY');

    // Set 6: Project PENDING
    await createWorkflow(`${timestamp}-6`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      projectExecutionStatus: 'PENDING',
      stopAt: 'PROJECT',
    });
    console.log('   - Generated Set 6: Project PENDING');

    // Set 7: Project IN_PROGRESS
    await createWorkflow(`${timestamp}-7`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      projectExecutionStatus: 'IN_PROGRESS',
      stopAt: 'PROJECT',
    });
    console.log('   - Generated Set 7: Project IN_PROGRESS');

    // Set 8: Project DONE
    await createWorkflow(`${timestamp}-8`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      projectExecutionStatus: 'DONE',
      stopAt: 'PROJECT',
    });
    console.log('   - Generated Set 8: Project DONE');

    // Set 9: Invoice DRAFT
    await createWorkflow(`${timestamp}-9`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      projectExecutionStatus: 'DONE',
      invoiceStatus: 'DRAFT',
      stopAt: 'INVOICE',
    });
    console.log('   - Generated Set 9: Invoice DRAFT');

    // Set 10: Invoice PAID
    await createWorkflow(`${timestamp}-10`, {
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      projectExecutionStatus: 'DONE',
      invoiceStatus: 'PAID',
      stopAt: 'INVOICE',
    });
    console.log('   - Generated Set 10: Invoice PAID');

    console.log('✅ Dummy Project Workflows seeded successfully.');
  } catch (err) {
    console.error('❌ Error seeding dummy project workflow:', err);
    throw err;
  }
};

module.exports = {
  seedProjectWorkflow,
};

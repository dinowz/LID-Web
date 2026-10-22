/**
 * serviceWorkflowSeed.js
 * -------------------------------------------------------
 * Seeds service execution workflows with valid status list:
 *
 * Inquiry          : OPEN, CONVERTED
 * Quotation        : DRAFT, SENT, REALIZED, CLOSE_LOSS
 * Purchase Order   : REVIEW, PROCESSING, WAITING_OC, READY, IN_PROGRESS
 * ServiceExecution : PENDING, IN_PROGRESS
 *
 * Flow types:
 * 1. EXTERNAL_PURCHASE  – Inquiry → Quotation → PO → ServiceExecution (external vendor, no TFS)
 * 4. EXTERNAL_PURCHASE – Inquiry → Quotation → PO → ServiceExecution (external vendor, no TFS)
 *
 * Notes:
 * - DONE removed because it is not in the requested valid status list.
 * - Completed service examples are represented as IN_PROGRESS 90%.
 * -------------------------------------------------------
 */

const seedServiceWorkflow = async (prisma) => {
  console.log('  Seeding Service Workflow (PO, External TFS, IC TFS)...');

  const VALID_STATUS = {
    inquiry: ['OPEN', 'CONVERTED'],
    quotation: ['DRAFT', 'SENT', 'REALIZED', 'CLOSE_LOSS'],
    po: ['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'IN_PROGRESS'],
    serviceExecution: ['PENDING', 'IN_PROGRESS', 'DONE', 'COMPLETED'],
  };

  const validateStatus = (type, status) => {
    if (!VALID_STATUS[type].includes(status)) {
      throw new Error(
        `Invalid ${type} status: ${status}. Valid: ${VALID_STATUS[type].join(', ')}`
      );
    }
  };

  // ─── Load master data ─────────────────────────────────────────
  const user = await prisma.user.findFirst();
  const customer = await prisma.customer.findFirst();
  const codeWord = await prisma.codeWord.findFirst();
  const vendor = await prisma.vendor.findFirst();
  const serviceItem = await prisma.masterServiceItem.findFirst();
  const personnels = await prisma.masterDivision.findMany({
    take: 3,
    where: { active: true },
  });

  if (!user || !customer || !codeWord || !serviceItem) {
    console.warn(
      '  ⚠️ Master data tidak lengkap (user/customer/codeWord/serviceItem), melewati service seeder.'
    );
    return;
  }

  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(2, 12);

  // ─── Helper: generate TFS number ──────────────────────────────
  let tfsSeq = 1;
  const nextTfsNumber = () =>
    `TFS-SVC-${ts}-${String(tfsSeq++).padStart(3, '0')}`;

  // ─── Helper: generate Service Execution number ─────────────────
  let svcSeq = 1;
  const nextSvcNumber = () =>
    `SVC-SEED-${ts}-${String(svcSeq++).padStart(3, '0')}`;

  // ─── Helper: create TFS assignments for a ServiceExecution ─────
  const createTfsAssignments = async (serviceExecutionId, count = 2) => {
    for (let i = 0; i < Math.min(count, personnels.length); i++) {
      const p = personnels[i];

      await prisma.tFS.create({
        data: {
          tfsNumber: nextTfsNumber(),
          serviceExecutionId,
          personnelId: p.id,
          title: `Penugasan ${p.title} – Execution`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          days: 7,
          jobDescription: `Melaksanakan tugas lapangan sesuai dengan scope pekerjaan oleh ${p.name}`,
          status: 'IN_PROGRESS',
          remarks: 'Seeded data',
        },
      });

      // Update personnel status to not idle for seeded data
      await prisma.masterDivision.update({
        where: { id: p.id },
        data: { isIdle: false }
      });
    }
  };

  // ================================================================
  // TYPE 1: EXTERNAL_PURCHASE
  // Alur: Inquiry → Quotation → PO → ServiceExecution
  // ================================================================
  console.log('    → Creating EXTERNAL_PURCHASE service records...');

  const poScenarios = [
    {
      suffix: `PO-${ts}-1`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'REVIEW',
      svcStatus: 'PENDING',
      progress: 0,
      label: 'Pending - PO Review',
    },
    {
      suffix: `PO-${ts}-2`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'PROCESSING',
      svcStatus: 'IN_PROGRESS',
      progress: 45,
      label: 'In Progress - PO Processing',
    },
    {
      suffix: `PO-${ts}-3`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      svcStatus: 'IN_PROGRESS',
      progress: 90,
      label: 'In Progress - Service hampir selesai',
    },
    {
      suffix: `PO-${ts}-4`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      svcStatus: 'DONE',
      progress: 100,
      invoiceStatus: 'DRAFT',
      label: 'Done - Invoice Draft',
    },
    {
      suffix: `PO-${ts}-5`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'IN_PROGRESS',
      svcStatus: 'DONE',
      progress: 100,
      invoiceStatus: 'PAID',
      label: 'Done - Invoice Paid',
    },
  ];

  for (const s of poScenarios) {
    try {
      validateStatus('inquiry', s.inquiryStatus);
      validateStatus('quotation', s.quotationStatus);
      validateStatus('po', s.poStatus);
      validateStatus('serviceExecution', s.svcStatus);

      const unitPrice =
        parseFloat(serviceItem.standardPrice) > 0
          ? parseFloat(serviceItem.standardPrice)
          : 5000000;

      const qty = 1;
      const totalPrice = unitPrice * qty;

      // 1. Inquiry
      const inq = await prisma.inquiry.create({
        data: {
          inquiryNumber: `INQ-${s.suffix}`,
          sourceCode: `SRC-${s.suffix}`,
          statusCode: s.inquiryStatus,
          requestType: 'SERVICE_EXTERNAL_PURCHASE',
          subject: `[PO Flow] Service Mesin Industrial – ${s.label}`,
          inquiryDate: new Date(),
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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
                requestDescription: `Permintaan jasa ${serviceItem.serviceName}`,
                qty,
                uom: 'Unit',
              },
            ],
          },
        },
        include: { details: true },
      });

      // 2. Quotation
      const quo = await prisma.quotation.create({
        data: {
          quotationNumber: `QUO-${s.suffix}`,
          inquiryId: inq.id,
          status: s.quotationStatus,
          basePrice: totalPrice,
          totalPrice,
          currency: 'IDR',
          leadTimeDays: 7,
          createdBy: user.id,
          details: {
            create: [
              {
                inquiryDetailId: inq.details[0].id,
                lineNo: 1,
                itemType: 'SERVICE',
                mappedServiceId: serviceItem.id,
                qty,
                unitPrice,
                totalPrice,
                leadTimeDays: 7,
              },
            ],
          },
        },
        include: { details: true, inquiry: true },
      });

      // 3. Purchase Order
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber: `PO-${s.suffix}`,
          quotationId: quo.id,
          poType: 'SERVICE',
          status: s.poStatus,
          netValue: totalPrice,
          currency: 'IDR',
          createdBy: user.id,
          details: {
            create: [
              {
                quotationDetailId: quo.details[0].id,
                itemType: 'SERVICE',
                mappedServiceId: serviceItem.id,
                qty,
                unitPrice,
                totalPrice,
              },
            ],
          },
          serviceDetail: {
            create: {
              vendorId: vendor?.id ?? null,
              serviceStartDate: new Date(),
              serviceEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              picName: 'Ir. Firdaus, MT',
              engineerName: 'Ahmad Mubarok',
            },
          },
        },
      });

      // 4. Service Execution
      const svc = await prisma.serviceExecution.create({
        data: {
          serviceNumber: nextSvcNumber(),
          sourceType: 'EXTERNAL_PURCHASE',
          poId: po.id,
          status: s.svcStatus,
          progressPercentage: s.progress,
          engineerName: 'Repairing|Ir. Firdaus, MT',
          startDate: new Date(),
          targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          completedDate: null,
          remarks: `Seeded – ${s.label}`,
          createdBy: user.id,
        },
      });

      if (personnels.length > 0) {
        await createTfsAssignments(svc.id, 2);
      }

      await prisma.serviceExecutionHistory.create({
        data: {
          serviceId: svc.id,
          oldStatus: null,
          newStatus: s.svcStatus,
          oldProgress: 0,
          newProgress: s.progress,
          progressNote: `Initial status set to ${s.svcStatus}`,
          changedBy: user.id,
        },
      });

      if (s.invoiceStatus) {
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: `INV-${s.suffix}`,
            sourceType: 'SERVICE',
            serviceId: svc.id,
            poId: po.id,
            quotationId: quo.id,
            customerId: customer.id,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            currency: 'IDR',
            exchangeRate: 1,
            subtotalAmount: totalPrice,
            taxAmount: 0,
            totalAmount: totalPrice,
            status: s.invoiceStatus,
            createdBy: user.id,
            details: {
              create: [
                {
                  description: quo.inquiry.subject || `Tagihan Service ${svc.serviceNumber}`,
                  qty: 1,
                  uom: 'lot',
                  unitPrice: totalPrice,
                  lineTotal: totalPrice,
                },
                {
                  description: `TFS - Ahmad Mubarok (1 Days, 2 Hours)`,
                  qty: 1,
                  uom: 'Ls',
                  unitPrice: 0,
                  lineTotal: 0,
                }
              ]
            }
          }
        });

        if (s.invoiceStatus === 'PAID') {
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
      }

      console.log(`      ✔ PO Flow: ${s.label}`);
    } catch (err) {
      console.error(`      ✘ PO Flow [${s.suffix}]:`, err.message);
    }
  }

  // ================================================================
  // TYPE 2: EXTERNAL_TFS
  // Alur: Inquiry → Quotation → ServiceExecution + TFS tanpa PO
  // ================================================================
  console.log('    → Creating EXTERNAL_TFS service records...');

  const extScenarios = [
    {
      suffix: `EXT-${ts}-1`,
      inquiryStatus: 'OPEN',
      quotationStatus: 'DRAFT',
      svcStatus: 'PENDING',
      progress: 0,
      label: 'Pending - Quotation Draft',
    },
    {
      suffix: `EXT-${ts}-2`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'SENT',
      svcStatus: 'PENDING',
      progress: 0,
      label: 'Pending - Quotation Sent',
    },
    {
      suffix: `EXT-${ts}-3`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      svcStatus: 'IN_PROGRESS',
      progress: 60,
      label: 'In Progress - Tim sedang di lapangan',
    },
  ];

  for (const s of extScenarios) {
    try {
      validateStatus('inquiry', s.inquiryStatus);
      validateStatus('quotation', s.quotationStatus);
      validateStatus('serviceExecution', s.svcStatus);

      const unitPrice = 8000000;
      const qty = 1;
      const totalPrice = unitPrice * qty;

      // 1. Inquiry
      const inq = await prisma.inquiry.create({
        data: {
          inquiryNumber: `INQ-${s.suffix}`,
          sourceCode: `SRC-${s.suffix}`,
          statusCode: s.inquiryStatus,
          requestType: 'SERVICE_EXTERNAL_TFS',
          subject: `[External TFS] Inspeksi & Commissioning Unit – ${s.label}`,
          inquiryDate: new Date(),
          dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
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
                requestDescription: 'Inspeksi berkala dan commissioning unit baru',
                qty,
                uom: 'Lot',
              },
            ],
          },
        },
        include: { details: true },
      });

      // 2. Quotation
      const quo = await prisma.quotation.create({
        data: {
          quotationNumber: `QUO-${s.suffix}`,
          inquiryId: inq.id,
          status: s.quotationStatus,
          basePrice: totalPrice,
          totalPrice,
          currency: 'IDR',
          leadTimeDays: 10,
          createdBy: user.id,
          details: {
            create: [
              {
                inquiryDetailId: inq.details[0].id,
                lineNo: 1,
                itemType: 'SERVICE',
                mappedServiceId: serviceItem.id,
                qty,
                unitPrice,
                totalPrice,
                leadTimeDays: 10,
              },
            ],
          },
        },
      });

      // 3. Service Execution
      const svc = await prisma.serviceExecution.create({
        data: {
          serviceNumber: nextSvcNumber(),
          sourceType: 'EXTERNAL_TFS',
          quotationId: quo.id,
          status: s.svcStatus,
          progressPercentage: s.progress,
          engineerName: 'Cleaning|Budi Santoso',
          startDate: new Date(),
          targetDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          completedDate: null,
          remarks: `Seeded – ${s.label}`,
          createdBy: user.id,
        },
      });

      if (personnels.length > 0) {
        await createTfsAssignments(svc.id, 2);
      }

      await prisma.serviceExecutionHistory.create({
        data: {
          serviceId: svc.id,
          oldStatus: null,
          newStatus: s.svcStatus,
          oldProgress: 0,
          newProgress: s.progress,
          progressNote: `Auto-created from Quotation External`,
          changedBy: user.id,
        },
      });

      console.log(`      ✔ External TFS: ${s.label}`);
    } catch (err) {
      console.error(`      ✘ External TFS [${s.suffix}]:`, err.message);
    }
  }

  // ================================================================
  // TYPE 3: IC_TFS
  // Alur: Inquiry IC → ServiceExecution + TFS tanpa Quotation, tanpa PO
  // ================================================================
  console.log('    → Creating IC_TFS service records...');

  const icScenarios = [
    {
      suffix: `IC-${ts}-1`,
      inquiryStatus: 'OPEN',
      svcStatus: 'PENDING',
      progress: 0,
      label: 'Pending - Baru diterima',
    },
    {
      suffix: `IC-${ts}-2`,
      inquiryStatus: 'CONVERTED',
      svcStatus: 'IN_PROGRESS',
      progress: 30,
      label: 'In Progress - Persiapan tim',
    },
    {
      suffix: `IC-${ts}-3`,
      inquiryStatus: 'CONVERTED',
      svcStatus: 'IN_PROGRESS',
      progress: 85,
      label: 'In Progress - Pekerjaan hampir selesai',
    },
  ];

  for (const s of icScenarios) {
    try {
      validateStatus('inquiry', s.inquiryStatus);
      validateStatus('serviceExecution', s.svcStatus);

      // 1. Inquiry IC
      const inq = await prisma.inquiry.create({
        data: {
          inquiryNumber: `INQ-${s.suffix}`,
          sourceCode: `SRC-${s.suffix}`,
          statusCode: s.inquiryStatus,
          requestType: 'SERVICE_IC_TFS',
          subject: `[IC TFS] Maintenance Internal Rutin – ${s.label}`,
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
                requestDescription: 'Perawatan berkala mesin produksi internal',
                qty: 1,
                uom: 'Job',
              },
            ],
          },
        },
      });

      // 2. Service Execution
      const svc = await prisma.serviceExecution.create({
        data: {
          serviceNumber: nextSvcNumber(),
          sourceType: 'IC_TFS',
          inquiryId: inq.id,
          status: s.svcStatus,
          progressPercentage: s.progress,
          engineerName: 'Maintaining|Citra Kirana',
          startDate: new Date(),
          targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          completedDate: null,
          remarks: `Seeded – ${s.label}`,
          createdBy: user.id,
        },
      });

      if (personnels.length > 0) {
        await createTfsAssignments(svc.id, 1);
      }

      await prisma.serviceExecutionHistory.create({
        data: {
          serviceId: svc.id,
          oldStatus: null,
          newStatus: s.svcStatus,
          oldProgress: 0,
          newProgress: s.progress,
          progressNote: `Auto-created from Inquiry IC`,
          changedBy: user.id,
        },
      });

      console.log(`      ✔ IC TFS: ${s.label}`);
    } catch (err) {
      console.error(`      ✘ IC TFS [${s.suffix}]:`, err.message);
    }
  }

  // TYPE 4: Removed because it is merged into TYPE 1 (EXTERNAL_PURCHASE)
  /*
  const extPoScenarios = [
    {
      suffix: `EXTPO-${ts}-1`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'REVIEW',
      svcStatus: 'PENDING',
      progress: 0,
      label: 'Pending - PO Baru Diterima (Vendor Eksternal)',
    },
    {
      suffix: `EXTPO-${ts}-2`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'WAITING_OC',
      svcStatus: 'IN_PROGRESS',
      progress: 30,
      label: 'In Progress - Menunggu Order Confirmation Vendor',
    },
    {
      suffix: `EXTPO-${ts}-3`,
      inquiryStatus: 'CONVERTED',
      quotationStatus: 'REALIZED',
      poStatus: 'READY',
      svcStatus: 'IN_PROGRESS',
      progress: 80,
      label: 'In Progress - Vendor Hampir Selesai',
    },
  ];

  for (const s of extPoScenarios) {
    try {
      validateStatus('inquiry', s.inquiryStatus);
      validateStatus('quotation', s.quotationStatus);
      validateStatus('po', s.poStatus);
      validateStatus('serviceExecution', s.svcStatus);

      const unitPrice =
        parseFloat(serviceItem.standardPrice) > 0
          ? parseFloat(serviceItem.standardPrice)
          : 12000000;

      const qty = 1;
      const totalPrice = unitPrice * qty;

      // 1. Inquiry
      const inq = await prisma.inquiry.create({
        data: {
          inquiryNumber: `INQ-${s.suffix}`,
          sourceCode: `SRC-${s.suffix}`,
          statusCode: s.inquiryStatus,
          requestType: 'SERVICE_EXTERNAL_PURCHASE',
          subject: `[External Purchase] Pengadaan Jasa Vendor Luar – ${s.label}`,
          inquiryDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
                requestDescription: `Pengadaan jasa dari vendor eksternal: ${serviceItem.serviceName}`,
                qty,
                uom: 'Lot',
              },
            ],
          },
        },
        include: { details: true },
      });

      // 2. Quotation
      const quo = await prisma.quotation.create({
        data: {
          quotationNumber: `QUO-${s.suffix}`,
          inquiryId: inq.id,
          status: s.quotationStatus,
          basePrice: totalPrice,
          totalPrice,
          currency: 'IDR',
          leadTimeDays: 21,
          createdBy: user.id,
          details: {
            create: [
              {
                inquiryDetailId: inq.details[0].id,
                lineNo: 1,
                itemType: 'SERVICE',
                mappedServiceId: serviceItem.id,
                qty,
                unitPrice,
                totalPrice,
                leadTimeDays: 21,
              },
            ],
          },
        },
        include: { details: true },
      });

      // 3. Purchase Order (vendor eksternal)
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber: `PO-${s.suffix}`,
          quotationId: quo.id,
          poType: 'SERVICE',
          status: s.poStatus,
          netValue: totalPrice,
          currency: 'IDR',
          createdBy: user.id,
          details: {
            create: [
              {
                quotationDetailId: quo.details[0].id,
                itemType: 'SERVICE',
                mappedServiceId: serviceItem.id,
                qty,
                unitPrice,
                totalPrice,
              },
            ],
          },
          serviceDetail: {
            create: {
              vendorId: vendor?.id ?? null,
              serviceStartDate: new Date(),
              serviceEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              picName: 'Dewi Rahmawati',
              engineerName: vendor ? null : 'Vendor Eksternal',
            },
          },
        },
      });

      // 4. Service Execution (tanpa TFS — dikerjakan vendor eksternal)
      const svc = await prisma.serviceExecution.create({
        data: {
          serviceNumber: nextSvcNumber(),
          sourceType: 'PURCHASE_ORDER',
          poId: po.id,
          status: s.svcStatus,
          progressPercentage: s.progress,
          engineerName: 'Vendor Eksternal',
          picName: 'Dewi Rahmawati',
          startDate: new Date(),
          targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          completedDate: null,
          remarks: `Seeded – ${s.label} (dikerjakan oleh vendor eksternal, tanpa TFS internal)`,
          createdBy: user.id,
        },
      });

      // Tidak ada TFS assignment — intentionally skipped untuk flow ini

      await prisma.serviceExecutionHistory.create({
        data: {
          serviceId: svc.id,
          oldStatus: null,
          newStatus: s.svcStatus,
          oldProgress: 0,
          newProgress: s.progress,
          progressNote: `Auto-created dari External Purchase PO – status awal ${s.svcStatus}`,
          changedBy: user.id,
        },
      });

      console.log(`      ✔ External Purchase: ${s.label}`);
    } catch (err) {
      console.error(`      ✘ External Purchase [${s.suffix}]:`, err.message);
    }
  }
  */

  console.log('  ✔ Service Workflow seeder selesai.');
};

module.exports = { seedServiceWorkflow };
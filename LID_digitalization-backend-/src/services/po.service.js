const prisma = require('../config/prisma');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { autoCreateDeliveryForPO } = require('./delivery.service');
const { autoCreateServiceExecutionForPO } = require('./service_execution.service');
const { deleteFiles } = require('../utils/file.utils');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const getPOs = async (filters = {}) => {
  const { poType, ...rest } = filters;
  
  const where = { ...rest };
  
  if (poType) {
    if (poType === 'SPARE_PART') {
      where.OR = [
        { poType: 'SPARE_PART' },
        { quotation: { inquiry: { requestType: 'SPARE_PART' } } }
      ];
    } else if (poType === 'SERVICE') {
      where.OR = [
        { poType: 'SERVICE' },
        { quotation: { inquiry: { requestType: { startsWith: 'SERVICE_' } } } }
      ];
    } else if (poType === 'PROJECT') {
      where.OR = [
        { poType: 'PROJECT' },
        { quotation: { inquiry: { requestType: { startsWith: 'PROJECT_' } } } }
      ];
    }
  }

  return await prisma.purchaseOrder.findMany({
    where,
    include: {
      histories: { include: { changer: true }, orderBy: { createdAt: 'desc' } },
      quotation: {
        include: {
          inquiry: { include: { customer: true, codeWord: true, histories: { include: { changer: true } } } },
          purchaseOrders: {
            select: { id: true, poNumber: true }
          }
        }
      },
      details: { include: { service: true, sparePart: true } },
      sparePartDetail: { include: { vendor: true } },
      serviceDetail: true,
      projectDetail: true,
      creator: true,
      updater: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

const getPOById = async (id) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: BigInt(id) },
    include: {
      details: {
        include: {
          service: true,
          sparePart: true,
        }
      },
      histories: { orderBy: { createdAt: 'desc' }, include: { changer: true } },
      quotation: {
        include: {
          details: {
            include: { service: true, sparePart: true }
          },
          purchaseOrders: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              netValue: true,
              currency: true,
              createdAt: true
            }
          },
          inquiry: {
            include: {
              customer: true,
              codeWord: true,
              histories: { include: { changer: true } },
              details: true
            }
          }
        }
      },

      sparePartDetail: { include: { vendor: true } },
      serviceDetail: true,
      projectDetail: true
    }
  });

  if (po && po.quotationId) {
    po.siblingPOs = await prisma.purchaseOrder.findMany({
      where: {
        quotationId: po.quotationId,
        id: { not: po.id }
      },
      select: {
        id: true,
        poNumber: true,
        status: true,
        netValue: true,
        currency: true,
        createdAt: true
      },
      orderBy: { id: 'asc' }
    });
  }

  return po;
};

const createPOFromQuotation = async (quotationId, userId, additionalData = {}) => {
  return await prisma.$transaction(async (tx) => {
    const { customerPoFile } = additionalData;
    // 1. Check if quotation exists
    const quotation = await tx.quotation.findUnique({
      where: { id: BigInt(quotationId) },
      include: {
        inquiry: { include: { customer: true, codeWord: true } },
        details: true,
        creator: true,
        sparePartDetail: true,
      }
    });

    if (!quotation) {
      throw new Error(`Quotation not found for ID ${quotationId}`);
    }

    // 2. Check status
    if (quotation.status !== 'SENT') {
      throw new Error(`Cannot create PO. Quotation status must be SENT (currently: ${quotation.status}). Please send the quotation first.`);
    }

    // 3. Tentukan poType dari requestType inquiry
    const requestType = quotation.inquiry?.requestType || '';
    let poType = 'SPARE_PART';
    if (requestType.startsWith('SERVICE_')) poType = 'SERVICE';
    if (requestType.startsWith('PROJECT_')) poType = 'PROJECT';

    // 4. Determine effective currency (align with quotation: IDR for local customer)
    const isLocal = quotation.inquiry?.customer?.customerType !== 'FOREIGN';
    const effectiveCurrency = isLocal ? 'IDR' : (quotation.currency || 'IDR');

    // 5. Prepare PO Data
    const poData = {
      poNumber: null,
      quotation: { connect: { id: BigInt(quotationId) } },
      status: 'REVIEW',
      poType,
      customerPoFile: customerPoFile || null,
      netValue: quotation.totalPrice,
      currency: effectiveCurrency,
      exchangeRate: quotation.exchangeRate,
      codeWord: quotation.inquiry?.codeWord?.code || null,
      salesOrganization: quotation.creator?.name || 'System Generated',
      hasDp: Boolean(quotation.sparePartDetail?.hasDp),
      dpPercent: quotation.sparePartDetail?.hasDp ? (quotation.sparePartDetail?.dpPercent || 0) : 0,
      dpAmount: quotation.sparePartDetail?.hasDp ? (quotation.sparePartDetail?.dpAmount || 0) : 0,
      statusChangedAt: new Date(),
      lastActivityAt: new Date(),
      ...(userId ? { creator: { connect: { id: Number(userId) } } } : {}),
    };

    if (quotation.details && quotation.details.length > 0) {
      const isSparepart = poType === 'SPARE_PART';
      poData.details = {
        create: quotation.details.map((d) => {
          const qty = Number(d.qty || 1);
          const sellPrice = Number(d.sellPriceCalc || 0);
          const effectiveTotalPrice = (isSparepart && sellPrice > 0) ? Math.round(sellPrice) : Number(d.totalPrice || 0);
          const effectiveUnitPrice = (isSparepart && sellPrice > 0 && qty > 0) ? Math.round(sellPrice / qty) : Number(d.unitPrice || 0);

          return {
            itemType: d.itemType,
            qty: d.qty,
            unitPrice: effectiveUnitPrice,
            totalPrice: effectiveTotalPrice,
            note: d.note,
            quotationDetailId: d.id,
            ...(d.mappedServiceId && { service: { connect: { id: d.mappedServiceId } } }),
            ...(d.mappedSparePartId && { sparePart: { connect: { id: d.mappedSparePartId } } }),
          };
        })
      };
    }

    const po = await tx.purchaseOrder.create({
      data: poData,
      include: { details: true }
    });

    // 5. Auto-create extension record
    if (poType === 'SPARE_PART') {
      await tx.purchaseOrderSparePart.create({
        data: { poId: po.id, shipToPartyName: quotation.inquiry?.customer?.name || null }
      });
    } else if (poType === 'SERVICE') {
      await tx.purchaseOrderService.create({ data: { poId: po.id } });
    } else if (poType === 'PROJECT') {
      await tx.purchaseOrderProject.create({ data: { poId: po.id } });
    }

    // 6. Update Quotation Status to REALIZED
    await tx.quotation.update({
      where: { id: BigInt(quotationId) },
      data: { status: 'REALIZED' }
    });

    return po;
  });
};


const PO_STATUSES_SPAREPART = ['REVIEW', 'PROCESSING', 'WAITING_OC', 'MANUFACTURING', 'READY', 'COMPLETED'];
const PO_STATUSES_SERVICE = ['REVIEW', 'PROCESSING', 'WAITING_OC', 'READY', 'COMPLETED'];

const STATUS_LABELS = {
  REVIEW: 'Review & Input',
  PROCESSING: 'PO Internal Dibuat',
  WAITING_OC: 'Menunggu Order Confirmation',
  MANUFACTURING: 'Dalam Proses Manufaktur',
  READY: 'Dokumen Vendor Lengkap',
  COMPLETED: 'Selesai & Proses ke Delivery',
};

const updatePO = async (id, data, userId) => {
  const {
    poNumber, sdDocument, netValue, currency, codeWord,
    salesOrganization, shipToPartyName, expectedTo, remarks,
    reminderEmail, status, vendorId, vendorType,
    internalPoFile, ocFile, vendorInvoiceFile, vendorPackingListFile,
    bastFile, qcCheckFile,
    estimatedProductionDone, estimatedReadyToShip,
    serviceStartDate, serviceEndDate, picName, engineerName,
    serviceReportFile, baFile, vendorQuotationFile, otherQuotationFiles
  } = data;

  return await prisma.$transaction(async (tx) => {
    const current = await tx.purchaseOrder.findUnique({
      where: { id: BigInt(id) },
      include: { sparePartDetail: true, serviceDetail: true, projectDetail: true }
    });
    if (!current) throw new Error("PO not found");

    // === Validate PO Number uniqueness ===
    if (poNumber) {
      const existingPO = await tx.purchaseOrder.findUnique({ where: { poNumber } });
      if (existingPO && existingPO.id !== BigInt(id)) {
        throw new Error(`Nomor PO "${poNumber}" sudah digunakan oleh dokumen lain.`);
      }
    }

    // Baca nilai dari ekstensi
    const isService = current.poType === 'SERVICE' || current.quotation?.inquiry?.requestType?.startsWith('SERVICE_');
    const isProject = current.poType === 'PROJECT';
    const isSparepart = current.poType === 'SPARE_PART' || (!current.poType && !isProject && !isService);

    const ext = isProject ? current.projectDetail : (isService ? current.serviceDetail : current.sparePartDetail);
    const currentInternalPoFile  = ext?.internalPoFile     ?? current.internalPoFile;
    const currentOcFile           = ext?.ocFile            ?? current.ocFile;
    const currentVendorInvoice    = ext?.vendorInvoiceFile ?? current.vendorInvoiceFile;
    const currentVendorId         = ext?.vendorId          ?? current.vendorId;
    
    // Khusus sparepart
    const spExt = current.sparePartDetail;
    const currentPackingList      = spExt?.vendorPackingListFile ?? current.vendorPackingListFile;
    const currentEstReady         = spExt?.estimatedReadyToShip ?? current.estimatedReadyToShip;
    const currentBastFile         = spExt?.bastFile;
    const currentQcCheckFile      = spExt?.qcCheckFile;
    const currentVendorType       = vendorType || spExt?.vendorType || 'EXTERNAL';

    // Khusus service
    const svcExt = current.serviceDetail;

    // Khusus project
    const prjExt = current.projectDetail;
    const currentPrjReport        = prjExt?.projectReportFile;
    const currentBaFile           = isProject ? prjExt?.baFile : svcExt?.baFile;
    
    // Estimasi Tanggal Service/Pengerjaan
    const currentSvcStartDate     = isProject ? prjExt?.serviceStartDate : svcExt?.serviceStartDate;
    const currentSvcEndDate       = isProject ? prjExt?.serviceEndDate : svcExt?.serviceEndDate;

    // === Status transition validation ===
    const isStatusChanging = status && status !== current.status;
    if (isStatusChanging) {
      const validSequence = isSparepart ? PO_STATUSES_SPAREPART : PO_STATUSES_SERVICE;
      const currentIdx = validSequence.indexOf(current.status);
      const newIdx = validSequence.indexOf(status);

      if (newIdx === -1) throw new Error(`Status "${status}" tidak valid.`);
      if (newIdx !== currentIdx + 1) {
        throw new Error(`Tidak bisa langsung dari ${current.status} ke ${status}. Ikuti urutan: ${validSequence.join(' → ')}`);
      }

      if (status === 'PROCESSING') {
        const effectivePoNumber = poNumber || current.poNumber;
        const effectiveFile = internalPoFile || currentInternalPoFile;
        const effectiveQuo = vendorQuotationFile !== undefined ? vendorQuotationFile : spExt?.vendorQuotationFile;
        if (!effectivePoNumber) throw new Error('Nomor PO internal wajib diisi sebelum pindah ke PROCESSING.');
        if (!effectiveFile) throw new Error('Upload dokumen PO Internal (PDF SAP) wajib sebelum pindah ke PROCESSING.');
        if (isSparepart && !effectiveQuo) throw new Error('Upload dokumen Quotation Vendor wajib sebelum pindah ke PROCESSING.');
      }

      if (status === 'WAITING_OC') {
        const effectiveVendorId = vendorId || currentVendorId;
        if (!effectiveVendorId) throw new Error('Pilih Vendor terlebih dahulu sebelum mengirim PO ke vendor.');
      }

      if (status === 'READY') {
        const effectiveOc   = ocFile           || currentOcFile;
        const effectiveInv  = vendorInvoiceFile || currentVendorInvoice;
        if (!effectiveOc)   throw new Error('Upload Order Confirmation (OC) dari vendor wajib sebelum pindah ke READY.');
        if (!effectiveInv && !isService)  throw new Error('Upload Vendor Invoice wajib sebelum pindah ke READY.');
        
        if (isSparepart) {
          const effectivePl   = vendorPackingListFile || currentPackingList;
          const effectiveShip = estimatedReadyToShip || currentEstReady;
          const effectiveBast = bastFile || currentBastFile;
          if (!effectivePl)   throw new Error('Upload Vendor Packing List wajib sebelum pindah ke READY.');
          if (!effectiveShip) throw new Error('Isi Estimasi Tanggal Siap Kirim wajib sebelum pindah ke READY.');
          if (currentVendorType === 'EXTERNAL' && !effectiveBast) {
            throw new Error('Upload BAST wajib untuk vendor External sebelum pindah ke READY.');
          }
        } else if (isService || isProject) {
          const effectiveStartDate = serviceStartDate || currentSvcStartDate;
          const effectiveEndDate = serviceEndDate || currentSvcEndDate;
          if (!effectiveStartDate || !effectiveEndDate) throw new Error('Isi Estimasi Tanggal Service/Pengerjaan (Start & End) wajib sebelum pindah ke READY.');
        }
      }

      if (status === 'COMPLETED') {
        if (current.status !== 'READY') throw new Error('PO harus dalam status READY sebelum masuk COMPLETED.');
        if (!currentOcFile)        throw new Error('Dokumen OC belum diupload.');
        if (!currentVendorInvoice && !isService) throw new Error('Vendor Invoice belum diupload.');
        
        if (isSparepart) {
          if (!currentPackingList)   throw new Error('Vendor Packing List belum diupload.');
          if (!currentEstReady)      throw new Error('Estimasi tanggal siap kirim belum diisi.');
          if (currentVendorType === 'EXTERNAL' && !currentBastFile) {
            throw new Error('BAST belum diupload (wajib untuk vendor External).');
          }
        } else if (isService || isProject) {
          if (!currentSvcStartDate || !currentSvcEndDate) throw new Error('Estimasi tanggal service/pengerjaan belum diisi.');
        }
      }
    }

    // === Auto-set SLA timestamps ===
    const autoTimestamps = {};
    if (isStatusChanging) {
      if (status === 'PROCESSING') autoTimestamps.internalPoUploadedAt = new Date();
      if (status === 'WAITING_OC') autoTimestamps.poSentToVendorAt = new Date();
      if (status === 'READY')      autoTimestamps.ocReceivedAt = new Date();
    }

    // === Update tabel header PO ===
    const updated = await tx.purchaseOrder.update({
      where: { id: BigInt(id) },
      data: {
        poNumber,
        sdDocument,
        netValue,
        currency,
        codeWord,
        salesOrganization,
        remarks,
        reminderEmail,
        lastActivityAt: new Date(),
        ...(isStatusChanging && { statusChangedAt: new Date() }),
        ...(status && { status }),
        updatedBy: userId ? Number(userId) : null
      }
    });

    // === Update tabel ekstensi sparePartDetail / serviceDetail ===
    if (isSparepart) {
      const spData = {
        ...(shipToPartyName !== undefined && { shipToPartyName }),
        ...(expectedTo !== undefined && { expectedTo: expectedTo ? new Date(expectedTo) : null }),
        ...(vendorId !== undefined && { vendorId }),
        ...(vendorType !== undefined && { vendorType }),
        ...(internalPoFile !== undefined && { internalPoFile }),
        ...(ocFile !== undefined && { ocFile }),
        ...(vendorInvoiceFile !== undefined && { vendorInvoiceFile }),
        ...(vendorPackingListFile !== undefined && { vendorPackingListFile }),
        ...(bastFile !== undefined && { bastFile }),
        ...(qcCheckFile !== undefined && { qcCheckFile }),
        ...(estimatedProductionDone !== undefined && {
          estimatedProductionDone: estimatedProductionDone ? new Date(estimatedProductionDone) : null
        }),
        ...(estimatedReadyToShip !== undefined && {
          estimatedReadyToShip: estimatedReadyToShip ? new Date(estimatedReadyToShip) : null
        }),
        ...(vendorQuotationFile !== undefined && { vendorQuotationFile }),
        ...(otherQuotationFiles !== undefined && { otherQuotationFiles }),
        ...autoTimestamps,
      };

      if (Object.keys(spData).length > 0) {
        await tx.purchaseOrderSparePart.upsert({
          where: { poId: BigInt(id) },
          update: spData,
          create: { poId: BigInt(id), ...spData }
        });
      }
    } else if (isService) {
      const svcData = {
        ...(vendorId !== undefined && { vendorId }),
        ...(internalPoFile !== undefined && { internalPoFile }),
        ...(ocFile !== undefined && { ocFile }),
        ...(vendorInvoiceFile !== undefined && { vendorInvoiceFile }),
        ...(serviceStartDate !== undefined && {
          serviceStartDate: serviceStartDate ? new Date(serviceStartDate) : null
        }),
        ...(serviceEndDate !== undefined && {
          serviceEndDate: serviceEndDate ? new Date(serviceEndDate) : null
        }),
        ...(picName !== undefined && { picName }),
        ...(engineerName !== undefined && { engineerName }),
        ...(serviceReportFile !== undefined && { serviceReportFile }),
        ...(baFile !== undefined && { baFile }),
        ...autoTimestamps,
      };

      if (Object.keys(svcData).length > 0) {
        await tx.purchaseOrderService.upsert({
          where: { poId: BigInt(id) },
          update: svcData,
          create: { poId: BigInt(id), ...svcData }
        });
      }
    } else if (isProject) {
      const prjData = {
        ...(vendorId !== undefined && { vendorId }),
        ...(internalPoFile !== undefined && { internalPoFile }),
        ...(ocFile !== undefined && { ocFile }),
        ...(vendorInvoiceFile !== undefined && { vendorInvoiceFile }),
        ...(serviceStartDate !== undefined && {
          serviceStartDate: serviceStartDate ? new Date(serviceStartDate) : null
        }),
        ...(serviceEndDate !== undefined && {
          serviceEndDate: serviceEndDate ? new Date(serviceEndDate) : null
        }),
        ...(picName !== undefined && { picName }),
        ...(engineerName !== undefined && { engineerName }),
        ...(baFile !== undefined && { baFile }),
        ...autoTimestamps,
      };

      if (Object.keys(prjData).length > 0) {
        await tx.purchaseOrderProject.upsert({
          where: { poId: BigInt(id) },
          update: prjData,
          create: { poId: BigInt(id), ...prjData }
        });
      }
    }

    // === Record status history ===
    if (isStatusChanging) {
      const extUpdated = isService
        ? await tx.purchaseOrderService.findUnique({ where: { poId: BigInt(id) } })
        : (isProject ? await tx.purchaseOrderProject.findUnique({ where: { poId: BigInt(id) } })
        : (isSparepart ? await tx.purchaseOrderSparePart.findUnique({ where: { poId: BigInt(id) } }) : null));
        
      const noteMap = {
        PROCESSING: `PO Internal diunggah. PO Number: ${updated.poNumber || '-'}`,
        WAITING_OC: `PO dikirim ke vendor ${extUpdated?.vendorId ? `(Vendor ID: ${extUpdated.vendorId})` : ''}`,
        READY: `Order Confirmation diterima. Estimasi: ${(isService || isProject) ? extUpdated?.serviceStartDate?.toLocaleDateString('id-ID') : extUpdated?.estimatedReadyToShip?.toLocaleDateString('id-ID') || '-'}`,
        COMPLETED: `Semua dokumen lengkap. ${(isService || isProject) ? 'Execution' : 'Delivery'} akan dibuat otomatis.`,
      };

      await tx.purchaseOrderStatusHistory.create({
        data: {
          poId: updated.id,
          oldStatus: current.status,
          newStatus: status,
          changeNote: noteMap[status] || `Status berubah ke ${STATUS_LABELS[status] || status}`,
          changedBy: userId ? Number(userId) : null,
        }
      });

      // AUTO-CREATE DELIVERY / SERVICE EXECUTION / PROJECT EXECUTION when status → COMPLETED
      if (status === 'COMPLETED') {
        if (isService) {
          const existingExecution = await tx.serviceExecution.findFirst({ where: { poId: BigInt(id) } });
          if (!existingExecution) {
            await autoCreateServiceExecutionForPO(tx, id, updated.poNumber, userId);
          }
        } else if (isProject) {
          const existingExecution = await tx.projectExecution.findFirst({ where: { poId: BigInt(id) } });
          if (!existingExecution) {
            // Include inquiry to get project name properly
            const poWithInquiry = await tx.purchaseOrder.findUnique({
              where: { id: BigInt(id) },
              include: { quotation: { include: { inquiry: true } } }
            });
            const quoNumber = poWithInquiry?.quotation?.quotationNumber || '';
            const cleanSeq = quoNumber.replace('QUO-', '').split('-R')[0];
            const projectNumber = cleanSeq ? `PRJ-${cleanSeq}` : `PRJ-${updated.poNumber}`; 
            await tx.projectExecution.create({
              data: {
                poId: BigInt(id),
                projectNumber,
                projectType: 'OM',
                projectName: poWithInquiry?.quotation?.inquiry?.subject || 'Project O&M',
                status: 'PENDING',
                startDate: extUpdated?.serviceStartDate,
                targetDate: extUpdated?.serviceEndDate,
                createdBy: userId ? Number(userId) : null,
                statusChangedAt: new Date(),
                lastActivityAt: new Date()
              }
            });
          }
        } else if (isSparepart) {
          const existingDelivery = await tx.delivery.findFirst({ where: { poId: BigInt(id) } });
          if (!existingDelivery) {
            await autoCreateDeliveryForPO(tx, id, updated.poNumber, userId);
          }
        }

        // --- NEW CODE: Update Quotation Status to EXECUTED ---
        if (updated.quotationId) {
          const currentQuotation = await tx.quotation.findUnique({
            where: { id: updated.quotationId }
          });
          if (currentQuotation && currentQuotation.status !== 'EXECUTED') {
            await tx.quotation.update({
              where: { id: updated.quotationId },
              data: { status: 'EXECUTED' }
            });
            await tx.quotationStatusHistory.create({
              data: {
                quotationId: updated.quotationId,
                oldStatus: currentQuotation.status,
                newStatus: 'EXECUTED',
                changeNote: `PO #${updated.poNumber || id} is Completed. Setup phase finished.`,
                changedBy: userId ? Number(userId) : null
              }
            });
          }
        }
      }
    }

    return updated;
  });
};


const revertPOToQuotation = async (id, userId, reason) => {
  const filesToDelete = [];

  const quotationId = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: BigInt(id) },
      include: { quotation: true, sparePartDetail: true, serviceDetail: true, projectDetail: true }
    });

    if (!po) throw new Error("Purchase Order not found");
    if (po.status !== 'REVIEW') throw new Error("Only PO in REVIEW status can be reverted");

    // Collect file paths before deleting
    if (po.customerPoFile) filesToDelete.push(po.customerPoFile);
    const ext = po.sparePartDetail || po.serviceDetail || po.projectDetail;
    if (ext) {
      [ext.internalPoFile, ext.ocFile, ext.vendorInvoiceFile, ext.vendorPackingListFile,
       ext.serviceReportFile, ext.baFile, ext.projectReportFile]
        .filter(Boolean).forEach(f => filesToDelete.push(f));
    }

    // Check if sibling POs still exist for this quotation
    const siblingCount = po.quotationId ? await tx.purchaseOrder.count({
      where: { quotationId: po.quotationId, id: { not: po.id } }
    }) : 0;

    if (siblingCount === 0 && po.quotationId) {
      // 1. Record Quotation History
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: po.quotationId,
          oldStatus: 'REALIZED',
          newStatus: 'ACTIVE',
          changeNote: `Reverted from PO. Reason: ${reason}`,
          changedBy: userId ? Number(userId) : null
        }
      });

      // 2. Recalculate Quotation Number with Revision Count
      const historyCount = await tx.quotationStatusHistory.count({
        where: { quotationId: po.quotationId }
      });
      const baseQuoNumber = po.quotation ? po.quotation.quotationNumber.split('-R')[0] : '';
      const newQuoNumber = historyCount > 0 ? `${baseQuoNumber}-R${historyCount}` : baseQuoNumber;

      // 3. Update Quotation Status back to ACTIVE & new quotationNumber
      await tx.quotation.update({
        where: { id: po.quotationId },
        data: { status: 'ACTIVE', quotationNumber: newQuoNumber }
      });
    } else if (po.quotationId) {
      // Sibling POs exist: keep quotation as REALIZED, just record that this partial PO was removed
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: po.quotationId,
          oldStatus: 'REALIZED',
          newStatus: 'REALIZED',
          changeNote: `Partial PO #${po.poNumber || po.id} was cancelled/removed. Reason: ${reason}`,
          changedBy: userId ? Number(userId) : null
        }
      });
    }

    // Delete PO (this will cascade delete PO Details)
    await tx.purchaseOrder.delete({
      where: { id: BigInt(id) }
    });

    return po.quotationId;
  });

  // Clean up physical files after successful transaction
  if (filesToDelete.length > 0) {
    deleteFiles(filesToDelete);
  }

  return quotationId;
};

const sendReminderTest = async (id) => {
  const po = await getPOById(id);
  if (!po) throw new Error("Purchase Order not found");
  if (!po.reminderEmail) throw new Error("Reminder Email is not set in this Purchase Order");

  const mailOptions = {
    from: process.env.SMTP_USER || '"Digitalization System" <no-reply@example.com>',
    to: po.reminderEmail,
    subject: `WARNING: Handling Time Limit for PO Setup (Quotation Ref: ${po.quotation?.quotationNumber})`,
    html: `
      <h2>Handling Time Limit Reached</h2>
      <p>This is an automated reminder that the Purchase Order configuration for <strong>Quotation ${po.quotation?.quotationNumber}</strong> has exceeded the handling time limit (2 Days).</p>
      <p>Please review and complete the SAP Registration data immediately to move the status to PROCESS.</p>
      <p><strong>Customer:</strong> ${po.quotation?.inquiry?.customer?.name || '-'}</p>
      <p><strong>Net Value:</strong> ${parseFloat(po.netValue).toLocaleString()} ${po.currency}</p>
      <hr />
      <em>LIND Digitalization System</em>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};



const uploadDocumentPath = async (id, poType, documentType, fileUrl, userId) => {
  return await prisma.$transaction(async (tx) => {
    const isService = poType === 'SERVICE';
    const isProject = poType === 'PROJECT';
    const isSparepart = poType === 'SPARE_PART';
    const isServiceExecution = poType === 'SERVICE_EXECUTION';
    const isDelivery = poType === 'DELIVERY';
    
    // We only update the document field that matches the documentType in the appropriate extension table
    const dataToUpdate = { [documentType]: fileUrl };

    if (isSparepart) {
      let dataToUpdate = { [documentType]: fileUrl };
      if (documentType === 'otherQuotationFiles') {
        const existing = await tx.purchaseOrderSparePart.findUnique({
          where: { poId: BigInt(id) },
          select: { otherQuotationFiles: true }
        });
        let files = [];
        if (existing && Array.isArray(existing.otherQuotationFiles)) {
          files = [...existing.otherQuotationFiles];
        }
        files.push(fileUrl);
        dataToUpdate = { otherQuotationFiles: files };
      }

      await tx.purchaseOrderSparePart.upsert({
        where: { poId: BigInt(id) },
        update: dataToUpdate,
        create: { poId: BigInt(id), ...dataToUpdate }
      });
    } else if (isService) {
      await tx.purchaseOrderService.upsert({
        where: { poId: BigInt(id) },
        update: dataToUpdate,
        create: { poId: BigInt(id), ...dataToUpdate }
      });
    } else if (isProject) {
      await tx.purchaseOrderProject.upsert({
        where: { poId: BigInt(id) },
        update: dataToUpdate,
        create: { poId: BigInt(id), ...dataToUpdate }
      });
    } else if (isServiceExecution) {
      let finalUpdate = dataToUpdate;
      const existing = await tx.serviceExecution.findUnique({
        where: { id: BigInt(id) },
        select: { status: true, timesheetFile: true }
      });
      if (!existing) throw new Error("Service Execution not found");
      if (existing.status === 'DONE' || existing.status === 'CANCELLED') {
        throw new Error(`Tidak dapat mengunggah dokumen baru karena status Service Execution sudah ${existing.status}.`);
      }

      if (documentType === 'timesheetFile') {
        let files = [];
        if (existing?.timesheetFile) {
          const raw = existing.timesheetFile.trim();
          if (raw.startsWith('[')) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) files = parsed.filter(Boolean);
            } catch {
              files = [raw];
            }
          } else {
            files = [raw];
          }
        }
        if (!files.includes(fileUrl)) {
          files.push(fileUrl);
        }
        finalUpdate = { timesheetFile: JSON.stringify(files) };
      }

      await tx.serviceExecution.update({
        where: { id: BigInt(id) },
        data: finalUpdate
      });
      return { success: true, fileUrl };
    } else if (isDelivery) {
      let finalData = { [documentType]: fileUrl };
      if (documentType === 'otherForwarderQuotationFiles') {
        const existing = await tx.delivery.findUnique({
          where: { id: BigInt(id) },
          select: { otherForwarderQuotationFiles: true }
        });
        let files = [];
        if (existing && Array.isArray(existing.otherForwarderQuotationFiles)) {
          files = [...existing.otherForwarderQuotationFiles];
        }
        files.push(fileUrl);
        finalData = { otherForwarderQuotationFiles: files };
      }
      await tx.delivery.update({
        where: { id: BigInt(id) },
        data: finalData
      });
      return { success: true, fileUrl };
    } else {
      throw new Error(`Unsupported poType: ${poType}`);
    }

    const currentPo = await tx.purchaseOrder.findUnique({
      where: { id: BigInt(id) },
      select: { status: true, poNumber: true }
    });

    if (!currentPo) throw new Error("PO not found");

    // Optional: add to history
    await tx.purchaseOrderStatusHistory.create({
      data: {
        poId: BigInt(id),
        oldStatus: currentPo.status,
        newStatus: currentPo.status,
        changeNote: `Document ${documentType} uploaded`,
        changedBy: userId ? Number(userId) : null
      }
    });

    return { success: true, fileUrl };
  });
};

const deletePO = async (id) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: BigInt(id) },
    include: { sparePartDetail: true, serviceDetail: true, projectDetail: true }
  });
  if (!po) throw new Error('Purchase Order not found');
  if (po.status === 'COMPLETED') throw new Error('PO yang sudah COMPLETED tidak bisa dihapus karena sudah memiliki Delivery aktif');

  // Collect all file paths from PO and its extension tables
  const filesToDelete = [po.customerPoFile];
  const ext = po.sparePartDetail || po.serviceDetail || po.projectDetail;
  if (ext) {
    filesToDelete.push(
      ext.internalPoFile,
      ext.ocFile,
      ext.vendorInvoiceFile,
      ext.vendorPackingListFile,
      ext.serviceReportFile,
      ext.baFile,
      ext.projectReportFile
    );
  }

  await prisma.purchaseOrder.delete({ where: { id: BigInt(id) } });

  // Clean up physical files after successful DB delete
  deleteFiles(filesToDelete.filter(Boolean));

  return { deleted: true };
};

const renameDocumentFile = async (id, poType, documentType, oldFileUrl, newFileName, userId) => {
  if (!oldFileUrl || !newFileName) {
    throw new Error('oldFileUrl dan newFileName wajib diisi.');
  }

  // 1. Resolve old file path
  const oldRelativePath = oldFileUrl.startsWith('/') ? oldFileUrl.substring(1) : oldFileUrl;
  const oldAbsolutePath = path.resolve(__dirname, '../../', oldRelativePath);

  if (!fs.existsSync(oldAbsolutePath)) {
    throw new Error('File fisik lama tidak ditemukan di server.');
  }

  // 2. Prepare new filename with timestamp
  const cleanName = newFileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9-_]/g, '_');
  if (!cleanName) {
    throw new Error('Nama file baru tidak valid.');
  }
  const timestamp = Date.now();
  const newFilename = `${cleanName}_${timestamp}.pdf`;
  const dir = path.dirname(oldAbsolutePath);
  const newAbsolutePath = path.join(dir, newFilename);

  // 3. Rename file on disk
  fs.renameSync(oldAbsolutePath, newAbsolutePath);

  // 4. Construct new URL
  const oldUrlDir = path.dirname(oldFileUrl).replace(/\\/g, '/');
  const newFileUrl = `${oldUrlDir}/${newFilename}`;

  // 5. Update database
  const isServiceExecution = poType === 'SERVICE_EXECUTION';
  if (isServiceExecution) {
    const existing = await prisma.serviceExecution.findUnique({
      where: { id: BigInt(id) },
      select: { timesheetFile: true }
    });

    if (existing?.timesheetFile) {
      let files = [];
      const raw = existing.timesheetFile.trim();
      if (raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) files = parsed.filter(Boolean);
        } catch {
          files = [raw];
        }
      } else {
        files = [raw];
      }

      // Replace oldFileUrl with newFileUrl
      const updatedFiles = files.map(f => (f === oldFileUrl ? newFileUrl : f));
      await prisma.serviceExecution.update({
        where: { id: BigInt(id) },
        data: {
          timesheetFile: JSON.stringify(updatedFiles),
          updatedBy: userId ? Number(userId) : undefined
        }
      });
    }
  }

  return { success: true, oldFileUrl, newFileUrl };
};

const splitPO = async (originPoId, { detailIds, newPoNumber, remarks }, userId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch origin PO
    const originPo = await tx.purchaseOrder.findUnique({
      where: { id: BigInt(originPoId) },
      include: {
        details: true,
        sparePartDetail: true,
        serviceDetail: true,
        projectDetail: true,
        quotation: true
      }
    });

    if (!originPo) throw new Error('Purchase Order not found');
    if (originPo.status !== 'REVIEW') {
      throw new Error(`Only Purchase Orders in REVIEW status can be split (current: ${originPo.status})`);
    }

    if (!Array.isArray(detailIds) || detailIds.length === 0) {
      throw new Error('Please select at least one item to split into a new Purchase Order');
    }

    const allItemIds = originPo.details.map(d => String(d.id));
    const selectedItemIds = detailIds.map(String);

    // Validate that all selected detailIds exist in origin PO
    const invalidIds = selectedItemIds.filter(id => !allItemIds.includes(id));
    if (invalidIds.length > 0) {
      throw new Error('One or more selected items do not belong to this Purchase Order');
    }

    // Validate that not ALL items are selected (must keep at least 1 item)
    if (selectedItemIds.length >= allItemIds.length) {
      throw new Error('Cannot split all items. At least one item must remain in the original Purchase Order');
    }

    // 2. Partition items
    const movingItems = originPo.details.filter(d => selectedItemIds.includes(String(d.id)));
    const remainingItems = originPo.details.filter(d => !selectedItemIds.includes(String(d.id)));

    // Calculate new netValues
    const newNetValue = movingItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    const updatedOriginNetValue = remainingItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

    // Calculate proportional DP
    const hasDp = Boolean(originPo.hasDp);
    const dpPercent = Number(originPo.dpPercent || 0);
    const newDpAmount = hasDp ? Math.round((newNetValue * dpPercent) / 100) : 0;
    const updatedOriginDpAmount = hasDp ? Math.round((updatedOriginNetValue * dpPercent) / 100) : 0;

    // 3. Create the New PO
    const newPoData = {
      quotationId: originPo.quotationId,
      poType: originPo.poType,
      status: 'REVIEW',
      poNumber: newPoNumber && newPoNumber.trim() ? newPoNumber.trim() : null,
      currency: originPo.currency,
      exchangeRate: originPo.exchangeRate,
      codeWord: originPo.codeWord,
      salesOrganization: originPo.salesOrganization,
      netValue: newNetValue,
      hasDp,
      dpPercent,
      dpAmount: newDpAmount,
      dpInvoiced: false,
      customerPoFile: originPo.customerPoFile || null,
      remarks: remarks || `Split from PO #${originPo.poNumber || originPo.id}`,
      statusChangedAt: new Date(),
      lastActivityAt: new Date(),
      createdBy: userId ? Number(userId) : null,
    };

    const newPo = await tx.purchaseOrder.create({
      data: newPoData
    });

    // 4. Create Extension record based on poType
    if (originPo.poType === 'SPARE_PART' && originPo.sparePartDetail) {
      await tx.purchaseOrderSparePart.create({
        data: {
          poId: newPo.id,
          shipToPartyName: originPo.sparePartDetail.shipToPartyName,
          vendorType: originPo.sparePartDetail.vendorType || 'EXTERNAL',
        }
      });
    } else if (originPo.poType === 'SERVICE') {
      await tx.purchaseOrderService.create({
        data: { poId: newPo.id }
      });
    } else if (originPo.poType === 'PROJECT') {
      await tx.purchaseOrderProject.create({
        data: { poId: newPo.id }
      });
    }

    // 5. Move selected details to the new PO
    await tx.purchaseOrderDetail.updateMany({
      where: { id: { in: selectedItemIds.map(BigInt) } },
      data: { purchaseOrderId: newPo.id }
    });

    // 6. Update origin PO netValue and dpAmount
    await tx.purchaseOrder.update({
      where: { id: BigInt(originPoId) },
      data: {
        netValue: updatedOriginNetValue,
        dpAmount: updatedOriginDpAmount,
        lastActivityAt: new Date(),
        updatedBy: userId ? Number(userId) : null
      }
    });

    // 7. Audit log status history
    await tx.purchaseOrderStatusHistory.create({
      data: {
        poId: originPo.id,
        oldStatus: originPo.status,
        newStatus: originPo.status,
        changeNote: `Split ${movingItems.length} item(s) to new PO #${newPo.poNumber || newPo.id}. Sisa net value: ${originPo.currency} ${updatedOriginNetValue.toLocaleString('id-ID')}`,
        changedBy: userId ? Number(userId) : null
      }
    });

    await tx.purchaseOrderStatusHistory.create({
      data: {
        poId: newPo.id,
        oldStatus: null,
        newStatus: 'REVIEW',
        changeNote: `Created from split of PO #${originPo.poNumber || originPo.id} with ${movingItems.length} item(s). Net value: ${newPo.currency} ${newNetValue.toLocaleString('id-ID')}`,
        changedBy: userId ? Number(userId) : null
      }
    });

    return {
      success: true,
      originalPoId: originPo.id,
      newPoId: newPo.id,
      originalNetValue: updatedOriginNetValue,
      newNetValue: newNetValue
    };
  });
};

module.exports = {
  getPOs,
  getPOById,
  createPOFromQuotation,
  updatePO,
  splitPO,
  revertPOToQuotation,
  sendReminderTest,
  uploadDocumentPath,
  renameDocumentFile,
  deletePO
};

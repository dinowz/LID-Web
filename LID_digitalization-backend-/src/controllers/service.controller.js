const prisma = require('../config/prisma');
const { broadcast } = require('../utils/sseEmitter');

// ── Helpers ──────────────────────────────────────────────────────────────────
const serializeService = (s) => {
  if (!s) return null;

  // Extract Customer Name
  let customerName = null;
  if (s.purchaseOrder?.quotation?.inquiry?.customer?.name) customerName = s.purchaseOrder.quotation.inquiry.customer.name;
  else if (s.inquiry?.customer?.name) customerName = s.inquiry.customer.name;
  else if (s.quotation?.inquiry?.customer?.name) customerName = s.quotation.inquiry.customer.name;

  // Extract Subject
  let subject = null;
  if (s.purchaseOrder?.quotation?.inquiry?.subject) subject = s.purchaseOrder.quotation.inquiry.subject;
  else if (s.inquiry?.subject) subject = s.inquiry.subject;
  else if (s.quotation?.inquiry?.subject) subject = s.quotation.inquiry.subject;

  // Extract Location
  let location = null;
  if (s.purchaseOrder?.quotation?.inquiry?.customer?.address) location = s.purchaseOrder.quotation.inquiry.customer.address;
  else if (s.inquiry?.customer?.address) location = s.inquiry.customer.address;
  else if (s.quotation?.inquiry?.customer?.address) location = s.quotation.inquiry.customer.address;

  // Extract Request Type (Workflow classification)
  let requestType = null;
  if (s.purchaseOrder?.quotation?.inquiry?.requestType) requestType = s.purchaseOrder.quotation.inquiry.requestType;
  else if (s.inquiry?.requestType) requestType = s.inquiry.requestType;
  else if (s.quotation?.inquiry?.requestType) requestType = s.quotation.inquiry.requestType;

  // Extract Quotation Number
  let quotationNumber = null;
  if (s.quotation?.quotationNumber) quotationNumber = s.quotation.quotationNumber;
  else if (s.purchaseOrder?.quotation?.quotationNumber) quotationNumber = s.purchaseOrder.quotation.quotationNumber;

  // Extract Code Word
  let codeWord = null;
  if (s.purchaseOrder?.quotation?.inquiry?.codeWord?.code) codeWord = s.purchaseOrder.quotation.inquiry.codeWord.code;
  else if (s.inquiry?.codeWord?.code) codeWord = s.inquiry.codeWord.code;
  else if (s.quotation?.inquiry?.codeWord?.code) codeWord = s.quotation.inquiry.codeWord.code;

  // Extract Inquiry Number
  let inquiryNumber = null;
  if (s.purchaseOrder?.quotation?.inquiry?.inquiryNumber) inquiryNumber = s.purchaseOrder.quotation.inquiry.inquiryNumber;
  else if (s.inquiry?.inquiryNumber) inquiryNumber = s.inquiry.inquiryNumber;
  else if (s.quotation?.inquiry?.inquiryNumber) inquiryNumber = s.quotation.inquiry.inquiryNumber;

  return {
    ...s,
    id: s.id.toString(),
    poId: s.poId ? s.poId.toString() : null,
    inquiryId: s.inquiryId ? s.inquiryId.toString() : null,
    quotationId: s.quotationId ? s.quotationId.toString() : null,
    quotationNumber,
    inquiryNumber,
    customerName,
    codeWord,
    subject,
    location,
    requestType,
    timesheetFile: s.timesheetFile,
    purchaseOrder: s.purchaseOrder
      ? { 
          ...s.purchaseOrder, 
          id: s.purchaseOrder.id.toString(), 
          quotationId: s.purchaseOrder.quotationId ? s.purchaseOrder.quotationId.toString() : null,
          details: s.purchaseOrder.details ? s.purchaseOrder.details.map(d => ({
            ...d,
            id: d.id.toString(),
            purchaseOrderId: d.purchaseOrderId.toString(),
            quotationDetailId: d.quotationDetailId ? d.quotationDetailId.toString() : null,
            mappedServiceId: d.mappedServiceId ? d.mappedServiceId.toString() : null,
            mappedSparePartId: d.mappedSparePartId ? d.mappedSparePartId.toString() : null,
          })) : undefined
        }
      : null,
    tfsAssignments: s.tfsAssignments ? s.tfsAssignments.map(t => ({
      ...t,
      id: t.id.toString(),
      serviceExecutionId: t.serviceExecutionId.toString(),
      personnelId: t.personnelId.toString(),
    })) : [],
    invoices: s.invoices ? s.invoices.map(serializeInvoiceBasic) : undefined,
    histories: s.histories ? s.histories.map(serializeServiceHistory) : undefined,
  };
};

const serializeServiceHistory = (h) => ({
  ...h,
  id: h.id.toString(),
  serviceId: h.serviceId.toString(),
});


const serializeInvoiceBasic = (inv) => ({
  ...inv,
  id: inv.id.toString(),
  serviceId: inv.serviceId ? inv.serviceId.toString() : null,
  projectId: inv.projectId ? inv.projectId.toString() : null,
});

// ── Generate service number ───────────────────────────────────────────────────
const generateServiceNumber = async () => {
  const year = new Date().getFullYear();
  const latestService = await prisma.serviceExecution.findFirst({
    where: { serviceNumber: { startsWith: `SVC-${year}-` } },
    orderBy: { serviceNumber: 'desc' }
  });

  let nextSeq = 1;
  if (latestService && latestService.serviceNumber) {
    const parts = latestService.serviceNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seq = String(nextSeq).padStart(4, '0');
  return `SVC-${year}-${seq}`;
};

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const latestInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } },
    orderBy: { invoiceNumber: 'desc' }
  });

  let nextSeq = 1;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const parts = latestInvoice.invoiceNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seq = String(nextSeq).padStart(4, '0');
  return `INV-${year}-${seq}`;
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

const getServices = async (req, res) => {
  try {
    const { status, sourceType, year } = req.query;
    const where = {};
    if (status) where.status = status;
    if (sourceType) where.sourceType = sourceType;
    if (year) {
      where.createdAt = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      };
    }

    const data = await prisma.serviceExecution.findMany({
      where,
      include: {
        purchaseOrder: {
          include: {
            quotation: {
              include: {
                inquiry: {
                  include: { customer: true, codeWord: true }
                }
              }
            }
          }
        },
        inquiry: {
          include: { customer: true, codeWord: true }
        },
        quotation: {
          include: { inquiry: { include: { customer: true, codeWord: true } } }
        },
        tfsAssignments: true,
        invoices: { select: { id: true, invoiceNumber: true, status: true } },
        creator: true,
        updater: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(data.map(serializeService));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getServiceById = async (req, res) => {
  try {
    const data = await prisma.serviceExecution.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        purchaseOrder: {
          include: {
            details: {
              include: {
                service: true,
                sparePart: true
              }
            },
            quotation: {
              include: {
                details: {
                  include: { service: true, sparePart: true }
                },
                inquiry: {
                  include: { customer: true, codeWord: true, details: true }
                }
              }
            }
          }
        },
        inquiry: {
          include: { customer: true, codeWord: true }
        },
        quotation: {
          include: { inquiry: { include: { customer: true, codeWord: true } } }
        },
        tfsAssignments: {
          include: { personnel: true }
        },
        invoices: true,
        histories: { include: { changer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }
      },
    });
    if (!data) return res.status(404).json({ error: 'Service not found' });
    res.json(serializeService(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createService = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { sourceType, poId, inquiryId, quotationId, startDate, targetDate, progressNote, remarks, sdNumber } = req.body;

    if (!sourceType) return res.status(400).json({ error: 'sourceType is required (EXTERNAL_PURCHASE | IC_TFS | EXTERNAL_TFS)' });

    const serviceNumber = await generateServiceNumber();

    const data = await prisma.serviceExecution.create({
      data: {
        serviceNumber,
        sdNumber: sdNumber ? sdNumber.trim() : null,
        sourceType,
        poId: poId ? BigInt(poId) : null,
        inquiryId: inquiryId ? BigInt(inquiryId) : null,
        quotationId: quotationId ? BigInt(quotationId) : null,
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        progressNote: progressNote || null,
        remarks: remarks || null,
        createdBy: userId,
        statusChangedAt: new Date(),
        lastActivityAt: new Date()
      },
      include: { purchaseOrder: true, inquiry: true, quotation: true, tfsAssignments: true },
    });

    broadcast({ type: 'REFRESH_BADGE' });
    broadcast({ type: 'REFRESH_SERVICE_LIST' });
    res.status(201).json(serializeService(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateService = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { status, progressPercentage, progressNote, issue, nextAction, startDate, targetDate, completedDate, remarks, timesheetFile, sdNumber } = req.body;
    const serviceId = BigInt(req.params.id);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.serviceExecution.findUnique({ where: { id: serviceId } });
      if (!current) throw new Error("Service not found");

      if (current.status === 'DONE' || current.status === 'CANCELLED') {
        throw new Error(`Service Execution sudah berstatus ${current.status} dan tidak dapat diubah lagi.`);
      }

      const isStatusChanged = status && status !== current.status;
      const isProgressChanged = progressPercentage !== undefined && progressPercentage !== current.progressPercentage;
      const isNoteProvided = progressNote && progressNote.trim() !== '';
      const isIssueProvided = issue !== undefined;
      const isNextActionProvided = nextAction !== undefined;

      // Validation for DONE status
      if (status === 'DONE') {
        const effectiveTimesheet = timesheetFile !== undefined ? timesheetFile : current.timesheetFile;
        let hasFile = false;
        if (effectiveTimesheet) {
          if (Array.isArray(effectiveTimesheet)) {
            hasFile = effectiveTimesheet.filter(Boolean).length > 0;
          } else if (typeof effectiveTimesheet === 'string') {
            const trimmed = effectiveTimesheet.trim();
            if (trimmed.startsWith('[')) {
              try {
                const parsed = JSON.parse(trimmed);
                hasFile = Array.isArray(parsed) && parsed.filter(Boolean).length > 0;
              } catch {
                hasFile = trimmed !== '';
              }
            } else {
              hasFile = trimmed !== '';
            }
          }
        }
        if (!hasFile) {
          throw new Error('File Completion Documents (PDF) wajib diunggah sebelum mengubah status menjadi DONE.');
        }

        const effectiveProgress = progressPercentage !== undefined ? progressPercentage : current.progressPercentage;
        if (effectiveProgress !== 100) {
          throw new Error('Status DONE wajib memiliki progress 100%.');
        }
      }

      // Validation & cascading for CANCELLED status
      if (status === 'CANCELLED') {
        // 1. Cancel all linked TFS assignments
        const tfsList = await tx.tFS.findMany({ where: { serviceExecutionId: serviceId } });
        if (tfsList.length > 0) {
          await tx.tFS.updateMany({
            where: { serviceExecutionId: serviceId },
            data: { status: 'CANCELLED' }
          });
          // Update isIdle for each personnel
          for (const tfs of tfsList) {
            const activeTfs = await tx.tFS.count({
              where: {
                personnelId: tfs.personnelId,
                status: { notIn: ['DONE', 'CANCELLED'] }
              }
            });
            await tx.masterDivision.update({
              where: { id: tfs.personnelId },
              data: { isIdle: activeTfs === 0 }
            });
          }
        }

        // 2. Cancel linked PO (if exists)
        if (current.poId) {
          const po = await tx.purchaseOrder.findUnique({ where: { id: current.poId } });
          if (po && po.status !== 'CANCELLED') {
            await tx.purchaseOrder.update({
              where: { id: current.poId },
              data: { status: 'CANCELLED', statusChangedAt: new Date() }
            });
            await tx.purchaseOrderStatusHistory.create({
              data: {
                poId: current.poId,
                oldStatus: po.status,
                newStatus: 'CANCELLED',
                changeNote: `Auto-cancelled: Service Execution ${current.serviceNumber} was cancelled`,
                changedBy: userId
              }
            });

            // 2a. Cancel linked Quotation (from PO)
            if (po.quotationId) {
              const quot = await tx.quotation.findUnique({ where: { id: po.quotationId } });
              if (quot && quot.status !== 'CANCELLED') {
                await tx.quotation.update({
                  where: { id: po.quotationId },
                  data: { status: 'CANCELLED', statusChangedAt: new Date() }
                });
                await tx.quotationStatusHistory.create({
                  data: {
                    quotationId: po.quotationId,
                    oldStatus: quot.status,
                    newStatus: 'CANCELLED',
                    changeNote: `Auto-cancelled: Service Execution ${current.serviceNumber} was cancelled`,
                    changedBy: userId
                  }
                });

                // 2b. Cancel linked Inquiry (from Quotation)
                if (quot.inquiryId) {
                  const inq = await tx.inquiry.findUnique({ where: { id: quot.inquiryId } });
                  if (inq && inq.statusCode !== 'CANCELLED') {
                    await tx.inquiry.update({
                      where: { id: quot.inquiryId },
                      data: { statusCode: 'CANCELLED', statusChangedAt: new Date() }
                    });
                    await tx.inquiryStatusHistory.create({
                      data: {
                        inquiryId: quot.inquiryId,
                        oldStatusCode: inq.statusCode,
                        newStatusCode: 'CANCELLED',
                        changeNote: `Auto-cancelled: Service Execution ${current.serviceNumber} was cancelled`,
                        changedBy: userId
                      }
                    });
                  }
                }
              }
            }
          }
        }

        // 3. Cancel directly linked Quotation (if sourceType is EXTERNAL_TFS)
        if (current.quotationId) {
          const quot = await tx.quotation.findUnique({ where: { id: current.quotationId } });
          if (quot && quot.status !== 'CANCELLED') {
            await tx.quotation.update({
              where: { id: current.quotationId },
              data: { status: 'CANCELLED', statusChangedAt: new Date() }
            });
            await tx.quotationStatusHistory.create({
              data: {
                quotationId: current.quotationId,
                oldStatus: quot.status,
                newStatus: 'CANCELLED',
                changeNote: `Auto-cancelled: Service Execution ${current.serviceNumber} was cancelled`,
                changedBy: userId
              }
            });
            // Cancel Inquiry from Quotation
            if (quot.inquiryId) {
              const inq = await tx.inquiry.findUnique({ where: { id: quot.inquiryId } });
              if (inq && inq.statusCode !== 'CANCELLED') {
                await tx.inquiry.update({
                  where: { id: quot.inquiryId },
                  data: { statusCode: 'CANCELLED', statusChangedAt: new Date() }
                });
                await tx.inquiryStatusHistory.create({
                  data: {
                    inquiryId: quot.inquiryId,
                    oldStatusCode: inq.statusCode,
                    newStatusCode: 'CANCELLED',
                    changeNote: `Auto-cancelled: Service Execution ${current.serviceNumber} was cancelled`,
                    changedBy: userId
                  }
                });
              }
            }
          }
        }

        // 4. Cancel directly linked Inquiry (if sourceType is IC_TFS)
        if (current.inquiryId) {
          const inq = await tx.inquiry.findUnique({ where: { id: current.inquiryId } });
          if (inq && inq.statusCode !== 'CANCELLED') {
            await tx.inquiry.update({
              where: { id: current.inquiryId },
              data: { statusCode: 'CANCELLED', statusChangedAt: new Date() }
            });
            await tx.inquiryStatusHistory.create({
              data: {
                inquiryId: current.inquiryId,
                oldStatusCode: inq.statusCode,
                newStatusCode: 'CANCELLED',
                changeNote: `Auto-cancelled: Service Execution ${current.serviceNumber} was cancelled`,
                changedBy: userId
              }
            });
          }
        }
      }

      const data = await tx.serviceExecution.update({
        where: { id: serviceId },
        data: {
          ...(status && { status }),
          ...(progressPercentage !== undefined && { progressPercentage }),
          ...(progressNote !== undefined && { progressNote }),
          ...(issue !== undefined && { issue }),
          ...(nextAction !== undefined && { nextAction }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
          ...(completedDate !== undefined && { completedDate: completedDate ? new Date(completedDate) : null }),
          ...(remarks !== undefined && { remarks }),
          ...(sdNumber !== undefined && { sdNumber: sdNumber ? sdNumber.trim() : null }),
          ...(timesheetFile !== undefined && { 
            timesheetFile: Array.isArray(timesheetFile) ? JSON.stringify(timesheetFile) : timesheetFile 
          }),
          lastActivityAt: new Date(),
          ...(isStatusChanged && { statusChangedAt: new Date() }),
          updatedBy: userId,
        },
        include: { purchaseOrder: true, inquiry: true, quotation: true, invoices: true, histories: { include: { changer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } },
      });

      if (isStatusChanged || isProgressChanged || isNoteProvided || isIssueProvided || isNextActionProvided) {
        await tx.serviceExecutionHistory.create({
          data: {
            serviceId: data.id,
            oldStatus: current.status,
            newStatus: data.status,
            oldProgress: current.progressPercentage,
            newProgress: data.progressPercentage,
            progressNote: progressNote || null,
            issue: issue !== undefined ? issue : null,
            nextAction: nextAction !== undefined ? nextAction : null,
            changedBy: userId,
          }
        });
        
        // Synchronize TFS statuses and update isIdle
        const tfsList = await tx.tFS.findMany({ where: { serviceExecutionId: serviceId } });
        if (tfsList.length > 0) {
          await tx.tFS.updateMany({
            where: { serviceExecutionId: serviceId },
            data: { status: data.status }
          });
          
          for (const tfs of tfsList) {
            const activeTfs = await tx.tFS.count({
              where: {
                personnelId: tfs.personnelId,
                status: { notIn: ['DONE', 'CANCELLED'] }
              }
            });
            await tx.masterDivision.update({
              where: { id: tfs.personnelId },
              data: { isIdle: activeTfs === 0 }
            });
          }
        }

        return await tx.serviceExecution.findUnique({
          where: { id: serviceId },
          include: { purchaseOrder: true, inquiry: true, quotation: true, invoices: true, histories: { include: { changer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } }
        });
      }

      return data;
    });





    broadcast({ type: 'REFRESH_BADGE' });
    res.json(serializeService(updated));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteService = async (req, res) => {
  try {
    const existing = await prisma.serviceExecution.findUnique({
      where: { id: BigInt(req.params.id) },
      select: { id: true, status: true, serviceNumber: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Service Execution not found.' });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot delete Service Execution "${existing.serviceNumber}" because its status is "${existing.status}". Only PENDING executions can be deleted.`,
      });
    }

    await prisma.serviceExecution.delete({ where: { id: BigInt(req.params.id) } });
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: "Cannot delete Service Execution because it has been Invoiced. Please delete the linked Invoice first." 
      });
    }
    res.status(400).json({ error: error.message });
  }
};

const createServiceFromQuotation = async (req, res) => {
  try {
    const { createServiceExecutionFromQuotation: createServiceExecFromQuotation } = require('../services/service_execution.service');
    const service = await createServiceExecFromQuotation(prisma, req.params.quotationId, req.user ? req.user.id : null);
    res.status(201).json({ id: service.id.toString(), serviceNumber: service.serviceNumber });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createServiceFromInquiry = async (req, res) => {
  try {
    const { createServiceExecutionFromInquiry: createServiceExecFromInquiry } = require('../services/service_execution.service');
    const service = await createServiceExecFromInquiry(prisma, req.params.inquiryId, req.user ? req.user.id : null);
    res.status(201).json({ id: service.id.toString(), serviceNumber: service.serviceNumber });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  createServiceFromQuotation,
  createServiceFromInquiry,
};

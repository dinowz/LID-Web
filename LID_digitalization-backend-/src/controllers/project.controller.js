const prisma = require('../config/prisma');
const { broadcast } = require('../utils/sseEmitter');

// ── Helpers ──────────────────────────────────────────────────────────────────
const serializeProject = (p) => {
  if (!p) return null;
  return {
    ...p,
    id: p.id.toString(),
    poId: p.poId ? p.poId.toString() : null,
    purchaseOrder: p.purchaseOrder
      ? {
          ...p.purchaseOrder,
          id: p.purchaseOrder.id.toString(),
          quotationId: p.purchaseOrder.quotationId ? p.purchaseOrder.quotationId.toString() : null,
          quotation: p.purchaseOrder.quotation
            ? {
                ...p.purchaseOrder.quotation,
                id: p.purchaseOrder.quotation.id.toString(),
                inquiry: p.purchaseOrder.quotation.inquiry
                  ? {
                      ...p.purchaseOrder.quotation.inquiry,
                      id: p.purchaseOrder.quotation.inquiry.id.toString(),
                      customer: p.purchaseOrder.quotation.inquiry.customer
                        ? {
                            ...p.purchaseOrder.quotation.inquiry.customer,
                            id: p.purchaseOrder.quotation.inquiry.customer.id.toString()
                          }
                        : null
                    }
                  : null
              }
            : null
        }
      : null,
    invoices: p.invoices
      ? p.invoices.map(inv => ({ ...inv, id: inv.id.toString(), serviceId: inv.serviceId ? inv.serviceId.toString() : null, projectId: inv.projectId ? inv.projectId.toString() : null, tfsId: inv.tfsId ? inv.tfsId.toString() : null }))
      : undefined,
    histories: p.histories ? p.histories.map(h => ({
      ...h,
      id: h.id.toString(),
      projectId: h.projectId.toString(),
    })) : undefined,
  };
};

// ── Generate project number ───────────────────────────────────────────────────
const generateProjectNumber = async () => {
  const year = new Date().getFullYear();
  const latestProject = await prisma.projectExecution.findFirst({
    where: {
      projectNumber: {
        startsWith: `PRJ-${year}-`
      }
    },
    orderBy: {
      projectNumber: 'desc'
    }
  });

  let nextSeq = 1;
  if (latestProject && latestProject.projectNumber) {
    const parts = latestProject.projectNumber.split('-');
    const lastSeqStr = parts[parts.length - 1];
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seq = String(nextSeq).padStart(4, '0');
  return `PRJ-${year}-${seq}`;
};

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const latestInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}-`
      }
    },
    orderBy: {
      invoiceNumber: 'desc'
    }
  });

  let nextSeq = 1;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const parts = latestInvoice.invoiceNumber.split('-');
    const lastSeqStr = parts[parts.length - 1];
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seq = String(nextSeq).padStart(4, '0');
  return `INV-${year}-${seq}`;
};

// ── CRUD ───────────────────────────────────────────────────────────────────────

const getProjects = async (req, res) => {
  try {
    const { status, projectType, year } = req.query;
    const where = {};
    if (status) where.status = status;
    if (projectType) where.projectType = projectType;
    if (year) {
      where.createdAt = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      };
    }

    const data = await prisma.projectExecution.findMany({
      where,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            quotationId: true,
            codeWord: true,
            quotation: {
              select: {
                id: true,
                quotationNumber: true,
                inquiry: {
                  select: {
                    id: true,
                    inquiryNumber: true,
                    subject: true,
                    customer: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        invoices: { select: { id: true, invoiceNumber: true, status: true } },
        creator: true,
        updater: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(data.map(serializeProject));
  } catch (error) {
    require('fs').writeFileSync('error.log', error.stack || error.message);
    res.status(500).json({ error: error.message });
  }
};

const getProjectById = async (req, res) => {
  try {
    const data = await prisma.projectExecution.findUnique({
      where: { id: BigInt(req.params.id) },
      include: { purchaseOrder: true, invoices: true, histories: { include: { changer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } },
    });
    if (!data) return res.status(404).json({ error: 'Project not found' });
    res.json(serializeProject(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createProject = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { poId, projectName, projectType, description, startDate, targetDate, progressNote } = req.body;

    if (!poId) return res.status(400).json({ error: 'poId is required' });
    if (!projectName) return res.status(400).json({ error: 'projectName is required' });
    if (!projectType) return res.status(400).json({ error: 'projectType is required (OM)' });

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: BigInt(poId) },
      include: { quotation: true }
    });
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    const quoNumber = po.quotation?.quotationNumber || '';
    const cleanSeq = quoNumber.replace('QUO-', '').split('-R')[0];
    const projectNumber = cleanSeq ? `PRJ-${cleanSeq}` : `PRJ-${po.poNumber}`;

    const data = await prisma.projectExecution.create({
      data: {
        projectNumber,
        projectType,
        poId: BigInt(poId),
        projectName,
        status: 'PENDING',
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        progressNote: progressNote || null,
        createdBy: userId,
        statusChangedAt: new Date(),
        lastActivityAt: new Date()
      },
      include: { purchaseOrder: true },
    });

    broadcast({ type: 'REFRESH_BADGE' });
    res.status(201).json(serializeProject(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { status, progressPercentage, progressNote, issue, nextAction, picName, startDate, targetDate, completedDate, description, projectName } = req.body;
    const projectId = BigInt(req.params.id);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.projectExecution.findUnique({ where: { id: projectId } });
      if (!current) throw new Error("Project not found");

      const isStatusChanged = status && status !== current.status;
      const isProgressChanged = progressPercentage !== undefined && progressPercentage !== current.progressPercentage;
      const isNoteProvided = progressNote && progressNote.trim() !== '';
      const isIssueProvided = issue !== undefined;
      const isNextActionProvided = nextAction !== undefined;

      const data = await tx.projectExecution.update({
        where: { id: projectId },
        data: {
          ...(status && { status }),
          ...(progressPercentage !== undefined && { progressPercentage }),
          ...(progressNote !== undefined && { progressNote }),
          ...(issue !== undefined && { issue }),
          ...(nextAction !== undefined && { nextAction }),
          ...(picName !== undefined && { picName }),
          ...(projectName !== undefined && { projectName }),
          ...(description !== undefined && { description }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
          ...(completedDate !== undefined && { completedDate: completedDate ? new Date(completedDate) : null }),
          lastActivityAt: new Date(),
          ...(isStatusChanged && { statusChangedAt: new Date() }),
          updatedBy: userId,
        },
        include: { purchaseOrder: true, invoices: true, histories: { include: { changer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } },
      });

      if (isStatusChanged || isProgressChanged || isNoteProvided || isIssueProvided || isNextActionProvided) {
        await tx.projectExecutionHistory.create({
          data: {
            projectId: data.id,
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
        
        return await tx.projectExecution.findUnique({
          where: { id: projectId },
          include: { purchaseOrder: true, invoices: true, histories: { include: { changer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } }
        });
      }

      return data;
    });



    broadcast({ type: 'REFRESH_BADGE' });
    res.json(serializeProject(updated));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    const existing = await prisma.projectExecution.findUnique({
      where: { id: BigInt(req.params.id) },
      select: { id: true, status: true, projectNumber: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Project Execution not found.' });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot delete Project Execution "${existing.projectNumber}" because its status is "${existing.status}". Only PENDING executions can be deleted.`,
      });
    }

    await prisma.projectExecution.delete({ where: { id: BigInt(req.params.id) } });
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: "Cannot delete Project Execution because it has been Invoiced. Please delete the linked Invoice first." 
      });
    }
    res.status(400).json({ error: error.message });
  }
};

module.exports = { getProjects, getProjectById, createProject, updateProject, deleteProject };

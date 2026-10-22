const prisma = require('../config/prisma');

const serializeTfs = (t) => {
  if (!t) return null;
  return {
    ...t,
    id: t.id.toString(),
    assignmentType: t.assignmentType || 'PAID_ASSIGNMENT',
    serviceExecutionId: t.serviceExecutionId ? t.serviceExecutionId.toString() : null,
    personnelId: t.personnelId ? t.personnelId.toString() : null,
    serviceExecution: t.serviceExecution ? {
      ...t.serviceExecution,
      id: t.serviceExecution.id.toString(),
    } : undefined,
  };
};

const generateTfsNumber = async () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `TFS-${yy}${mm}${dd}-`;

  const latestTfs = await prisma.tFS.findFirst({
    where: { tfsNumber: { startsWith: prefix } },
    orderBy: { tfsNumber: 'desc' }
  });

  let nextSeq = 1;
  if (latestTfs && latestTfs.tfsNumber) {
    const parts = latestTfs.tfsNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
};

// ── Validasi konflik jadwal personel berdasarkan date range ───────────────────
const checkScheduleConflict = async (tx, personnelId, startDate, endDate, excludeTfsId = null) => {
  if (!startDate || !endDate) return null; // Skip jika tanggal tidak lengkap

  const client = tx || prisma;
  const start = new Date(startDate);
  const end = new Date(endDate);

  const conflictWhere = {
    personnelId: BigInt(personnelId),
    status: { notIn: ['CANCELLED'] },
    // Overlap: startBaru <= endLama AND endBaru >= startLama
    startDate: { lte: end },
    endDate: { gte: start },
  };

  if (excludeTfsId) {
    conflictWhere.id = { not: BigInt(excludeTfsId) };
  }

  const conflict = await client.tFS.findFirst({
    where: conflictWhere,
    include: {
      personnel: { select: { name: true, personnel_code: true } },
      serviceExecution: { select: { serviceNumber: true } },
    },
  });

  return conflict; // null = tidak ada konflik
};

// ── GET ALL TFS (global, bukan per service) ───────────────────────────────────
const getAllTfs = async (req, res) => {
  try {
    const { serviceExecutionId, personnelId, status, assignmentType, unlinked } = req.query;
    const where = {};
    if (serviceExecutionId) where.serviceExecutionId = BigInt(serviceExecutionId);
    if (personnelId) where.personnelId = BigInt(personnelId);
    if (status) where.status = status;
    if (assignmentType) where.assignmentType = assignmentType;
    if (unlinked === 'true') where.serviceExecutionId = null;

    const data = await prisma.tFS.findMany({
      where,
      include: {
        personnel: true,
        serviceExecution: {
          select: {
            id: true,
            serviceNumber: true,
            status: true,
            sourceType: true,
            inquiry: { include: { customer: true } },
            quotation: { include: { inquiry: { include: { customer: true } } } },
            purchaseOrder: { include: { quotation: { include: { inquiry: { include: { customer: true } } } } } },
          },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(data.map(serializeTfs));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── SEARCH SERVICE EXECUTIONS (untuk autocomplete) ────────────────────────────
const searchServices = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (q && q.length === 1) return res.json([]);

    const where = {
      status: { notIn: ['DONE', 'CANCELLED'] },
    };

    if (q && q.length >= 2) {
      where.serviceNumber = { contains: q, mode: 'insensitive' };
    }

    const data = await prisma.serviceExecution.findMany({
      where,
      take: 10,
      include: {
        inquiry: { include: { customer: true } },
        quotation: { include: { inquiry: { include: { customer: true } } } },
        purchaseOrder: { include: { quotation: { include: { inquiry: { include: { customer: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = data.map(s => {
      let customerName = null;
      let subject = null;
      if (s.purchaseOrder?.quotation?.inquiry) {
        customerName = s.purchaseOrder.quotation.inquiry.customer?.name;
        subject = s.purchaseOrder.quotation.inquiry.subject;
      } else if (s.quotation?.inquiry) {
        customerName = s.quotation.inquiry.customer?.name;
        subject = s.quotation.inquiry.subject;
      } else if (s.inquiry) {
        customerName = s.inquiry.customer?.name;
        subject = s.inquiry.subject;
      }

      return {
        id: s.id.toString(),
        serviceNumber: s.serviceNumber,
        status: s.status,
        sourceType: s.sourceType,
        customerName: customerName || '-',
        subject: subject || '-',
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── GET TFS by Service Execution ID ──────────────────────────────────────────
const getTfsByServiceExecutionId = async (req, res) => {
  try {
    const { serviceExecutionId } = req.params;
    const data = await prisma.tFS.findMany({
      where: { serviceExecutionId: BigInt(serviceExecutionId) },
      include: { personnel: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(data.map(serializeTfs));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── CREATE TFS Assignment (Paid, linked to Service Execution) ─────────────────
const createTfsAssignment = async (req, res) => {
  try {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const isOnlyTfs = userRoles.includes('TFS') && !userRoles.includes('ADMIN') && !userRoles.includes('SERVICE');
    if (isOnlyTfs) {
      return res.status(403).json({ error: 'Forbidden: TFS-only role is not allowed to create Paid Assignments.' });
    }

    const { serviceExecutionId } = req.params;
    const { personnelId, title, startDate, endDate, days, hoursPerDay, jobDescription, remarks, status } = req.body;

    if (!personnelId) return res.status(400).json({ error: 'Personnel ID is required' });

    const tfsNumber = await generateTfsNumber();

    const data = await prisma.$transaction(async (tx) => {
      const svc = await tx.serviceExecution.findUnique({
        where: { id: BigInt(serviceExecutionId) },
        select: { status: true },
      });
      if (svc && svc.status === 'DONE') {
        throw new Error('TFS tidak dapat ditambahkan untuk pekerjaan yang sudah selesai (DONE).');
      }

      // Validasi konflik jadwal (date range)
      if (startDate && endDate) {
        const conflict = await checkScheduleConflict(tx, personnelId, startDate, endDate);
        if (conflict) {
          const conflictStart = conflict.startDate ? new Date(conflict.startDate).toLocaleDateString('id-ID') : '?';
          const conflictEnd = conflict.endDate ? new Date(conflict.endDate).toLocaleDateString('id-ID') : '?';
          throw new Error(
            `Konflik jadwal: Personel sudah dijadwalkan untuk "${conflict.serviceExecution?.serviceNumber || 'service lain'}" ` +
            `pada tanggal ${conflictStart} — ${conflictEnd}. Pilih tanggal yang tidak bertabrakan.`
          );
        }
      }

      const created = await tx.tFS.create({
        data: {
          tfsNumber,
          assignmentType: 'PAID_ASSIGNMENT',
          serviceExecutionId: BigInt(serviceExecutionId),
          personnelId: BigInt(personnelId),
          title: title || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          days: days ? parseInt(days, 10) : null,
          hoursPerDay: hoursPerDay ? parseInt(hoursPerDay, 10) : null,
          jobDescription: jobDescription || null,
          remarks: remarks || null,
          status: status || svc?.status || 'DRAFT',
        },
        include: {
          personnel: true,
          serviceExecution: { select: { id: true, serviceNumber: true, status: true } },
        },
      });

      return created;
    });

    res.status(201).json(serializeTfs(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ── CREATE STANDALONE TFS (Free Assignment / Day Off / Paid without service) ──
const createStandaloneTfs = async (req, res) => {
  try {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const isOnlyTfs = userRoles.includes('TFS') && !userRoles.includes('ADMIN') && !userRoles.includes('SERVICE');

    const { personnelId, title, startDate, endDate, days, hoursPerDay, jobDescription, remarks, status, assignmentType } = req.body;

    if (isOnlyTfs && assignmentType === 'PAID_ASSIGNMENT') {
      return res.status(403).json({ error: 'Forbidden: TFS-only role is not allowed to create Paid Assignments.' });
    }

    if (!personnelId) return res.status(400).json({ error: 'Personnel ID is required' });
    if (!assignmentType) return res.status(400).json({ error: 'Assignment type is required' });

    const validTypes = ['PAID_ASSIGNMENT', 'FREE_ASSIGNMENT', 'DAY_OFF'];
    if (!validTypes.includes(assignmentType)) {
      return res.status(400).json({ error: `Invalid assignment type. Must be one of: ${validTypes.join(', ')}` });
    }

    const tfsNumber = await generateTfsNumber();

    const data = await prisma.$transaction(async (tx) => {
      // Validasi konflik jadwal (date range)
      if (startDate && endDate) {
        const conflict = await checkScheduleConflict(tx, personnelId, startDate, endDate);
        if (conflict) {
          const conflictStart = conflict.startDate ? new Date(conflict.startDate).toLocaleDateString('id-ID') : '?';
          const conflictEnd = conflict.endDate ? new Date(conflict.endDate).toLocaleDateString('id-ID') : '?';
          throw new Error(
            `Konflik jadwal: Personel sudah dijadwalkan untuk "${conflict.serviceExecution?.serviceNumber || 'tugas lain'}" ` +
            `pada tanggal ${conflictStart} — ${conflictEnd}. Pilih tanggal yang tidak bertabrakan.`
          );
        }
      }

      const created = await tx.tFS.create({
        data: {
          tfsNumber,
          assignmentType,
          serviceExecutionId: null,
          personnelId: BigInt(personnelId),
          title: title || (assignmentType === 'DAY_OFF' ? 'DAY OFF' : null),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          days: days ? parseInt(days, 10) : null,
          hoursPerDay: hoursPerDay ? parseInt(hoursPerDay, 10) : null,
          jobDescription: jobDescription || null,
          remarks: remarks || null,
          status: status || 'DRAFT',
        },
        include: {
          personnel: true,
        },
      });

      return created;
    });

    res.status(201).json(serializeTfs(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ── LINK TFS to Service Execution ─────────────────────────────────────────────
const linkTfsToServiceExecution = async (req, res) => {
  try {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const isOnlyTfs = userRoles.includes('TFS') && !userRoles.includes('ADMIN') && !userRoles.includes('SERVICE');
    if (isOnlyTfs) {
      return res.status(403).json({ error: 'Forbidden: TFS-only role is not allowed to link assignments to Service Executions.' });
    }

    const tfsId = BigInt(req.params.id);
    const { serviceExecutionId } = req.body;

    if (!serviceExecutionId) return res.status(400).json({ error: 'Service Execution ID is required' });

    const data = await prisma.$transaction(async (tx) => {
      const existing = await tx.tFS.findUnique({ where: { id: tfsId } });
      if (!existing) throw new Error('TFS Assignment not found');

      if (existing.serviceExecutionId) {
        throw new Error('TFS sudah ter-link ke Service Execution lain.');
      }

      // Verify service execution exists
      const svc = await tx.serviceExecution.findUnique({
        where: { id: BigInt(serviceExecutionId) },
        select: { id: true, status: true, serviceNumber: true },
      });
      if (!svc) throw new Error('Service Execution not found');
      if (svc.status === 'DONE') throw new Error('Tidak dapat link TFS ke Service Execution yang sudah DONE.');

      const updated = await tx.tFS.update({
        where: { id: tfsId },
        data: {
          serviceExecutionId: BigInt(serviceExecutionId),
        },
        include: {
          personnel: true,
          serviceExecution: { select: { id: true, serviceNumber: true, status: true } },
        },
      });

      return updated;
    });

    res.json(serializeTfs(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ── UPDATE TFS Assignment ─────────────────────────────────────────────────────
const updateTfsAssignment = async (req, res) => {
  try {
    const tfsId = BigInt(req.params.id);
    const { personnelId, title, startDate, endDate, days, hoursPerDay, jobDescription, remarks, status } = req.body;

    const data = await prisma.$transaction(async (tx) => {
      const existing = await tx.tFS.findUnique({
        where: { id: tfsId },
        include: { serviceExecution: { select: { status: true } } },
      });
      if (!existing) throw new Error('TFS Assignment not found');

      const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
      const isOnlyTfs = userRoles.includes('TFS') && !userRoles.includes('ADMIN') && !userRoles.includes('SERVICE');
      if (isOnlyTfs && (existing.assignmentType === 'PAID_ASSIGNMENT' || existing.serviceExecutionId)) {
        throw new Error('Forbidden: TFS-only role is not allowed to modify Paid Assignments or linked Service Executions.');
      }

      if (existing.serviceExecution?.status === 'DONE') {
        throw new Error('TFS tidak dapat diubah untuk pekerjaan yang sudah selesai (DONE).');
      }

      // Tentukan personnelId final untuk validasi
      const finalPersonnelId = personnelId || existing.personnelId.toString();
      const finalStartDate = startDate !== undefined ? startDate : existing.startDate;
      const finalEndDate = endDate !== undefined ? endDate : existing.endDate;

      // Validasi konflik jadwal (kecualikan TFS yang sedang diedit)
      if (finalStartDate && finalEndDate) {
        const conflict = await checkScheduleConflict(tx, finalPersonnelId, finalStartDate, finalEndDate, tfsId.toString());
        if (conflict) {
          const conflictStart = conflict.startDate ? new Date(conflict.startDate).toLocaleDateString('id-ID') : '?';
          const conflictEnd = conflict.endDate ? new Date(conflict.endDate).toLocaleDateString('id-ID') : '?';
          throw new Error(
            `Konflik jadwal: Personel sudah dijadwalkan untuk "${conflict.serviceExecution?.serviceNumber || 'service lain'}" ` +
            `pada tanggal ${conflictStart} — ${conflictEnd}. Pilih tanggal yang tidak bertabrakan.`
          );
        }
      }

      const updated = await tx.tFS.update({
        where: { id: tfsId },
        data: {
          ...(personnelId && { personnelId: BigInt(personnelId) }),
          ...(title !== undefined && { title }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
          ...(days !== undefined && { days: days ? parseInt(days, 10) : null }),
          ...(hoursPerDay !== undefined && { hoursPerDay: hoursPerDay ? parseInt(hoursPerDay, 10) : null }),
          ...(jobDescription !== undefined && { jobDescription }),
          ...(remarks !== undefined && { remarks }),
          ...(status !== undefined && { status }),
        },
        include: {
          personnel: true,
          serviceExecution: { select: { id: true, serviceNumber: true, status: true } },
        },
      });

      return updated;
    });

    res.json(serializeTfs(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ── DELETE TFS Assignment ─────────────────────────────────────────────────────
const deleteTfsAssignment = async (req, res) => {
  try {
    const tfsId = BigInt(req.params.id);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.tFS.findUnique({
        where: { id: tfsId },
        include: { serviceExecution: { select: { status: true } } },
      });
      if (existing) {
        if (existing.serviceExecution?.status === 'DONE') {
          throw new Error('TFS tidak dapat dihapus untuk pekerjaan yang sudah selesai (DONE).');
        }
        await tx.tFS.delete({ where: { id: tfsId } });
      }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getAllTfs,
  searchServices,
  getTfsByServiceExecutionId,
  createTfsAssignment,
  createStandaloneTfs,
  linkTfsToServiceExecution,
  updateTfsAssignment,
  deleteTfsAssignment,
};

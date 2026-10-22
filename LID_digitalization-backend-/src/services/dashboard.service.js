const prisma = require('../config/prisma');

const getResourceUtilization = async (monthStr, yearStr) => {
  const year = yearStr ? parseInt(yearStr) : new Date().getFullYear();
  const isToday = monthStr === 'today' || monthStr === undefined;
  const isMonth = !isToday && monthStr !== undefined;

  // --- Period for personnel availability (active assignments on that day/month) ---
  let periodStart, periodEnd;
  if (isMonth) {
    const month = parseInt(monthStr); // 0-11
    periodStart = new Date(year, month, 1);
    periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  } else {
    const today = new Date();
    periodStart = new Date(today);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(today);
    periodEnd.setHours(23, 59, 59, 999);
  }

  // --- Period for manday calculation ---
  // "today" = YTD (1 Jan to today), month = specific month
  let mandayStart, mandayEnd;
  if (isMonth) {
    const month = parseInt(monthStr);
    mandayStart = new Date(year, month, 1);
    mandayStart.setHours(0, 0, 0, 0);
    mandayEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  } else {
    mandayStart = new Date(year, 0, 1);
    mandayStart.setHours(0, 0, 0, 0);
    mandayEnd = new Date();
    mandayEnd.setHours(23, 59, 59, 999);
  }

  // --- Personnel availability query ---
  const personnel = await prisma.masterDivision.findMany({
    where: { active: true },
    include: {
      tfsAssignments: {
        where: {
          status: { notIn: ['DONE', 'CANCELLED'] },
          startDate: { lte: periodEnd },
          endDate: { gte: periodStart }
        }
      }
    }
  });

  const total = personnel.length;
  const onAssignment = personnel.filter(p => p.tfsAssignments && p.tfsAssignments.length > 0).length;
  const available = total - onAssignment;
  const utilization = total > 0 ? Math.round((onAssignment / total) * 100) : 0;

  // --- Annual target from PipelineTarget.roleTargets ---
  const pipelineTarget = await prisma.pipelineTarget.findUnique({ where: { year } });
  const roleTargets = pipelineTarget?.roleTargets || {};
  const targetMandays = Object.values(roleTargets).reduce((sum, v) => sum + Number(v), 0);

  // --- Manday calculation: PAID_ASSIGNMENT + FREE_ASSIGNMENT only ---
  const tfsAssignments = await prisma.tFS.findMany({
    where: {
      assignmentType: { in: ['PAID_ASSIGNMENT', 'FREE_ASSIGNMENT'] },
      status: { notIn: ['CANCELLED'] },
      startDate: { lte: mandayEnd },
      endDate: { gte: mandayStart },
    },
    select: {
      startDate: true,
      endDate: true,
      personnel: {
        select: {
          title: true,
        }
      }
    }
  });

  // Sum days intersecting with the manday period
  let utilizationMandays = 0;
  for (const tfs of tfsAssignments) {
    if (!tfs.startDate || !tfs.endDate) continue;
    const sRaw = tfs.startDate > mandayStart ? tfs.startDate : mandayStart;
    const eRaw = tfs.endDate < mandayEnd ? tfs.endDate : mandayEnd;
    const sDay = new Date(sRaw.getFullYear(), sRaw.getMonth(), sRaw.getDate());
    const eDay = new Date(eRaw.getFullYear(), eRaw.getMonth(), eRaw.getDate());
    const days = Math.floor((eDay - sDay) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 0) utilizationMandays += days;
  }

  // Calculate mandays & targets specifically grouped by role
  const roles = [...new Set(personnel.map(p => p.title).filter(Boolean))];
  const byRole = roles.map(role => {
    // 1. Calculate actual mandays for this role
    let roleUtilizedMandays = 0;
    const roleTfs = tfsAssignments.filter(t => t.personnel?.title === role);
    for (const tfs of roleTfs) {
      const sRaw = tfs.startDate > mandayStart ? tfs.startDate : mandayStart;
      const eRaw = tfs.endDate < mandayEnd ? tfs.endDate : mandayEnd;
      const sDay = new Date(sRaw.getFullYear(), sRaw.getMonth(), sRaw.getDate());
      const eDay = new Date(eRaw.getFullYear(), eRaw.getMonth(), eRaw.getDate());
      const days = Math.floor((eDay - sDay) / (1000 * 60 * 60 * 24)) + 1;
      if (days > 0) roleUtilizedMandays += days;
    }

    // 2. Fetch role target from roleTargets
    const roleTarget = roleTargets[role] ? Number(roleTargets[role]) : 0;
    const ratio = roleTarget > 0 ? Number((roleUtilizedMandays / roleTarget).toFixed(4)) : 0;

    return {
      role,
      utilizationMandays: roleUtilizedMandays,
      targetMandays: roleTarget,
      utilizationRatio: ratio,
      utilizationPercentage: Math.min(Math.round(ratio * 100), 100),
    };
  }).sort((a, b) => b.utilizationRatio - a.utilizationRatio);

  const utilizationPercentage = targetMandays > 0
    ? Math.min(Math.round((utilizationMandays / targetMandays) * 100), 100)
    : 0;

  return {
    total,
    onAssignment,
    available,
    utilization,
    byRole,
    utilizationMandays,
    targetMandays,
    utilizationPercentage,
    isYTD: isToday,
  };
};

const getResourceOverview = async (year) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  // Get all assignments for the year, include personnel for role
  const tfsAssignments = await prisma.tFS.findMany({
    where: {
      assignmentType: { in: ['PAID_ASSIGNMENT', 'FREE_ASSIGNMENT'] },
      status: { notIn: ['CANCELLED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    include: { personnel: { select: { title: true } } }
  });

  // Get targets
  const target = await prisma.pipelineTarget.findUnique({ where: { year } });
  const roleTargets = target?.roleTargets || {};

  // Collect all unique roles (from assignments + from configured targets)
  const allRoles = new Set([
    ...Object.keys(roleTargets),
    ...tfsAssignments.map(t => t.personnel?.title).filter(Boolean)
  ]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // monthlyByRole[monthIndex][role] = days
  const monthlyByRole = Array.from({ length: 12 }, () => ({}));

  tfsAssignments.forEach(tfs => {
    const role = tfs.personnel?.title;
    if (!role || !tfs.startDate || !tfs.endDate) return;

    let s = new Date(tfs.startDate);
    let e = new Date(tfs.endDate);
    if (s < startDate) s = startDate;
    if (e >= endDate) e = new Date(year, 11, 31);

    let current = new Date(s);
    current.setHours(0, 0, 0, 0);
    let end = new Date(e);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      const m = current.getMonth();
      monthlyByRole[m][role] = (monthlyByRole[m][role] || 0) + 1;
      current.setDate(current.getDate() + 1);
    }
  });

  // Monthly target per role = annualTarget / 12
  const monthlyTargetPerRole = {};
  Object.entries(roleTargets).forEach(([role, annual]) => {
    monthlyTargetPerRole[role] = Math.round(Number(annual));
  });

  // Build per-month data rows: { month, [role]: days, ... }
  const overview = months.map((m, i) => {
    const row = { month: `${m} ${year.toString().slice(-2)}` };
    allRoles.forEach(role => {
      row[role] = monthlyByRole[i][role] || 0;
    });
    return row;
  });

  return {
    data: overview,
    roles: Array.from(allRoles),
    monthlyTargetPerRole
  };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getPipelineStats = async (year) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const [inquiries, quotations, pos] = await Promise.all([
    prisma.inquiry.findMany({
      where: { createdAt: { gte: startDate, lt: endDate } },
      select: { requestType: true, createdAt: true }
    }),
    prisma.quotation.findMany({
      where: { createdAt: { gte: startDate, lt: endDate } },
      select: { quotationType: true, createdAt: true, totalPrice: true, currency: true, status: true }
    }),
    prisma.purchaseOrder.findMany({
      where: { createdAt: { gte: startDate, lt: endDate } },
      select: { poType: true, createdAt: true, netValue: true, currency: true }
    }),
  ]);

  // Inquiry requestType is a free string like 'SPARE_PART', 'SERVICE_EXTERNAL', 'PROJECT_OM', etc.
  const classifyInquiry = (type = '') => {
    const t = type.toUpperCase();
    if (t.startsWith('SERVICE')) return 'service';
    if (t.startsWith('PROJECT')) return 'project';
    if (t === 'SPARE_PART' || t === 'SPAREPART') return 'sparepart';
    return null;
  };

  // Quotation.quotationType and PO.poType use WorkflowType enum: SPARE_PART, SERVICE, PROJECT
  const classifyWorkflow = (type) => {
    if (!type) return null;
    const t = type.toUpperCase();
    if (t === 'SERVICE') return 'service';
    if (t === 'PROJECT') return 'project';
    if (t === 'SPARE_PART') return 'sparepart';
    return null;
  };

  // Target data for exchange rates
  const target = await prisma.pipelineTarget.findUnique({ where: { year } });
  const usdRate = target?.exchangeRateUsd ? Number(target.exchangeRateUsd) : 15000;
  const eurRate = target?.exchangeRateEur ? Number(target.exchangeRateEur) : 16500;

  const emptyMonth = () => ({
    sparepart: { quotation: 0, po: 0, qAmtIdrEquiv: 0, poAmtIdrEquiv: 0, executedQAmtIdrEquiv: 0, executedOnlyQAmtIdrEquiv: 0, executedOnlyCount: 0 },
    service: { quotation: 0, po: 0, qAmtIdrEquiv: 0, poAmtIdrEquiv: 0, executedQAmtIdrEquiv: 0, executedOnlyQAmtIdrEquiv: 0, executedOnlyCount: 0 },
    project: { quotation: 0, po: 0, qAmtIdrEquiv: 0, poAmtIdrEquiv: 0, executedQAmtIdrEquiv: 0, executedOnlyQAmtIdrEquiv: 0, executedOnlyCount: 0 },
  });

  const months = MONTHS.map((name) => ({ month: name, ...emptyMonth() }));

  quotations.forEach(q => {
    const flow = classifyWorkflow(q.quotationType);
    if (!flow) return;
    const item = months[new Date(q.createdAt).getMonth()][flow];
    item.quotation += 1;
    const amt = Number(q.totalPrice) || 0;

    let idrEquiv = amt;
    if (q.currency === 'USD') idrEquiv = amt * usdRate;
    else if (q.currency === 'EUR') idrEquiv = amt * eurRate;

    item.qAmtIdrEquiv += idrEquiv;
    if (q.status === 'EXECUTED' || q.status === 'REALIZED') {
      item.executedQAmtIdrEquiv += idrEquiv;
    }
    if (q.status === 'EXECUTED' || q.status === 'REALIZED') {
      item.executedOnlyQAmtIdrEquiv += idrEquiv;
      item.executedOnlyCount += 1;
    }
  });

  pos.forEach(p => {
    const flow = classifyWorkflow(p.poType);
    if (!flow) return;
    const item = months[new Date(p.createdAt).getMonth()][flow];
    item.po += 1;
    const amt = Number(p.netValue) || 0;

    let idrEquiv = amt;
    if (p.currency === 'USD') idrEquiv = amt * usdRate;
    else if (p.currency === 'EUR') idrEquiv = amt * eurRate;

    item.poAmtIdrEquiv += idrEquiv;
  });

  // Available years
  const oldest = await prisma.inquiry.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
  const firstYear = oldest ? new Date(oldest.createdAt).getFullYear() : year;
  const currentYear = new Date().getFullYear();
  const availableYears = [];
  for (let y = firstYear; y <= currentYear; y++) availableYears.push(y);

  return {
    year,
    availableYears,
    months: months.map(m => ({
      month: m.month,
      sparepartQuotation: m.sparepart.quotation,
      sparepartPO: m.sparepart.po,
      serviceQuotation: m.service.quotation,
      servicePO: m.service.po,
      projectQuotation: m.project.quotation,
      projectPO: m.project.po,

      // Totals
      totalQAmtIdrEquiv: m.sparepart.qAmtIdrEquiv + m.service.qAmtIdrEquiv + m.project.qAmtIdrEquiv,
      totalPoAmtIdrEquiv: m.sparepart.poAmtIdrEquiv + m.service.poAmtIdrEquiv + m.project.poAmtIdrEquiv,
      totalExecutedQAmtIdrEquiv: m.sparepart.executedQAmtIdrEquiv + m.service.executedQAmtIdrEquiv + m.project.executedQAmtIdrEquiv,

      // Executed Only (status EXECUTED, for bar chart)
      totalExecutedOnlyAmt: m.sparepart.executedOnlyQAmtIdrEquiv + m.service.executedOnlyQAmtIdrEquiv + m.project.executedOnlyQAmtIdrEquiv,
      totalExecutedOnlyCount: m.sparepart.executedOnlyCount + m.service.executedOnlyCount + m.project.executedOnlyCount,
      sparepartExecutedOnlyAmt: m.sparepart.executedOnlyQAmtIdrEquiv,
      sparepartExecutedOnlyCount: m.sparepart.executedOnlyCount,
      serviceExecutedOnlyAmt: m.service.executedOnlyQAmtIdrEquiv,
      serviceExecutedOnlyCount: m.service.executedOnlyCount,
      projectExecutedOnlyAmt: m.project.executedOnlyQAmtIdrEquiv,
      projectExecutedOnlyCount: m.project.executedOnlyCount,

      // Raw
      ...m
    })),
    target: target || null
  };
};

const generateCSVReport = async (year) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const [deliveries, invoices, services, projects] = await Promise.all([
    prisma.delivery.findMany({ where: { createdAt: { gte: startDate, lt: endDate } } }),
    prisma.invoice.findMany({ where: { invoiceDate: { gte: startDate, lt: endDate } } }),
    prisma.serviceExecution.findMany({ where: { createdAt: { gte: startDate, lt: endDate } } }),
    prisma.projectExecution.findMany({ where: { createdAt: { gte: startDate, lt: endDate } } })
  ]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const reportData = months.map((name) => ({
    month: name,
    deliveries: 0,
    projects: 0,
    services: 0,
    paidIDR: 0, paidEUR: 0, paidUSD: 0,
    unpaidIDR: 0, unpaidEUR: 0, unpaidUSD: 0
  }));

  // Aggregation
  deliveries.forEach(d => {
    const m = new Date(d.createdAt).getMonth();
    reportData[m].deliveries++;
  });

  services.forEach(s => {
    const m = new Date(s.createdAt).getMonth();
    reportData[m].services++;
  });

  projects.forEach(p => {
    const m = new Date(p.createdAt).getMonth();
    reportData[m].projects++;
  });

  invoices.forEach(i => {
    const m = new Date(i.invoiceDate).getMonth();
    const amt = parseFloat(i.totalAmount || 0);
    const isPaid = i.status === 'PAID';

    if (i.currency === 'IDR') {
      if (isPaid) reportData[m].paidIDR += amt;
      else reportData[m].unpaidIDR += amt;
    } else if (i.currency === 'EUR') {
      if (isPaid) reportData[m].paidEUR += amt;
      else reportData[m].unpaidEUR += amt;
    } else if (i.currency === 'USD') {
      if (isPaid) reportData[m].paidUSD += amt;
      else reportData[m].unpaidUSD += amt;
    }
  });

  const headers = [
    'Month', 'Active Delivery', 'Active Projects', 'Active Services',
    'Paid (IDR)', 'Paid (EUR)', 'Paid (USD)',
    'Unpaid (IDR)', 'Unpaid (EUR)', 'Unpaid (USD)'
  ];

  const rows = [headers.join(',')];

  reportData.forEach(d => {
    rows.push([
      d.month,
      d.deliveries,
      d.projects,
      d.services,
      Math.round(d.paidIDR), Math.round(d.paidEUR), Math.round(d.paidUSD),
      Math.round(d.unpaidIDR), Math.round(d.unpaidEUR), Math.round(d.unpaidUSD)
    ].join(','));
  });

  return rows.join('\n');
};
const getInvoiceAchievement = async (year) => {
  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

  // Target data for exchange rates and target amounts
  const target = await prisma.pipelineTarget.findUnique({ where: { year } });
  const usdRate = target?.exchangeRateUsd ? Number(target.exchangeRateUsd) : 15000;
  const eurRate = target?.exchangeRateEur ? Number(target.exchangeRateEur) : 16500;
  
  const targetSparepart = target?.targetSparepart ? Number(target.targetSparepart) : 0;
  const targetService = target?.targetService ? Number(target.targetService) : 0;
  const targetProject = target?.targetProject ? Number(target.targetProject) : 0;
  const targetTotal = target?.target ? Number(target.target) : 0;

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['PAID', 'DONE'] },
      OR: [
        {
          paymentDate: {
            gte: startOfYear,
            lte: endOfYear
          }
        },
        {
          createdAt: {
            gte: startOfYear,
            lte: endOfYear
          },
          paymentDate: null
        }
      ]
    }
  });

  let sparepartPaidIdr = 0;
  let servicePaidIdr = 0;
  let projectPaidIdr = 0;

  invoices.forEach(inv => {
    let amtIdr = Number(inv.totalAmount || 0);
    if (inv.currency === 'USD') amtIdr *= usdRate;
    else if (inv.currency === 'EUR') amtIdr *= eurRate;

    if (inv.sourceType === 'SPARE_PART' || inv.poId) {
       // if sourceType SPARE_PART or it has poId (po part)
       sparepartPaidIdr += amtIdr;
    } else if (inv.sourceType === 'SERVICE') {
       servicePaidIdr += amtIdr;
    } else if (inv.sourceType === 'PROJECT') {
       projectPaidIdr += amtIdr;
    }
  });

  const totalPaidIdr = sparepartPaidIdr + servicePaidIdr + projectPaidIdr;

  return {
    targetSparepart,
    targetService,
    targetProject,
    targetTotal,
    sparepartPaidIdr,
    servicePaidIdr,
    projectPaidIdr,
    totalPaidIdr,
    achievementSparepart: targetSparepart > 0 ? (sparepartPaidIdr / targetSparepart) * 100 : 0,
    achievementService: targetService > 0 ? (servicePaidIdr / targetService) * 100 : 0,
    achievementProject: targetProject > 0 ? (projectPaidIdr / targetProject) * 100 : 0,
    achievementTotal: targetTotal > 0 ? (totalPaidIdr / targetTotal) * 100 : 0
  };
};

module.exports = {
  getResourceUtilization,
  getResourceOverview,
  getPipelineStats,
  generateCSVReport,
  getInvoiceAchievement
};

const prisma = require('../config/prisma');
const nodemailer = require('nodemailer');
const { delay } = require('../utils/delay.utils');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Find all PENDING and IN_PROGRESS ServiceExecutions that have had no activity and need a reminder.
 */
const findIdleServices = async () => {
  const idleDays = parseInt(process.env.REMINDER_EXECUTION_IDLE_DAYS || '1', 10);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - idleDays);

  const openServices = await prisma.serviceExecution.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      reminderCount: { lt: 3 }, // max 3 reminders
    },
    include: {
      purchaseOrder: { include: { quotation: { include: { inquiry: { include: { customer: true } } } } } },
      inquiry: { include: { customer: true } },
      quotation: { include: { inquiry: { include: { customer: true } } } }
    },
    orderBy: { createdAt: 'asc' },
  });

  return openServices.filter((s) => {
    if (s.reminderCount === 0) {
      const referenceDate = s.lastActivityAt ? new Date(s.lastActivityAt) : new Date(s.createdAt);
      return referenceDate <= threshold;
    }

    if (s.lastReminderAt) {
      const lastReminderDate = new Date(s.lastReminderAt);
      const isTimeForNextReminder = lastReminderDate <= threshold;

      const lastActivityDate = s.lastActivityAt ? new Date(s.lastActivityAt) : null;
      const hasNoNewActivity = !lastActivityDate || lastActivityDate <= lastReminderDate;

      return isTimeForNextReminder && hasNoNewActivity;
    }

    return false;
  });
};

/**
 * Find all PENDING and IN_PROGRESS ProjectExecutions that have had no activity and need a reminder.
 */
const findIdleProjects = async () => {
  const idleDays = parseInt(process.env.REMINDER_EXECUTION_IDLE_DAYS || '1', 10);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - idleDays);

  const openProjects = await prisma.projectExecution.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      reminderCount: { lt: 3 }, // max 3 reminders
    },
    include: {
      purchaseOrder: { include: { quotation: { include: { inquiry: { include: { customer: true } } } } } }
    },
    orderBy: { createdAt: 'asc' },
  });

  return openProjects.filter((p) => {
    if (p.reminderCount === 0) {
      const referenceDate = p.lastActivityAt ? new Date(p.lastActivityAt) : new Date(p.createdAt);
      return referenceDate <= threshold;
    }

    if (p.lastReminderAt) {
      const lastReminderDate = new Date(p.lastReminderAt);
      const isTimeForNextReminder = lastReminderDate <= threshold;

      const lastActivityDate = p.lastActivityAt ? new Date(p.lastActivityAt) : null;
      const hasNoNewActivity = !lastActivityDate || lastActivityDate <= lastReminderDate;

      return isTimeForNextReminder && hasNoNewActivity;
    }

    return false;
  });
};

/**
 * Get all active users with PROJECT or SERVICE role from the database.
 */
const getExecutionUsers = async () => {
  return await prisma.user.findMany({
    where: {
      roles: { hasSome: ['PROJECT', 'SERVICE'] },
      status: 'ACTIVE',
      email: { not: '' }
    },
    select: { id: true, name: true, email: true }
  });
};

const processExecutionReminders = async () => {
  try {
    const idleServices = await findIdleServices();
    const idleProjects = await findIdleProjects();

    if (idleServices.length === 0 && idleProjects.length === 0) {
      console.log('[ExecutionReminder] No idle executions found.');
      return { sent: false, skipped: true, reason: 'No idle executions found' };
    }

    const recipients = await getExecutionUsers();

    if (recipients.length === 0) {
      console.warn('[ExecutionReminder] No active recipients found with role PROJECT or SERVICE');
      return { sent: false, error: 'No active recipients found with role PROJECT or SERVICE' };
    }

    console.log(`[ExecutionReminder] Found ${idleServices.length} idle service(s) & ${idleProjects.length} idle project(s). Sending to ${recipients.length} user(s)...`);

    const CHUNK_SIZE = 3;
    const CHUNK_DELAY_MS = 60000;
    let sentCount = 0;

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);

      for (const user of chunk) {
        const emailHtml = generateExecutionEmailTemplate(user, idleServices, idleProjects);
        await transporter.sendMail({
          from: `"LIND Digitalization" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: `[REMINDER] Stagnant Execution Progress - ${new Date().toLocaleDateString('id-ID')}`,
          html: emailHtml,
        });
        sentCount++;
        console.log(`[ExecutionReminder] ✅ Email sent to ${user.name} (${user.email})`);
      }

      if (i + CHUNK_SIZE < recipients.length) {
        console.log(`[ExecutionReminder] Rate limit: waiting 60s before next batch...`);
        await delay(CHUNK_DELAY_MS);
      }
    }

    const serviceIds = idleServices.map(s => s.id);
    const projectIds = idleProjects.map(p => p.id);

    if (serviceIds.length > 0) {
      await prisma.serviceExecution.updateMany({
        where: { id: { in: serviceIds } },
        data: {
          lastReminderAt: new Date(),
          reminderCount: { increment: 1 }
        }
      });
    }

    if (projectIds.length > 0) {
      await prisma.projectExecution.updateMany({
        where: { id: { in: projectIds } },
        data: {
          lastReminderAt: new Date(),
          reminderCount: { increment: 1 }
        }
      });
    }

    console.log(`[ExecutionReminder] Done. Sent: ${sentCount}/${recipients.length}. Updated ${idleServices.length} service(s) & ${idleProjects.length} project(s).`);

    return { sent: true, recipientCount: sentCount, servicesReminded: idleServices.length, projectsReminded: idleProjects.length };

  } catch (error) {
    console.error('[ExecutionReminder] Error:', error);
    throw error;
  }
};

const { renderStandardEmailLayout, renderBadge } = require('../utils/emailTemplate.utils');

function generateExecutionEmailTemplate(user, services, projects) {
  const tableColumns = [
    { title: 'No. Eksekusi', key: 'execNumber', style: 'font-weight: bold;' },
    { title: 'Tipe', key: 'typeBadge' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Status', key: 'statusBadge' },
    { title: 'Aktivitas Terakhir', key: 'lastActivity' },
  ];

  const serviceRows = services.map((s) => {
    const customer = s.purchaseOrder?.quotation?.inquiry?.customer?.name 
                  || s.inquiry?.customer?.name 
                  || s.quotation?.inquiry?.customer?.name 
                  || '-';
    const lastActivity = s.lastActivityAt
      ? new Date(s.lastActivityAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-';

    let badgeType = s.status === 'IN_PROGRESS' ? 'info' : 'warning';

    return {
      execNumber: s.serviceNumber,
      typeBadge: renderBadge('SERVICE', 'purple'),
      customerName: customer,
      statusBadge: renderBadge(s.status, badgeType),
      lastActivity,
    };
  });

  const projectRows = projects.map((p) => {
    const customer = p.purchaseOrder?.quotation?.inquiry?.customer?.name || '-';
    const lastActivity = p.lastActivityAt
      ? new Date(p.lastActivityAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-';

    let badgeType = p.status === 'IN_PROGRESS' ? 'info' : 'warning';

    return {
      execNumber: p.projectNumber,
      typeBadge: renderBadge('PROJECT', 'indigo'),
      customerName: customer,
      statusBadge: renderBadge(p.status, badgeType),
      lastActivity,
    };
  });

  const tableRows = [...serviceRows, ...projectRows];
  const totalCount = services.length + projects.length;

  return renderStandardEmailLayout({
    headerTitle: '⚙️ Reminder: Progres Eksekusi Stagnan',
    headerColor: '#1e40af',
    recipientName: user.name || 'Tim Eksekusi',
    introMessage: `Terdapat <strong>${totalCount} pekerjaan eksekusi (Service & Project)</strong> berstatus <strong>PENDING</strong> atau <strong>IN_PROGRESS</strong> yang belum ada aktivitas lanjutan. Mohon segera diperbarui.`,
    tableColumns,
    tableRows,
  });
}

module.exports = { processExecutionReminders, findIdleServices, findIdleProjects, getExecutionUsers };

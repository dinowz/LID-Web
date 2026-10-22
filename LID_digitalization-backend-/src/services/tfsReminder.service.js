const prisma = require('../config/prisma');
const nodemailer = require('nodemailer');
const { delay } = require('../utils/delay.utils');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Find all TFS assignments where endDate is past REMINDER_TFS_OVERDUE_DAYS (default: 3 days)
 * and status is NOT COMPLETED / CLOSED / CANCELLED.
 */
const findOverdueTFSAssignments = async () => {
  const overdueDays = parseInt(process.env.REMINDER_TFS_OVERDUE_DAYS || '3', 10);
  const maxReminders = parseInt(process.env.REMINDER_TFS_MAX_COUNT || '3', 10);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - overdueDays);

  const tfsList = await prisma.tFS.findMany({
    where: {
      endDate: { lte: thresholdDate },
      status: { notIn: ['DONE','CANCELLED'] },
      reminderCount: { lt: maxReminders },
    },
    include: {
      personnel: true,
      serviceExecution: {
        include: {
          purchaseOrder: {
            include: {
              quotation: {
                include: { inquiry: { include: { customer: true } } },
              },
            },
          },
          inquiry: { include: { customer: true } },
          quotation: { include: { inquiry: { include: { customer: true } } } },
        },
      },
    },
    orderBy: { endDate: 'asc' },
  });

  return tfsList;
};

/**
 * Get all active users with TFS or SERVICE role from database.
 */
const getTFSUsers = async () => {
  return await prisma.user.findMany({
    where: {
      roles: { hasSome: ['TFS', 'SERVICE'] },
      status: 'ACTIVE',
      email: { not: '' },
    },
    select: { id: true, name: true, email: true },
  });
};

const { renderStandardEmailLayout, renderBadge } = require('../utils/emailTemplate.utils');

/**
 * Build consolidated HTML email body for overdue TFS assignments.
 */
const buildTFSEmailHtml = (user, tfsList) => {
  const tableColumns = [
    { title: 'No. TFS', key: 'tfsNumber', style: 'font-weight: bold;' },
    { title: 'Judul', key: 'title' },
    { title: 'Personel', key: 'personnelName' },
    { title: 'Customer', key: 'customerName' },
    { title: 'End Date', key: 'endDate' },
    { title: 'Terlewat', key: 'daysOverdue', style: 'color: #dc2626; font-weight: bold;' },
    { title: 'Pengingat Ke', key: 'reminderCountText', style: 'font-weight: bold; color: #1e40af;' },
    { title: 'Status', key: 'statusBadge' },
  ];

  const tableRows = tfsList.map((item) => {
    const endDateStr = item.endDate
      ? new Date(item.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-';

    const daysOverdue = item.endDate
      ? Math.floor((Date.now() - new Date(item.endDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const customerName =
      item.serviceExecution?.purchaseOrder?.quotation?.inquiry?.customer?.name ||
      item.serviceExecution?.inquiry?.customer?.name ||
      item.serviceExecution?.quotation?.inquiry?.customer?.name ||
      '-';

    const currentCount = (item.reminderCount || 0) + 1;

    return {
      tfsNumber: item.tfsNumber,
      title: item.title || '-',
      personnelName: item.personnel?.name || '-',
      customerName,
      endDate: endDateStr,
      daysOverdue: `+${daysOverdue} hari`,
      reminderCountText: `#${currentCount}`,
      statusBadge: renderBadge(item.status, 'warning'),
    };
  });

  return renderStandardEmailLayout({
    headerTitle: '⚠️ Reminder: TFS Overdue End Date',
    headerColor: '#1e40af',
    recipientName: user.name || 'Tim Service / TFS',
    introMessage: `Terdapat <strong>${tfsList.length} penugasan TFS</strong> yang telah melebihi tanggal selesai (End Date) lebih dari 3 hari namun belum berstatus COMPLETED. Mohon segera ditindaklanjuti.`,
    tableColumns,
    tableRows,
  });
};

/**
 * Main Orchestrator for TFS Reminders.
 */
const processTFSReminders = async () => {
  try {
    const overdueTfsList = await findOverdueTFSAssignments();

    if (overdueTfsList.length === 0) {
      console.log('[TFSReminder] No overdue TFS assignments found.');
      return { skipped: true, reason: 'No overdue TFS assignments found' };
    }

    const tfsUsers = await getTFSUsers();

    if (tfsUsers.length === 0) {
      console.warn('[TFSReminder] No active TFS or SERVICE users found in database — skipping.');
      return { sent: false, reason: 'No active recipients found' };
    }

    console.log(`[TFSReminder] Found ${overdueTfsList.length} overdue TFS assignment(s). Sending to ${tfsUsers.length} user(s)...`);

    const CHUNK_SIZE = 3;
    const CHUNK_DELAY_MS = 60000;
    const results = [];

    for (let i = 0; i < tfsUsers.length; i += CHUNK_SIZE) {
      const chunk = tfsUsers.slice(i, i + CHUNK_SIZE);

      for (const user of chunk) {
        try {
          const emailHtml = buildTFSEmailHtml(user, overdueTfsList);
          const info = await transporter.sendMail({
            from: `"LIND Digitalization" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: `[REMINDER] ${overdueTfsList.length} TFS Overdue End Date`,
            html: emailHtml,
          });
          results.push({ status: 'sent', userId: user.id, email: user.email, messageId: info.messageId });
          console.log(`[TFSReminder] ✅ Email sent to ${user.name} (${user.email}) — ${info.messageId}`);
        } catch (err) {
          results.push({ status: 'error', userId: user.id, email: user.email, error: err.message });
          console.error(`[TFSReminder] ❌ Failed to send to ${user.name} (${user.email}): ${err.message}`);
        }
      }

      if (i + CHUNK_SIZE < tfsUsers.length) {
        console.log(`[TFSReminder] Rate limit: waiting 60s before next batch...`);
        await delay(CHUNK_DELAY_MS);
      }
    }

    const sentCount = results.filter((r) => r.status === 'sent').length;

    // Update reminderCount and lastReminderSentAt for overdue TFS items if emails were sent successfully
    if (sentCount > 0) {
      const now = new Date();
      for (const tfs of overdueTfsList) {
        try {
          await prisma.tFS.update({
            where: { id: tfs.id },
            data: {
              reminderCount: { increment: 1 },
              lastReminderSentAt: now,
            },
          });
        } catch (updateErr) {
          console.error(`[TFSReminder] Failed to update reminder stats for TFS ID ${tfs.id}:`, updateErr.message);
        }
      }
    }

    console.log(`[TFSReminder] Done. Sent: ${sentCount}/${tfsUsers.length}. Reminded ${overdueTfsList.length} TFS records.`);

    return { sent: sentCount > 0, totalUsers: tfsUsers.length, sentCount, results };
  } catch (error) {
    console.error('[TFSReminder] Error:', error);
    throw error;
  }
};

module.exports = { processTFSReminders, findOverdueTFSAssignments, getTFSUsers };

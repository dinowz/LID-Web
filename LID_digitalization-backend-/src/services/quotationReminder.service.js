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
 * Find all DRAFT quotations that have had no activity and need a reminder.
 * Rules:
 * - Maximum 3 reminders (reminderCount < 3).
 * - Idle threshold: REMINDER_QUOTATION_IDLE_DAYS (default: 1 day).
 * - First reminder (reminderCount === 0): idle from lastActivityAt (or createdAt) >= REMINDER_QUOTATION_IDLE_DAYS.
 * - Subsequent reminders (reminderCount 1 or 2): time since lastReminderAt >= REMINDER_QUOTATION_IDLE_DAYS AND no new activity since lastReminderAt.
 */
const findIdleQuotations = async () => {
  const idleDays = parseInt(process.env.REMINDER_QUOTATION_IDLE_DAYS || '1', 10);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - idleDays);

  const openQuotations = await prisma.quotation.findMany({
    where: {
      status: 'DRAFT',
      reminderCount: { lt: 3 }, // max 3 reminders
    },
    include: {
      inquiry: { include: { customer: true } },
      creator: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return openQuotations.filter((q) => {
    // 1st reminder: checked against lastActivityAt or createdAt
    if (q.reminderCount === 0) {
      const referenceDate = q.lastActivityAt ? new Date(q.lastActivityAt) : new Date(q.createdAt);
      return referenceDate <= threshold;
    }

    // 2nd and 3rd reminders: checked against lastReminderAt
    if (q.lastReminderAt) {
      const lastReminderDate = new Date(q.lastReminderAt);
      const isTimeForNextReminder = lastReminderDate <= threshold;

      const lastActivityDate = q.lastActivityAt ? new Date(q.lastActivityAt) : null;
      const hasNoNewActivity = !lastActivityDate || lastActivityDate <= lastReminderDate;

      return isTimeForNextReminder && hasNoNewActivity;
    }

    return false;
  });
};

const { renderStandardEmailLayout, renderBadge } = require('../utils/emailTemplate.utils');

/**
 * Build the consolidated HTML email body for idle quotations.
 */
const buildQuotationEmailHtml = (user, quotations) => {
  const tableColumns = [
    { title: 'No. Quotation', key: 'quotationNumber', style: 'font-weight: bold;' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Inquiry Ref', key: 'inquiryNumber' },
    { title: 'Total Price', key: 'totalPrice', align: 'right' },
    { title: 'Aktivitas Terakhir', key: 'lastActivity' },
    { title: 'Idle', key: 'daysSince', style: 'color: #dc2626; font-weight: bold;' },
    { title: 'Creator', key: 'creatorName' },
  ];

  const tableRows = quotations.map((q) => {
    const lastActivity = q.lastActivityAt
      ? new Date(q.lastActivityAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date(q.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const daysSince = Math.floor(
      (Date.now() - (q.lastActivityAt || q.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const formattedPrice = `${q.currency || 'IDR'} ${parseFloat(q.totalPrice || 0).toLocaleString('id-ID')}`;

    return {
      quotationNumber: q.quotationNumber,
      customerName: q.inquiry?.customer?.name || '-',
      inquiryNumber: q.inquiry?.inquiryNumber || '-',
      totalPrice: formattedPrice,
      lastActivity,
      daysSince: `${daysSince} hari`,
      creatorName: q.creator?.name || '-',
    };
  });

  return renderStandardEmailLayout({
    headerTitle: '📋 Reminder: Quotation DRAFT Belum Dikirim',
    headerColor: '#1e40af',
    recipientName: user.name || 'Tim Sales',
    introMessage: `Terdapat <strong>${quotations.length} quotation berstatus DRAFT</strong> yang belum dikirim ke customer. Mohon segera ditindaklanjuti.`,
    tableColumns,
    tableRows,
  });
};


/**
 * Get all active users with SALES role from the database.
 */
const getSalesUsers = async () => {
  return await prisma.user.findMany({
    where: {
      roles: { hasSome: ['SERVICE', 'PROJECT', 'SPARE_PART'] },
      status: 'ACTIVE',
      email: { not: '' },
    },
    select: { id: true, name: true, email: true },
  });
};

/**
 * Send a consolidated reminder email to a single recipient.
 */
const sendReminderToUser = async (user, quotations) => {
  const mailOptions = {
    from: `"LIND Digitalization" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `[REMINDER] ${quotations.length} Quotation DRAFT Belum Dikirim`,
    html: buildQuotationEmailHtml(user, quotations),
  };

  const info = await transporter.sendMail(mailOptions);
  return { userId: user.id, email: user.email, messageId: info.messageId };
};

/**
 * Main orchestrator:
 * 1. Find idle DRAFT quotations
 * 2. Get all active Sales users from database
 * 3. Send 1 consolidated email per Sales user with a delay between each
 * 4. Update lastReminderAt + reminderCount for each quotation
 */
const processQuotationReminders = async () => {
  const idleQuotations = await findIdleQuotations();

  if (idleQuotations.length === 0) {
    console.log('[REMINDER-QUO] No idle DRAFT quotations found.');
    return { skipped: true };
  }

  const salesUsers = await getSalesUsers();

  if (salesUsers.length === 0) {
    console.warn('[REMINDER-QUO] No active SALES users found in database — skipping.');
    return { sent: false, reason: 'No active SALES users in database' };
  }

  console.log(`[REMINDER-QUO] Found ${idleQuotations.length} idle quotations. Sending to ${salesUsers.length} Sales user(s)...`);

  const CHUNK_SIZE = 3;
  const CHUNK_DELAY_MS = 60000;
  const results = [];

  for (let i = 0; i < salesUsers.length; i += CHUNK_SIZE) {
    const chunk = salesUsers.slice(i, i + CHUNK_SIZE);

    for (const user of chunk) {
      try {
        const result = await sendReminderToUser(user, idleQuotations);
        results.push({ status: 'sent', ...result });
        console.log(`[REMINDER-QUO] ✅ Email sent to ${user.name} (${user.email}) — ${result.messageId}`);
      } catch (err) {
        results.push({ status: 'error', userId: user.id, email: user.email, error: err.message });
        console.error(`[REMINDER-QUO] ❌ Failed to send to ${user.name} (${user.email}): ${err.message}`);
      }
    }

    if (i + CHUNK_SIZE < salesUsers.length) {
      console.log(`[REMINDER-QUO] Rate limit: waiting 60s before next batch...`);
      await delay(CHUNK_DELAY_MS);
    }
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;

  if (sentCount > 0) {
    const now = new Date();
    await prisma.quotation.updateMany({
      where: {
        id: { in: idleQuotations.map((q) => q.id) },
      },
      data: {
        lastReminderAt: now,
        reminderCount: { increment: 1 },
      },
    });

    console.log(`[REMINDER-QUO] Done. Sent: ${sentCount}/${salesUsers.length}. Updated ${idleQuotations.length} quotation records.`);
  }

  return { sent: sentCount > 0, totalUsers: salesUsers.length, sentCount, results };
};

module.exports = { processQuotationReminders, findIdleQuotations, getSalesUsers };

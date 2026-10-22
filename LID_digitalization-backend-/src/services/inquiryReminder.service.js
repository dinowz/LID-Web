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
 * Find all OPEN inquiries that have had no activity and need a reminder.
 * Rules:
 * - Maximum 3 reminders (reminderCount < 3).
 * - Idle threshold: REMINDER_IDLE_DAYS (default: 1 day).
 * - First reminder (reminderCount === 0): idle from lastActivityAt (or createdAt) >= REMINDER_IDLE_DAYS.
 * - Subsequent reminders (reminderCount 1 or 2): time since lastReminderAt >= REMINDER_IDLE_DAYS AND no new activity since lastReminderAt.
 */
const findIdleOpenInquiries = async () => {
  const idleDays = parseInt(process.env.REMINDER_IDLE_DAYS || '1', 10);
  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - idleDays);

  const openInquiries = await prisma.inquiry.findMany({
    where: {
      statusCode: 'OPEN',
      reminderCount: { lt: 3 }, // max 3 reminders
    },
    include: {
      customer: true,
      creator: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return openInquiries.filter((inq) => {
    // 1st reminder: checked against lastActivityAt or createdAt
    if (inq.reminderCount === 0) {
      const referenceDate = inq.lastActivityAt ? new Date(inq.lastActivityAt) : new Date(inq.createdAt);
      return referenceDate <= threshold;
    }

    // 2nd and 3rd reminders: checked against lastReminderAt
    if (inq.lastReminderAt) {
      const lastReminderDate = new Date(inq.lastReminderAt);
      const isTimeForNextReminder = lastReminderDate <= threshold;

      const lastActivityDate = inq.lastActivityAt ? new Date(inq.lastActivityAt) : null;
      const hasNoNewActivity = !lastActivityDate || lastActivityDate <= lastReminderDate;

      return isTimeForNextReminder && hasNoNewActivity;
    }

    return false;
  });
};

const { renderStandardEmailLayout, renderBadge } = require('../utils/emailTemplate.utils');

/**
 * Build the consolidated HTML email body summarizing all idle inquiries.
 */
const buildEmailHtml = (user, inquiries) => {
  const tableColumns = [
    { title: 'No. Inquiry', key: 'inquiryNumber', style: 'font-weight: bold;' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Subject', key: 'subject' },
    { title: 'Tipe', key: 'requestType' },
    { title: 'Aktivitas Terakhir', key: 'lastActivity' },
    { title: 'Idle', key: 'daysSince', style: 'color: #dc2626; font-weight: bold;' },
    { title: 'Creator', key: 'creatorName' },
  ];

  const tableRows = inquiries.map((inq) => {
    const lastActivity = inq.lastActivityAt
      ? new Date(inq.lastActivityAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date(inq.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const daysSince = Math.floor(
      (Date.now() - (inq.lastActivityAt || inq.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      inquiryNumber: inq.inquiryNumber,
      customerName: inq.customer?.name || '-',
      subject: inq.subject,
      requestType: renderBadge(inq.requestType, 'info'),
      lastActivity,
      daysSince: `${daysSince} hari`,
      creatorName: inq.creator?.name || '-',
    };
  });

  return renderStandardEmailLayout({
    headerTitle: '⚠️ Reminder: Inquiry OPEN Belum Ada Aktivitas',
    headerColor: '#1e40af',
    recipientName: user.name || 'Tim Sales',
    introMessage: `Terdapat <strong>${inquiries.length} inquiry berstatus OPEN</strong> yang belum ada aktivitas lanjutan. Mohon segera ditindaklanjuti.`,
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
const sendReminderToUser = async (user, inquiries) => {
  const mailOptions = {
    from: `"LIND Digitalization" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `[REMINDER] ${inquiries.length} Inquiry OPEN Belum Ada Aktivitas > 2 Hari`,
    html: buildEmailHtml(user, inquiries),
  };

  const info = await transporter.sendMail(mailOptions);
  return { userId: user.id, email: user.email, messageId: info.messageId };
};

/**
 * Main orchestrator:
 * 1. Find idle OPEN inquiries
 * 2. Get all active Sales users from database
 * 3. Send 1 consolidated email per Sales user with a delay between each
 * 4. Update lastReminderAt + reminderCount for each inquiry
 */
const processInquiryReminders = async () => {
  const idleInquiries = await findIdleOpenInquiries();

  if (idleInquiries.length === 0) {
    console.log('[REMINDER] No idle OPEN inquiries found.');
    return { skipped: true };
  }

  // Get recipients from database instead of env
  const salesUsers = await getSalesUsers();

  if (salesUsers.length === 0) {
    console.warn('[REMINDER] No active SALES users found in database — skipping.');
    return { sent: false, reason: 'No active SALES users in database' };
  }

  console.log(`[REMINDER] Found ${idleInquiries.length} idle inquiries. Sending to ${salesUsers.length} Sales user(s)...`);

  const CHUNK_SIZE = 3;
  const CHUNK_DELAY_MS = 60000; // 60 seconds between chunks
  const results = [];

  for (let i = 0; i < salesUsers.length; i += CHUNK_SIZE) {
    const chunk = salesUsers.slice(i, i + CHUNK_SIZE);

    for (const user of chunk) {
      try {
        const result = await sendReminderToUser(user, idleInquiries);
        results.push({ status: 'sent', ...result });
        console.log(`[REMINDER] ✅ Email sent to ${user.name} (${user.email}) — ${result.messageId}`);
      } catch (err) {
        results.push({ status: 'error', userId: user.id, email: user.email, error: err.message });
        console.error(`[REMINDER] ❌ Failed to send to ${user.name} (${user.email}): ${err.message}`);
      }
    }

    // Jeda 60 detik setelah setiap chunk, kecuali chunk terakhir
    if (i + CHUNK_SIZE < salesUsers.length) {
      console.log(`[REMINDER] Rate limit: waiting 60s before next batch...`);
      await delay(CHUNK_DELAY_MS);
    }
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;

  if (sentCount > 0) {
    // Update lastReminderAt and increment reminderCount for each inquiry
    const now = new Date();
    await prisma.inquiry.updateMany({
      where: {
        id: { in: idleInquiries.map((i) => i.id) },
      },
      data: {
        lastReminderAt: now,
        reminderCount: { increment: 1 },
      },
    });

    console.log(`[REMINDER] Done. Sent: ${sentCount}/${salesUsers.length}. Updated ${idleInquiries.length} inquiry records.`);
  }

  return { sent: sentCount > 0, totalUsers: salesUsers.length, sentCount, results };
};

module.exports = { processInquiryReminders, findIdleOpenInquiries, getSalesUsers };


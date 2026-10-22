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
 * Find all REVIEW, WAITING_OC, and READY POs that have had no activity and need a reminder.
 * Rules:
 * - Maximum 3 reminders (reminderCount < 3).
 * - Independent Idle thresholds via env:
 *   - REVIEW: REMINDER_PO_REVIEW_IDLE_DAYS (default: 1 day)
 *   - WAITING_OC: REMINDER_PO_WAITING_OC_IDLE_DAYS (default: 3 days)
 *   - READY: REMINDER_PO_READY_IDLE_DAYS (default: 3 days)
 */
const findIdlePOs = async () => {
  const reviewIdleDays = parseInt(process.env.REMINDER_PO_REVIEW_IDLE_DAYS || '1', 10);
  const waitingOcIdleDays = parseInt(process.env.REMINDER_PO_WAITING_OC_IDLE_DAYS || '3', 10);
  const readyIdleDays = parseInt(process.env.REMINDER_PO_READY_IDLE_DAYS || '3', 10);

  const reviewThreshold = new Date();
  reviewThreshold.setDate(reviewThreshold.getDate() - reviewIdleDays);

  const waitingOcThreshold = new Date();
  waitingOcThreshold.setDate(waitingOcThreshold.getDate() - waitingOcIdleDays);

  const readyThreshold = new Date();
  readyThreshold.setDate(readyThreshold.getDate() - readyIdleDays);

  const openPOs = await prisma.purchaseOrder.findMany({
    where: {
      status: { in: ['REVIEW', 'WAITING_OC', 'READY'] },
      reminderCount: { lt: 3 }, // max 3 reminders
    },
    include: {
      quotation: {
        include: { inquiry: { include: { customer: true } } }
      },
      creator: true,
      sparePartDetail: { include: { vendor: true } },
      serviceDetail: { include: { vendor: true } },
      projectDetail: { include: { vendor: true } }
    },
    orderBy: { createdAt: 'asc' },
  });

  return openPOs.filter((po) => {
    let threshold = reviewThreshold;
    if (po.status === 'WAITING_OC') threshold = waitingOcThreshold;
    if (po.status === 'READY') threshold = readyThreshold;

    // 1st reminder: checked against lastActivityAt or createdAt
    if (po.reminderCount === 0) {
      const referenceDate = po.lastActivityAt ? new Date(po.lastActivityAt) : new Date(po.createdAt);
      return referenceDate <= threshold;
    }

    // 2nd and 3rd reminders: checked against lastReminderAt
    if (po.lastReminderAt) {
      const lastReminderDate = new Date(po.lastReminderAt);
      const isTimeForNextReminder = lastReminderDate <= threshold;

      const lastActivityDate = po.lastActivityAt ? new Date(po.lastActivityAt) : null;
      const hasNoNewActivity = !lastActivityDate || lastActivityDate <= lastReminderDate;

      return isTimeForNextReminder && hasNoNewActivity;
    }

    return false;
  });
};

/**
 * Helper to get vendor from the correct detail extension
 */
const getVendorName = (po) => {
  const ext = po.poType === 'PROJECT' ? po.projectDetail 
            : (po.poType === 'SERVICE' ? po.serviceDetail : po.sparePartDetail);
  return ext?.vendor?.name || '-';
};

const { renderStandardEmailLayout, renderBadge } = require('../utils/emailTemplate.utils');

/**
 * Build the consolidated HTML email body for idle POs.
 */
const buildPOEmailHtml = (user, pos) => {
  const tableColumns = [
    { title: 'Nomor PO', key: 'poNumber', style: 'font-weight: bold;' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Vendor', key: 'vendorName' },
    { title: 'Inquiry Ref', key: 'inquiryNumber' },
    { title: 'Status', key: 'statusBadge' },
    { title: 'Total Nilai', key: 'netValue', align: 'right' },
    { title: 'Aktivitas Terakhir', key: 'lastActivity' },
    { title: 'Idle', key: 'daysSince', style: 'color: #dc2626; font-weight: bold;' },
    { title: 'Pembuat', key: 'creatorName' },
  ];

  const tableRows = pos.map((po) => {
    const lastActivity = po.lastActivityAt
      ? new Date(po.lastActivityAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date(po.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const daysSince = Math.floor(
      (Date.now() - (po.lastActivityAt || po.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const formattedValue = `${po.currency || 'IDR'} ${parseFloat(po.netValue || 0).toLocaleString('id-ID')}`;
    const customerName = po.quotation?.inquiry?.customer?.name || '-';
    const inqRef = po.quotation?.inquiry?.inquiryNumber || '-';
    const vendorName = getVendorName(po);

    let badgeType = 'info';
    if (po.status === 'REVIEW') badgeType = 'warning';
    if (po.status === 'WAITING_OC') badgeType = 'info';
    if (po.status === 'READY') badgeType = 'success';

    return {
      poNumber: po.poNumber || 'Draft',
      customerName,
      vendorName,
      inquiryNumber: inqRef,
      statusBadge: renderBadge(po.status, badgeType),
      netValue: formattedValue,
      lastActivity,
      daysSince: `${daysSince} hari`,
      creatorName: po.creator?.name || '-',
    };
  });

  return renderStandardEmailLayout({
    headerTitle: '📦 Reminder: Purchase Order Belum Ada Aktivitas',
    headerColor: '#1e40af',
    recipientName: user.name || 'Tim Procurement',
    introMessage: `Terdapat <strong>${pos.length} Purchase Order (berstatus REVIEW / WAITING_OC / READY)</strong> yang belum ada aktivitas lanjutan. Mohon segera ditindaklanjuti.`,
    tableColumns,
    tableRows,
  });
};


/**
 * Get all active users with PROCUREMENT role from the database.
 */
const getProcurementUsers = async () => {
  return await prisma.user.findMany({
    where: {
      roles: { has: 'PROCUREMENT' },
      status: 'ACTIVE',
      email: { not: '' },
    },
    select: { id: true, name: true, email: true },
  });
};

/**
 * Send a consolidated reminder email to a single recipient.
 */
const sendReminderToUser = async (user, pos) => {
  const mailOptions = {
    from: `"LIND Digitalization" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `[REMINDER] ${pos.length} Purchase Order Belum Ada Aktivitas`,
    html: buildPOEmailHtml(user, pos),
  };

  const info = await transporter.sendMail(mailOptions);
  return { userId: user.id, email: user.email, messageId: info.messageId };
};

/**
 * Main orchestrator:
 * 1. Find idle REVIEW POs
 * 2. Get all active Procurement users from database
 * 3. Send 1 consolidated email per Procurement user with a delay between each
 * 4. Update lastReminderAt + reminderCount for each PO
 */
const processPOReminders = async () => {
  const idlePOs = await findIdlePOs();

  if (idlePOs.length === 0) {
    console.log('[REMINDER-PO] No idle REVIEW POs found.');
    return { skipped: true };
  }

  const procUsers = await getProcurementUsers();

  if (procUsers.length === 0) {
    console.warn('[REMINDER-PO] No active PROCUREMENT users found in database — skipping.');
    return { sent: false, reason: 'No active PROCUREMENT users in database' };
  }

  console.log(`[REMINDER-PO] Found ${idlePOs.length} idle POs. Sending to ${procUsers.length} Procurement user(s)...`);

  const CHUNK_SIZE = 3;
  const CHUNK_DELAY_MS = 60000;
  const results = [];

  for (let i = 0; i < procUsers.length; i += CHUNK_SIZE) {
    const chunk = procUsers.slice(i, i + CHUNK_SIZE);

    for (const user of chunk) {
      try {
        const result = await sendReminderToUser(user, idlePOs);
        results.push({ status: 'sent', ...result });
        console.log(`[REMINDER-PO] ✅ Email sent to ${user.name} (${user.email}) — ${result.messageId}`);
      } catch (err) {
        results.push({ status: 'error', userId: user.id, email: user.email, error: err.message });
        console.error(`[REMINDER-PO] ❌ Failed to send to ${user.name} (${user.email}): ${err.message}`);
      }
    }

    if (i + CHUNK_SIZE < procUsers.length) {
      console.log(`[REMINDER-PO] Rate limit: waiting 60s before next batch...`);
      await delay(CHUNK_DELAY_MS);
    }
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;

  if (sentCount > 0) {
    const now = new Date();
    await prisma.purchaseOrder.updateMany({
      where: {
        id: { in: idlePOs.map((p) => p.id) },
      },
      data: {
        lastReminderAt: now,
        reminderCount: { increment: 1 },
      },
    });

    console.log(`[REMINDER-PO] Done. Sent: ${sentCount}/${procUsers.length}. Updated ${idlePOs.length} PO records.`);
  }

  return { sent: sentCount > 0, totalUsers: procUsers.length, sentCount, results };
};

module.exports = { processPOReminders, findIdlePOs, getProcurementUsers };

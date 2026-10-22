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
 * Find all REVIEW_LOGISTIC and PACKED deliveries that have had no activity and need a reminder.
 * Rules:
 * - Maximum 3 reminders (logisticReminderCount < 3).
 * - Idle threshold: REMINDER_DELIVERY_IDLE_DAYS (default: 1 day).
 * - First reminder (logisticReminderCount === 0): idle from updatedAt (or createdAt) >= REMINDER_DELIVERY_IDLE_DAYS.
 * - Subsequent reminders (logisticReminderCount 1 or 2): time since lastLogisticReminderAt >= REMINDER_DELIVERY_IDLE_DAYS AND no new update since lastLogisticReminderAt.
 */
const findIdleDeliveries = async () => {
  const idleDays = parseInt(process.env.REMINDER_DELIVERY_IDLE_DAYS || '1', 10);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - idleDays);

  const openDeliveries = await prisma.delivery.findMany({
    where: {
      status: { in: ['REVIEW_LOGISTIC', 'PACKED'] },
      logisticReminderCount: { lt: 3 }, // max 3 reminders
    },
    include: {
      purchaseOrder: {
        include: { quotation: { include: { inquiry: { include: { customer: true } } } } }
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  return openDeliveries.filter((d) => {
    // 1st reminder: checked against updatedAt or createdAt
    if (d.logisticReminderCount === 0) {
      const referenceDate = d.updatedAt ? new Date(d.updatedAt) : new Date(d.createdAt);
      return referenceDate <= threshold;
    }

    // 2nd and 3rd reminders: checked against lastLogisticReminderAt
    if (d.lastLogisticReminderAt) {
      const lastReminderDate = new Date(d.lastLogisticReminderAt);
      const isTimeForNextReminder = lastReminderDate <= threshold;

      const lastUpdateDate = d.updatedAt ? new Date(d.updatedAt) : null;
      const hasNoNewActivity = !lastUpdateDate || lastUpdateDate <= lastReminderDate;

      return isTimeForNextReminder && hasNoNewActivity;
    }

    return false;
  });
};

/**
 * Get all active users with LOGISTIC role from the database.
 */
const getLogisticUsers = async () => {
  return await prisma.user.findMany({
    where: {
      roles: { has: 'LOGISTIC' },
      status: 'ACTIVE',
      email: { not: '' }
    },
    select: { id: true, name: true, email: true }
  });
};

const processDeliveryReminders = async () => {
  try {
    const idleDeliveries = await findIdleDeliveries();

    if (idleDeliveries.length === 0) {
      console.log('[LogisticReminder] No idle delivery items found.');
      return { sent: false, skipped: true, reason: 'No idle delivery items found' };
    }

    const recipients = await getLogisticUsers();

    if (recipients.length === 0) {
      console.warn('[LogisticReminder] No active recipients found with role LOGISTIC');
      return { sent: false, error: 'No active recipients found with role LOGISTIC' };
    }

    console.log(`[LogisticReminder] Found ${idleDeliveries.length} idle deliveries. Sending to ${recipients.length} Logistic user(s)...`);

    const CHUNK_SIZE = 3;
    const CHUNK_DELAY_MS = 60000; // 60 seconds between chunks
    let sentCount = 0;

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);

      for (const user of chunk) {
        const emailHtml = generateLogisticEmailTemplate(user, idleDeliveries);
        await transporter.sendMail({
          from: `"LIND Digitalization" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: `[REMINDER] ${idleDeliveries.length} Delivery Process Pending - ${new Date().toLocaleDateString('id-ID')}`,
          html: emailHtml,
        });
        sentCount++;
        console.log(`[LogisticReminder] ✅ Email sent to ${user.name} (${user.email})`);
      }

      if (i + CHUNK_SIZE < recipients.length) {
        console.log(`[LogisticReminder] Rate limit: waiting 60s before next batch...`);
        await delay(CHUNK_DELAY_MS);
      }
    }

    // Update tracking columns
    const deliveryIds = idleDeliveries.map(d => d.id);
    await prisma.delivery.updateMany({
      where: { id: { in: deliveryIds } },
      data: {
        lastLogisticReminderAt: new Date(),
        logisticReminderCount: { increment: 1 }
      }
    });

    console.log(`[LogisticReminder] Done. Sent: ${sentCount}/${recipients.length}. Updated ${idleDeliveries.length} delivery records.`);

    return { 
      sent: true, 
      recipientCount: sentCount, 
      deliveriesReminded: idleDeliveries.length 
    };

  } catch (error) {
    console.error('[LogisticReminder] Error:', error);
    throw error;
  }
};

const { renderStandardEmailLayout, renderBadge } = require('../utils/emailTemplate.utils');

function generateLogisticEmailTemplate(user, deliveries) {
  const tableColumns = [
    { title: 'No. Delivery', key: 'deliveryNumber', style: 'font-weight: bold;' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Status', key: 'statusBadge' },
    { title: 'Aktivitas Terakhir', key: 'lastActivity' },
  ];

  const tableRows = deliveries.map((d) => {
    const customer = d.purchaseOrder?.quotation?.inquiry?.customer?.name || '-';
    const lastActivity = d.updatedAt
      ? new Date(d.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-';

    let badgeType = 'info';
    if (d.status === 'REVIEW_LOGISTIC') badgeType = 'warning';
    if (d.status === 'PACKED') badgeType = 'teal';

    return {
      deliveryNumber: d.deliveryNumber,
      customerName: customer,
      statusBadge: renderBadge(d.status, badgeType),
      lastActivity,
    };
  });

  return renderStandardEmailLayout({
    headerTitle: '🚚 Reminder: Proses Pengiriman Logistik Pending',
    headerColor: '#1e40af',
    recipientName: user.name || 'Tim Logistik',
    introMessage: `Terdapat <strong>${deliveries.length} pengiriman barang</strong> yang masih tertahan di status <strong>REVIEW_LOGISTIC</strong> atau <strong>PACKED</strong>. Mohon segera diproses.`,
    tableColumns,
    tableRows,
  });
}

module.exports = { processDeliveryReminders, findIdleDeliveries, getLogisticUsers };

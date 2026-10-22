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

const processReadyToInvoiceReminders = async () => {
  const idleDays = parseInt(process.env.REMINDER_READY_TO_INVOICE_IDLE_DAYS || '2', 10);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - idleDays);

  console.log(`[BillingReminder] Checking for idle "Ready to Invoice" items since ${thresholdDate.toISOString()}`);

  try {
    // 1. Fetch Idle Deliveries
    const idleDeliveries = await prisma.delivery.findMany({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        invoices: { none: {} },
        actualDeliveryDate: { lte: thresholdDate },
        invoiceReminderCount: { lt: 1 }
      },
      include: {
        purchaseOrder: { include: { quotation: { include: { inquiry: { include: { customer: true } } } } } }
      }
    });

    // 2. Fetch Idle Service Executions
    const idleServices = await prisma.serviceExecution.findMany({
      where: {
        status: { in: ['DONE', 'COMPLETED'] },
        sourceType: { not: 'IC_TFS' },
        invoices: { none: {} },
        completedDate: { lte: thresholdDate },
        invoiceReminderCount: { lt: 1 }
      },
      include: {
        purchaseOrder: { include: { quotation: { include: { inquiry: { include: { customer: true } } } } } },
        inquiry: { include: { customer: true } }
      }
    });

    // 3. Fetch Potential Idle Project Executions
    const potentialProjects = await prisma.projectExecution.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'DONE', 'COMPLETED'] },
        updatedAt: { lte: thresholdDate },
        invoiceReminderCount: { lt: 1 }
      },
      include: {
        purchaseOrder: { include: { quotation: { include: { inquiry: { include: { customer: true } } } } } },
        invoices: { where: { status: { not: 'CANCELLED' } } }
      }
    });

    // Filter projects that actually have unbilled amount
    const idleProjects = potentialProjects.filter(p => {
      const poNetValue = Number(p.purchaseOrder?.netValue || 0);
      const totalInvoiced = p.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      return totalInvoiced < poNetValue;
    });

    if (idleDeliveries.length === 0 && idleServices.length === 0 && idleProjects.length === 0) {
      return { sent: false, skipped: true, reason: 'No idle billing items found' };
    }

    // 4. Get Recipients (Roles: FINANCE, SALES, TFS)
    const recipients = await prisma.user.findMany({
      where: {
        roles: { hasSome: ['FINANCE', 'SERVICE', 'PROJECT', 'TFS'] },
        status: 'ACTIVE'
      }
    });

    if (recipients.length === 0) {
      return { sent: false, error: 'No active recipients found with roles FINANCE, SALES, or TFS' };
    }

    // 5. Send Consolidated Emails — rate-limited: 3 users per minute
    const CHUNK_SIZE = 3;
    const CHUNK_DELAY_MS = 60000;
    let sentCount = 0;

    // Pre-filter recipients who actually have items relevant to their role
    const eligibleRecipients = recipients.filter(user => {
      const isTfsOnly = user.roles?.includes('TFS') && !user.roles?.some(r => ['FINANCE', 'SERVICE', 'PROJECT'].includes(r));
      const filteredDeliveries = isTfsOnly ? [] : idleDeliveries;
      const filteredServices = idleServices;
      const filteredProjects = isTfsOnly ? [] : idleProjects;
      return filteredDeliveries.length > 0 || filteredServices.length > 0 || filteredProjects.length > 0;
    });

    for (let i = 0; i < eligibleRecipients.length; i += CHUNK_SIZE) {
      const chunk = eligibleRecipients.slice(i, i + CHUNK_SIZE);

      for (const user of chunk) {
        const isTfsOnly = user.roles?.includes('TFS') && !user.roles?.some(r => ['FINANCE', 'SERVICE', 'PROJECT'].includes(r));
        const filteredDeliveries = isTfsOnly ? [] : idleDeliveries;
        const filteredServices = idleServices;
        const filteredProjects = isTfsOnly ? [] : idleProjects;

        const emailHtml = generateBillingEmailTemplate(user, filteredDeliveries, filteredServices, filteredProjects);
        await transporter.sendMail({
          from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
          to: user.email,
          subject: `[REMINDER] Ready to Invoice Items Pending - ${new Date().toLocaleDateString('id-ID')}`,
          html: emailHtml,
        });
        sentCount++;
        console.log(`[BillingReminder] ✅ Email sent to ${user.name} (${user.email})`);
      }

      if (i + CHUNK_SIZE < eligibleRecipients.length) {
        console.log(`[BillingReminder] Rate limit: waiting 60s before next batch...`);
        await delay(CHUNK_DELAY_MS);
      }
    }

    // 6. Update tracking columns
    if (idleDeliveries.length > 0) {
      await prisma.delivery.updateMany({
        where: { id: { in: idleDeliveries.map(d => d.id) } },
        data: {
          lastInvoiceReminderAt: new Date(),
          invoiceReminderCount: { increment: 1 }
        }
      });
    }

    if (idleServices.length > 0) {
      await prisma.serviceExecution.updateMany({
        where: { id: { in: idleServices.map(s => s.id) } },
        data: {
          lastInvoiceReminderAt: new Date(),
          invoiceReminderCount: { increment: 1 }
        }
      });
    }

    if (idleProjects.length > 0) {
      await prisma.projectExecution.updateMany({
        where: { id: { in: idleProjects.map(p => p.id) } },
        data: {
          lastInvoiceReminderAt: new Date(),
          invoiceReminderCount: { increment: 1 }
        }
      });
    }

    return {
      sent: true,
      recipientCount: sentCount,
      deliveriesReminded: idleDeliveries.length,
      servicesReminded: idleServices.length,
      projectsReminded: idleProjects.length
    };

  } catch (error) {
    console.error('[BillingReminder] Error:', error);
    throw error;
  }
};

const { renderStandardEmailLayout, renderBadge } = require('../utils/emailTemplate.utils');

function generateBillingEmailTemplate(user, deliveries, services, projects) {
  const tableColumns = [
    { title: 'Ref Number', key: 'refNumber', style: 'font-weight: bold;' },
    { title: 'Tipe', key: 'typeBadge' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Ready Since', key: 'readySince' },
  ];

  const deliveryRows = deliveries.map((d) => {
    const customer = d.purchaseOrder?.quotation?.inquiry?.customer?.name || '-';
    const date = d.actualDeliveryDate
      ? new Date(d.actualDeliveryDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-';

    return {
      refNumber: d.deliveryNumber,
      typeBadge: renderBadge('Sparepart', 'teal'),
      customerName: customer,
      readySince: date,
    };
  });

  const serviceRows = services.map((s) => {
    const customer = s.purchaseOrder?.quotation?.inquiry?.customer?.name || s.inquiry?.customer?.name || '-';
    const date = s.completedDate
      ? new Date(s.completedDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-';

    return {
      refNumber: s.serviceNumber,
      typeBadge: renderBadge('Service', 'purple'),
      customerName: customer,
      readySince: date,
    };
  });

  const projectRows = projects.map((p) => {
    const customer = p.purchaseOrder?.quotation?.inquiry?.customer?.name || '-';
    const date = p.updatedAt
      ? new Date(p.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-';

    return {
      refNumber: p.projectNumber,
      typeBadge: renderBadge('Project (O&M)', 'indigo'),
      customerName: customer,
      readySince: date,
    };
  });

  const tableRows = [...deliveryRows, ...serviceRows, ...projectRows];
  const totalItems = tableRows.length;

  return renderStandardEmailLayout({
    headerTitle: '💰 Reminder: Item Ready to Invoice Pending',
    headerColor: '#1e40af',
    recipientName: user.name || 'Tim Tim Terkait',
    introMessage: `Terdapat <strong>${totalItems} item yang sudah siap ditagih (Ready to Invoice)</strong> namun belum diproses penagihannya selama lebih dari 2 hari. Mohon segera diproses.`,
    tableColumns,
    tableRows,
  });
}

module.exports = { processReadyToInvoiceReminders };

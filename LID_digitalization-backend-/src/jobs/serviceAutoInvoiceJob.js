const cron = require('node-cron');
const prisma = require('../config/prisma');
const { calculateICTFSNetValue } = require('../services/po.service');

/**
 * Service Auto Invoicing Job
 * Runs every hour to check for expired Service Executions and IC TFS records.
 */
const startServiceAutoInvoiceJob = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running Service Auto-Invoice Job...', new Date().toISOString());
    try {
      await processServiceExecutions();
      await processICTFS();
    } catch (err) {
      console.error('[CRON] Service Auto-Invoice Job failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  });

  console.log('[CRON] Service Auto-Invoice job scheduled (hourly)');
};

/**
 * Process expired Service Executions
 */
async function processServiceExecutions() {
  const now = new Date();
  
  const expiredServices = await prisma.serviceExecution.findMany({
    where: {
      targetDate: { lt: now },
      status: { notIn: ['DONE', 'COMPLETED'] },
      invoices: { none: {} }
    },
    include: { purchaseOrder: true, tfs: true }
  });

  for (const service of expiredServices) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Calculate Amount
        let totalAmount = 0;
        let currency = 'IDR';
        
        if (service.purchaseOrder) {
          totalAmount = service.purchaseOrder.netValue;
          currency = service.purchaseOrder.currency;
        } else if (service.tfs) {
          totalAmount = await calculateICTFSNetValue(tx, service.tfs);
        }

        // 2. Generate Invoice Number
        const invoiceNumber = await generateInvoiceNumber(tx);

        // 3. Create Invoice
        await tx.invoice.create({
          data: {
            invoiceNumber,
            sourceType: 'SERVICE',
            serviceId: service.id,
            totalAmount,
            currency,
            status: 'DRAFT',
            remarks: `Auto-generated due to deadline (${service.targetDate?.toLocaleDateString()}) passing.`
          }
        });

        // 3. Update Service Status
        await tx.serviceExecution.update({
          where: { id: service.id },
          data: { 
            status: 'COMPLETED',
            completedDate: now,
            progressNote: (service.progressNote || '') + '\n[System] Automatically completed and invoiced due to deadline.'
          }
        });
      });
      console.log(`[CRON] Auto-invoiced Service Execution: ${service.serviceNumber}`);
    } catch (err) {
      console.error(`[CRON] Failed to auto-invoice Service ${service.serviceNumber}:`, err.message);
    }
  }
}

/**
 * Process expired IC TFS records
 */
async function processICTFS() {
  const now = new Date();
  
  const expiredTFS = await prisma.tFS.findMany({
    where: {
      tfsType: 'IC',
      endDate: { lt: now },
      status: { notIn: ['DONE', 'COMPLETED'] },
      invoices: { none: {} }
    }
  });

  for (const tfs of expiredTFS) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Calculate Value
        const netValue = await calculateICTFSNetValue(tx, tfs);

        // 2. Generate Invoice Number
        const invoiceNumber = await generateInvoiceNumber(tx);

        // 3. Create Invoice
        await tx.invoice.create({
          data: {
            invoiceNumber,
            sourceType: 'SERVICE',
            tfsId: tfs.id,
            totalAmount: netValue,
            currency: 'IDR',
            status: 'DRAFT',
            remarks: `Auto-generated due to IC TFS deadline (${tfs.endDate?.toLocaleDateString()}) passing.`
          }
        });

        // 4. Update TFS Status
        await tx.tFS.update({
          where: { id: tfs.id },
          data: { 
            status: 'DONE',
            completedDate: now
          }
        });
      });
      console.log(`[CRON] Auto-invoiced IC TFS: ${tfs.tfsNumber}`);
    } catch (err) {
      console.error(`[CRON] Failed to auto-invoice TFS ${tfs.tfsNumber}:`, err.message);
    }
  }
}

/**
 * Generate unique invoice number
 */
async function generateInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const latestInvoice = await tx.invoice.findFirst({
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
}

module.exports = { startServiceAutoInvoiceJob };

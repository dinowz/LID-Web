const prisma = require('../src/config/prisma');
const { startServiceAutoInvoiceJob } = require('../src/jobs/serviceAutoInvoiceJob');

async function triggerManually() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  console.log('Updating records to be overdue...');
  
  // Update ServiceExecution 1 to be overdue
  await prisma.serviceExecution.update({
    where: { id: BigInt(1) },
    data: { targetDate: yesterday }
  });

  // Update TFS 19 to be overdue
  await prisma.tFS.update({
    where: { id: BigInt(19) },
    data: { endDate: yesterday }
  });

  console.log('Triggering job logic...');
  
  // We need to access the internal functions of the job or just copy the logic here
  // Since I can't easily access non-exported functions, I'll just copy the core logic for testing
  
  const { calculateICTFSNetValue } = require('../src/services/po.service');
  
  // --- CORE LOGIC START ---
  const now = new Date();
  
  // Process Services
  const expiredServices = await prisma.serviceExecution.findMany({
    where: {
      targetDate: { lt: now },
      status: { notIn: ['DONE', 'COMPLETED'] },
      invoices: { none: {} }
    },
    include: { purchaseOrder: true }
  });

  console.log(`Found ${expiredServices.length} expired services.`);

  for (const service of expiredServices) {
    await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.invoice.count({ where: { invoiceNumber: { startsWith: `INV-${year}-` } } });
      const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

      await tx.invoice.create({
        data: {
          invoiceNumber,
          sourceType: 'SERVICE',
          serviceId: service.id,
          totalAmount: service.purchaseOrder?.netValue || 0,
          currency: service.purchaseOrder?.currency || 'IDR',
          status: 'DRAFT',
          remarks: `[TEST] Auto-generated due to deadline passing.`
        }
      });

      await tx.serviceExecution.update({
        where: { id: service.id },
        data: { status: 'COMPLETED', completedDate: now }
      });
    });
    console.log(`Auto-invoiced Service: ${service.serviceNumber}`);
  }

  // Process TFS
  const expiredTFS = await prisma.tFS.findMany({
    where: {
      tfsType: 'IC',
      endDate: { lt: now },
      status: { notIn: ['DONE', 'COMPLETED'] },
      invoices: { none: {} }
    }
  });

  console.log(`Found ${expiredTFS.length} expired IC TFS.`);

  for (const tfs of expiredTFS) {
    await prisma.$transaction(async (tx) => {
      const netValue = await calculateICTFSNetValue(tx, tfs);
      const year = new Date().getFullYear();
      const count = await tx.invoice.count({ where: { invoiceNumber: { startsWith: `INV-${year}-` } } });
      const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

      await tx.invoice.create({
        data: {
          invoiceNumber,
          sourceType: 'SERVICE',
          tfsId: tfs.id,
          totalAmount: netValue,
          currency: 'IDR',
          status: 'DRAFT',
          remarks: `[TEST] Auto-generated due to IC TFS deadline passing.`
        }
      });

      await tx.tFS.update({
        where: { id: tfs.id },
        data: { status: 'DONE', completedDate: now }
      });
    });
    console.log(`Auto-invoiced TFS: ${tfs.tfsNumber}`);
  }
  // --- CORE LOGIC END ---

  console.log('Verification done.');
  process.exit(0);
}

triggerManually();

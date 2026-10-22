const prisma = require('../src/config/prisma');

async function checkInvoices() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { service: true, tfs: true }
  });
  console.log('Recent Invoices:', JSON.parse(JSON.stringify(invoices, (k, v) => typeof v === 'bigint' ? v.toString() : v)));
  process.exit(0);
}

checkInvoices();

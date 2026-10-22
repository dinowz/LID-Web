const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const invoiceService = require('../src/services/invoice.service');

async function test() {
  try {
    console.log('Testing getReadyToInvoiceList with items...');
    const list = await invoiceService.getReadyToInvoiceList();
    console.log('Success getReadyToInvoiceList:', list.length, 'items');
    
    if (list.length > 0) {
      console.log('Sample item 0 details:', JSON.stringify(list[0].items, null, 2));
    } else {
      console.log('LIST IS EMPTY. Checking DB counts...');
      const deliveryCount = await prisma.delivery.count({ where: { status: { in: ['DELIVERED', 'COMPLETED'] }, invoices: { none: {} } } });
      const serviceCount = await prisma.serviceExecution.count({ where: { status: { in: ['DONE', 'COMPLETED'] }, invoices: { none: {} } } });
      console.log('Deliveries matching:', deliveryCount);
      console.log('Services matching:', serviceCount);
    }
  } catch (err) {
    console.error('ERROR DETECTED:', err);
    console.error('Stack:', err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();

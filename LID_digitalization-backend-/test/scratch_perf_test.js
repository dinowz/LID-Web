const { generateQuotationPdf } = require('../src/services/quotation.service');
const prisma = require('../src/config/prisma');

async function test() {
  // Find a service quotation
  const quo = await prisma.quotation.findFirst({
    where: { inquiry: { requestType: { startsWith: 'SERVICE_' } } }
  });
  
  if (!quo) {
    console.log('No service quotation found to test.');
    return;
  }
  
  console.log(`Testing PDF for Quo ID: ${quo.id}`);

  console.log('--- Run 1 (Cold) ---');
  const s1 = Date.now();
  await generateQuotationPdf(quo.id);
  console.log(`Run 1 time: ${Date.now() - s1}ms`);

  console.log('--- Run 2 (Warm) ---');
  const s2 = Date.now();
  await generateQuotationPdf(quo.id);
  console.log(`Run 2 time: ${Date.now() - s2}ms`);
  
  process.exit(0);
}

test();

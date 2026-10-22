const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const all = await p.inquiry.groupBy({
    by: ['requestType'],
    _count: { _all: true },
  });
  console.log('\n=== Inquiry by requestType ===');
  all.forEach(g => console.log(`  ${g.requestType}: ${g._count._all}`));

  const qAll = await p.quotation.count();
  console.log(`\nQuotation total: ${qAll}`);

  const poAll = await p.purchaseOrder.count();
  console.log(`PurchaseOrder total: ${poAll}`);
}

main().catch(console.error).finally(() => p.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting data migration...');

  const r1 = await prisma.inquiryDetail.updateMany({
    where: {
      serviceSubType: null,
      inquiry: { requestType: 'SERVICE_EXTERNAL_PURCHASE' }
    },
    data: { serviceSubType: 'PURCHASE' }
  });
  console.log('PURCHASE items updated:', r1.count);

  const r2 = await prisma.inquiryDetail.updateMany({
    where: {
      serviceSubType: null,
      inquiry: { requestType: 'SERVICE_EXTERNAL_TFS' }
    },
    data: { serviceSubType: 'TFS' }
  });
  console.log('TFS items updated:', r2.count);

  const r3 = await prisma.inquiry.updateMany({
    where: {
      requestType: { in: ['SERVICE_EXTERNAL_PURCHASE', 'SERVICE_EXTERNAL_TFS'] }
    },
    data: { requestType: 'SERVICE_EXTERNAL' }
  });
  console.log('Inquiries migrated to SERVICE_EXTERNAL:', r3.count);

  console.log('Migration complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

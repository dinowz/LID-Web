const prisma = require('../src/config/prisma');

async function fixRecords() {
  console.log('Fixing ServiceExecution records with incorrect sourceType...');
  
  const records = await prisma.serviceExecution.findMany({
    where: {
      sourceType: 'IC_TFS',
      tfs: {
        tfsType: 'EXTERNAL'
      }
    },
    include: { tfs: true }
  });

  console.log(`Found ${records.length} records to fix.`);

  for (const record of records) {
    await prisma.serviceExecution.update({
      where: { id: record.id },
      data: { sourceType: 'EXTERNAL_TFS' }
    });
    console.log(`Fixed ${record.serviceNumber}: IC_TFS -> EXTERNAL_TFS`);
  }

  process.exit(0);
}

fixRecords();

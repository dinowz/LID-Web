const prisma = require('../src/config/prisma');

async function checkData() {
  const now = new Date();
  
  const se = await prisma.serviceExecution.findMany({
    include: { purchaseOrder: true }
  });
  console.log('Service Executions:', JSON.parse(JSON.stringify(se, (k, v) => typeof v === 'bigint' ? v.toString() : v)));

  const tfs = await prisma.tFS.findMany({
    where: { tfsType: 'IC' }
  });
  console.log('IC TFS:', JSON.parse(JSON.stringify(tfs, (k, v) => typeof v === 'bigint' ? v.toString() : v)));
  
  process.exit(0);
}

checkData();

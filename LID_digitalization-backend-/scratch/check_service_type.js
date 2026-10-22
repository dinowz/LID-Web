const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const executions = await prisma.serviceExecution.findMany({
    include: {
      purchaseOrder: {
        include: {
          quotation: {
            include: {
              inquiry: true
            }
          }
        }
      }
    }
  });

  executions.forEach(ex => {
    console.log(`Execution ${ex.serviceNumber} - Source: ${ex.sourceType}`);
    if (ex.purchaseOrder) {
      console.log(`  -> PO: ${ex.purchaseOrder.poNumber}`);
      console.log(`  -> Inquiry Type: ${ex.purchaseOrder.quotation?.inquiry?.requestType}`);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const personnel = await prisma.masterDivision.findMany();
  for (const p of personnel) {
    const activeTfs = await prisma.tFS.count({
      where: {
        personnelId: p.id,
        status: { notIn: ['DONE', 'CANCELLED'] }
      }
    });
    
    await prisma.masterDivision.update({
      where: { id: p.id },
      data: { isIdle: activeTfs === 0 }
    });
    console.log(`Updated ${p.name} - isIdle: ${activeTfs === 0}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

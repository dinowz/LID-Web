const { PrismaClient } = require('@prisma/client');
const {
  seedUsers,
  seedCodeWords,
  seedCustomers,
  seedServiceCategories,
  seedServiceItems,
  seedSparePartCategories,
  seedSpareParts,
  seedVendors,
  seedDivisions,
  seedForwarders,
  seedSparePartWorkflow,
  seedServiceWorkflow,
  seedProjectWorkflow,
} = require('./seeds');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // === 1. Independent master data (no FK dependencies) ===
  console.log('[1/5] Seeding Users...');
  await seedUsers(prisma);

  console.log('[2/5] Seeding CodeWords & Customers & Vendors & Divisions...');
  await seedCodeWords(prisma);
  await seedCustomers(prisma);
  await seedVendors(prisma);
  await seedDivisions(prisma);
  await seedForwarders(prisma);

  // === 2. Categories first, then items ===
  console.log('[4/5] Seeding Service Categories & Items...');
  await seedServiceCategories(prisma);
  await seedServiceItems(prisma);     // depends on ServiceCategory

  console.log('[5/5] Seeding Spare Part Categories & Items...');
  await seedSparePartCategories(prisma);
  await seedSpareParts(prisma);       // depends on SparePartCategory

  // console.log('\n[6/7] Generating Dummy Spare Part Transactions...');
  // await seedSparePartWorkflow(prisma);

  // console.log('\n[7/8] Generating Dummy Service Transactions...');
  // await seedServiceWorkflow(prisma);

  // console.log('\n[8/8] Generating Dummy Project Transactions...');
  // await seedProjectWorkflow(prisma);

  console.log('\n✅ All seeds completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

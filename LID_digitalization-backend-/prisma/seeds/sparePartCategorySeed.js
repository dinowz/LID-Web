/**
 * Seed MasterSparePartCategory
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedSparePartCategories(prisma) {
  const categories = [
    { categoryCode: 'MEC', categoryName: 'Mechanical Part',       description: 'Mechanical components' },
    { categoryCode: 'ELE', categoryName: 'Electrical Part',       description: 'Electrical components' },
    { categoryCode: 'HYD', categoryName: 'Hydraulic Part',        description: 'Hydraulic system components' },
    { categoryCode: 'INS', categoryName: 'Instrument Part',       description: 'Instrumentation components' },
    { categoryCode: 'WER', categoryName: 'Wear Part',             description: 'Wear and consumable parts' },
    { categoryCode: 'FIL', categoryName: 'Filter & Lubrication',  description: 'Filters, lubricants' },
  ];

  for (const cat of categories) {
    await prisma.masterSparePartCategory.upsert({
      where: { categoryCode: cat.categoryCode },
      update: {},
      create: cat,
    });
  }

  console.log(`  ✔ MasterSparePartCategories seeded (${categories.length} records)`);
}

module.exports = { seedSparePartCategories };

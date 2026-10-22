/**
 * Seed MasterServiceCategory
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedServiceCategories(prisma) {
  const categories = [
    { categoryCode: 'INS', categoryName: 'Inspection',      description: 'Inspection services for mills and equipment' },
    { categoryCode: 'MNT', categoryName: 'Maintenance',     description: 'Preventive and corrective maintenance services' },
    { categoryCode: 'TRB', categoryName: 'Troubleshooting', description: 'On-site troubleshooting and diagnosis services' },
    { categoryCode: 'TRN', categoryName: 'Training',        description: 'Training and knowledge transfer services' },
    { categoryCode: 'COM', categoryName: 'Commissioning',   description: 'Equipment commissioning and startup services' },
    { categoryCode: 'MOD', categoryName: 'Modification',    description: 'Equipment modification and retrofit services' },
  ];

  for (const cat of categories) {
    await prisma.masterServiceCategory.upsert({
      where: { categoryCode: cat.categoryCode },
      update: {},
      create: cat,
    });
  }

  console.log(`  ✔ MasterServiceCategories seeded (${categories.length} records)`);
}

module.exports = { seedServiceCategories };

/**
 * Seed MasterServiceItem
 * Depends on: MasterServiceCategory (must run serviceCategorySeed first)
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedServiceItems(prisma) {
  // Fetch category IDs
  const catIns = await prisma.masterServiceCategory.findUnique({ where: { categoryCode: 'INS' } });
  const catMnt = await prisma.masterServiceCategory.findUnique({ where: { categoryCode: 'MNT' } });
  const catTrb = await prisma.masterServiceCategory.findUnique({ where: { categoryCode: 'TRB' } });
  const catTrn = await prisma.masterServiceCategory.findUnique({ where: { categoryCode: 'TRN' } });
  const catCom = await prisma.masterServiceCategory.findUnique({ where: { categoryCode: 'COM' } });
  const catMod = await prisma.masterServiceCategory.findUnique({ where: { categoryCode: 'MOD' } });

  const items = [
    // Inspection
    { serviceCode: 'SRV-INS-001', serviceName: 'Mill Inspection',                categoryId: catIns.id, uom: 'visit',   standardPrice: 5000000,  leadTimeDays: 3  },
    { serviceCode: 'SRV-INS-002', serviceName: 'Gear Box Inspection',            categoryId: catIns.id, uom: 'visit',   standardPrice: 4500000,  leadTimeDays: 2  },
    { serviceCode: 'SRV-INS-003', serviceName: 'Classifier Inspection',          categoryId: catIns.id, uom: 'visit',   standardPrice: 3500000,  leadTimeDays: 2  },

    // Maintenance
    { serviceCode: 'SRV-MNT-001', serviceName: 'Preventive Maintenance',         categoryId: catMnt.id, uom: 'day',     standardPrice: 7500000,  leadTimeDays: 7  },
    { serviceCode: 'SRV-MNT-002', serviceName: 'Roller Replacement Service',     categoryId: catMnt.id, uom: 'day',     standardPrice: 12000000, leadTimeDays: 14 },
    { serviceCode: 'SRV-MNT-003', serviceName: 'Wear Part Replacement',          categoryId: catMnt.id, uom: 'day',     standardPrice: 8000000,  leadTimeDays: 5  },

    // Troubleshooting
    { serviceCode: 'SRV-TRB-001', serviceName: 'Troubleshooting Visit',          categoryId: catTrb.id, uom: 'visit',   standardPrice: 6000000,  leadTimeDays: 2  },
    { serviceCode: 'SRV-TRB-002', serviceName: 'Vibration Analysis',             categoryId: catTrb.id, uom: 'visit',   standardPrice: 5500000,  leadTimeDays: 3  },

    // Training
    { serviceCode: 'SRV-TRN-001', serviceName: 'Operator Training',              categoryId: catTrn.id, uom: 'session', standardPrice: 10000000, leadTimeDays: 14 },
    { serviceCode: 'SRV-TRN-002', serviceName: 'Maintenance Engineer Training',  categoryId: catTrn.id, uom: 'session', standardPrice: 15000000, leadTimeDays: 21 },

    // Commissioning
    ...(catCom ? [
      { serviceCode: 'SRV-COM-001', serviceName: 'Mill Commissioning',           categoryId: catCom.id, uom: 'day',     standardPrice: 20000000, leadTimeDays: 30 },
      { serviceCode: 'SRV-COM-002', serviceName: 'Hot Commissioning Support',    categoryId: catCom.id, uom: 'day',     standardPrice: 18000000, leadTimeDays: 14 },
    ] : []),

    // Modification
    ...(catMod ? [
      { serviceCode: 'SRV-MOD-001', serviceName: 'Classifier Modification',      categoryId: catMod.id, uom: 'project', standardPrice: 25000000, leadTimeDays: 45 },
      { serviceCode: 'SRV-MOD-002', serviceName: 'Feed System Upgrade',          categoryId: catMod.id, uom: 'project', standardPrice: 30000000, leadTimeDays: 60 },
    ] : []),
  ];

  for (const item of items) {
    await prisma.masterServiceItem.upsert({
      where: { serviceCode: item.serviceCode },
      update: {},
      create: item,
    });
  }

  console.log(`  ✔ MasterServiceItems seeded (${items.length} records)`);
}

module.exports = { seedServiceItems };

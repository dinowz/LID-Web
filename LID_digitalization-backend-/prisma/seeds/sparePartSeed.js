/**
 * Seed MasterSparePart
 * Depends on: MasterSparePartCategory (must run sparePartCategorySeed first)
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedSpareParts(prisma) {
  const catMec  = await prisma.masterSparePartCategory.findUnique({ where: { categoryCode: 'MEC' } });
  const catEle  = await prisma.masterSparePartCategory.findUnique({ where: { categoryCode: 'ELE' } });
  const catHyd  = await prisma.masterSparePartCategory.findUnique({ where: { categoryCode: 'HYD' } });
  const catInst = await prisma.masterSparePartCategory.findUnique({ where: { categoryCode: 'INS' } });
  const catWer  = await prisma.masterSparePartCategory.findUnique({ where: { categoryCode: 'WER' } });
  const catFil  = await prisma.masterSparePartCategory.findUnique({ where: { categoryCode: 'FIL' } });

  const parts = [
    // Mechanical
    { partCode: 'SPP-MEC-001', partName: 'Bearing 6205',            categoryId: catMec.id, brand: 'SKF',            uom: 'pcs',   standardPrice: 200000,   estimatedPrice: 230000,   stockQty: 50,  minStock: 10, warehouseLocation: 'WH-A-01' },
    { partCode: 'SPP-MEC-002', partName: 'Roller Shaft Seal',       categoryId: catMec.id, brand: 'Freudenberg',    uom: 'pcs',   standardPrice: 350000,   estimatedPrice: 400000,   stockQty: 30,  minStock: 5,  warehouseLocation: 'WH-A-02' },
    { partCode: 'SPP-MEC-003', partName: 'Coupling Element',        categoryId: catMec.id, brand: 'Flender',        uom: 'pcs',   standardPrice: 1200000,  estimatedPrice: 1380000,  stockQty: 8,   minStock: 2,  warehouseLocation: 'WH-A-03' },

    // Electrical
    { partCode: 'SPP-ELE-001', partName: 'Pressure Sensor',         categoryId: catEle.id, brand: 'Siemens',        uom: 'unit',  standardPrice: 1500000,  estimatedPrice: 1750000,  stockQty: 15,  minStock: 5,  warehouseLocation: 'WH-B-02' },
    { partCode: 'SPP-ELE-002', partName: 'Proximity Switch',        categoryId: catEle.id, brand: 'IFM',            uom: 'unit',  standardPrice: 800000,   estimatedPrice: 920000,   stockQty: 20,  minStock: 5,  warehouseLocation: 'WH-B-03' },

    // Hydraulic
    { partCode: 'SPP-HYD-001', partName: 'Hydraulic Hose',          categoryId: catHyd.id, brand: 'Gates',          uom: 'meter', standardPrice: 100000,   estimatedPrice: 115000,   stockQty: 100, minStock: 20, warehouseLocation: 'WH-C-03' },
    { partCode: 'SPP-HYD-002', partName: 'Hydraulic Cylinder',      categoryId: catHyd.id, brand: 'Bosch Rexroth',  uom: 'unit',  standardPrice: 15000000, estimatedPrice: 17250000, stockQty: 4,   minStock: 1,  warehouseLocation: 'WH-C-04' },

    // Instrument
    { partCode: 'SPP-INS-001', partName: 'Temperature Transmitter', categoryId: catInst.id, brand: 'Endress+Hauser', uom: 'unit',  standardPrice: 2500000,  estimatedPrice: 2875000,  stockQty: 10,  minStock: 2,  warehouseLocation: 'WH-B-04' },

    // Wear Part
    ...(catWer ? [
      { partCode: 'SPP-WER-001', partName: 'Grinding Roller Tire',  categoryId: catWer.id, brand: 'Loesche',        uom: 'pcs',   standardPrice: 85000000, estimatedPrice: 97750000, stockQty: 2,   minStock: 1,  warehouseLocation: 'WH-D-01' },
      { partCode: 'SPP-WER-002', partName: 'Table Liner Segment',   categoryId: catWer.id, brand: 'Loesche',        uom: 'pcs',   standardPrice: 45000000, estimatedPrice: 51750000, stockQty: 4,   minStock: 2,  warehouseLocation: 'WH-D-02' },
    ] : []),

    // Filter & Lubrication
    ...(catFil ? [
      { partCode: 'SPP-FIL-001', partName: 'Oil Filter Element',    categoryId: catFil.id, brand: 'Mahle',          uom: 'pcs',   standardPrice: 450000,   estimatedPrice: 520000,   stockQty: 25,  minStock: 5,  warehouseLocation: 'WH-E-01' },
      { partCode: 'SPP-FIL-002', partName: 'Gear Oil ISO VG 320',   categoryId: catFil.id, brand: 'Shell',          uom: 'liter', standardPrice: 75000,    estimatedPrice: 86000,    stockQty: 200, minStock: 50, warehouseLocation: 'WH-E-02' },
    ] : []),
  ];

  for (const part of parts) {
    await prisma.masterSparePart.upsert({
      where:  { partCode: part.partCode },
      update: { estimatedPrice: part.estimatedPrice ?? null },
      create: part,
    });
  }

  console.log(`  ✔ MasterSpareParts seeded (${parts.length} records)`);
}

module.exports = { seedSpareParts };

/**
 * Seeder for MasterDivision (Personnel)
 */

const personnelList = [
  { personnel_code: 'P-001', name: 'Ahmad Mubarok', title: 'Senior Mechanical Engineer', division: 'Mechanical', phone: '08123456789', email: 'ahmad.mubarok@example.com' },
  { personnel_code: 'P-002', name: 'Budi Santoso', title: 'Electrical Engineer', division: 'Electrical', phone: '08129876543', email: 'budi.santoso@example.com' },
  { personnel_code: 'P-003', name: 'Citra Kirana', title: 'Instrumentation Specialist', division: 'Instrumentation', phone: '081311112222', email: 'citra.kirana@example.com' },
  { personnel_code: 'P-004', name: 'Danang Prabowo', title: 'Civil Engineer', division: 'Civil Works', phone: '081433334444', email: 'danang.prabowo@example.com' },
  { personnel_code: 'P-005', name: 'Eka Saputra', title: 'Logistics Coordinator', division: 'Logistics', phone: '081555556666', email: 'eka.saputra@example.com' },
];

async function seedDivisions(prisma) {
  console.log('  Seeding Personnel (MasterDivision)...');
  
  for (const item of personnelList) {
    await prisma.masterDivision.upsert({
      where: { personnel_code: item.personnel_code },
      update: {},
      create: {
        personnel_code: item.personnel_code,
        name: item.name,
        title: item.title,
        division: item.division,
        phone: item.phone,
        email: item.email,
        active: true,
      },
    });
  }
  
  console.log(`  ✔ Personnel seeded (${personnelList.length} records)`);
}

module.exports = { seedDivisions };

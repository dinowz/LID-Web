/**
 * Seed Customers
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedCustomers(prisma) {
  const customers = [
    { name: 'PT Semen Indonesia Tbk',      email: 'procurement@semenindonesia.com',   phone: '+62-21-5501234',  address: 'Jl. Veteran, Gresik, Jawa Timur', customerType: 'LOCAL' },
    { name: 'PT Indocement Tunggal Prakarsa', email: 'purchase@indocement.co.id',      phone: '+62-21-5501235',  address: 'Jl. Mayor Oking, Bogor, Jawa Barat', customerType: 'LOCAL' },
    { name: 'PT Holcim Indonesia',          email: 'order@holcim.co.id',              phone: '+62-21-5501236',  address: 'Jl. Jend. Gatot Subroto, Jakarta Selatan', customerType: 'LOCAL' },
    { name: 'PT Conch Cement Indonesia',    email: 'procurement@conch.co.id',         phone: '+62-21-5501237',  address: 'Jl. Industri Raya, Manokwari, Papua Barat', customerType: 'LOCAL' },
    { name: 'PT Solusi Bangun Indonesia',   email: 'purchase@solusibangun.com',       phone: '+62-21-5501238',  address: 'Jl. Raya Narogong KM 7, Bekasi, Jawa Barat', customerType: 'LOCAL' },
    { name: 'PT Semen Baturaja',            email: 'info@semenbaturaja.co.id',        phone: '+62-711-510258',  address: 'Jl. Abikusno Cokrosuyoso, Palembang, Sumatera Selatan', customerType: 'LOCAL' },
    { name: 'Heidelberg Materials AG',      email: 'global.procurement@heidelberg.com', phone: '+49-6221-481-0',  address: 'Berliner Straße 6, 69120 Heidelberg, Germany', customerType: 'FOREIGN' },
    { name: 'Siam City Cement PLC',         email: 'purchase@siamcity.com',           phone: '+66-2797-7000',   address: 'Column Tower, Bangkok, Thailand', customerType: 'FOREIGN' },
  ];

  for (const cust of customers) {
    // Use name-based lookup since there's no unique constraint on name; 
    // findFirst + create pattern
    const existing = await prisma.customer.findFirst({ where: { name: cust.name } });
    if (!existing) {
      await prisma.customer.create({ data: cust });
    }
  }

  console.log(`  ✔ Customers seeded (${customers.length} records)`);
}

module.exports = { seedCustomers };

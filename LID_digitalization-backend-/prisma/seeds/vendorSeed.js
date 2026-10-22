/**
 * Seed Vendors
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedVendors(prisma) {
  const vendors = [
    {
      vendorCode: 'VND-001',
      vendorName: 'PT Schneider Electric Indonesia',
      email: 'sales.id@se.com',
      phone: '+62-21-7501234',
      address: 'Jl. Letjen TB Simatupang, Jakarta Selatan, Indonesia',
      contactPerson: 'Budi Santoso',
      country: 'Indonesia',
      active: true,
    },
    {
      vendorCode: 'VND-002',
      vendorName: 'PT Siemens Indonesia',
      email: 'industry.id@siemens.com',
      phone: '+62-21-27568000',
      address: 'Jl. Jend. Ahmad Yani, Jakarta Timur, Indonesia',
      contactPerson: 'Andi Pratama',
      country: 'Indonesia',
      active: true,
    },
    {
      vendorCode: 'VND-003',
      vendorName: 'PT ABB Sakti Industri',
      email: 'contact.id@abb.com',
      phone: '+62-21-29351000',
      address: 'Jl. Jababeka Raya, Cikarang, Indonesia',
      contactPerson: 'Rina Wulandari',
      country: 'Indonesia',
      active: true,
    },
    {
      vendorCode: 'VND-004',
      vendorName: 'Festo Pte Ltd',
      email: 'sales@festo.com',
      phone: '+65-6265-1234',
      address: 'Boon Lay Way, Singapore',
      contactPerson: 'Michael Tan',
      country: 'Singapore',
      active: true,
    },
    {
      vendorCode: 'VND-005',
      vendorName: 'SMC Corporation',
      email: 'global@smc.com',
      phone: '+81-3-5207-8244',
      address: 'Sotokanda, Chiyoda-ku, Tokyo, Japan',
      contactPerson: 'Kenji Sato',
      country: 'Japan',
      active: true,
    },
    {
      vendorCode: 'VND-006',
      vendorName: 'Phoenix Contact GmbH & Co. KG',
      email: 'info@phoenixcontact.com',
      phone: '+49-5235-300',
      address: 'Flachsmarktstraße 8, Blomberg, Germany',
      contactPerson: 'Anna Müller',
      country: 'Germany',
      active: true,
    },
    {
      vendorCode: 'VND-007',
      vendorName: 'Endress+Hauser Indonesia',
      email: 'info.id@endress.com',
      phone: '+62-21-29578800',
      address: 'Jl. Ciputat Raya, Jakarta Selatan, Indonesia',
      contactPerson: 'Dewi Lestari',
      country: 'Indonesia',
      active: true,
    },
    {
      vendorCode: 'VND-008',
      vendorName: 'Emerson Process Management',
      email: 'apac.sales@emerson.com',
      phone: '+65-6777-8211',
      address: '1 Pandan Crescent, Singapore',
      contactPerson: 'Jason Lim',
      country: 'Singapore',
      active: true,
    },
  ];

  for (const vendor of vendors) {
    await prisma.vendor.upsert({
      where: { vendorCode: vendor.vendorCode },
      update: {
        vendorName: vendor.vendorName,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        contactPerson: vendor.contactPerson,
        country: vendor.country,
        active: vendor.active,
      },
      create: vendor,
    });
  }

  console.log(`  ✔ Vendors seeded (${vendors.length} records)`);
}

module.exports = { seedVendors };
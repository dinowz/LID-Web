/**
 * Forwarder Seeder
 */
const seedForwarders = async (prisma) => {
  const forwarders = [
    {
      name: 'DHL Global Forwarding',
      supplierNumber: 'SUP-FW-001',
      country: 'Germany',
      email: 'logistics@dhl.com',
      phone: '+49 228 182-0',
      active: true
    },
    {
      name: 'FedEx Express Indonesia',
      supplierNumber: 'SUP-FW-002',
      country: 'USA',
      email: 'support@fedex.co.id',
      phone: '+62 21 7590 8800',
      active: true
    },
    {
      name: 'JNE / PT. Jalur Nugraha Ekakurir',
      supplierNumber: 'SUP-FW-003',
      country: 'Indonesia',
      email: 'customercare@jne.co.id',
      phone: '+62 21 2927 8888',
      active: true
    },
    {
      name: 'PT. Siba Surya',
      supplierNumber: 'SUP-FW-004',
      country: 'Indonesia',
      email: 'info@sibasurya.com',
      phone: '+62 24 658 4460',
      active: true
    },
    {
      name: 'PT. Samudera Indonesia Tbk',
      supplierNumber: 'SUP-FW-005',
      country: 'Indonesia',
      email: 'corp.sec@samudera.id',
      phone: '+62 21 548 0088',
      active: true
    },
    {
      name: 'Kuehne + Nagel',
      supplierNumber: 'SUP-FW-006',
      country: 'Switzerland',
      email: 'info.jakarta@kuehne-nagel.com',
      phone: '+62 21 252 5050',
      active: true
    }
  ];

  console.log('  Upserting forwarders...');
  
  for (const fw of forwarders) {
    await prisma.forwarder.upsert({
      where: { id: forwarders.indexOf(fw) + 1 }, // Using index + 1 as ID for stable seeding
      update: fw,
      create: {
        ...fw,
        id: forwarders.indexOf(fw) + 1
      },
    });
  }
  
  console.log(`  ✅ ${forwarders.length} Forwarders seeded.`);
};

module.exports = { seedForwarders };

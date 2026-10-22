const bcrypt = require('bcrypt');

/**
 * Seed Users — one user per role
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedUsers(prisma) {
  const users = [
    { email: 'admin@loesche.com', name: 'Super Admin', password: 'admin123', role: 'ADMIN' },
    { email: 'service@loesche.com', name: 'Service Rep', password: 'service123', role: 'SERVICE' },
    { email: 'sparepart@loesche.com', name: 'Spare Part Rep', password: 'sparepart123', role: 'SPARE_PART' },
    { email: 'procurement@loesche.com', name: 'Procurement Rep', password: 'procurement123', role: 'PROCUREMENT' },
    { email: 'logistic@loesche.com', name: 'Logistic Rep', password: 'logistic123', role: 'LOGISTIC' },
    { email: 'finance@loesche.com', name: 'Finance Rep', password: 'finance123', role: 'FINANCE' },
    { email: 'project@loesche.com', name: 'Project Rep', password: 'project123', role: 'PROJECT' },
    { email: 'tfs@loesche.com', name: 'TFS Rep', password: 'tfs123', role: 'TFS' },
    { email: 'management@loesche.com', name: 'Management Rep', password: 'management123', role: 'MANAGEMENT' },
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        status: 'ACTIVE',
      },
      create: {
        email: u.email,
        name: u.name,
        password: hashed,
        roles: [u.role],
        status: 'ACTIVE',
      },
    });
  }

  console.log(`  ✔ Users seeded (${users.length} records)`);
}

module.exports = { seedUsers };

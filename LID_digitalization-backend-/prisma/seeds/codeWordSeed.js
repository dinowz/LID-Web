/**
 * Seed CodeWords
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedCodeWords(prisma) {
  const codeWords = [
    { code: 'CW-LMR',   description: 'Loesche Mill Repair' },
    { code: 'CW-LMS',   description: 'Loesche Mill Service' },
    { code: 'CW-LMI',   description: 'Loesche Mill Inspection' },
    { code: 'CW-LMT',   description: 'Loesche Mill Training' },
    { code: 'CW-LMP',   description: 'Loesche Mill Parts' },
    { code: 'CW-LMU',   description: 'Loesche Mill Upgrade' },
    { code: 'CW-LMO',   description: 'Loesche Mill O&M' },
    { code: 'CW-GEN',   description: 'General Request' },
  ];

  for (const cw of codeWords) {
    await prisma.codeWord.upsert({
      where: { code: cw.code },
      update: {},
      create: cw,
    });
  }

  console.log(`  ✔ CodeWords seeded (${codeWords.length} records)`);
}

module.exports = { seedCodeWords };

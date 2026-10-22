const { processQuotationReminders } = require('../src/services/quotationReminder.service');
const prisma = require('../src/config/prisma');
require('dotenv').config();

async function testQuotationReminder() {
  console.log('--- Memulai Test Reminder Quotation ---');

  // 1. Cari satu quotation DRAFT untuk dijadikan bahan test
  const targetQuotation = await prisma.quotation.findFirst({
    where: { status: 'DRAFT' }
  });

  if (!targetQuotation) {
    console.log('❌ Tidak ada quotation berstatus DRAFT di database. Silakan buat quotation baru dulu di UI.');
    return;
  }

  console.log(`Menggunakan Quotation: ${targetQuotation.quotationNumber}`);

  // 2. Manipulasi tanggal agar dianggap "idle" (> 3 hari)
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

  await prisma.quotation.update({
    where: { id: targetQuotation.id },
    data: {
      lastActivityAt: fourDaysAgo,
      reminderCount: 0 // Reset agar bisa dikirim lagi
    }
  });

  console.log('✅ Berhasil memanipulasi tanggal lastActivityAt menjadi 4 hari yang lalu.');

  // 3. Jalankan fungsi reminder
  try {
    console.log('Sedang mencoba mengirim email...');
    const result = await processQuotationReminders();
    
    if (result.sent) {
      console.log('🚀 SUKSES: Email reminder quotation berhasil dikirim!');
      console.log('Detail:', result);
    } else if (result.skipped) {
      console.log('ℹ️ SKIPPED: Tidak ada quotation yang memenuhi syarat (cek kriteria query).');
    } else {
      console.log('❌ GAGAL:', result.reason);
    }
  } catch (error) {
    console.error('❌ ERROR saat menjalankan reminder quotation:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testQuotationReminder();

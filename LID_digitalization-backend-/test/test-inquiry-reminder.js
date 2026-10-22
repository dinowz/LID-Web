const { processInquiryReminders } = require('../src/services/inquiryReminder.service');
const prisma = require('../src/config/prisma');
require('dotenv').config();

async function testReminder() {
  console.log('--- Memulai Test Reminder Inquiry ---');

  // 1. Cari satu inquiry OPEN untuk dijadikan bahan test
  const targetInquiry = await prisma.inquiry.findFirst({
    where: { statusCode: 'OPEN' }
  });

  if (!targetInquiry) {
    console.log('❌ Tidak ada inquiry berstatus OPEN di database. Silakan buat inquiry baru dulu di UI.');
    return;
  }

  console.log(`Menggunakan Inquiry: ${targetInquiry.inquiryNumber}`);

  // 2. Manipulasi tanggal agar dianggap "idle" (> 2 hari)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  await prisma.inquiry.update({
    where: { id: targetInquiry.id },
    data: {
      lastActivityAt: threeDaysAgo,
      reminderCount: 0 // Reset agar bisa dikirim lagi
    }
  });

  console.log('✅ Berhasil memanipulasi tanggal lastActivityAt menjadi 3 hari yang lalu.');

  // 3. Jalankan fungsi reminder
  try {
    console.log('Sedang mencoba mengirim email...');
    const result = await processInquiryReminders();
    
    if (result.sent) {
      console.log('🚀 SUKSES: Email reminder berhasil dikirim!');
      console.log('Detail:', result);
    } else if (result.skipped) {
      console.log('ℹ️ SKIPPED: Tidak ada inquiry yang memenuhi syarat (cek kriteria query).');
    } else {
      console.log('❌ GAGAL:', result.reason);
    }
  } catch (error) {
    console.error('❌ ERROR saat menjalankan reminder:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testReminder();

const { processPOReminders } = require('../src/services/poReminder.service');
const prisma = require('../src/config/prisma');
require('dotenv').config();

async function testPOReminder() {
  console.log('--- Memulai Test Reminder Purchase Order ---');

  // 1. Cari satu PO berstatus WAITING_OC untuk dijadikan bahan test
  const targetPO = await prisma.purchaseOrder.findFirst({
    where: { status: 'WAITING_OC' }
  });

  if (!targetPO) {
    console.log('❌ Tidak ada PO berstatus WAITING_OC di database. Silakan buat/ubah PO ke WAITING_OC dulu di UI.');
    return;
  }

  console.log(`Menggunakan PO: ${targetPO.poNumber || targetPO.id}`);

  // 2. Manipulasi tanggal agar dianggap "idle" (> 3 hari)
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

  await prisma.purchaseOrder.update({
    where: { id: targetPO.id },
    data: {
      lastActivityAt: fourDaysAgo,
      reminderCount: 0 // Reset agar bisa dikirim lagi
    }
  });

  console.log('✅ Berhasil memanipulasi tanggal lastActivityAt menjadi 4 hari yang lalu.');

  // 3. Jalankan fungsi reminder
  try {
    console.log('Sedang mencoba mengirim email...');
    const result = await processPOReminders();
    
    if (result.sent) {
      console.log('🚀 SUKSES: Email reminder PO berhasil dikirim!');
      console.log('Detail:', result);
    } else if (result.skipped) {
      console.log('ℹ️ SKIPPED: Tidak ada PO yang memenuhi syarat (cek kriteria query).');
    } else {
      console.log('❌ GAGAL:', result.reason);
    }
  } catch (error) {
    console.error('❌ ERROR saat menjalankan reminder PO:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPOReminder();

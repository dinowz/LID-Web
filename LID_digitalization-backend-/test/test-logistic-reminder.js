const { processDeliveryReminders } = require('../src/services/deliveryReminder.service');
const prisma = require('../config/prisma');
require('dotenv').config();

async function testLogisticReminder() {
  console.log('--- Memulai Test Reminder Logistic Delivery ---');

  // 1. Cari satu Delivery berstatus REVIEW_LOGISTIC atau PACKED
  const targetDel = await prisma.delivery.findFirst({
    where: { status: { in: ['REVIEW_LOGISTIC', 'PACKED'] } }
  });

  if (targetDel) {
    console.log(`Menggunakan Delivery: ${targetDel.deliveryNumber}`);
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    await prisma.delivery.update({
      where: { id: targetDel.id },
      data: {
        updatedAt: fourDaysAgo,
        logisticReminderCount: 0
      }
    });
    console.log('✅ Berhasil memanipulasi tanggal updatedAt Delivery.');
  } else {
    console.log('ℹ️ Tidak ditemukan Delivery berstatus REVIEW_LOGISTIC/PACKED untuk testing.');
  }

  // 2. Jalankan fungsi reminder
  try {
    console.log('Sedang mencoba mengirim email ke tim LOGISTIC...');
    const result = await processDeliveryReminders();
    
    if (result.sent) {
      console.log('🚀 SUKSES: Email reminder Logistic berhasil dikirim!');
      console.log('Detail:', result);
    } else if (result.skipped) {
      console.log('ℹ️ SKIPPED: Tidak ada data yang memenuhi syarat.');
    } else {
      console.log('❌ GAGAL:', result.error || result.reason);
    }
  } catch (error) {
    console.error('❌ ERROR saat menjalankan reminder:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLogisticReminder();

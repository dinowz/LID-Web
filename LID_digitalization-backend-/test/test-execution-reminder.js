const { processExecutionReminders } = require('../src/services/executionReminder.service');
const prisma = require('../config/prisma');
require('dotenv').config();

async function testExecutionReminder() {
  console.log('--- Memulai Test Reminder Execution Progress ---');

  // 1. Cari satu Service Execution berstatus PENDING/IN_PROGRESS
  const targetSvc = await prisma.serviceExecution.findFirst({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }
  });

  if (targetSvc) {
    console.log(`Menggunakan Service: ${targetSvc.serviceNumber}`);
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    await prisma.serviceExecution.update({
      where: { id: targetSvc.id },
      data: {
        lastActivityAt: fourDaysAgo,
        reminderCount: 0
      }
    });
    console.log('✅ Berhasil memanipulasi tanggal Service Execution.');
  }

  // 2. Jalankan fungsi reminder
  try {
    console.log('Sedang mencoba mengirim email...');
    const result = await processExecutionReminders();
    
    if (result.sent) {
      console.log('🚀 SUKSES: Email reminder Execution berhasil dikirim!');
      console.log('Detail:', result);
    } else if (result.skipped) {
      console.log('ℹ️ SKIPPED: Tidak ada data yang memenuhi syarat.');
    } else {
      console.log('❌ GAGAL:', result.reason);
    }
  } catch (error) {
    console.error('❌ ERROR saat menjalankan reminder:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testExecutionReminder();

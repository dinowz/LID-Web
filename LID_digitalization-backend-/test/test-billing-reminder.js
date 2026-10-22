const { processReadyToInvoiceReminders } = require('../src/services/readyToInvoiceReminder.service');
const prisma = require('../config/prisma');
require('dotenv').config();

async function testBillingReminder() {
  console.log('--- Memulai Test Reminder Ready to Invoice (Billing) ---');

  // 1. Cari satu Delivery berstatus DELIVERED/COMPLETED tanpa Invoice
  const targetDel = await prisma.delivery.findFirst({
    where: { 
      status: { in: ['DELIVERED', 'COMPLETED'] },
      invoices: { none: {} }
    }
  });

  if (targetDel) {
    console.log(`Menggunakan Delivery: ${targetDel.deliveryNumber}`);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await prisma.delivery.update({
      where: { id: targetDel.id },
      data: {
        actualDeliveryDate: threeDaysAgo,
        invoiceReminderCount: 0
      }
    });
    console.log('✅ Berhasil memanipulasi tanggal actualDeliveryDate.');
  } else {
    console.log('ℹ️ Tidak ditemukan Delivery yang siap ditagih untuk testing.');
  }

  // 2. Jalankan fungsi reminder
  try {
    console.log('Sedang mencoba mengirim email ke tim FINANCE...');
    const result = await processReadyToInvoiceReminders();
    
    if (result.sent) {
      console.log('🚀 SUKSES: Email reminder Billing berhasil dikirim!');
      console.log('Detail:', result);
    } else if (result.skipped) {
      console.log('ℹ️ SKIPPED: Tidak ada data yang memenuhi syarat (sudah dikirim atau belum 2 hari).');
    } else {
      console.log('❌ GAGAL:', result.error || result.reason);
    }
  } catch (error) {
    console.error('❌ ERROR saat menjalankan reminder:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testBillingReminder();

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
require('dotenv').config();

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const transactionTables = [
  { name: 'TFS (Schedules)', model: 'tFS' },
  { name: 'Project Execution History', model: 'projectExecutionHistory' },
  { name: 'Project Execution', model: 'projectExecution' },
  { name: 'Service Execution History', model: 'serviceExecutionHistory' },
  { name: 'Service Execution', model: 'serviceExecution' },
  { name: 'Delivery Status History', model: 'deliveryStatusHistory' },
  { name: 'Delivery Item', model: 'deliveryItem' },
  { name: 'Delivery Note', model: 'delivery' },
  { name: 'Invoice Status History', model: 'invoiceStatusHistory' },
  { name: 'Invoice Detail', model: 'invoiceDetail' },
  { name: 'Invoice', model: 'invoice' },
  { name: 'PO Status History', model: 'purchaseOrderStatusHistory' },
  { name: 'PO Detail', model: 'purchaseOrderDetail' },
  { name: 'PO Spare Part Extension', model: 'purchaseOrderSparePart' },
  { name: 'PO Service Extension', model: 'purchaseOrderService' },
  { name: 'PO Project Extension', model: 'purchaseOrderProject' },
  { name: 'Purchase Order', model: 'purchaseOrder' },
  { name: 'Quotation Status History', model: 'quotationStatusHistory' },
  { name: 'Quotation Detail', model: 'quotationDetail' },
  { name: 'Quotation Spare Part Extension', model: 'quotationSparePart' },
  { name: 'Quotation Service Extension', model: 'quotationService' },
  { name: 'Quotation Project Extension', model: 'quotationProject' },
  { name: 'Quotation', model: 'quotation' },
  { name: 'Inquiry Status History', model: 'inquiryStatusHistory' },
  { name: 'Inquiry Detail', model: 'inquiryDetail' },
  { name: 'Inquiry', model: 'inquiry' }
];

async function main() {
  console.log('\n======================================================');
  console.log('⚠️  PERINGATAN: SCRIPT PEMBERSIHAN DATA TRANSAKSI  ⚠️');
  console.log('======================================================');
  console.log('Script ini akan MENGHAPUS SEMUA DATA TRANSAKSI di bawah ini:');
  transactionTables.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name}`);
  });
  console.log('\nData Master (User, Customer, Vendor, Master Service,');
  console.log('Master Sparepart, Master Division/Personnel) TIDAK akan dihapus.');
  console.log('------------------------------------------------------');
  console.log('Tindakan ini bersifat PERMANEN dan TIDAK BISA DIBATALKAN.');
  console.log('------------------------------------------------------');

  rl.question('Ketik "HAPUS-TRANSAKSI" untuk mengonfirmasi tindakan ini: ', async (answer) => {
    if (answer !== 'HAPUS-TRANSAKSI') {
      console.log('❌ Konfirmasi salah. Pembatalan eksekusi.');
      rl.close();
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('\nStarting database cleanup...');
    try {
      // Execute in sequential transaction or sequential blocks to handle FK constraints
      for (const table of transactionTables) {
        console.log(`🧹 Cleaning ${table.name}...`);
        const result = await prisma[table.model].deleteMany({});
        console.log(`   └─ Deleted ${result.count} rows.`);
      }

      console.log('\n✅ Database cleanup completed successfully!');
    } catch (error) {
      console.error('\n❌ Error during cleanup:', error);
    } finally {
      rl.close();
      await prisma.$disconnect();
    }
  });
}

main();

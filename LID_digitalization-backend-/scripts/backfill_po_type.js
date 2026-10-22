/**
 * Script Backfill Tahap 2: Refactor PO Schema
 * 
 * Yang dilakukan:
 * 1. Isi po_type di semua PO existing berdasarkan relasi quotation/tfs
 * 2. INSERT ke purchase_order_sparepart dari field lama di purchase_order (untuk PO tipe SPARE_PART)
 * 3. INSERT ke purchase_order_service (kosong) untuk PO tipe SERVICE
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Backfill PO Schema Refactor - Tahap 2 ===\n');

  // -------------------------------------------------------
  // STEP 1: Tentukan po_type untuk setiap PO existing
  // -------------------------------------------------------
  console.log('[1/3] Menentukan po_type untuk semua PO...');

  const allPOs = await prisma.purchaseOrder.findMany({
    include: {
      quotation: {
        include: { inquiry: { select: { requestType: true } } }
      },
      tfs: { select: { id: true } }
    }
  });

  console.log(`      Ditemukan ${allPOs.length} PO existing`);

  let countSP = 0, countService = 0, countProject = 0;

  for (const po of allPOs) {
    let poType = 'SPARE_PART'; // default

    if (po.tfsId) {
      poType = 'SERVICE';
    } else if (po.quotation?.inquiry?.requestType?.startsWith('SERVICE_')) {
      poType = 'SERVICE';
    } else if (po.quotation?.inquiry?.requestType?.startsWith('PROJECT_')) {
      poType = 'PROJECT';
    }

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { poType }
    });

    if (poType === 'SPARE_PART') countSP++;
    else if (poType === 'SERVICE') countService++;
    else countProject++;
  }

  console.log(`      ✅ Selesai: SPARE_PART=${countSP}, SERVICE=${countService}, PROJECT=${countProject}\n`);

  // -------------------------------------------------------
  // STEP 2: INSERT ke purchase_order_sparepart untuk PO tipe SPARE_PART
  // -------------------------------------------------------
  console.log('[2/3] Backfill data ke purchase_order_sparepart...');

  const sparepartPOs = await prisma.purchaseOrder.findMany({
    where: { poType: 'SPARE_PART' }
  });

  let insertedSP = 0, skippedSP = 0;
  for (const po of sparepartPOs) {
    // Cek apakah sudah ada record ekstensi (hindari duplikat)
    const existing = await prisma.purchaseOrderSparepart.findUnique({
      where: { poId: po.id }
    });

    if (existing) {
      skippedSP++;
      continue;
    }

    await prisma.purchaseOrderSparepart.create({
      data: {
        poId:                    po.id,
        vendorId:                po.vendorId ?? null,
        shipToPartyName:         po.shipToPartyName ?? null,
        expectedTo:              po.expectedTo ?? null,
        internalPoUploadedAt:    po.internalPoUploadedAt ?? null,
        poSentToVendorAt:        po.poSentToVendorAt ?? null,
        ocReceivedAt:            po.ocReceivedAt ?? null,
        estimatedProductionDone: po.estimatedProductionDone ?? null,
        estimatedReadyToShip:    po.estimatedReadyToShip ?? null,
        internalPoFile:          po.internalPoFile ?? null,
        ocFile:                  po.ocFile ?? null,
        vendorInvoiceFile:       po.vendorInvoiceFile ?? null,
        vendorPackingListFile:   po.vendorPackingListFile ?? null,
      }
    });
    insertedSP++;
  }

  console.log(`      ✅ Selesai: ${insertedSP} inserted, ${skippedSP} skipped (sudah ada)\n`);

  // -------------------------------------------------------
  // STEP 3: INSERT ke purchase_order_service untuk PO tipe SERVICE
  // -------------------------------------------------------
  console.log('[3/3] Backfill data ke purchase_order_service...');

  const servicePOs = await prisma.purchaseOrder.findMany({
    where: { poType: 'SERVICE' }
  });

  let insertedSvc = 0, skippedSvc = 0;
  for (const po of servicePOs) {
    const existing = await prisma.purchaseOrderService.findUnique({
      where: { poId: po.id }
    });

    if (existing) {
      skippedSvc++;
      continue;
    }

    await prisma.purchaseOrderService.create({
      data: { poId: po.id }
    });
    insertedSvc++;
  }

  console.log(`      ✅ Selesai: ${insertedSvc} inserted, ${skippedSvc} skipped (sudah ada)\n`);

  // -------------------------------------------------------
  // VERIFIKASI AKHIR
  // -------------------------------------------------------
  console.log('=== Verifikasi Akhir ===');
  const totalPO = await prisma.purchaseOrder.count();
  const totalSPExt = await prisma.purchaseOrderSparepart.count();
  const totalSvcExt = await prisma.purchaseOrderService.count();
  const poWithNoType = await prisma.purchaseOrder.count({ where: { poType: null } });

  console.log(`Total PO          : ${totalPO}`);
  console.log(`PO Sparepart Ext  : ${totalSPExt}`);
  console.log(`PO Service Ext    : ${totalSvcExt}`);
  console.log(`PO tanpa po_type  : ${poWithNoType} (harus 0)`);

  if (poWithNoType > 0) {
    console.warn('\n⚠️  Ada PO yang tidak berhasil di-set po_type! Periksa manual.');
  } else {
    console.log('\n✅ Backfill selesai. Semua PO sudah memiliki po_type dan data ekstensi.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error saat backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

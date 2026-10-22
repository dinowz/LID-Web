/**
 * Skrip Migrasi & Remediasi Sumber Data Nominal Purchase Order (PO)
 *
 * Latar Belakang:
 * Pada versi sebelumnya, saat PO di-generate dari Quotation (khususnya tipe SPARE_PART),
 * item breakdown mengambil `totalPrice` (yang pada Quotation Sparepart berisi harga modal vendor),
 * bukan `sellPriceCalc` (harga jual/penawaran riil setelah margin & diskon item).
 * Begitu pula pada split PO, pemecahan `netValue` menghitung dari item modal tersebut.
 *
 * Skrip ini melakukan:
 * 1. Menyelaraskan harga per item pada `purchase_order_detail`:
 *    - PO Sparepart: menggunakan `quotation_detail.sellPriceCalc` (dan unitPrice = sellPriceCalc / qty).
 *    - PO Service / Project: menggunakan `quotation_detail.totalPrice` & unitPrice.
 * 2. Menyelaraskan header `purchase_order.netValue`:
 *    - PO Tunggal: sama dengan `quotation.totalPrice`.
 *    - PO Pecahan (Split): sama dengan total penjumlahan `purchase_order_detail.totalPrice` (yang sudah terkoreksi).
 * 3. Menghitung ulang `purchase_order.dpAmount` jika PO menggunakan Down Payment.
 *
 * Cara Menjalankan:
 * cd backend
 * node scripts/remediate_po_nominals.js
 * atau
 * npm run migrate:po-nominals
 */

const prisma = require('../src/config/prisma');

async function remediate() {
  console.log('=== STARTING PO NOMINALS REMEDIATION ===\n');

  // 1. Fetch all POs
  const pos = await prisma.purchaseOrder.findMany({
    include: {
      quotation: {
        include: {
          details: true,
          sparePartDetail: true,
          inquiry: {
            include: { customer: true },
          },
        },
      },
      details: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${pos.length} Purchase Orders to inspect.\n`);

  // Count POs per quotation to identify single vs split POs
  const quotationPoCounts = {};
  for (const po of pos) {
    if (po.quotationId) {
      const qId = String(po.quotationId);
      quotationPoCounts[qId] = (quotationPoCounts[qId] || 0) + 1;
    }
  }

  let totalItemsUpdated = 0;
  let totalHeadersUpdated = 0;

  for (const po of pos) {
    const isSplit = po.quotationId && quotationPoCounts[String(po.quotationId)] > 1;
    console.log(
      `Checking PO ID ${po.id} (PO Number: ${po.poNumber || '-'}, Type: ${po.poType}, Split: ${isSplit ? 'YES' : 'NO'})...`
    );

    // Step A: Remediate details
    let itemsUpdated = 0;
    const updatedDetails = [];

    for (const d of po.details) {
      let targetTotalPrice = Number(d.totalPrice || 0);
      let targetUnitPrice = Number(d.unitPrice || 0);

      if (d.quotationDetailId && po.quotation?.details) {
        const qd = po.quotation.details.find((q) => String(q.id) === String(d.quotationDetailId));
        if (qd) {
          const qty = Number(d.qty || 1);
          if (po.poType === 'SPARE_PART') {
            const sellPrice = Number(qd.sellPriceCalc || 0);
            if (sellPrice > 0) {
              targetTotalPrice = Math.round(sellPrice);
              targetUnitPrice = qty > 0 ? Math.round(sellPrice / qty) : Math.round(sellPrice);
            } else {
              targetTotalPrice = Number(qd.totalPrice || 0);
              targetUnitPrice = Number(qd.unitPrice || 0);
            }
          } else {
            // SERVICE / PROJECT
            targetTotalPrice = Number(qd.totalPrice || 0);
            targetUnitPrice = Number(qd.unitPrice || 0);
          }
        }
      }

      if (targetTotalPrice !== Number(d.totalPrice) || targetUnitPrice !== Number(d.unitPrice)) {
        console.log(`  Updating Item ID ${d.id}:`);
        console.log(`    TotalPrice: ${d.totalPrice} -> ${targetTotalPrice}`);
        console.log(`    UnitPrice:  ${d.unitPrice} -> ${targetUnitPrice}`);

        await prisma.purchaseOrderDetail.update({
          where: { id: d.id },
          data: {
            totalPrice: targetTotalPrice,
            unitPrice: targetUnitPrice,
          },
        });
        itemsUpdated++;
        totalItemsUpdated++;
      }

      updatedDetails.push({
        ...d,
        totalPrice: targetTotalPrice,
        unitPrice: targetUnitPrice,
      });
    }

    // Step B: Remediate Header netValue, DP & Currency
    const isLocal = po.quotation?.inquiry?.customer?.customerType !== 'FOREIGN';
    const targetCurrency = isLocal ? 'IDR' : (po.quotation?.currency || po.currency || 'IDR');

    let targetNetValue = Number(po.netValue || 0);
    if (!isSplit && po.quotation) {
      // Single PO: Net value must equal quotation.totalPrice
      targetNetValue = Number(po.quotation.totalPrice || 0);
    } else if (isSplit) {
      // Split PO: Net value is sum of its items (now correctly valued with sellPriceCalc)
      targetNetValue = updatedDetails.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    }

    const hasDp = Boolean(po.hasDp);
    const dpPercent = Number(po.dpPercent || 0);
    const targetDpAmount = hasDp && dpPercent > 0 ? Math.round((targetNetValue * dpPercent) / 100) : 0;

    const currencyNeedsUpdate = po.currency !== targetCurrency;
    const poNeedsUpdate =
      targetNetValue !== Number(po.netValue) ||
      (hasDp && targetDpAmount !== Number(po.dpAmount)) ||
      currencyNeedsUpdate;

    if (poNeedsUpdate) {
      console.log(`  Updating PO Header:`);
      if (currencyNeedsUpdate) {
        console.log(`    currency: ${po.currency} -> ${targetCurrency}`);
      }
      if (targetNetValue !== Number(po.netValue)) {
        console.log(`    netValue: ${po.netValue} -> ${targetNetValue}`);
      }
      if (hasDp && targetDpAmount !== Number(po.dpAmount)) {
        console.log(`    dpAmount: ${po.dpAmount} -> ${targetDpAmount}`);
      }

      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          netValue: targetNetValue,
          currency: targetCurrency,
          ...(hasDp ? { dpAmount: targetDpAmount } : {}),
        },
      });
      totalHeadersUpdated++;
    }

    console.log(
      `  Summary for PO ${po.id}: ${itemsUpdated} items updated, header ${poNeedsUpdate ? 'UPDATED' : 'OK'}.\n`
    );
  }

  console.log(`=== REMEDIATION COMPLETED ===`);
  console.log(`Total items updated: ${totalItemsUpdated}`);
  console.log(`Total headers updated: ${totalHeadersUpdated}`);

  await prisma.$disconnect();
}

remediate().catch((err) => {
  console.error('Remediation error:', err);
  process.exit(1);
});

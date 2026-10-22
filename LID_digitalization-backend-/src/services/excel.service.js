const ExcelJS = require('exceljs');
const path = require('path');
const prisma = require('../config/prisma');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/inquiry/templateExportInquiry.xlsx'
);

const LOGO_PATH = path.join(
  __dirname,
  '../assets/logo3.png'
);

// Excel row item dimulai dari row 18
const ITEM_START_ROW = 18;
const TEMPLATE_LAST_ITEM_ROW = 26;

/**
 * Format tanggal Indonesia
 */
const formatDateId = (dateValue) => {
  if (!dateValue) return '-';

  return new Date(dateValue).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Sanitasi nama file supaya aman
 */
const sanitizeFilename = (value) => {
  return String(value || 'export')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_');
};

/**
 * Helper untuk menyalin style (font, alignment, border, fill, format) dari satu cell ke cell lain
 */
const copyCellStyle = (sourceCell, targetCell) => {
  if (sourceCell.font) targetCell.font = JSON.parse(JSON.stringify(sourceCell.font));
  if (sourceCell.alignment) targetCell.alignment = JSON.parse(JSON.stringify(sourceCell.alignment));
  if (sourceCell.border) targetCell.border = JSON.parse(JSON.stringify(sourceCell.border));
  if (sourceCell.fill) targetCell.fill = JSON.parse(JSON.stringify(sourceCell.fill));
  if (sourceCell.numFmt) targetCell.numFmt = sourceCell.numFmt;
};

/**
 * Generate Excel file for Inquiry using ExcelJS natively
 */
const generateInquiryExcel = async (inquiryId) => {
  if (!inquiryId) {
    throw new Error('Inquiry ID is required');
  }

  const inquiry = await prisma.inquiry.findUnique({
    where: {
      id: BigInt(inquiryId),
    },
    include: {
      customer: true,
      codeWord: true,
      details: {
        orderBy: {
          lineNo: 'asc',
        },
      },
    },
  });

  if (!inquiry) {
    throw new Error('Inquiry not found');
  }

  // Load template menggunakan ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('Worksheet not found in template');
  }

  // =========================
  // 1. Fill Header Inquiry
  // =========================
  const inquiryDate = formatDateId(inquiry.inquiryDate);

  // Subject (Cell E2)
  const cellE2 = worksheet.getCell('E2');
  cellE2.value = inquiry.subject || '-';

  // General Description (Cell B10)
  const cellB10 = worksheet.getCell('B10');
  cellB10.value = `General Description: ${inquiry.description || '-'}`;

  // Header Details
  worksheet.getCell('D6').value = inquiry.codeWord?.projectNo || '-';
  worksheet.getCell('F6').value = inquiry.codeWord?.code || '-';
  worksheet.getCell('K6').value = inquiry.inquiryNumber || '-';

  worksheet.getCell('D7').value = inquiry.codeWord?.millType || '-';
  worksheet.getCell('F7').value = inquiry.customer?.name || '-';
  worksheet.getCell('K7').value = inquiryDate;

  worksheet.getCell('D9').value = inquiry.sourceCode || '-';

  // =========================
  // 2. Fill Detail Items
  // =========================
  const details = inquiry.details || [];
  const templateSourceRow = worksheet.getRow(TEMPLATE_LAST_ITEM_ROW);

  details.forEach((item, index) => {
    const excelRowNumber = ITEM_START_ROW + index;
    const row = worksheet.getRow(excelRowNumber);

    // Jika item melebihi row template bawaan (row 26), copy format & masukan merge
    if (excelRowNumber > TEMPLATE_LAST_ITEM_ROW) {
      // Copy style cell per col dari row 26
      for (let col = 2; col <= 12; col++) { // B (2) - L (12)
        const sourceCell = templateSourceRow.getCell(col);
        const targetCell = row.getCell(col);
        copyCellStyle(sourceCell, targetCell);
      }
      row.height = templateSourceRow.height;

      // Unik Merge untuk row baru
      worksheet.mergeCells(`C${excelRowNumber}:E${excelRowNumber}`);
      worksheet.mergeCells(`F${excelRowNumber}:G${excelRowNumber}`);
      worksheet.mergeCells(`J${excelRowNumber}:L${excelRowNumber}`);
    }

    const qty = Number(item.qty || 0);

    // B = No
    worksheet.getCell(`B${excelRowNumber}`).value = index + 1;

    // C-E = Item Description
    worksheet.getCell(`C${excelRowNumber}`).value =
      item.requestedItemName || item.requestDescription || '-';

    // F-G = Part Number
    worksheet.getCell(`F${excelRowNumber}`).value =
      item.requestedPartNumber || '-';

    // H = Qty
    worksheet.getCell(`H${excelRowNumber}`).value = qty;

    // I = UoM
    worksheet.getCell(`I${excelRowNumber}`).value = item.uom || '-';

    // J-L = Item Notes
    worksheet.getCell(`J${excelRowNumber}`).value =
      item.requestDescription || item.notes || '-';
  });

  // =========================
  // 4. Generate Final Buffer
  // =========================
  const finalBuffer = await workbook.xlsx.writeBuffer();

  const safeInquiryNumber = sanitizeFilename(inquiry.inquiryNumber || inquiryId);
  const filename = `Inquiry_${safeInquiryNumber}_Items.xlsx`;

  return {
    buffer: finalBuffer,
    filename,
  };
};

module.exports = {
  generateInquiryExcel,
};
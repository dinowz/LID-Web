const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib'); // <-- Tambahkan ini

let browserInstance = null;
const imageCache = new Map();

/**
 * Simple template renderer: replaces {{key}} placeholders with values.
 * Supports nested objects via dot notation: {{inquiry.customer.name}}
 * Supports {{#each items}}...{{/each}} for arrays.
 */
function renderTemplate(template, data) {
  // Handle {{#each array}} ... {{/each}} blocks
  template = template.replace(
    /\{\{#each ([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (match, key, block) => {
      const arr = getNestedValue(data, key.trim());
      if (!Array.isArray(arr)) return '';
      return arr.map((item, index) => {
        let rendered = block;

        // Process nested {{#if}} blocks using the item context
        rendered = rendered.replace(
          /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
          (m, ifKey, ifBlock) => {
            const cleanKey = ifKey.trim().replace(/^this\./, '');
            const val = getNestedValue(item, cleanKey) || getNestedValue(data, cleanKey);
            return val ? ifBlock : '';
          }
        );

        // Replace {{this.xxx}} and {{xxx}} within each block
        rendered = rendered.replace(/\{\{this\.([^}]+)\}\}/g, (m, k) => {
          const val = getNestedValue(item, k.trim());
          return val !== undefined && val !== null ? String(val) : '';
        });
        rendered = rendered.replace(/\{\{@index\}\}/g, String(index));
        rendered = rendered.replace(/\{\{@indexPlusOne\}\}/g, String(index + 1));
        // Also support bare {{key}} within each block referencing item properties
        rendered = rendered.replace(/\{\{([^#/][^}]*)\}\}/g, (m, k) => {
          const val = getNestedValue(item, k.trim());
          if (val !== undefined && val !== null) return String(val);
          // Fallback to parent context
          const parentVal = getNestedValue(data, k.trim());
          return parentVal !== undefined && parentVal !== null ? String(parentVal) : '';
        });
        return rendered;
      }).join('');
    }
  );

  // Handle {{#if variable}} ... {{/if}} blocks (simple truthy check)
  template = template.replace(
    /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, key, block) => {
      const val = getNestedValue(data, key.trim());
      return val ? block : '';
    }
  );

  // Replace remaining {{key}} placeholders
  template = template.replace(/\{\{([^#/][^}]*)\}\}/g, (match, key) => {
    const val = getNestedValue(data, key.trim());
    return val !== undefined && val !== null ? String(val) : '';
  });

  return template;
}

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, obj);
}

function getBase64Image(filePath) {
  if (imageCache.has(filePath)) {
    return imageCache.get(filePath);
  }
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
    imageCache.set(filePath, base64);
    return base64;
  }
  return '';
}

/**
 * Generates a PDF buffer from an HTML template file.
 * @param {string} templatePath - Absolute path to the HTML template file.
 * @param {object} data - Data to inject into the template.
 * @returns {Buffer} - PDF buffer.
 */
async function generatePdfFromTemplate(templatePath, data, options = {}) {
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');

  const enrichedData = {
    ...data,
    logoBase64: getBase64Image(path.join(__dirname, '../assets/logo.png')),
    logo3Base64: getBase64Image(path.join(__dirname, '../assets/logo3.png')),
    coverBase64: getBase64Image(path.join(__dirname, '../assets/cover.png')),
    headerBase64: getBase64Image(path.join(__dirname, '../assets/header.png')),
    footerBase64: getBase64Image(path.join(__dirname, '../assets/footer.png')),
  };

  const renderedHtml = renderTemplate(templateHtml, enrichedData);

  let page;
  try {
    // === Inisialisasi Browser (Sama seperti sebelumnya) ===
    if (browserInstance && !browserInstance.isConnected()) {
      try { await browserInstance.close(); } catch (e) { }
      browserInstance = null;
    }

    if (!browserInstance) {
      const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      };
      // Only set executablePath on Linux (production server)
      if (process.platform === 'linux') {
        launchOptions.executablePath = '/usr/bin/chromium-browser';
      }
      browserInstance = await puppeteer.launch(launchOptions);
    }
    page = await browserInstance.newPage();
  } catch (error) {
    console.error('Puppeteer browser error, retrying...', error);
    try { if (browserInstance) await browserInstance.close(); } catch (e) { }
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    page = await browserInstance.newPage();
  }

  try {
    await page.setContent(renderedHtml, { waitUntil: 'load' });

    if (options.singlePage) {
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: options.margin || { top: 0, right: 0, bottom: 0, left: 0 }
      });
      return pdfBuffer;
    }

    // ==========================================
    // 1. RENDER HALAMAN 1 (COVER) TANPA HEADER
    // ==========================================
    const coverPdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false, // Matikan Header/Footer
      pageRanges: '1',            // HANYA HALAMAN 1
      margin: { top: 0, right: 0, bottom: 0, left: 0 } // Bebas margin untuk cover
    });

    // ==========================================
    // 2. RENDER HALAMAN 2 SAMPAI AKHIR (DENGAN HEADER)
    // ==========================================
    const contentPdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,  // Nyalakan Header/Footer
      pageRanges: '2-',           // MULAI HALAMAN 2 SAMPAI SELESAI
      headerTemplate: options.headerTemplate || `
        <div style="width: 100%; padding: 4mm 16mm 0 16mm; box-sizing: border-box; display: flex; align-items: center; justify-content: center;">
          <img src="${enrichedData.headerBase64}" style="width: 100%; height: auto; display: block;" />
        </div>
      `,
      footerTemplate: options.footerTemplate || `
        <div style="width: 100%; font-family: Arial, Helvetica, sans-serif; padding: 0 16mm 0 22mm; box-sizing: border-box;">
          <div style="border-top: 1px solid #e0e0e0; width: 100%; padding-top: 4mm; display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="font-size: 8pt; color: #666; padding-left: 2mm;">
              The copyright for this document and all appendices is reserved by LOESCHE GmbH
            </div>
            <div style="font-size: 10.5pt; color: #777; letter-spacing: 2px;">
              <span class="pageNumber"></span> | Page
            </div>
          </div>
        </div>
      `,
      margin: options.margin !== undefined ? options.margin : {
        top: '25mm',
        right: '15mm',
        bottom: '25mm',
        left: '15mm',
      },
    });

    // ==========================================
    // 3. GABUNGKAN KEDUA PDF MENGGUNAKAN pdf-lib
    // ==========================================
    const mergedPdf = await PDFDocument.create();

    // Load buffer yang baru dibuat
    const coverPdfDoc = await PDFDocument.load(coverPdfBuffer);
    const contentPdfDoc = await PDFDocument.load(contentPdfBuffer);

    // Salin Halaman 1 (Cover) ke dokumen final
    const [coverPage] = await mergedPdf.copyPages(coverPdfDoc, [0]);
    mergedPdf.addPage(coverPage);

    // Salin Halaman 2 dst (Konten) ke dokumen final
    const contentPages = await mergedPdf.copyPages(contentPdfDoc, contentPdfDoc.getPageIndices());
    contentPages.forEach((p) => {
      mergedPdf.addPage(p);
    });

    // Save dan return sebagai buffer Node.js
    const finalPdfBytes = await mergedPdf.save();
    return Buffer.from(finalPdfBytes);

  } finally {
    await page.close();
  }
}

module.exports = { generatePdfFromTemplate, renderTemplate };

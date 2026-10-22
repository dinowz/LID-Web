/**
 * ============================================================
 * SMTP Email Testing Script — LIND Digitalization
 * ============================================================
 *
 * Digunakan untuk mendiagnosa masalah konfigurasi SMTP sebelum
 * sistem reminder otomatis berjalan.
 *
 * Cara Menjalankan:
 *   node src/scripts/test-email.js
 *   node src/scripts/test-email.js target@contoh.com
 *
 * ============================================================
 */

// Load .env dari root backend
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const nodemailer = require('nodemailer');

// ── Konfigurasi dari .env ──────────────────────────────────────
const SMTP_HOST   = process.env.SMTP_HOST   || 'smtp.gmail.com';
const SMTP_PORT   = parseInt(process.env.SMTP_PORT || '465');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER   = process.env.SMTP_USER;
const SMTP_PASS   = process.env.SMTP_PASS;

// Ambil email tujuan dari argumen CLI. Bisa dipisah koma atau spasi (multiple args)
// Contoh: node test-email.js email1@test.com email2@test.com
// Atau  : node test-email.js "email1@test.com, email2@test.com"
const cliArgs = process.argv.slice(2);
const rawTarget = cliArgs.length > 0 ? cliArgs.join(',') : (SMTP_USER || '');

// Split koma, trim, dan filter email yang tidak kosong
const TARGET_EMAILS = rawTarget
  .split(',')
  .map(e => e.trim())
  .filter(e => e.length > 0);

// ── Helper logger ──────────────────────────────────────────────
const log   = (msg) => console.log(`  ✅  ${msg}`);
const warn  = (msg) => console.warn(`  ⚠️   ${msg}`);
const error = (msg) => console.error(`  ❌  ${msg}`);
const info  = (msg) => console.log(`  ℹ️   ${msg}`);
const divider = () => console.log('─'.repeat(60));

// ── Step 1: Tampilkan Konfigurasi (Aman) ──────────────────────
const printConfig = () => {
  divider();
  console.log('📧  SMTP Configuration');
  divider();
  info(`Host      : ${SMTP_HOST}`);
  info(`Port      : ${SMTP_PORT}`);
  info(`Secure    : ${SMTP_SECURE} (SSL/TLS aktif jika true)`);
  info(`User      : ${SMTP_USER || '(TIDAK DISET)'}`);
  info(`Password  : ${SMTP_PASS ? '***' + SMTP_PASS.slice(-4) : '(TIDAK DISET)'}`);
  info(`Target (${TARGET_EMAILS.length}) : ${TARGET_EMAILS.join(', ') || '(TIDAK DISET)'}`);
  divider();
};

// ── Step 2: Validator .env ─────────────────────────────────────
const validateConfig = () => {
  let valid = true;

  if (!SMTP_HOST) { error('SMTP_HOST tidak diset di .env!'); valid = false; }
  if (!SMTP_PORT) { error('SMTP_PORT tidak diset di .env!'); valid = false; }
  if (!SMTP_USER) { error('SMTP_USER tidak diset di .env!'); valid = false; }
  if (!SMTP_PASS) { error('SMTP_PASS tidak diset di .env!'); valid = false; }
  if (TARGET_EMAILS.length === 0) { error('Email tujuan tidak diketahui!'); valid = false; }

  // Peringatan mismatch Port vs Secure
  if (SMTP_PORT === 465 && !SMTP_SECURE) {
    warn('Port 465 biasanya memerlukan SMTP_SECURE=true (SSL). Pastikan konfigurasi sudah sesuai.');
  }
  if (SMTP_PORT === 587 && SMTP_SECURE) {
    warn('Port 587 biasanya menggunakan STARTTLS (SMTP_SECURE=false). Pastikan konfigurasi sudah sesuai.');
  }

  return valid;
};

// ── Step 3: Verifikasi Koneksi ─────────────────────────────────
const verifyConnection = async (transporter) => {
  console.log('\n🔌  Memverifikasi koneksi SMTP...');
  try {
    await transporter.verify();
    log('Koneksi SMTP berhasil! Server bisa dihubungi dan login berhasil.');
    return true;
  } catch (err) {
    error(`Verifikasi SMTP GAGAL: ${err.message}`);
    
    // Petunjuk tambahan berdasarkan pesan error
    if (err.message.includes('Invalid login') || err.message.includes('Username and Password not accepted')) {
      warn('Kemungkinan penyebab: Password salah atau bukan App Password Gmail.');
      warn('Buat App Password di: https://myaccount.google.com/apppasswords');
    }
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
      warn('Kemungkinan penyebab: Port diblokir firewall atau host/port salah.');
    }
    if (err.message.includes('self signed certificate') || err.message.includes('certificate')) {
      warn('Kemungkinan penyebab: Masalah sertifikat SSL/TLS. Coba ubah SMTP_SECURE=false untuk tes.');
    }
    return false;
  }
};

// Helper delay / sleep ms
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Step 4: Kirim Email Uji Coba ──────────────────────────────
const sendTestEmail = async (transporter) => {
  const timestamp = new Date().toLocaleString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const DELAY_MS = 5000;
  let successCount = 0;
  let failCount = 0;

  console.log(`\n📨  Memulai pengiriman ke ${TARGET_EMAILS.length} penerima dengan jeda ${DELAY_MS / 1000} detik per email...\n`);

  for (let i = 0; i < TARGET_EMAILS.length; i++) {
    const recipient = TARGET_EMAILS[i];
    
    // Berikan delay jika bukan email pertama
    if (i > 0) {
      info(`Menunggu delay ${DELAY_MS / 1000} detik sebelum mengirim ke ${recipient}...`);
      await sleep(DELAY_MS);
    }

    const mailOptions = {
      from: `"LIND System Test" <${SMTP_USER}>`,
      to: recipient,
      subject: `[TEST ${i + 1}/${TARGET_EMAILS.length}] SMTP Email Test — ${new Date().toISOString()}`,
      text: `Ini adalah email uji coba dari LIND Digitalization System.\n\nDikirim pada: ${timestamp}\nDari: ${SMTP_USER}\nKe: ${recipient}\n\nJika Anda menerima email ini, konfigurasi SMTP sudah benar!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8" /></head>
        <body style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, sans-serif;">
          <div style="max-width:600px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <div style="background:#16a34a; padding:24px 32px;">
              <h2 style="margin:0; color:#fff; font-size:20px;">✅ SMTP Test Berhasil! (${i + 1}/${TARGET_EMAILS.length})</h2>
              <p style="margin:6px 0 0; color:#bbf7d0; font-size:14px;">LIND Digitalization — Konfigurasi Email</p>
            </div>
            <div style="padding:24px 32px;">
              <p style="color:#374151; font-size:15px;">
                Email uji coba ini dikirim dari <strong>LIND Digitalization System</strong>.<br/><br/>
                Jika Anda menerima email ini, artinya konfigurasi SMTP sudah benar dan sistem reminder siap digunakan.
              </p>
              <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:16px;">
                <tr style="background:#f0fdf4;">
                  <td style="padding:8px 12px; font-weight:bold; color:#166534; width:40%;">Waktu Kirim</td>
                  <td style="padding:8px 12px; color:#374151;">${timestamp}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px; font-weight:bold; color:#166534;">Dari (SMTP_USER)</td>
                  <td style="padding:8px 12px; color:#374151;">${SMTP_USER}</td>
                </tr>
                <tr style="background:#f0fdf4;">
                  <td style="padding:8px 12px; font-weight:bold; color:#166534;">Kepada</td>
                  <td style="padding:8px 12px; color:#374151;">${recipient}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px; font-weight:bold; color:#166534;">Host : Port</td>
                  <td style="padding:8px 12px; color:#374151;">${SMTP_HOST} : ${SMTP_PORT} (Secure: ${SMTP_SECURE})</td>
                </tr>
              </table>
              <p style="margin:24px 0 0; color:#6b7280; font-size:12px; border-top:1px solid #e5e7eb; padding-top:16px;">
                Email ini dikirim otomatis melalui script testing LIND Digitalization System.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log(`📩  [${i + 1}/${TARGET_EMAILS.length}] Mengirim email ke: ${recipient} ...`);
    try {
      const sendInfo = await transporter.sendMail(mailOptions);
      log(`Berhasil dikirim ke ${recipient} (Message ID: ${sendInfo.messageId})`);
      successCount++;
    } catch (err) {
      error(`Gagal mengirim ke ${recipient}: ${err.message}`);
      if (err.responseCode) {
        warn(`SMTP Response Code: ${err.responseCode}`);
      }
      failCount++;
    }
  }

  console.log(`\n📊  Ringkasan Pengiriman: ${successCount} Berhasil, ${failCount} Gagal`);
  return failCount === 0;
};

// ── Main ───────────────────────────────────────────────────────
const main = async () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     LIND Digitalization — SMTP Email Testing Script      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Step 1: Tampilkan konfigurasi
  printConfig();

  // Step 2: Validasi konfigurasi
  console.log('\n🔍  Memvalidasi konfigurasi .env...');
  const isConfigValid = validateConfig();
  if (!isConfigValid) {
    error('\nKonfigurasi tidak lengkap. Harap isi variabel .env yang diperlukan terlebih dahulu.');
    process.exit(1);
  }
  log('Semua variabel konfigurasi sudah terisi.');

  // Step 3: Buat transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Step 4: Verifikasi koneksi
  const isConnected = await verifyConnection(transporter);
  if (!isConnected) {
    error('\nGagal terhubung ke server SMTP. Testing dihentikan.');
    process.exit(1);
  }

  // Step 5: Kirim email test
  const isSent = await sendTestEmail(transporter);

  divider();
  if (isSent) {
    log('TESTING SELESAI — Email berhasil terkirim! Konfigurasi SMTP sudah benar.');
    log(`Periksa inbox email: ${TARGET_EMAILS.join(', ')}`);
  } else {
    error('TESTING SELESAI — Email GAGAL dikirim. Periksa log error di atas.');
  }
  divider();
  console.log('');

  process.exit(isSent ? 0 : 1);
};

main().catch((err) => {
  console.error('\n[FATAL] Unhandled Error:', err.message);
  process.exit(1);
});

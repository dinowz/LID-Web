const cron = require('node-cron');
const { processReadyToInvoiceReminders } = require('../services/readyToInvoiceReminder.service');

const startReadyToInvoiceReminderJob = () => {
  // Jadwalkan setiap hari jam 10:00 WIB
  // 0 10 * * *
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Running Ready to Invoice Reminder at 10:00 WIB...');
    try {
      const result = await processReadyToInvoiceReminders();
      if (result.skipped) {
        console.log('[CRON] Ready to Invoice Reminder: no idle items, email skipped.');
      } else if (result.sent) {
        console.log(`[CRON] Ready to Invoice Reminder: email sent to ${result.recipientCount} finance users.`);
      }
    } catch (error) {
      console.error('[CRON] Ready to Invoice Reminder failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
  console.log('[CRON] Ready to Invoice Reminder job scheduled (daily at 10:00 WIB)');
};

module.exports = { startReadyToInvoiceReminderJob };

const cron = require('node-cron');
const { processQuotationReminders } = require('../services/quotationReminder.service');

/**
 * Quotation Reminder Job
 * Runs every day at 09:15 AM WIB (15 min after inquiry reminder).
 * Sends a single consolidated email per Sales user listing all DRAFT quotations
 * that have had no activity for more than 3 days.
 */
const startQuotationReminderJob = () => {
  cron.schedule('15 9 * * *', async () => {
    console.log('[CRON] Running Quotation Reminder Job...', new Date().toISOString());
    try {
      const result = await processQuotationReminders();
      if (result.skipped) {
        console.log('[CRON] Quotation Reminder: no idle quotations, email skipped.');
      } else if (result.sent) {
        console.log(`[CRON] Quotation Reminder: email sent to ${result.sentCount}/${result.totalUsers} users.`);
      } else {
        console.warn('[CRON] Quotation Reminder: email not sent —', result.reason);
      }
    } catch (err) {
      console.error('[CRON] Quotation Reminder Job failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });

  console.log('[CRON] Quotation Reminder job scheduled (daily at 09:15 WIB)');
};

module.exports = { startQuotationReminderJob };

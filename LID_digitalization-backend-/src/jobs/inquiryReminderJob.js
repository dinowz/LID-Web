const cron = require('node-cron');
const { processInquiryReminders } = require('../services/inquiryReminder.service');

/**
 * Inquiry Reminder Job
 * Runs every day at 09:00 AM WIB.
 * Sends a single consolidated email to the Sales team listing all OPEN inquiries
 * that have had no activity for more than 2 days (and have not been reminded yet).
 */
const startInquiryReminderJob = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running Inquiry Reminder Job...', new Date().toISOString());
    try {
      const result = await processInquiryReminders();
      if (result.skipped) {
        console.log('[CRON] Inquiry Reminder: no idle inquiries, email skipped.');
      } else if (result.sent) {
        console.log(`[CRON] Inquiry Reminder: email sent, ${result.count} inquiries reported.`);
      } else {
        console.warn('[CRON] Inquiry Reminder: email not sent —', result.reason);
      }
    } catch (err) {
      console.error('[CRON] Inquiry Reminder Job failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });

  console.log('[CRON] Inquiry Reminder job scheduled (daily at 09:00 WIB)');
};

module.exports = { startInquiryReminderJob };

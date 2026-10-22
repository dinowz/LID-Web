const cron = require('node-cron');
const { processPOReminders } = require('../services/poReminder.service');

/**
 * Purchase Order Reminder Job
 * Runs every day at 09:30 AM WIB.
 * Sends a single consolidated email per Procurement user listing all WAITING_OC POs
 * that have had no activity for more than 3 days.
 */
const startPOReminderJob = () => {
  cron.schedule('30 9 * * *', async () => {
    console.log('[CRON] Running PO Reminder Job...', new Date().toISOString());
    try {
      const result = await processPOReminders();
      if (result.skipped) {
        console.log('[CRON] PO Reminder: no idle POs, email skipped.');
      } else if (result.sent) {
        console.log(`[CRON] PO Reminder: email sent to ${result.sentCount}/${result.totalUsers} users.`);
      } else {
        console.warn('[CRON] PO Reminder: email not sent —', result.reason);
      }
    } catch (err) {
      console.error('[CRON] PO Reminder Job failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });

  console.log('[CRON] PO Reminder job scheduled (daily at 09:30 WIB)');
};

module.exports = { startPOReminderJob };

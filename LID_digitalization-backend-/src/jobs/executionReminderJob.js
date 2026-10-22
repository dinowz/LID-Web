const cron = require('node-cron');
const { processExecutionReminders } = require('../services/executionReminder.service');

const startExecutionReminderJob = () => {
  // Jadwalkan setiap hari jam 09:45 WIB
  // 45 9 * * *
  cron.schedule('45 9 * * *', async () => {
    try {
      const result = await processExecutionReminders();
      if (result.skipped) {
        console.log('[CRON] Execution Progress Reminder: no idle executions, email skipped.');
      } else if (result.sent) {
        console.log(`[CRON] Execution Progress Reminder: email sent, ${result.count} executions reported.`);
      } else {
        console.warn('[CRON] Execution Progress Reminder: email not sent —', result.reason);
      }
    } catch (error) {
      console.error('[CRON] Execution Progress Reminder failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
  console.log('[CRON] Execution Progress Reminder job scheduled (daily at 09:45 WIB)');
};

module.exports = { startExecutionReminderJob };

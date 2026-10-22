const cron = require('node-cron');
const { processTFSReminders } = require('../services/tfsReminder.service');

/**
 * Schedule TFS Reminder to run every day at 09:00 WIB (09:00 AM)
 * Cron expression: '0 9 * * *'
 */
const startTFSReminderJob = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Starting Daily TFS Overdue Reminder Job at 09:00 WIB...');
    try {
      await processTFSReminders();
    } catch (error) {
      console.error('[CRON] Error executing Daily TFS Reminder Job:', error);
    }
  });

  console.log('[CRON] Daily TFS Reminder Job scheduled (09:00 WIB).');
};

module.exports = { startTFSReminderJob };

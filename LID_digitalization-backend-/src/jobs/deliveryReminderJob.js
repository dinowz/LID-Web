const cron = require('node-cron');
const { processDeliveryReminders } = require('../services/deliveryReminder.service');

const startDeliveryReminderJob = () => {
  // Jadwalkan setiap hari jam 09:15 WIB
  // 15 9 * * *
  cron.schedule('15 10 * * *', async () => {
    console.log('[CRON] Running Logistic Delivery Reminder at 09:15 WIB...');
    try {
      const result = await processDeliveryReminders();
      if (result.skipped) {
        console.log('[CRON] Logistic Delivery Reminder: no idle items, email skipped.');
      } else if (result.sent) {
        console.log(`[CRON] Logistic Delivery Reminder: email sent to ${result.recipientCount} logistic users.`);
      }
    } catch (error) {
      console.error('[CRON] Logistic Delivery Reminder failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
  console.log('[CRON] Logistic Delivery Reminder job scheduled (daily at 10:15 WIB)');
};

module.exports = { startDeliveryReminderJob };

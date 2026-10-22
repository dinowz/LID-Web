const cron = require('node-cron');
const { checkOverdueDeliveries } = require('../services/delivery.service');

/**
 * Delivery Overdue Job
 * Runs every day at 08:00 AM server time.
 * Sends email notifications for deliveries that have passed their target delivery date (H+1).
 */
const startDeliveryOverdueJob = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running delivery overdue check...', new Date().toISOString());
    try {
      const results = await checkOverdueDeliveries();
      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'error').length;
      console.log(`[CRON] Overdue check complete. Sent: ${sent}, Failed: ${failed}`);
    } catch (err) {
      console.error('[CRON] Overdue check failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  });

  console.log('[CRON] Delivery overdue job scheduled (daily at 08:00 WIB)');
};

module.exports = { startDeliveryOverdueJob };

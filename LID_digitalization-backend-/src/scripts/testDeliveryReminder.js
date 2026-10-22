require('dotenv').config();
const {
  findIdleDeliveries,
  getLogisticUsers,
  processDeliveryReminders,
} = require('../services/deliveryReminder.service');

const isForceMode = process.argv.includes('--force');

async function runTestSimulation() {
  console.log('====================================================');
  console.log('        DELIVERY REMINDER TEST SIMULATOR            ');
  console.log('====================================================');
  console.log(`MODE: ${isForceMode ? '⚡ FORCE / REAL RUN (Sending Email & Updating DB)' : '🔍 DRY RUN (Simulation Only - No Emails / DB Edits)'}`);
  console.log(`TIME: ${new Date().toLocaleString('id-ID')}`);
  console.log('----------------------------------------------------\n');

  try {
    if (!isForceMode) {
      console.log('1. Checking Idle Delivery Items (REVIEW_LOGISTIC & PACKED)...');
      const idleDeliveries = await findIdleDeliveries();
      console.log(`   Found: ${idleDeliveries.length} idle delivery item(s)\n`);

      if (idleDeliveries.length > 0) {
        console.log('   [Idle Deliveries List]:');
        idleDeliveries.forEach((d, index) => {
          const lastDate = d.updatedAt || d.createdAt;
          const daysIdle = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          const customerName = d.purchaseOrder?.quotation?.inquiry?.customer?.name || '-';
          console.log(
            `   ${index + 1}. Delivery No: ${d.deliveryNumber} | Status: ${d.status} | Customer: ${customerName} | ReminderCount: ${d.logisticReminderCount}/3 | Days Idle: ${daysIdle} day(s)`
          );
        });
      } else {
        console.log('   No REVIEW_LOGISTIC or PACKED delivery items meet the idle reminder criteria.');
      }

      console.log('\n2. Checking Target Recipients (Logistic Users)...');
      const recipients = await getLogisticUsers();
      console.log(`   Found: ${recipients.length} active logistic user(s)\n`);

      if (recipients.length > 0) {
        console.log('   [Recipients List]:');
        recipients.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        });
      } else {
        console.log('   No active users found with role LOGISTIC.');
      }

      console.log('\n----------------------------------------------------');
      console.log('💡 TIP: To actually send emails and update DB, run:');
      console.log('   node src/scripts/testDeliveryReminder.js --force');
      console.log('====================================================');
    } else {
      console.log('🚀 Triggering processDeliveryReminders()...\n');
      const result = await processDeliveryReminders();
      console.log('\n----------------------------------------------------');
      console.log('EXECUTION RESULT:', JSON.stringify(result, null, 2));
      console.log('====================================================');
    }
  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } process.exit(0);
}

runTestSimulation();

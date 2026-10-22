require('dotenv').config();
const {
  findIdlePOs,
  getProcurementUsers,
  processPOReminders,
} = require('../services/poReminder.service');

const isForceMode = process.argv.includes('--force');

async function runTestSimulation() {
  console.log('====================================================');
  console.log('           PO REMINDER TEST SIMULATOR               ');
  console.log('====================================================');
  console.log(`MODE: ${isForceMode ? '⚡ FORCE / REAL RUN (Sending Email & Updating DB)' : '🔍 DRY RUN (Simulation Only - No Emails / DB Edits)'}`);
  console.log(`TIME: ${new Date().toLocaleString('id-ID')}`);
  console.log('----------------------------------------------------\n');

  try {
    if (!isForceMode) {
      console.log('1. Checking Idle POs (REVIEW, WAITING_OC & READY)...');
      const idlePOs = await findIdlePOs();
      console.log(`   Found: ${idlePOs.length} idle PO(s)\n`);

      if (idlePOs.length > 0) {
        console.log('   [Idle POs List]:');
        idlePOs.forEach((po, index) => {
          const lastDate = po.lastActivityAt || po.createdAt;
          const daysIdle = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          const priceStr = parseFloat(po.netValue || 0).toLocaleString('id-ID');
          console.log(
            `   ${index + 1}. No: ${po.poNumber || 'Draft'} | Status: ${po.status} | Customer: ${po.quotation?.inquiry?.customer?.name || '-'} | NetValue: ${po.currency} ${priceStr} | ReminderCount: ${po.reminderCount}/3 | Days Idle: ${daysIdle} day(s)`
          );
        });
      } else {
        console.log('   No REVIEW, WAITING_OC, or READY POs meet the idle reminder criteria.');
      }

      console.log('\n2. Checking Target Recipients (Procurement Users)...');
      const procUsers = await getProcurementUsers();
      console.log(`   Found: ${procUsers.length} active procurement user(s)\n`);

      if (procUsers.length > 0) {
        console.log('   [Recipients List]:');
        procUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        });
      } else {
        console.log('   No active users found with role PROCUREMENT.');
      }

      console.log('\n----------------------------------------------------');
      console.log('💡 TIP: To actually send emails and update DB, run:');
      console.log('   node src/scripts/testPOReminder.js --force');
      console.log('====================================================');
    } else {
      console.log('🚀 Triggering processPOReminders()...\n');
      const result = await processPOReminders();
      console.log('\n----------------------------------------------------');
      console.log('EXECUTION RESULT:', JSON.stringify(result, null, 2));
      console.log('====================================================');
    }
  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } process.exit(0);
}

runTestSimulation();

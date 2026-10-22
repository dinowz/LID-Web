require('dotenv').config();
const {
  findOverdueTFSAssignments,
  getTFSUsers,
  processTFSReminders,
} = require('../services/tfsReminder.service');

const isForceMode = process.argv.includes('--force');

async function runTestSimulation() {
  console.log('====================================================');
  console.log('         TFS OVERDUE REMINDER TEST SIMULATOR        ');
  console.log('====================================================');
  console.log(`MODE: ${isForceMode ? '⚡ FORCE / REAL RUN (Sending Email & Updating DB)' : '🔍 DRY RUN (Simulation Only - No Emails / DB Edits)'}`);
  console.log(`TIME: ${new Date().toLocaleString('id-ID')}`);
  console.log('----------------------------------------------------\n');

  try {
    if (!isForceMode) {
      console.log('1. Checking Overdue TFS Assignments...');
      const overdueTFSList = await findOverdueTFSAssignments();
      console.log(`   Found: ${overdueTFSList.length} overdue TFS assignment(s)\n`);

      if (overdueTFSList.length > 0) {
        console.log('   [Overdue TFS List]:');
        overdueTFSList.forEach((item, index) => {
          const endDateStr = item.endDate ? new Date(item.endDate).toLocaleDateString('id-ID') : '-';
          const daysOverdue = item.endDate
            ? Math.floor((Date.now() - new Date(item.endDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          const customerName =
            item.serviceExecution?.purchaseOrder?.quotation?.inquiry?.customer?.name ||
            item.serviceExecution?.inquiry?.customer?.name ||
            item.serviceExecution?.quotation?.inquiry?.customer?.name ||
            '-';

          console.log(
            `   ${index + 1}. No: ${item.tfsNumber} | Title: ${item.title || '-'} | Personnel: ${item.personnel?.name || '-'} | Customer: ${customerName} | EndDate: ${endDateStr} (+${daysOverdue} days overdue)`
          );
        });
      } else {
        console.log('   No TFS assignments meet the overdue end date criteria.');
      }

      console.log('\n2. Checking Target Recipients (TFS & SERVICE Users)...');
      const recipients = await getTFSUsers();
      console.log(`   Found: ${recipients.length} active recipient(s)\n`);

      if (recipients.length > 0) {
        console.log('   [Recipients List]:');
        recipients.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        });
      } else {
        console.log('   No active users found with role TFS or SERVICE.');
      }

      console.log('\n----------------------------------------------------');
      console.log('💡 TIP: To actually send emails and update DB, run:');
      console.log('   node src/scripts/testTFSReminder.js --force');
      console.log('====================================================');
    } else {
      console.log('🚀 Triggering processTFSReminders()...\n');
      const result = await processTFSReminders();
      console.log('\n----------------------------------------------------');
      console.log('EXECUTION RESULT:', JSON.stringify(result, null, 2));
      console.log('====================================================');
    }
  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } process.exit(0);
}

runTestSimulation();

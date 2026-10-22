require('dotenv').config();
const {
  findIdleServices,
  findIdleProjects,
  getExecutionUsers,
  processExecutionReminders,
} = require('../services/executionReminder.service');

const isForceMode = process.argv.includes('--force');

async function runTestSimulation() {
  console.log('====================================================');
  console.log('       EXECUTION REMINDER TEST SIMULATOR            ');
  console.log('====================================================');
  console.log(`MODE: ${isForceMode ? '⚡ FORCE / REAL RUN (Sending Email & Updating DB)' : '🔍 DRY RUN (Simulation Only - No Emails / DB Edits)'}`);
  console.log(`TIME: ${new Date().toLocaleString('id-ID')}`);
  console.log('----------------------------------------------------\n');

  try {
    if (!isForceMode) {
      console.log('1. Checking Idle Service Executions...');
      const idleServices = await findIdleServices();
      console.log(`   Found: ${idleServices.length} idle service execution(s)\n`);

      if (idleServices.length > 0) {
        console.log('   [Idle Services List]:');
        idleServices.forEach((s, index) => {
          const lastDate = s.lastActivityAt || s.createdAt;
          const daysIdle = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          const customerName = s.purchaseOrder?.quotation?.inquiry?.customer?.name 
                        || s.inquiry?.customer?.name 
                        || s.quotation?.inquiry?.customer?.name 
                        || '-';
          console.log(
            `   ${index + 1}. Service No: ${s.serviceNumber} | Status: ${s.status} | Customer: ${customerName} | ReminderCount: ${s.reminderCount}/3 | Days Idle: ${daysIdle} day(s)`
          );
        });
      } else {
        console.log('   No PENDING or IN_PROGRESS service executions meet the idle reminder criteria.');
      }

      console.log('\n2. Checking Idle Project Executions...');
      const idleProjects = await findIdleProjects();
      console.log(`   Found: ${idleProjects.length} idle project execution(s)\n`);

      if (idleProjects.length > 0) {
        console.log('   [Idle Projects List]:');
        idleProjects.forEach((p, index) => {
          const lastDate = p.lastActivityAt || p.createdAt;
          const daysIdle = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          const customerName = p.purchaseOrder?.quotation?.inquiry?.customer?.name || '-';
          console.log(
            `   ${index + 1}. Project No: ${p.projectNumber} | Status: ${p.status} | Customer: ${customerName} | ReminderCount: ${p.reminderCount}/3 | Days Idle: ${daysIdle} day(s)`
          );
        });
      } else {
        console.log('   No PENDING or IN_PROGRESS project executions meet the idle reminder criteria.');
      }

      console.log('\n3. Checking Target Recipients (PROJECT & SERVICE Users)...');
      const recipients = await getExecutionUsers();
      console.log(`   Found: ${recipients.length} active recipient(s)\n`);

      if (recipients.length > 0) {
        console.log('   [Recipients List]:');
        recipients.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        });
      } else {
        console.log('   No active users found with role PROJECT or SERVICE.');
      }

      console.log('\n----------------------------------------------------');
      console.log('💡 TIP: To actually send emails and update DB, run:');
      console.log('   node src/scripts/testExecutionReminder.js --force');
      console.log('====================================================');
    } else {
      console.log('🚀 Triggering processExecutionReminders()...\n');
      const result = await processExecutionReminders();
      console.log('\n----------------------------------------------------');
      console.log('EXECUTION RESULT:', JSON.stringify(result, null, 2));
      console.log('====================================================');
    }
  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } process.exit(0);
}

runTestSimulation();

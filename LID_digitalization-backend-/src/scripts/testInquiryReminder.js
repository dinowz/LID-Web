require('dotenv').config();
const {
  findIdleOpenInquiries,
  getSalesUsers,
  processInquiryReminders,
} = require('../services/inquiryReminder.service');

const isForceMode = process.argv.includes('--force');

async function runTestSimulation() {
  console.log('====================================================');
  console.log('         INQUIRY REMINDER TEST SIMULATOR            ');
  console.log('====================================================');
  console.log(`MODE: ${isForceMode ? '⚡ FORCE / REAL RUN (Sending Email & Updating DB)' : '🔍 DRY RUN (Simulation Only - No Emails / DB Edits)'}`);
  console.log(`TIME: ${new Date().toLocaleString('id-ID')}`);
  console.log('----------------------------------------------------\n');

  try {
    if (!isForceMode) {
      console.log('1. Checking Idle Open Inquiries...');
      const idleInquiries = await findIdleOpenInquiries();
      console.log(`   Found: ${idleInquiries.length} idle inquiry(ies)\n`);

      if (idleInquiries.length > 0) {
        console.log('   [Idle Inquiries List]:');
        idleInquiries.forEach((inq, index) => {
          const lastDate = inq.lastActivityAt || inq.createdAt;
          const daysIdle = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          console.log(
            `   ${index + 1}. No: ${inq.inquiryNumber} | Customer: ${inq.customer?.name || '-'} | Type: ${inq.requestType} | ReminderCount: ${inq.reminderCount}/3 | Days Idle: ${daysIdle} day(s)`
          );
        });
      } else {
        console.log('   No open inquiries meet the idle reminder criteria.');
      }

      console.log('\n2. Checking Target Recipients (Sales Users)...');
      const salesUsers = await getSalesUsers();
      console.log(`   Found: ${salesUsers.length} active sales user(s)\n`);

      if (salesUsers.length > 0) {
        console.log('   [Recipients List]:');
        salesUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        });
      } else {
        console.log('   No active users found with roles SERVICE, PROJECT, or SPARE_PART.');
      }

      console.log('\n----------------------------------------------------');
      console.log('💡 TIP: To actually send emails and update DB, run:');
      console.log('   node src/scripts/testInquiryReminder.js --force');
      console.log('====================================================');
    } else {
      console.log('🚀 Triggering processInquiryReminders()...\n');
      const result = await processInquiryReminders();
      console.log('\n----------------------------------------------------');
      console.log('EXECUTION RESULT:', JSON.stringify(result, null, 2));
      console.log('====================================================');
    }
  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } process.exit(0);
}

runTestSimulation();

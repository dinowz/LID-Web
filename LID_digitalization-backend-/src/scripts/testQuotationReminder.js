require('dotenv').config();
const {
  findIdleQuotations,
  getSalesUsers,
  processQuotationReminders,
} = require('../services/quotationReminder.service');

const isForceMode = process.argv.includes('--force');

async function runTestSimulation() {
  console.log('====================================================');
  console.log('        QUOTATION REMINDER TEST SIMULATOR           ');
  console.log('====================================================');
  console.log(`MODE: ${isForceMode ? '⚡ FORCE / REAL RUN (Sending Email & Updating DB)' : '🔍 DRY RUN (Simulation Only - No Emails / DB Edits)'}`);
  console.log(`TIME: ${new Date().toLocaleString('id-ID')}`);
  console.log('----------------------------------------------------\n');

  try {
    if (!isForceMode) {
      console.log('1. Checking Idle Draft Quotations...');
      const idleQuotations = await findIdleQuotations();
      console.log(`   Found: ${idleQuotations.length} idle draft quotation(s)\n`);

      if (idleQuotations.length > 0) {
        console.log('   [Idle Quotations List]:');
        idleQuotations.forEach((q, index) => {
          const lastDate = q.lastActivityAt || q.createdAt;
          const daysIdle = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          const priceStr = parseFloat(q.totalPrice || 0).toLocaleString('id-ID');
          console.log(
            `   ${index + 1}. No: ${q.quotationNumber} | Customer: ${q.inquiry?.customer?.name || '-'} | Price: ${q.currency} ${priceStr} | ReminderCount: ${q.reminderCount}/3 | Days Idle: ${daysIdle} day(s)`
          );
        });
      } else {
        console.log('   No draft quotations meet the idle reminder criteria.');
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
      console.log('   node src/scripts/testQuotationReminder.js --force');
      console.log('====================================================');
    } else {
      console.log('🚀 Triggering processQuotationReminders()...\n');
      const result = await processQuotationReminders();
      console.log('\n----------------------------------------------------');
      console.log('EXECUTION RESULT:', JSON.stringify(result, null, 2));
      console.log('====================================================');
    }
  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } process.exit(0);
}

runTestSimulation();

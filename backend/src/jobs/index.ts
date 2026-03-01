import cron from 'node-cron';
import { fetchAndStoreExchangeRate } from '../services/fx.service';

/**
 * Initializes and starts all cron jobs.
 * Called once on server startup.
 */
export function startCronJobs(): void {
  console.log('⏰ Starting cron jobs...');

  // Fetch exchange rate daily at 8:00 AM Uruguay time (UTC-3)
  // Runs at 11:00 UTC = 08:00 UYT
  cron.schedule('0 11 * * *', async () => {
    console.log('💱 Fetching daily exchange rate...');
    try {
      await fetchAndStoreExchangeRate();
      console.log('✅ Exchange rate updated');
    } catch (err) {
      console.error('❌ Failed to fetch exchange rate:', err);
    }
  });

  // Weekly recommendations — every Sunday at 10 PM UYT (01:00 UTC Monday)
  cron.schedule('0 1 * * 1', async () => {
    console.log('🤖 Generating weekly AI recommendations...');
    // Phase 4: implement recommendations.service call here
  });

  // Recurring transaction generator — daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Processing recurring transactions...');
    // Phase 2: implement recurring transaction creation
  });

  // Email sync — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    // Phase 3: implement email sync
  });

  console.log('✅ Cron jobs started');
}

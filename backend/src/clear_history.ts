import { db } from './prisma/db.js';
import { emailQueue, redisConnection } from './services/queue.service.js';

async function main() {
  const emailToClear = 'thakashiq@gmail.com';
  console.log(`[Cleanup] Searching for user: ${emailToClear}`);

  try {
    const user = await db.orm.public.User.where({ email: emailToClear }).first();
    if (!user) {
      console.log(`[Cleanup] User "${emailToClear}" not found in database.`);
    } else {
      console.log(`[Cleanup] Found User ID: ${user.id}`);

      // Fetch and remove all campaigns and emails belonging to the user
      const campaigns = await db.orm.public.Campaign.where({ userId: user.id }).all();
      const campaignIds = campaigns.map((c) => c.id);

      console.log(`[Cleanup] Found ${campaigns.length} campaigns. Wiping email logs...`);

      let emailDeleteCount = 0;
      for (const cid of campaignIds) {
        const deletedEmails = await db.orm.public.Email.where({ campaignId: cid }).deleteAll();
        emailDeleteCount += deletedEmails.length;
      }

      const deletedCampaigns = await db.orm.public.Campaign.where({ userId: user.id }).deleteAll();

      console.log(`[Cleanup] Successfully wiped:`);
      console.log(`  - ${emailDeleteCount} email logs`);
      console.log(`  - ${deletedCampaigns.length} campaigns`);
    }

    // Clean BullMQ Queues (Wipe active, delayed, completed, failed tasks)
    console.log('[Cleanup] Draining and cleaning BullMQ emailQueue...');
    await emailQueue.drain(true);
    await emailQueue.clean(0, 99999, 'delayed');
    await emailQueue.clean(0, 99999, 'completed');
    await emailQueue.clean(0, 99999, 'failed');
    await emailQueue.clean(0, 99999, 'wait');
    await emailQueue.clean(0, 99999, 'active');
    
    // Clear all rate limiting counters and Slack notify keys in Redis
    const rateKeys = await redisConnection.keys('rate:*');
    const slackKeys = await redisConnection.keys('slack_notified:*');
    const keysToWipe = [...rateKeys, ...slackKeys];
    
    if (keysToWipe.length > 0) {
      await redisConnection.del(...keysToWipe);
      console.log(`[Cleanup] Cleared ${keysToWipe.length} rate and notification keys in Redis.`);
    }

    console.log('[Cleanup] BullMQ queue and Redis state successfully wiped!');

  } catch (err) {
    console.error('[Cleanup] Error during database/queue cleanup:', err);
  }

  process.exit(0);
}

main();

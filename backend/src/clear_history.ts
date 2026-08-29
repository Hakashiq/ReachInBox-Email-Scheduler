import { db } from './prisma/db.js';

async function main() {
  const emailToClear = 'thakashiq@gmail.com';
  console.log(`[Cleanup] Searching for user: ${emailToClear}`);

  try {
    const user = await db.orm.public.User.where({ email: emailToClear }).first();
    if (!user) {
      console.log(`[Cleanup] User "${emailToClear}" not found in database. Nothing to clean.`);
      process.exit(0);
    }

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

  } catch (err) {
    console.error('[Cleanup] Error during database cleanup:', err);
  }

  process.exit(0);
}

main();

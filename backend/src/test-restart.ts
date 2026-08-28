import { db } from './prisma/db';
import { emailQueue } from './services/queue.service';

async function main() {
  console.log('--- PERSISTENCE & RESTART TEST SETUP ---');
  
  // 1. Ensure we have a default user
  const mockGoogleId = 'mock-google-id-12345';
  let user = await db.orm.public.User.where({ googleId: mockGoogleId }).first();
  if (!user) {
    user = await db.orm.public.User.create({
      googleId: mockGoogleId,
      name: 'Developer User',
      email: 'dev@reachinbox.com',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ReachInbox',
    });
  }

  // 2. Ensure we have a default sender
  let sender = await db.orm.public.Sender.where({ userId: user.id }).first();
  if (!sender) {
    sender = await db.orm.public.Sender.create({
      userId: user.id,
      name: 'Test Ethereal Sender',
      smtpUser: 'mock-ethereal-user@ethereal.email',
      smtpPass: 'mock-ethereal-password',
      maxEmailsPerHour: 50,
    });
  }

  // 3. Create a test campaign starting in 15 seconds with 10 seconds spacing
  const leads = ['lead1@example.com', 'lead2@example.com', 'lead3@example.com', 'lead4@example.com', 'lead5@example.com'];
  const startTimestamp = Date.now() + 15000; // 15 seconds from now
  const delaySec = 10;

  const campaign = await db.orm.public.Campaign.create({
    userId: user.id,
    senderId: sender.id,
    subject: 'Durable Restart Campaign',
    body: '<p>This is a test of queue restart durability.</p>',
    startTime: new Date(startTimestamp).toISOString(),
    delayBetweenEmailsSec: delaySec,
    hourlyLimit: 100,
  });

  console.log(`Campaign created: ${campaign.id}`);
  console.log(`Scheduling ${leads.length} emails. Spacing: ${delaySec}s. Start time in 15 seconds.`);

  for (let i = 0; i < leads.length; i++) {
    const recipientEmail = leads[i];
    const targetTime = startTimestamp + i * delaySec * 1000;
    const targetTimeIso = new Date(targetTime).toISOString();

    const emailRecord = await db.orm.public.Email.create({
      campaignId: campaign.id,
      recipientEmail,
      status: 'scheduled',
      scheduledTime: targetTimeIso,
      retryCount: 0,
    });

    const delay = Math.max(0, targetTime - Date.now());

    await emailQueue.add(
      'send-email',
      { emailId: emailRecord.id },
      {
        delay,
        jobId: emailRecord.id, // BullMQ deduplication key
      }
    );

    console.log(`Scheduled: ${recipientEmail} for target time ${targetTimeIso} (delay: ${Math.round(delay/1000)}s)`);
  }

  console.log('\n--- SUCCESS: Emails Scheduled! ---');
  console.log('INSTRUCTIONS:');
  console.log('1. Start your dev server: `npm run dev`');
  console.log('2. Watch the terminal until the first email sends (Ethereal Preview URL printed).');
  console.log('3. Immediately KILL the server (Ctrl+C).');
  console.log('4. Wait 10-15 seconds (passing the target time of the second/third emails).');
  console.log('5. Start the dev server again: `npm run dev`');
  console.log('6. Confirm that the skipped/delayed emails fire immediately upon restart, and no email is double-sent!');
  
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

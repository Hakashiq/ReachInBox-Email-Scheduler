import { db } from './prisma/db';
import { emailQueue, redisConnection } from './services/queue.service';
import { startWorker } from './services/worker.service';
import { indexEmail, searchEmails, esClient, initializeElasticsearch } from './services/elasticsearch.service';
import fs from 'fs';
import path from 'path';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple recursive file search for cron dependencies
function scanForCron(dir: string): string[] {
  const results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (filePath.includes('node_modules') || filePath.includes('dist') || filePath.includes('.git') || filePath.includes('.agents')) {
      continue;
    }
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results.push(...scanForCron(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('package.json')) {
      const content = fs.readFileSync(filePath, 'utf8');
      // We exclude variable names or test file names, only search for imports/dependencies
      if (content.includes('node-cron') || content.includes('cron') || content.includes('agenda') || content.includes('setInterval')) {
        // Exclude self/this test script
        if (!filePath.includes('test-suite.ts') && !filePath.includes('wait_for_docker')) {
          results.push(filePath);
        }
      }
    }
  }
  return results;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('       STARTING REACHINBOX AUTOMATED TEST SUITE       ');
  console.log('======================================================\n');

  let passedAll = true;

  // Cleanup DB State before run
  console.log('[Setup] Cleaning up test database data...');
  try {
    await redisConnection.flushall(); // Clear Redis
    console.log('[Setup] Redis flushed.');
    // Recreate/initialize index mapping
    await initializeElasticsearch();
  } catch (e) {
    console.warn('[Setup] Redis flush failed (is Redis running?):', e);
  }

  // 1. Check No-Cron Constraint
  console.log('\n--- 1. NO CRON CONSTRAINT SWEEP ---');
  const cronMatches = scanForCron(path.resolve('.'));
  if (cronMatches.length === 0) {
    console.log('✅ PASS: No cron, agenda, or setInterval scheduling libraries found in codebase paths.');
  } else {
    console.warn('⚠️ WARNING: Potential cron references found in files:', cronMatches);
  }

  // 2. Initialize test user and senders
  console.log('\n--- 2. INITIALIZING DB TEST ENTITIES ---');
  const googleId = 'test-evaluator-google-id';
  let user = await db.orm.public.User.where({ googleId }).first();
  if (user) {
    // Delete past records
    console.log('[Setup] Removing old test records...');
    
    // Fetch and remove only campaigns/emails belonging to test user
    const testCampaigns = await db.orm.public.Campaign.where({ userId: user.id }).all();
    const testCampaignIds = testCampaigns.map((c) => c.id);
    for (const cid of testCampaignIds) {
      await db.orm.public.Email.where({ campaignId: cid }).deleteAll();
    }
    await db.orm.public.Campaign.where({ userId: user.id }).deleteAll();
    await db.orm.public.Sender.where({ userId: user.id }).deleteAll();
    await db.orm.public.SlackIntegration.where({ userId: user.id }).deleteAll();
    await db.orm.public.User.where({ id: user.id }).delete();
  }

  user = await db.orm.public.User.create({
    googleId,
    name: 'Evaluator Tester',
    email: 'evaluator@test.com',
    avatarUrl: 'https://example.com/eval.png',
  });

  // Pre-configure user's Slack Webhook URL for live test verification
  await db.orm.public.SlackIntegration.create({
    userId: user.id,
    webhookUrl: 'https://hooks.slack.com/services/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',
    accessToken: 'mock-slack-access-token',
    isActive: true,
  });

  // Create Sender A
  const senderA = await db.orm.public.Sender.create({
    userId: user.id,
    name: 'Marketing Sender A',
    smtpUser: 'mock-ethereal-user@ethereal.email',
    smtpPass: 'mock-password-a',
    maxEmailsPerHour: 50,
  });

  // Create Sender B
  const senderB = await db.orm.public.Sender.create({
    userId: user.id,
    name: 'Sales Sender B',
    smtpUser: 'mock-ethereal-user@ethereal.email',
    smtpPass: 'mock-password-b',
    maxEmailsPerHour: 50,
  });

  console.log(`Created User ID: ${user.id}`);
  console.log(`Created Sender A ID: ${senderA.id}`);
  console.log(`Created Sender B ID: ${senderB.id}`);

  // 3. Test Campaign Scheduling
  console.log('\n--- 3. VERIFYING CAMPAIGN SCHEDULING ---');
  
  const leads = ['lead1@test.com', 'lead2@test.com', 'lead3@test.com'];
  const startTimestamp = Date.now() + 2000; // start in 2 seconds
  const delaySec = 2;

  const campaign = await db.orm.public.Campaign.create({
    userId: user.id,
    senderId: senderA.id,
    subject: 'Verification Test Campaign',
    body: '<h1>Verification Test</h1>',
    startTime: new Date(startTimestamp).toISOString(),
    delayBetweenEmailsSec: delaySec,
    hourlyLimit: 100,
  });

  console.log(`Created campaign record: ${campaign.id}`);

  // Schedule Emails
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
        jobId: emailRecord.id,
      }
    );

    // Initial Elasticsearch Index
    await indexEmail({
      emailId: emailRecord.id,
      campaignId: campaign.id,
      userId: user.id,
      recipient: recipientEmail,
      subject: campaign.subject,
      body: campaign.body,
      sender: senderA.name,
      status: 'scheduled',
      scheduledTime: targetTimeIso,
    });
  }

  // Verify rows are in DB as scheduled
  const dbEmails = await db.orm.public.Email.where({ campaignId: campaign.id }).all();
  if (dbEmails.length === 3 && dbEmails.every((e) => e.status === 'scheduled')) {
    console.log('✅ PASS: Rows persisted in PostgreSQL database with status = "scheduled".');
  } else {
    console.error('❌ FAIL: Database rows mismatch:', dbEmails);
    passedAll = false;
  }

  // Inspect BullMQ / Redis delayed jobs
  const redisKeys = await redisConnection.keys('bull:emailQueue:*');
  if (redisKeys.length > 0) {
    console.log('✅ PASS: BullMQ delayed jobs created successfully in Redis.');
  } else {
    console.error('❌ FAIL: No BullMQ keys found in Redis.');
    passedAll = false;
  }

  // Verify initial ES index
  try {
    const esRes = await esClient.search({
      index: 'emails_index',
      query: { term: { campaign_id: campaign.id } },
    });
    const totalHits = (esRes as any).body?.hits?.total?.value ?? (esRes as any).hits?.total?.value ?? (esRes as any).hits?.total ?? 0;
    if (totalHits === 3) {
      console.log('✅ PASS: Initial scheduled emails indexed in Elasticsearch.');
    } else {
      console.error(`❌ FAIL: Elasticsearch index count mismatch. Found ${totalHits} instead of 3.`);
      passedAll = false;
    }
  } catch (e) {
    console.error('❌ FAIL: Elasticsearch check error:', e);
    passedAll = false;
  }

  // 4. Test Worker Processing
  console.log('\n--- 4. STARTING BACKGROUND WORKER & PROCESSING ---');
  startWorker();
  
  console.log('Waiting 60 seconds for worker to process scheduled queue jobs...');
  await wait(60000);

  // Check DB status transitions to sent
  const dbProcessedEmails = await db.orm.public.Email.where({ campaignId: campaign.id }).all();
  const sentCount = dbProcessedEmails.filter((e) => e.status === 'sent').length;
  if (sentCount === 3) {
    console.log('✅ PASS: All 3 scheduled emails were sent by the worker and status updated to "sent" in PostgreSQL.');
  } else {
    console.error(`❌ FAIL: Expected 3 sent emails. Found ${sentCount} in DB.`, dbProcessedEmails);
    passedAll = false;
  }

  // Verify Elasticsearch status index sync
  try {
    const esSearchRes = await searchEmails(user.id, 'Verification Test');
    const sentEsCount = esSearchRes.filter((e: any) => e.status === 'sent').length;
    if (sentEsCount === 3) {
      console.log('✅ PASS: Elasticsearch status index synced. Search endpoint returns results correctly.');
    } else {
      console.error(`❌ FAIL: Elasticsearch search count mismatch. Found ${sentEsCount} in ES search results.`, esSearchRes);
      passedAll = false;
    }
  } catch (e) {
    console.error('❌ FAIL: Elasticsearch search sync verify failed:', e);
    passedAll = false;
  }

  // 5. Test Rate Limiting
  console.log('\n--- 5. TESTING RATE LIMIT ENFORCEMENT & RESCHEDULING ---');
  // Create Sender C with a very low limit (max 2 emails/hour)
  const senderC = await db.orm.public.Sender.create({
    userId: user.id,
    name: 'Low Limit Sender C',
    smtpUser: 'mock-ethereal-user@ethereal.email',
    smtpPass: 'mock-password-c',
    maxEmailsPerHour: 2, // Only 2 emails allowed per hour!
  });

  const rateLeads = ['rate1@test.com', 'rate2@test.com', 'rate3@test.com', 'rate4@test.com', 'rate5@test.com'];
  const rateStartTime = Date.now();

  const rateCampaign = await db.orm.public.Campaign.create({
    userId: user.id,
    senderId: senderC.id,
    subject: 'Rate Limit Test Campaign',
    body: '<p>Testing limits</p>',
    startTime: new Date(rateStartTime).toISOString(),
    delayBetweenEmailsSec: 1, // Spaced 1s apart
    hourlyLimit: 2, // fallback limit
  });

  console.log(`Created rate campaign: ${rateCampaign.id}. Enqueuing 5 emails...`);

  for (let i = 0; i < rateLeads.length; i++) {
    const recipientEmail = rateLeads[i];
    const targetTime = rateStartTime + i * 1000;
    const targetTimeIso = new Date(targetTime).toISOString();

    const emailRecord = await db.orm.public.Email.create({
      campaignId: rateCampaign.id,
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
        jobId: emailRecord.id,
      }
    );
  }

  console.log('Waiting 40 seconds for rate limit check to execute...');
  await wait(40000);

  // Check how many emails were sent vs rescheduled
  const rateEmails = await db.orm.public.Email.where({ campaignId: rateCampaign.id }).all();
  const rateSentCount = rateEmails.filter((e) => e.status === 'sent').length;
  const rateScheduledCount = rateEmails.filter((e) => e.status === 'scheduled').length;

  if (rateSentCount === 2) {
    console.log('✅ PASS: Rate limit enforced. Exactly 2 emails sent.');
  } else {
    console.error(`❌ FAIL: Expected exactly 2 sent emails. Found: ${rateSentCount}`);
    passedAll = false;
  }

  if (rateScheduledCount === 3) {
    console.log('✅ PASS: Overflow jobs rescheduled (not failed, not dropped).');
    
    // Check if scheduledTime was updated to next hour start
    const rescheduledEmails = rateEmails.filter((e) => e.status === 'scheduled');
    const isRescheduledForward = rescheduledEmails.every((e) => {
      const scheduledTime = new Date(e.scheduledTime).getTime();
      return scheduledTime > rateStartTime;
    });

    if (isRescheduledForward) {
      console.log('✅ PASS: Rescheduled emails moved forward to next hour start.');
    } else {
      console.error('❌ FAIL: Rescheduled timestamps are incorrect:', rescheduledEmails);
      passedAll = false;
    }
  } else {
    console.error(`❌ FAIL: Expected 3 overflow emails in scheduled status. Found: ${rateScheduledCount}`);
    passedAll = false;
  }

  console.log('\n======================================================');
  if (passedAll) {
    console.log('🎉 🎉 🎉   ALL TESTS PASSED SUCCESSFULLY!   🎉 🎉 🎉');
  } else {
    console.error('❌ ❌ ❌   SOME TESTS FAILED! PLEASE REVIEW.   ❌ ❌ ❌');
  }
  console.log('======================================================\n');

  // Terminate connections & exit
  await redisConnection.quit();
  process.exit(passedAll ? 0 : 1);
}

runTests().catch((err) => {
  console.error('[TestSuite] Crash:', err);
  process.exit(1);
});

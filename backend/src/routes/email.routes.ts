import { Router } from 'express';
import { db } from '../prisma/db.js';
import { emailQueue } from '../services/queue.service.js';
import { ensureAuthenticated } from '../middleware/auth.middleware.js';
import { indexEmail, searchEmails } from '../services/elasticsearch.service.js';

const router = Router();

// Retrieve all senders for the logged-in user
// If none exist, automatically creates a default mock Ethereal sender
router.get('/senders', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    let senders = await db.orm.public.Sender.where({ userId }).all();

    if (senders.length === 0) {
      // Create a default mock Ethereal sender
      const defaultSender = await db.orm.public.Sender.create({
        userId,
        name: 'Default Ethereal Sender',
        smtpUser: 'mock-ethereal-user@ethereal.email',
        smtpPass: 'mock-ethereal-password',
        maxEmailsPerHour: parseInt(process.env.DEFAULT_HOURLY_LIMIT || '50', 10),
      });
      senders = [defaultSender];
      console.log(`[Email] Created default Ethereal sender for user ${userId}`);
    }

    return res.json({ senders });
  } catch (err) {
    console.error('[Email] Error fetching senders:', err);
    return res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

// Create a new sender
router.post('/senders', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { name, smtpUser, smtpPass, maxEmailsPerHour } = req.body;

    if (!name || !smtpUser || !smtpPass) {
      return res.status(400).json({ error: 'Name, smtpUser, and smtpPass are required' });
    }

    const newSender = await db.orm.public.Sender.create({
      userId,
      name,
      smtpUser,
      smtpPass,
      maxEmailsPerHour: maxEmailsPerHour ? parseInt(maxEmailsPerHour, 10) : null,
    });

    return res.json({ sender: newSender });
  } catch (err) {
    console.error('[Email] Error creating sender:', err);
    return res.status(500).json({ error: 'Failed to create sender' });
  }
});

// Post a new email campaign to be scheduled
router.post('/schedule', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { subject, body, leads, startTime, delayBetweenEmailsSec, hourlyLimit, senderId } = req.body;

    // Validation
    if (!subject || !body || !leads || !Array.isArray(leads) || leads.length === 0 || !senderId) {
      return res.status(400).json({ error: 'Missing required fields or leads array is empty' });
    }

    const parsedDelay = parseInt(delayBetweenEmailsSec || '0', 10);
    const defaultLimitVal = parseInt(process.env.DEFAULT_HOURLY_LIMIT || '100', 10);
    const userLimit = parseInt(hourlyLimit || String(defaultLimitVal), 10);
    const parsedLimit = Math.min(userLimit, defaultLimitVal);
    const startTimestamp = startTime ? new Date(startTime).getTime() : Date.now();

    // Verify sender belongs to user
    const sender = await db.orm.public.Sender.where({ id: senderId, userId }).first();
    if (!sender) {
      return res.status(404).json({ error: 'Sender identity not found' });
    }

    // Create campaign record
    const campaign = await db.orm.public.Campaign.create({
      userId,
      senderId,
      subject,
      body,
      startTime: new Date(startTimestamp).toISOString(),
      delayBetweenEmailsSec: parsedDelay,
      hourlyLimit: parsedLimit,
    });

    console.log(`[Email] Created campaign ${campaign.id} with ${leads.length} leads.`);

    const scheduledEmails = [];

    // Schedule each lead
    for (let i = 0; i < leads.length; i++) {
      const recipientEmail = leads[i];
      // Target send time is spaced out by the delayBetweenEmailsSec
      const targetTime = startTimestamp + i * parsedDelay * 1000;
      const targetTimeIso = new Date(targetTime).toISOString();

      // Create Email log in DB
      const emailRecord = await db.orm.public.Email.create({
        campaignId: campaign.id,
        recipientEmail,
        status: 'scheduled',
        scheduledTime: targetTimeIso,
        retryCount: 0,
      });

      // Calculate delayed enqueue duration (in milliseconds)
      const now = Date.now();
      const delay = Math.max(0, targetTime - now);

      // Enqueue to BullMQ with deterministic jobId (matches database email id)
      await emailQueue.add(
        'send-email',
        { emailId: emailRecord.id },
        {
          delay,
          jobId: emailRecord.id, // Idempotency key for BullMQ
        }
      );

      // Index in Elasticsearch
      await indexEmail({
        emailId: emailRecord.id,
        campaignId: campaign.id,
        userId,
        recipient: recipientEmail,
        subject: campaign.subject,
        body: campaign.body,
        sender: sender.name,
        status: 'scheduled',
        scheduledTime: targetTimeIso,
      });

      scheduledEmails.push(emailRecord);
    }
    // Try to trigger Slack notification for campaign schedule (To match design template)
    try {
      const slackConfig = await db.orm.public.SlackIntegration.where({ userId, isActive: true }).first();
      if (slackConfig && slackConfig.webhookUrl) {
        const leadToShow = scheduledEmails[0];
        if (leadToShow) {
          const dateObj = new Date(leadToShow.scheduledTime);
          const formattedDate = dateObj.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }).toLowerCase();

          const slackMsg = {
            text: `📅 *Email Scheduled*\n\n*To:*\n${leadToShow.recipientEmail}\n*Scheduled For:*\n${formattedDate}\n\n*Subject:*\n${subject}\n*Status:*\nSCHEDULED`
          };

          await fetch(slackConfig.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackMsg),
          });
        }
      }
    } catch (slackErr) {
      console.error('[Email] Failed to send Slack schedule notification:', slackErr);
    }

    return res.json({
      success: true,
      campaignId: campaign.id,
      scheduledCount: scheduledEmails.length,
    });
  } catch (err) {
    console.error('[Email] Error scheduling campaign:', err);
    return res.status(500).json({ error: 'Failed to schedule email campaign' });
  }
});

// List all scheduled emails (including their parent campaign subject)
router.get('/scheduled', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch all campaigns belonging to this user
    const campaigns = await db.orm.public.Campaign.where({ userId }).all();
    const campaignIds = campaigns.map((c) => c.id);

    if (campaignIds.length === 0) {
      return res.json({ emails: [] });
    }

    // Get all scheduled emails for these campaigns
    // Note: Since Prisma Next supports simple where clauses, we will fetch and filter
    const allEmails = await db.orm.public.Email.where({ status: 'scheduled' }).all();
    
    // Filter locally by campaignIds
    const filteredEmails = allEmails
      .filter((email) => campaignIds.includes(email.campaignId))
      .map((email) => {
        const campaign = campaigns.find((c) => c.id === email.campaignId);
        return {
          ...email,
          subject: campaign ? campaign.subject : 'No Subject',
        };
      });

    // Sort by scheduledTime ascending
    filteredEmails.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

    return res.json({ emails: filteredEmails });
  } catch (err) {
    console.error('[Email] Error fetching scheduled emails:', err);
    return res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

// List all sent or failed emails
router.get('/sent', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch all campaigns belonging to this user
    const campaigns = await db.orm.public.Campaign.where({ userId }).all();
    const campaignIds = campaigns.map((c) => c.id);

    if (campaignIds.length === 0) {
      return res.json({ emails: [] });
    }

    // Get all sent or failed emails for these campaigns
    const allEmails = await db.orm.public.Email.all();
    
    const filteredEmails = allEmails
      .filter((email) => campaignIds.includes(email.campaignId) && (email.status === 'sent' || email.status === 'failed'))
      .map((email) => {
        const campaign = campaigns.find((c) => c.id === email.campaignId);
        return {
          ...email,
          subject: campaign ? campaign.subject : 'No Subject',
        };
      });

    // Sort by sentTime descending
    filteredEmails.sort((a, b) => {
      const timeA = a.sentTime ? new Date(a.sentTime).getTime() : 0;
      const timeB = b.sentTime ? new Date(b.sentTime).getTime() : 0;
      return timeB - timeA;
    });

    return res.json({ emails: filteredEmails });
  } catch (err) {
    console.error('[Email] Error fetching sent emails:', err);
    return res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

// Search emails using Elasticsearch
router.get('/search', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }

    const results = await searchEmails(userId, q);
    return res.json({ results });
  } catch (err) {
    console.error('[Email] Search route error:', err);
    return res.status(500).json({ error: 'Failed to perform search' });
  }
});

export default router;

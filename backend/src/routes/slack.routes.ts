import { Router } from 'express';
import { db } from '../prisma/db.js';
import { ensureAuthenticated } from '../middleware/auth.middleware.js';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// 1. Start Slack OAuth Flow
router.get('/oauth/start', ensureAuthenticated, (req: any, res) => {
  const clientID = process.env.SLACK_CLIENT_ID;
  
  if (clientID) {
    // Real Slack OAuth flow
    const redirectUri = encodeURIComponent(`${process.env.BACKEND_URL || 'http://localhost:5000'}/slack/oauth/callback`);
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientID}&scope=incoming-webhook&redirect_uri=${redirectUri}`;
    return res.redirect(slackAuthUrl);
  } else {
    // If Slack App credentials are not configured, redirect to a mock connection callback
    console.log('[Slack] Slack App Client ID missing. Redirecting to mock Slack callback.');
    return res.redirect('/slack/mock-callback');
  }
});

// 2. Slack OAuth Callback
router.get('/oauth/callback', ensureAuthenticated, async (req: any, res, next) => {
  const userId = req.user.id;
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/dashboard?slack=error&message=no_code`);
  }

  try {
    // Exchange authorization code for access token and webhook info
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID || '',
        client_secret: process.env.SLACK_CLIENT_SECRET || '',
        code: code as string,
        redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:5000'}/slack/oauth/callback`,
      }),
    });

    const body = await response.json();

    if (!body.ok) {
      console.error('[Slack] OAuth Exchange failed:', body.error);
      return res.redirect(`${FRONTEND_URL}/dashboard?slack=error&message=${body.error}`);
    }

    const accessToken = body.access_token;
    const webhookUrl = body.incoming_webhook?.url;

    if (!webhookUrl) {
      return res.redirect(`${FRONTEND_URL}/dashboard?slack=error&message=no_webhook_provided`);
    }

    // Upsert slack integration in database
    const existing = await db.orm.public.SlackIntegration.where({ userId }).first();
    if (existing) {
      await db.orm.public.SlackIntegration.where({ id: existing.id }).update({
        accessToken,
        webhookUrl,
        isActive: true,
        connectedAt: new Date().toISOString(),
      });
    } else {
      await db.orm.public.SlackIntegration.create({
        userId,
        accessToken,
        webhookUrl,
        isActive: true,
      });
    }

    console.log(`[Slack] Successfully connected Slack for user ${userId}`);
    return res.redirect(`${FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    next(err);
  }
});

// 3. Mock Slack Connect Redirect (for development)
router.get('/mock-callback', ensureAuthenticated, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    // Fallback to a developer Slack webhook URL if specified, or a mock one
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/mock-webhook-url';

    const existing = await db.orm.public.SlackIntegration.where({ userId }).first();
    if (existing) {
      await db.orm.public.SlackIntegration.where({ id: existing.id }).update({
        accessToken: 'mock-slack-access-token',
        webhookUrl,
        isActive: true,
        connectedAt: new Date().toISOString(),
      });
    } else {
      await db.orm.public.SlackIntegration.create({
        userId,
        accessToken: 'mock-slack-access-token',
        webhookUrl,
        isActive: true,
      });
    }

    console.log(`[Slack] Connected mock Slack webhook for user ${userId}: ${webhookUrl}`);
    return res.redirect(`${FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    next(err);
  }
});

// 4. Manually configure/update webhook URL (dev affordance)
router.post('/connect-webhook', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { webhookUrl } = req.body;

    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/services/')) {
      return res.status(400).json({ error: 'Valid Slack Webhook URL is required' });
    }

    const existing = await db.orm.public.SlackIntegration.where({ userId }).first();
    if (existing) {
      await db.orm.public.SlackIntegration.where({ id: existing.id }).update({
        webhookUrl,
        isActive: true,
        connectedAt: new Date().toISOString(),
      });
    } else {
      await db.orm.public.SlackIntegration.create({
        userId,
        accessToken: 'manual-webhook-token',
        webhookUrl,
        isActive: true,
      });
    }

    return res.json({ success: true, webhookUrl });
  } catch (err) {
    console.error('[Slack] Webhook connect error:', err);
    return res.status(500).json({ error: 'Failed to connect Slack webhook' });
  }
});

// 5. Get current Slack integration status
router.get('/status', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const integration = await db.orm.public.SlackIntegration.where({ userId }).first();
    
    return res.json({
      connected: !!integration && integration.isActive,
      webhookUrl: integration?.webhookUrl || null,
    });
  } catch (err) {
    console.error('[Slack] Status check error:', err);
    return res.status(500).json({ error: 'Failed to fetch Slack status' });
  }
});

// 6. Disconnect Slack
router.post('/disconnect', ensureAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const integration = await db.orm.public.SlackIntegration.where({ userId }).first();

    if (integration) {
      await db.orm.public.SlackIntegration.where({ id: integration.id }).update({
        isActive: false,
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Slack] Disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

export default router;

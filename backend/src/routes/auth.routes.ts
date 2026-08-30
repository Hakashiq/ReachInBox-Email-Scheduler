import { Router } from 'express';
import passport from 'passport';
import { db } from '../prisma/db.js';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// 1. Initiate Google OAuth
router.get('/google', (req, res, next) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (clientID && clientSecret) {
    return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  } else {
    console.error('[Auth] Google Client credentials missing in backend .env.');
    return res.status(501).send('Google OAuth is not configured on this server. Please define GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your backend .env file.');
  }
});

// 2. Google OAuth Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  (req, res) => {
    // Successful authentication, redirect home/dashboard
    res.redirect(`${FRONTEND_URL}/scheduled`);
  }
);

// 3. Mock Authentication Bypass
router.get('/mock-login', async (req, res, next) => {
  try {
    const mockEmail = 'dev@reachinbox.com';
    const mockGoogleId = 'mock-google-id-12345';
    const mockName = 'Developer User';
    const mockAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=ReachInbox';

    // Find or create the mock developer user in the DB
    let user = await db.orm.public.User.where({ googleId: mockGoogleId }).first();
    if (!user) {
      user = await db.orm.public.User.create({
        googleId: mockGoogleId,
        name: mockName,
        email: mockEmail,
        avatarUrl: mockAvatar,
      });
      console.log(`[Auth] Created new mock developer user: ${mockEmail}`);
    }

    // Manually log user into the session
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      console.log(`[Auth] Logged in as mock user: ${mockEmail}`);
      return res.redirect(`${FRONTEND_URL}/scheduled`);
    });
  } catch (err) {
    next(err);
  }
});

// Mock POST login (Email Form on login screen)
router.post('/mock-login', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email ID is required' });
    }

    const isSystemAdmin = email.trim().toLowerCase() === 'admin@reachinbox.com' || email.trim().toLowerCase() === 'admin';
    const userEmail = isSystemAdmin ? 'admin@reachinbox.com' : email.trim().toLowerCase();
    const userName = isSystemAdmin ? 'System Administrator' : userEmail.split('@')[0];
    const googleId = isSystemAdmin ? 'system-admin-google-id-999' : `mock-id-${userEmail}`;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${userEmail}`;

    let user = await db.orm.public.User.where({ email: userEmail }).first();
    if (!user) {
      user = await db.orm.public.User.create({
        googleId,
        name: userName,
        email: userEmail,
        avatarUrl,
      });
      console.log(`[Auth] Created user profile: ${userEmail}`);
    }

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      console.log(`[Auth] Logged in as: ${userEmail}`);
      return res.json({ success: true, user });
    });
  } catch (err) {
    next(err);
  }
});

// 4. Get Current Logged In User
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const userObj = req.user as any;
    const isAdmin = userObj.email === 'admin@reachinbox.com';
    return res.json({
      user: {
        id: userObj.id,
        googleId: userObj.googleId,
        name: userObj.name,
        email: userObj.email,
        avatarUrl: userObj.avatarUrl,
        isAdmin,
      }
    });
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

// 5. Logout User
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        return next(destroyErr);
      }
      res.clearCookie('connect.sid'); // Clear session cookie
      return res.json({ success: true, message: 'Logged out successfully' });
    });
  });
});

export default router;

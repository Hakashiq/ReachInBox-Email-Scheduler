import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../prisma/db.js';

export function configurePassport() {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await db.orm.public.User.where({ id }).first();
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback';

  if (clientID && clientSecret) {
    console.log('[Auth] Google OAuth credentials found. Configuring Google Strategy.');
    passport.use(
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL,
          scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            const googleId = profile.id;
            const name = profile.displayName || 'Google User';
            const avatarUrl = profile.photos?.[0]?.value || '';

            if (!email) {
              return done(new Error('No email found in Google profile'), undefined);
            }

            // Find or create user
            let user = await db.orm.public.User.where({ googleId }).first();
            if (!user) {
              user = await db.orm.public.User.create({
                googleId,
                name,
                email,
                avatarUrl,
              });
              console.log(`[Auth] Created new user: ${email}`);
            } else {
              // Update user name/avatar if needed
              await db.orm.public.User.where({ id: user.id }).update({
                name,
                avatarUrl,
              });
            }

            return done(null, user);
          } catch (err) {
            return done(err as Error, undefined);
          }
        }
      )
    );
  } else {
    console.warn(
      '[Auth] WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Real Google OAuth is disabled. Mock authentication bypass will be used.'
    );
  }
}

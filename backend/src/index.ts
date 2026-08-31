import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { configurePassport } from './config/passport.js';
import authRoutes from './routes/auth.routes.js';
import emailRoutes from './routes/email.routes.js';
import slackRoutes from './routes/slack.routes.js';
import { startWorker } from './services/worker.service.js';
import { initializeElasticsearch } from './services/elasticsearch.service.js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './services/queue.service.js';
import { adminBasicAuth } from './middleware/auth.middleware.js';

dotenv.config();

// Configure Passport Strategies
configurePassport();

// Initialize Elasticsearch index
initializeElasticsearch();

// Start the background worker
startWorker();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// CORS configuration to allow session cookies
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

// Trust proxy to allow secure cookies to be set behind Railway's reverse proxy
app.set('trust proxy', 1);

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'reachinbox-scheduler-default-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // Must be true for sameSite: 'none'
      sameSite: 'none', // Allow cookie sharing across different domains (Vercel and Railway)
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Mount Routes
app.use('/auth', authRoutes);
app.use('/emails', emailRoutes);
app.use('/slack', slackRoutes);

// Setup Bull Board for queue visibility
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: serverAdapter,
});
// Redirect /admin/queues to /admin/queues/ to ensure static assets load instantly from local memory
app.get('/admin/queues', (req, res) => {
  res.redirect('/admin/queues/');
});
app.use('/admin/queues', serverAdapter.getRouter());

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    auth: req.isAuthenticated ? req.isAuthenticated() : false,
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

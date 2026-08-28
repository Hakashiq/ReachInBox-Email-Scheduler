import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { configurePassport } from './config/passport';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import { startWorker } from './services/worker.service';
import { initializeElasticsearch } from './services/elasticsearch.service';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './services/queue.service';

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

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'reachinbox-scheduler-default-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
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

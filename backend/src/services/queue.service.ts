import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Set up Redis connection for BullMQ
export const redisConnection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null, // Required by BullMQ
});

redisConnection.on('connect', () => {
  console.log(`[Queue] Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
});

redisConnection.on('error', (err) => {
  console.error('[Queue] Redis Connection Error:', err);
});

// Initialize BullMQ Queue
export const emailQueue = new Queue('emailQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true, // Keep Redis clean
    removeOnFail: false,    // Keep failed jobs for debugging/visibility
  },
});

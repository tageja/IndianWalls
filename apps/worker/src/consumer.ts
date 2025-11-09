/**
 * BullMQ Worker Consumer
 * Consumes report generation jobs from Redis queue
 */

// import { Worker } from 'bullmq';
// import { executePipeline } from './pipeline';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'report-generator';
const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || '2', 10);

console.log('[Worker] Starting worker consumer...');
console.log(`[Worker] Redis: ${REDIS_URL}`);
console.log(`[Worker] Queue: ${QUEUE_NAME}`);
console.log(`[Worker] Concurrency: ${CONCURRENCY}`);

// TODO: Implement BullMQ worker
// const worker = new Worker(
//   QUEUE_NAME,
//   async (job) => {
//     await executePipeline(job);
//   },
//   {
//     connection: { url: REDIS_URL },
//     concurrency: CONCURRENCY,
//     removeOnComplete: { count: 100 },
//     removeOnFail: { count: 500 },
//   }
// );

// worker.on('completed', (job) => {
//   console.log(`[Worker] Job ${job.id} completed`);
// });

// worker.on('failed', (job, err) => {
//   console.error(`[Worker] Job ${job?.id} failed:`, err);
// });

console.log('[Worker] Worker consumer not yet implemented. See /apps/worker/src/consumer.ts');
console.log('[Worker] Press Ctrl+C to exit');

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

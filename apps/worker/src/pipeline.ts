/**
 * Worker Pipeline Orchestrator
 * Executes 6-step report generation pipeline with checkpointing
 */

import type { Job } from 'bullmq';
// import { logger } from './lib/logger';
// import { normalise } from './steps/normalise';
// import { fetchers } from './steps/fetchers';
// import { synthesise } from './steps/synthesise';
// import { renderCharts } from './steps/render-charts';
// import { composeHtml } from './steps/compose-html';
// import { finalise } from './steps/finalise';

interface JobMessage {
  reportId: string;
  userId: string;
  input: {
    projectName: string;
    location: string;
    reraId?: string;
    notes?: string;
  };
}

export async function executePipeline(job: Job<JobMessage>): Promise<void> {
  const { reportId, userId, input } = job.data;

  console.log(`[Pipeline] Starting report generation for ${reportId}`);

  // TODO: Implement pipeline steps
  // 1. Normalise input
  // 2. Fetch external data (RERA, Infra, Market)
  // 3. Synthesise via LLM (OpenAI Structured Outputs)
  // 4. Render charts (Chart.js + canvas)
  // 5. Compose HTML slots (sanitised)
  // 6. Finalise (upload to storage, update DB)

  // Each step should:
  // - Check if already completed (idempotency)
  // - Save checkpoint after completion
  // - Update job progress
  // - Handle errors appropriately

  throw new Error('Pipeline not yet implemented. See /apps/worker/src/pipeline.ts');
}

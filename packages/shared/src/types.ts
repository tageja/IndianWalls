/**
 * Shared type definitions for IndianWalls
 */

export interface SourceCitation {
  url: string;
  publisher: string;
  date: string; // ISO8601
  sha1: string; // SHA-1 hash of content
}

export interface FetcherResult<T> {
  data: T;
  source: SourceCitation;
  cachedUntil: Date;
}

export interface AppError extends Error {
  code: string;
  statusCode: number;
  isRetryable: boolean;
  context?: Record<string, unknown>;
}

export type SlotKey =
  | 'slot-hero'
  | 'slot-key-metrics'
  | 'slot-chart-1'
  | 'slot-chart-2'
  | 'slot-evidence';

export type ReportStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ChartAsset {
  id: string;
  url: string;
  altText: string;
}

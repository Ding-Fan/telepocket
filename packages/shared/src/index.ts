// Client-safe exports
export * from './types';
export * from './constants';
export * from './constants/categoryPrompts';
export { createClient as createBrowserClient } from './supabase/client';

// Server-only exports (safe to import in server components/actions)
export { createClient as createServerClient } from './supabase/server';
export * from './embeddingService';
// NOTE: metadataFetcher is NOT exported here because it has Node.js-only dependencies
// Bot app can import directly: import { metadataFetcher } from '@telepocket/shared/dist/metadataFetcher'
export * from './noteClassifier';
export * from './autoClassifyService';
export * from './tagClassifier';
export * from './autoTagService';
export * from './tagInitializer';
export * from './utils/rateLimiter';

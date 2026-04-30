/**
 * Test script to verify environment validation at startup
 * 
 * This script tests that the application correctly validates environment variables
 * and refuses to start when required variables are missing.
 * 
 * Usage: npx tsx scripts/test-env-validation.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { validateEnvironmentOrThrow } from '../src/lib/env';

console.log('Testing environment validation...\n');

try {
  validateEnvironmentOrThrow();
  console.log('✅ Environment validation passed!');
  console.log('All required environment variables are set and valid.\n');
  process.exit(0);
} catch (error) {
  console.error('❌ Environment validation failed!');
  if (error instanceof Error) {
    console.error(error.message);
  }
  console.error('\nThis is expected behavior when required variables are missing.');
  process.exit(1);
}

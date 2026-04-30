/**
 * Test script to verify environment validation fails with missing variables
 * 
 * This script tests that the application correctly detects missing environment variables
 * and refuses to start with a descriptive error message.
 * 
 * Usage: npx tsx scripts/test-env-validation-missing.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

// Simulate missing CRON_SECRET
delete process.env.CRON_SECRET;

import { validateEnvironmentOrThrow } from '../src/lib/env';

console.log('Testing environment validation with missing CRON_SECRET...\n');

try {
  validateEnvironmentOrThrow();
  console.error('❌ Test failed: Validation should have thrown an error!');
  process.exit(1);
} catch (error) {
  console.log('✅ Test passed: Validation correctly detected missing variable!');
  if (error instanceof Error) {
    console.log('\nError message:');
    console.log(error.message);
  }
  console.log('\n✅ Environment validation is working correctly!');
  process.exit(0);
}

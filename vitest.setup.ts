// Vitest setup file
// Load environment variables for testing
import { config } from 'dotenv';
import path from 'path';

// Load .env.local for tests
config({ path: path.resolve(__dirname, '.env.local') });

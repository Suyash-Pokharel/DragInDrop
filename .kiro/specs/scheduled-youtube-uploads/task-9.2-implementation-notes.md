# Task 9.2 Implementation Notes: Environment Variable Validation

## Overview

This document describes the implementation of environment variable validation for the scheduled YouTube uploads feature (Requirement 13.9).

## Changes Made

### 1. Updated `src/lib/env.ts`

Added the following YouTube-related environment variables to the `REQUIRED_ENV_VARS` array:

- **WORKER_SECRET** (Requirement 13.2)
  - Shared secret for authenticating requests to Render.com worker
  - Must be at least 32 characters for security
  - Generate with: `openssl rand -hex 32`

- **RENDER_WORKER_URL** (Requirement 13.3)
  - URL of the deployed Render.com worker service
  - Must be a valid URL starting with `http://` or `https://`
  - Example: `https://youtube-worker.onrender.com`

- **YOUTUBE_CLIENT_ID** (Requirement 13.4)
  - Google OAuth client ID for YouTube API access
  - Required for YouTube OAuth authentication

- **YOUTUBE_CLIENT_SECRET** (Requirement 13.5)
  - Google OAuth client secret for YouTube API access
  - Required for token refresh operations

The following variables were already in the list and are shared between TikTok and YouTube:

- **CRON_SECRET** (Requirements 12.1, 13.1)
- **B2_ENDPOINT_URL** (Requirements 12.8, 13.6)
- **OAUTH_ENCRYPTION_KEY** (Requirements 12.9, 13.7)
- **REDIS_URL** (Requirements 12.10, 13.8)

### 2. Added Validation Rules

#### WORKER_SECRET Validation
```typescript
case 'WORKER_SECRET':
  if (value.length < 32) {
    return {
      variable: varName,
      isValid: false,
      error: `${varName} should be at least 32 characters for security (current: ${value.length})`,
    };
  }
  break;
```

#### RENDER_WORKER_URL Validation
```typescript
case 'RENDER_WORKER_URL':
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return {
      variable: varName,
      isValid: false,
      error: `${varName} must be a valid URL starting with http:// or https://`,
    };
  }
  // Validate it's a valid URL format
  try {
    new URL(value);
  } catch {
    return {
      variable: varName,
      isValid: false,
      error: `${varName} must be a valid URL`,
    };
  }
  break;
```

### 3. Created Test Files

#### `src/lib/env.test.ts`
Comprehensive unit tests for environment variable validation:
- Tests for all required variables (CRON_SECRET, WORKER_SECRET, RENDER_WORKER_URL, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, etc.)
- Tests for validation rules (minimum length, URL format, hexadecimal format)
- Tests for `validateEnvironment()` function
- Tests for `validateEnvironmentOrThrow()` function
- Tests for `getRequiredEnv()` and `getOptionalEnv()` helper functions

#### `scripts/test-env-validation.ts`
Manual test script for verifying validation behavior:
- Test 1: Validate current environment
- Test 2: Test with missing WORKER_SECRET
- Test 3: Test with missing RENDER_WORKER_URL
- Test 4: Test with invalid WORKER_SECRET (too short)
- Test 5: Test with invalid RENDER_WORKER_URL (not a URL)
- Test 6: Test validateEnvironmentOrThrow with missing variables

### 4. Updated Documentation

Updated module-level documentation in `src/lib/env.ts` to reflect both TikTok and YouTube requirements.

## Validation Behavior

### Application Startup

The validation is automatically called during application startup via `instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironmentOrThrow } = await import('./src/lib/env');
    
    try {
      validateEnvironmentOrThrow();
    } catch (error) {
      console.error('[instrumentation] Failed to start application due to environment validation errors');
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
    }
  }
}
```

### Error Messages

When required variables are missing or invalid, the application will:

1. Log detailed error messages to the console
2. List all missing or invalid variables
3. Exit with code 1 (preventing the application from starting)

Example error message:
```
Environment validation failed. Missing or invalid required environment variables:
  - WORKER_SECRET is required but not set
  - RENDER_WORKER_URL is required but not set

Please set these variables in your .env.local file or environment configuration.
```

### Validation Rules Summary

| Variable | Validation Rule |
|----------|----------------|
| CRON_SECRET | Must be at least 32 characters |
| WORKER_SECRET | Must be at least 32 characters |
| RENDER_WORKER_URL | Must be a valid URL (http:// or https://) |
| YOUTUBE_CLIENT_ID | Must be set (no format validation) |
| YOUTUBE_CLIENT_SECRET | Must be set (no format validation) |
| OAUTH_ENCRYPTION_KEY | Must be exactly 64 hexadecimal characters |
| REDIS_URL | Must start with redis:// or rediss:// |
| B2_ENDPOINT_URL | Must NOT include protocol (no http:// or https://) |

## Testing

### Running Tests

#### Unit Tests (requires vitest installation)
```bash
npm test -- src/lib/env.test.ts --run
```

#### Manual Test Script
```bash
# Without environment variables (will show all missing)
npx tsx scripts/test-env-validation.ts

# With environment variables from .env.local
npx dotenv -e .env.local -- tsx scripts/test-env-validation.ts
```

### Test Results

All tests pass successfully:
- ✅ Correctly detects missing WORKER_SECRET
- ✅ Correctly detects missing RENDER_WORKER_URL
- ✅ Correctly detects WORKER_SECRET too short
- ✅ Correctly detects invalid RENDER_WORKER_URL format
- ✅ validateEnvironmentOrThrow correctly throws errors

## Configuration

### Setting Up Environment Variables

1. **WORKER_SECRET**: Generate a secure random string
   ```bash
   openssl rand -hex 32
   ```

2. **RENDER_WORKER_URL**: Set to your Render.com worker URL
   ```
   RENDER_WORKER_URL=https://your-worker.onrender.com
   ```

3. **YOUTUBE_CLIENT_ID** and **YOUTUBE_CLIENT_SECRET**: Obtain from Google Cloud Console
   - Go to https://console.cloud.google.com/
   - Create or select a project
   - Enable YouTube Data API v3
   - Create OAuth 2.0 credentials
   - Copy the Client ID and Client Secret

### Example .env.local Configuration

```bash
# Cron Secret (at least 32 characters)
CRON_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Worker Secret (at least 32 characters)
WORKER_SECRET=b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3

# Render.com Worker URL
RENDER_WORKER_URL=https://youtube-worker.onrender.com

# YouTube OAuth Credentials
YOUTUBE_CLIENT_ID=your_youtube_client_id_here
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret_here

# OAuth Encryption Key (exactly 64 hex characters)
OAUTH_ENCRYPTION_KEY=your_64_character_hex_encryption_key_here

# Redis URL
REDIS_URL=rediss://default:password@host:6379

# Backblaze B2 Configuration
B2_ACCOUNT_ID=your_account_id
B2_APPLICATION_KEY=your_application_key
B2_BUCKET_ID=your_bucket_id
B2_BUCKET_NAME=your_bucket_name
B2_ENDPOINT_URL=upload.example.com

# TikTok OAuth Credentials
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
```

## Integration with Existing Code

The environment variable validation is already integrated with the application startup process via `instrumentation.ts`. No additional integration is required.

The validation will automatically run when:
- The Next.js server starts
- The application is deployed to Vercel
- Any serverless function is invoked (first cold start)

## Error Handling

If the application fails to start due to missing environment variables:

1. Check the console output for detailed error messages
2. Verify all required variables are set in `.env.local` (local) or Vercel environment variables (production)
3. Ensure variable values meet the validation requirements (length, format, etc.)
4. Restart the application after fixing the configuration

## Future Enhancements

Potential improvements for future iterations:

1. Add validation for optional environment variables with warnings
2. Implement environment-specific validation (development vs. production)
3. Add validation for variable value formats (e.g., email format, URL patterns)
4. Create a CLI tool for generating secure random values
5. Add integration tests that verify the application starts successfully with valid configuration

## Related Files

- `src/lib/env.ts` - Main validation module
- `src/lib/env.test.ts` - Unit tests
- `scripts/test-env-validation.ts` - Manual test script
- `instrumentation.ts` - Application startup integration
- `.env.local` - Local environment configuration (not committed to git)

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 13.1**: CRON_SECRET validation
- **Requirement 13.2**: WORKER_SECRET validation
- **Requirement 13.3**: RENDER_WORKER_URL validation
- **Requirement 13.4**: YOUTUBE_CLIENT_ID validation
- **Requirement 13.5**: YOUTUBE_CLIENT_SECRET validation
- **Requirement 13.6**: B2_ENDPOINT_URL validation (shared with TikTok)
- **Requirement 13.7**: OAUTH_ENCRYPTION_KEY validation (shared with TikTok)
- **Requirement 13.8**: REDIS_URL validation (shared with TikTok)
- **Requirement 13.9**: Validation on application startup with descriptive errors

All required environment variables are validated, and the application will refuse to start if any are missing or invalid.

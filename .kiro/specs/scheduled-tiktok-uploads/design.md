# Design Document: Scheduled TikTok Video Uploads

## Overview

This design document specifies the technical architecture for implementing scheduled TikTok video uploads using TikTok's Content Posting API v2 with the PULL_FROM_URL method. The system enables automated publishing of scheduled posts through a GitHub Actions cron job that triggers a Vercel API endpoint every 5 minutes.

### Key Design Decisions

1. **External Cron Trigger**: Use GitHub Actions instead of Vercel Cron to avoid Vercel's Hobby plan limitations (1 cron job limit)
2. **Direct URL Upload**: Use TikTok's PULL_FROM_URL method to avoid file transfers through Vercel serverless functions
3. **Signed URLs for Security**: Use Backblaze B2 signed URLs (temporary authorization tokens) to keep bucket private while allowing TikTok to download videos
4. **Asynchronous Publishing**: Implement status polling to track upload completion since TikTok processes videos asynchronously
5. **Distributed Rate Limiting**: Use Redis for rate limiting across serverless instances
6. **Token Management**: Reuse existing encryption utilities and token refresh logic from the OAuth implementation

### System Context

The scheduled upload system integrates with:
- **Existing Post Management**: Leverages Post and PlatformPost tables
- **OAuth System**: Uses SocialAccount records with encrypted tokens
- **Backblaze B2**: Videos are stored in a public bucket accessible via HTTPS URLs
- **TikTok API**: Content Posting API v2 for video publishing
- **GitHub Actions**: External cron scheduler
- **Redis**: Distributed rate limiting and state management

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "GitHub Actions"
        CRON[Cron Trigger<br/>Every 5 minutes]
    end
    
    subgraph "Vercel Serverless"
        API[/api/cron/process-scheduled-tiktok-uploads]
        AUTH[Authorization Check]
        QUERY[Query Scheduled Posts]
        PROCESS[Process Each Post]
        UPLOAD[Upload to TikTok]
        POLL[Poll Upload Status]
        UPDATE[Update Database]
    end
    
    subgraph "Database"
        POST[(Post Table)]
        PLATFORM[(PlatformPost Table)]
        SOCIAL[(SocialAccount Table)]
    end
    
    subgraph "External Services"
        TIKTOK[TikTok API]
        B2[Backblaze B2]
        REDIS[(Redis)]
    end
    
    CRON -->|POST with secret| API
    API --> AUTH
    AUTH -->|Valid| QUERY
    QUERY --> POST
    QUERY --> PLATFORM
    QUERY --> SOCIAL
    PROCESS --> UPLOAD
    UPLOAD -->|PULL_FROM_URL| TIKTOK
    TIKTOK -->|Download video| B2
    TIKTOK -->|Return publish_id| UPLOAD
    UPLOAD --> UPDATE
    POLL -->|Check status| TIKTOK
    POLL --> UPDATE
    UPDATE --> PLATFORM
    UPDATE --> POST
    PROCESS --> REDIS
    UPLOAD --> REDIS
    POLL --> REDIS
```

### Component Interaction Flow

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant API as Vercel API
    participant DB as Database
    participant Token as Token Manager
    participant TikTok as TikTok API
    participant B2 as Backblaze B2
    participant Redis as Redis
    
    Note over GH: Every 5 minutes
    GH->>API: POST /api/cron/process-scheduled-tiktok-uploads
    API->>API: Verify CRON_SECRET
    
    API->>DB: Query scheduled posts<br/>(scheduledFor within ±6 min)
    DB-->>API: Posts with PENDING TikTok uploads
    
    loop For each post
        API->>DB: Get SocialAccount
        DB-->>API: Encrypted tokens + expiresAt
        
        API->>Token: Check if token expired
        alt Token expired
            Token->>TikTok: Refresh token
            TikTok-->>Token: New access token
            Token->>DB: Update encrypted tokens
        end
        
        Token-->>API: Valid access token
        
        API->>Redis: Check rate limit
        Redis-->>API: OK
        
        API->>API: Construct B2 URL
        API->>TikTok: POST /v2/post/publish/video/init/<br/>source=PULL_FROM_URL
        TikTok->>B2: Download video
        B2-->>TikTok: Video file
        TikTok-->>API: publish_id
        
        API->>DB: Update PlatformPost<br/>status=PUBLISHING<br/>publishId=...
        API->>Redis: Increment rate limit counter
    end
    
    API->>DB: Query PUBLISHING posts
    DB-->>API: Posts with publish_id
    
    loop For each publishing post
        API->>Redis: Check rate limit
        Redis-->>API: OK
        
        API->>TikTok: POST /v2/post/publish/status/fetch/
        TikTok-->>API: Status (PROCESSING/COMPLETE/FAILED)
        
        alt Status = PUBLISH_COMPLETE
            API->>DB: Update PlatformPost<br/>status=PUBLISHED
        else Status = FAILED
            API->>DB: Update PlatformPost<br/>status=FAILED
        end
        
        API->>DB: Sync Post status
        API->>Redis: Increment rate limit counter
    end
    
    API-->>GH: 200 OK with summary
```

## Components and Interfaces

### 1. GitHub Actions Workflow

**File**: `.github/workflows/scheduled-tiktok-uploads.yml`

**Purpose**: External cron scheduler that triggers the Vercel API endpoint every 5 minutes.

**Configuration**:
```yaml
name: Scheduled TikTok Uploads
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual triggering

jobs:
  trigger-uploads:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vercel API
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            ${{ secrets.VERCEL_API_URL }}/api/cron/process-scheduled-tiktok-uploads
```

**Required GitHub Secrets**:
- `CRON_SECRET`: Secret token for authenticating with the Vercel API
- `VERCEL_API_URL`: Base URL of the Vercel deployment (e.g., https://dragindrop.vercel.app)

**Error Handling**:
- If the API request fails, GitHub Actions will log the error
- The next scheduled run (5 minutes later) will retry
- Manual triggering via `workflow_dispatch` allows testing and recovery

### 2. Vercel API Endpoint

**File**: `src/app/api/cron/process-scheduled-tiktok-uploads/route.ts`

**Purpose**: Main orchestrator for processing scheduled TikTok uploads and polling status.

**Interface**:
```typescript
POST /api/cron/process-scheduled-tiktok-uploads
Headers:
  Authorization: Bearer <CRON_SECRET>
  Content-Type: application/json

Response 200:
{
  "success": true,
  "processed": 5,
  "uploaded": 3,
  "polled": 2,
  "errors": []
}

Response 401:
{
  "error": "Unauthorized"
}

Response 500:
{
  "error": "Internal server error",
  "details": "..."
}
```

**Core Responsibilities**:
1. Authenticate the request using CRON_SECRET
2. Query for scheduled posts within the scheduling window
3. Process each post: upload to TikTok or poll status
4. Update database with results
5. Return summary of operations

**Module Structure**:
```typescript
// Main handler
export async function POST(request: NextRequest): Promise<NextResponse>

// Authorization
function verifyCronSecret(request: NextRequest): boolean

// Scheduling window calculation
function getSchedulingWindow(): { start: Date; end: Date }

// Post processing
async function processScheduledPosts(): Promise<ProcessResult>
async function uploadToTikTok(post: Post, platformPost: PlatformPost, socialAccount: SocialAccount): Promise<UploadResult>
async function pollUploadStatus(platformPost: PlatformPost, socialAccount: SocialAccount): Promise<StatusResult>

// Database updates
async function updatePlatformPostStatus(platformPostId: string, status: PlatformPostStatus, publishId?: string, errorMessage?: string): Promise<void>
async function syncPostStatus(postId: string): Promise<void>
```

### 3. TikTok API Integration Module

**File**: `src/lib/tiktok/api.ts`

**Purpose**: Encapsulates all TikTok API interactions with proper error handling and rate limiting.

**Interface**:
```typescript
// Upload video via PULL_FROM_URL
interface UploadVideoParams {
  accessToken: string;
  videoUrl: string; // Signed URL with authorization token
  title: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

interface UploadVideoResponse {
  success: boolean;
  publishId?: string;
  error?: string;
  errorCode?: string;
}

async function uploadVideo(params: UploadVideoParams): Promise<UploadVideoResponse>

// Poll upload status
interface PollStatusParams {
  accessToken: string;
  publishId: string;
}

interface PollStatusResponse {
  success: boolean;
  status?: 'PROCESSING_DOWNLOAD' | 'PROCESSING_UPLOAD' | 'PUBLISH_COMPLETE' | 'FAILED';
  error?: string;
  errorCode?: string;
  failReason?: string;
}

async function pollStatus(params: PollStatusParams): Promise<PollStatusResponse>

// TikTok API response types
interface TikTokUploadResponse {
  data?: {
    publish_id: string;
  };
  error?: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface TikTokStatusResponse {
  data?: {
    status: string;
    fail_reason?: string;
    publicaly_available_post_id?: string[];
  };
  error?: {
    code: string;
    message: string;
    log_id: string;
  };
}
```

**Error Handling**:
- HTTP 400: Invalid request parameters → Return error to caller
- HTTP 401/403: Token expired → Trigger token refresh
- HTTP 429: Rate limit exceeded → Log and skip
- HTTP 5xx: Server error → Retry with exponential backoff
- Network timeout: 30-second timeout → Treat as temporary failure

### 4. Rate Limiting Module

**File**: `src/lib/tiktok/rateLimiter.ts`

**Purpose**: Enforce TikTok API rate limits using Redis.

**Interface**:
```typescript
interface RateLimitConfig {
  maxUploadsPerDay: number;  // 10
  maxStatusPollsPerDay: number;  // 100
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

async function checkUploadRateLimit(userId: string): Promise<RateLimitResult>
async function checkStatusPollRateLimit(userId: string): Promise<RateLimitResult>
async function incrementUploadCounter(userId: string): Promise<void>
async function incrementStatusPollCounter(userId: string): Promise<void>
```

**Redis Keys**:
- `tiktok:upload:${userId}:${date}` → Upload counter (expires at midnight UTC)
- `tiktok:poll:${userId}:${date}` → Status poll counter (expires at midnight UTC)

**Implementation**:
```typescript
// Redis key format
const uploadKey = `tiktok:upload:${userId}:${YYYYMMDD}`;
const pollKey = `tiktok:poll:${userId}:${YYYYMMDD}`;

// Check limit
const count = await redis.get(key);
if (count >= limit) {
  return { allowed: false, remaining: 0, resetAt: nextMidnightUTC };
}

// Increment counter
await redis.incr(key);
await redis.expireAt(key, nextMidnightUTC);
```

### 5. URL Construction Module

**File**: `src/lib/backblaze/urlBuilder.ts`

**Purpose**: Generate signed Backblaze B2 URLs with temporary authorization tokens for secure video access from private buckets.

**Interface**:
```typescript
interface BackblazeConfig {
  accountId: string;
  applicationKey: string;
  bucketId: string;
  bucketName: string;
  endpoint: string;
}

interface SignedUrlResult {
  signedUrl: string;
  expiresAt: Date;
}

async function buildSignedVideoUrl(videoFileKey: string): Promise<SignedUrlResult> {
  const config = getBackblazeConfig();
  
  // Step 1: Authorize with B2 API
  const authData = await authorizeB2Account(config.accountId, config.applicationKey);
  
  // Step 2: Get download authorization token
  const authToken = await getDownloadAuthorization({
    authorizationToken: authData.authorizationToken,
    apiUrl: authData.apiUrl,
    bucketId: config.bucketId,
    fileNamePrefix: videoFileKey,
    validDurationInSeconds: 3600 // 1 hour
  });
  
  // Step 3: Construct signed URL
  const encodedKey = encodeURIComponent(videoFileKey);
  const baseUrl = `https://${config.endpoint}/file/${config.bucketName}/${encodedKey}`;
  const signedUrl = `${baseUrl}?Authorization=${authToken}`;
  
  return {
    signedUrl,
    expiresAt: new Date(Date.now() + 3600 * 1000)
  };
}

async function authorizeB2Account(accountId: string, applicationKey: string): Promise<B2AuthResponse> {
  // Call b2_authorize_account API
}

async function getDownloadAuthorization(params: {
  authorizationToken: string;
  apiUrl: string;
  bucketId: string;
  fileNamePrefix: string;
  validDurationInSeconds: number;
}): Promise<string> {
  // Call b2_get_download_authorization API
}

function getBackblazeConfig(): BackblazeConfig {
  const accountId = process.env.B2_ACCOUNT_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucketId = process.env.B2_BUCKET_ID;
  const bucketName = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT_URL;
  
  if (!accountId || !applicationKey || !bucketId || !bucketName || !endpoint) {
    throw new Error('Missing Backblaze configuration');
  }
  
  return { accountId, applicationKey, bucketId, bucketName, endpoint };
}
```

**Signed URL Format**:
```
https://s3.eu-central-003.backblazeb2.com/file/DragInDrop/uploads/user123/video.mp4?Authorization=4_abc123xyz...
```

**Security Features**:
- Bucket remains PRIVATE (no public access)
- Authorization token valid for 1 hour only
- Each upload gets unique token
- No bandwidth charges for public bucket
- No domain verification required

**Validation**:
- Ensure HTTPS protocol
- URL-encode special characters in videoFileKey
- Validate all environment variables are set
- Handle B2 API errors gracefully

## Data Models

### Database Schema Changes

**PlatformPost Table Extension**:
```prisma
model PlatformPost {
  id              String             @id @default(cuid())
  postId          String
  socialAccountId String
  platformPostId  String?
  platformUrl     String?
  status          PlatformPostStatus @default(PENDING)
  errorMessage    String?
  retryCount      Int                @default(0)
  publishedAt     DateTime?
  publishId       String?            // NEW: TikTok publish_id for status tracking
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  Post            Post               @relation(fields: [postId], references: [id], onDelete: Cascade)
  SocialAccount   SocialAccount      @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)

  @@unique([postId, socialAccountId])
  @@index([postId])
  @@index([socialAccountId])
  @@index([status])
  @@index([publishId])  // NEW: Index for efficient status polling queries
}
```

**Migration**:
```sql
-- Add publishId column
ALTER TABLE "PlatformPost" ADD COLUMN "publishId" TEXT;

-- Add index for status polling queries
CREATE INDEX "PlatformPost_publishId_idx" ON "PlatformPost"("publishId");
```

### Status Flow Diagram

```mermaid
stateDiagram-v2
    [*] --> PENDING: Post created
    PENDING --> PUBLISHING: TikTok upload initiated<br/>(publish_id received)
    PUBLISHING --> PUBLISHED: Status poll returns<br/>PUBLISH_COMPLETE
    PUBLISHING --> FAILED: Status poll returns<br/>FAILED
    PUBLISHING --> PUBLISHING: Status poll returns<br/>PROCESSING_*
    PENDING --> FAILED: Upload API error<br/>(after 3 retries)
    FAILED --> [*]
    PUBLISHED --> [*]
    
    note right of PENDING
        Waiting for scheduled time
        or retry after failure
    end note
    
    note right of PUBLISHING
        TikTok is processing video
        Poll status every 5 minutes
    end note
```

### Post Status Synchronization Logic

The Post table status is derived from all associated PlatformPost records:

```typescript
function calculatePostStatus(platformPosts: PlatformPost[]): PostStatus {
  const statuses = platformPosts.map(pp => pp.status);
  
  // All published → PUBLISHED
  if (statuses.every(s => s === 'PUBLISHED')) {
    return 'PUBLISHED';
  }
  
  // All failed → FAILED
  if (statuses.every(s => s === 'FAILED')) {
    return 'FAILED';
  }
  
  // Any publishing → PUBLISHING
  if (statuses.some(s => s === 'PUBLISHING')) {
    return 'PUBLISHING';
  }
  
  // Mix of published and failed → PARTIALLY_PUBLISHED
  if (statuses.some(s => s === 'PUBLISHED') && statuses.some(s => s === 'FAILED')) {
    return 'PARTIALLY_PUBLISHED';
  }
  
  // All pending → SCHEDULED
  return 'SCHEDULED';
}
```

## Error Handling

### Error Categories and Responses

| Error Type | HTTP Status | Retry Strategy | User Impact |
|------------|-------------|----------------|-------------|
| Invalid CRON_SECRET | 401 | No retry | GitHub Actions logs error |
| Missing environment variables | 500 | No retry | System cannot start |
| Database connection error | 500 | Retry next cron run | Temporary delay |
| Token expired | N/A | Auto-refresh | Transparent to user |
| Token refresh failed | N/A | Mark as FAILED | User must reconnect account |
| TikTok API 400 (bad request) | N/A | No retry | Mark as FAILED with error message |
| TikTok API 401/403 (auth) | N/A | Refresh token + 1 retry | Transparent or FAILED |
| TikTok API 429 (rate limit) | N/A | Skip until next run | Temporary delay |
| TikTok API 5xx (server error) | N/A | Retry up to 3 times | Temporary delay or FAILED |
| Network timeout | N/A | Retry up to 3 times | Temporary delay or FAILED |
| Rate limit exceeded (our limit) | N/A | Skip until next day | User sees rate limit message |

### Retry Logic

**Upload Failures**:
```typescript
async function uploadWithRetry(
  post: Post,
  platformPost: PlatformPost,
  socialAccount: SocialAccount
): Promise<UploadResult> {
  const MAX_RETRIES = 3;
  
  if (platformPost.retryCount >= MAX_RETRIES) {
    return {
      success: false,
      error: 'Max retries exceeded',
      shouldMarkFailed: true
    };
  }
  
  const result = await uploadToTikTok(post, platformPost, socialAccount);
  
  if (!result.success && result.isRetryable) {
    await incrementRetryCount(platformPost.id);
    return {
      success: false,
      error: result.error,
      shouldMarkFailed: false  // Will retry on next cron run
    };
  }
  
  return result;
}
```

**Token Refresh**:
- Reuse existing `tokenManager.ts` logic
- Automatic refresh when `expiresAt < now + 5 minutes`
- If refresh fails with `invalid_grant`, deactivate SocialAccount
- If refresh fails with network error, retry with exponential backoff (up to 3 attempts)

### Error Logging

All errors must be logged with context:
```typescript
console.error('[process-scheduled-tiktok-uploads] Upload failed:', {
  userId: post.userId,
  postId: post.id,
  platformPostId: platformPost.id,
  platform: 'TikTok',
  error: error.message,
  errorCode: error.code,
  retryCount: platformPost.retryCount,
  timestamp: new Date().toISOString()
});
```

**Security Requirements**:
- NEVER log plaintext access tokens or refresh tokens
- NEVER log CRON_SECRET
- Log encrypted token lengths for debugging
- Log TikTok API error codes and messages

## Testing Strategy

### Property-Based Testing Assessment

**PBT is NOT applicable to this feature** because:

1. **Infrastructure as Code**: GitHub Actions workflow is declarative configuration, not a function with testable properties
2. **External Service Integration**: The feature primarily orchestrates external services (TikTok API, Redis, Database) rather than implementing pure business logic
3. **Side-Effect Operations**: Most operations (API calls, database updates) have no return values to assert universal properties on
4. **Deterministic External Behavior**: TikTok API behavior doesn't vary meaningfully with input in ways that would benefit from randomized testing

**Appropriate Testing Strategies**:
- Unit tests with mocks for individual functions
- Integration tests for end-to-end workflows
- Manual testing for TikTok API integration
- Snapshot tests for GitHub Actions YAML configuration

### Unit Tests

**Test Files**:
- `src/app/api/cron/process-scheduled-tiktok-uploads/route.test.ts`
- `src/lib/tiktok/api.test.ts`
- `src/lib/tiktok/rateLimiter.test.ts`
- `src/lib/backblaze/urlBuilder.test.ts`

**Test Coverage**:

1. **Authorization Tests**:
   - Valid CRON_SECRET → 200 response
   - Invalid CRON_SECRET → 401 response
   - Missing Authorization header → 401 response

2. **Scheduling Window Tests**:
   - Posts within window are selected
   - Posts outside window are excluded
   - Window calculation is correct (±6 minutes)

3. **URL Construction Tests**:
   - Valid videoFileKey → correct HTTPS URL
   - Special characters in videoFileKey → properly encoded
   - Missing environment variables → throws error

4. **Rate Limiting Tests**:
   - Within limit → allowed
   - At limit → blocked
   - Counter increments correctly
   - Counters reset at midnight UTC

5. **Status Synchronization Tests**:
   - All PUBLISHED → Post status PUBLISHED
   - All FAILED → Post status FAILED
   - Mix → Post status PARTIALLY_PUBLISHED
   - Any PUBLISHING → Post status PUBLISHING

6. **Error Handling Tests**:
   - Token expired → triggers refresh
   - Token refresh fails → marks as FAILED
   - TikTok API 429 → skips processing
   - TikTok API 5xx → increments retry count
   - Max retries exceeded → marks as FAILED

### Integration Tests

**Test Scenarios**:

1. **End-to-End Upload Flow**:
   - Create scheduled post
   - Trigger cron endpoint
   - Verify TikTok API called with correct parameters
   - Verify database updated with publish_id
   - Verify status changed to PUBLISHING

2. **Status Polling Flow**:
   - Create post with PUBLISHING status and publish_id
   - Trigger cron endpoint
   - Verify TikTok status API called
   - Verify database updated based on status

3. **Token Refresh Flow**:
   - Create post with expired token
   - Trigger cron endpoint
   - Verify token refresh called
   - Verify upload proceeds with new token

4. **Rate Limiting Flow**:
   - Exhaust rate limit for user
   - Trigger cron endpoint
   - Verify upload skipped
   - Verify error logged

**Mocking Strategy**:
- Mock TikTok API responses using `msw` (Mock Service Worker)
- Mock Redis using `ioredis-mock`
- Use test database for Prisma operations
- Mock Backblaze URLs (no actual file access needed)

### Manual Testing Checklist

**Prerequisites**:
1. ✅ Backblaze domain verified with TikTok
2. ✅ GitHub Actions workflow configured
3. ✅ CRON_SECRET set in GitHub Secrets and Vercel
4. ✅ Redis configured and accessible
5. ✅ TikTok OAuth connected for test user

**Test Cases**:
1. **Successful Upload**:
   - Create post scheduled for current time
   - Wait for cron trigger (max 5 minutes)
   - Verify post status changes to PUBLISHING
   - Wait for status poll (max 5 minutes)
   - Verify post status changes to PUBLISHED
   - Verify video appears on TikTok account

2. **Failed Upload**:
   - Create post with invalid video URL
   - Wait for cron trigger
   - Verify post status changes to FAILED
   - Verify error message is descriptive

3. **Token Refresh**:
   - Manually expire token in database
   - Create scheduled post
   - Wait for cron trigger
   - Verify token refreshed automatically
   - Verify upload succeeds

4. **Rate Limit**:
   - Create 11 posts for same user
   - Wait for cron trigger
   - Verify first 10 upload
   - Verify 11th is skipped with rate limit log

5. **Multiple Platforms**:
   - Create post for TikTok and YouTube
   - Wait for cron trigger
   - Verify only TikTok upload processed
   - Verify Post status reflects both platforms

## Implementation Plan

### Phase 1: Database Schema (1 day)

1. Add `publishId` field to PlatformPost table
2. Create migration script
3. Add index on `publishId`
4. Test migration on development database

### Phase 2: Core Modules (3 days)

1. **URL Builder Module** (0.5 day):
   - Implement `buildVideoUrl()`
   - Add environment variable validation
   - Write unit tests

2. **TikTok API Module** (1 day):
   - Implement `uploadVideo()`
   - Implement `pollStatus()`
   - Add error handling and timeout logic
   - Write unit tests with mocked responses

3. **Rate Limiter Module** (1 day):
   - Implement Redis-based rate limiting
   - Add counter increment/check functions
   - Handle Redis connection errors
   - Write unit tests with ioredis-mock

4. **Token Management Integration** (0.5 day):
   - Verify existing `tokenManager.ts` works for TikTok
   - Add any TikTok-specific token handling
   - Write integration tests

### Phase 3: API Endpoint (2 days)

1. **Endpoint Implementation** (1 day):
   - Create route handler
   - Implement authorization check
   - Implement scheduling window query
   - Implement upload processing loop
   - Implement status polling loop
   - Add comprehensive logging

2. **Database Operations** (0.5 day):
   - Implement `updatePlatformPostStatus()`
   - Implement `syncPostStatus()`
   - Add transaction safety
   - Write unit tests

3. **Error Handling** (0.5 day):
   - Add retry logic
   - Add error categorization
   - Add error logging
   - Write error handling tests

### Phase 4: GitHub Actions (0.5 day)

1. Create workflow file
2. Configure secrets
3. Test manual trigger
4. Verify cron schedule

### Phase 5: Testing (2 days)

1. **Unit Tests** (1 day):
   - Write tests for all modules
   - Achieve >80% code coverage
   - Test error paths

2. **Integration Tests** (0.5 day):
   - Test end-to-end upload flow
   - Test status polling flow
   - Test token refresh flow

3. **Manual Testing** (0.5 day):
   - Test in Vercel preview environment
   - Verify TikTok uploads work
   - Test rate limiting
   - Test error scenarios

### Phase 6: Deployment (1 day)

1. Deploy database migration to production
2. Deploy code to Vercel
3. Configure GitHub Actions in production repository
4. Monitor first few cron runs
5. Verify logs and error handling

**Total Estimated Time**: 9.5 days

## Security Considerations

### Authentication and Authorization

1. **Cron Endpoint Security**:
   - Require `Authorization: Bearer <CRON_SECRET>` header
   - Use cryptographically secure secret (min 32 characters)
   - Rotate CRON_SECRET periodically
   - Log all unauthorized access attempts

2. **Token Security**:
   - Reuse existing AES-256-GCM encryption
   - Never log plaintext tokens
   - Validate user owns SocialAccount before token access
   - Deactivate accounts with invalid refresh tokens

3. **Environment Variables**:
   - Store all secrets in Vercel environment variables
   - Never commit secrets to repository
   - Use different secrets for preview/production

### Rate Limiting

1. **TikTok API Limits**:
   - 10 uploads per user per day
   - 100 status polls per user per day
   - Use Redis for distributed tracking
   - Log rate limit violations

2. **Endpoint Protection**:
   - No additional rate limiting needed (authenticated by secret)
   - GitHub Actions runs on fixed schedule
   - Monitor for unusual activity

### Data Privacy

1. **Logging**:
   - Log userId, postId, platformPostId for debugging
   - Never log video content or URLs with sensitive data
   - Never log access tokens or refresh tokens
   - Log error messages without sensitive context

2. **Error Messages**:
   - Return generic errors to GitHub Actions
   - Log detailed errors server-side
   - Don't expose internal system details

## Monitoring and Observability

### Key Metrics

1. **Success Metrics**:
   - Posts processed per cron run
   - Successful uploads per day
   - Average time from scheduled to published
   - Status poll success rate

2. **Error Metrics**:
   - Failed uploads per day
   - Token refresh failures
   - Rate limit hits
   - TikTok API errors by type

3. **Performance Metrics**:
   - Cron execution time
   - TikTok API response time
   - Database query time
   - Redis operation time

### Logging Strategy

**Log Levels**:
- `INFO`: Cron start/end, successful operations
- `WARN`: Rate limits, retryable errors
- `ERROR`: Failed uploads, token refresh failures, API errors

**Log Format**:
```typescript
{
  level: 'INFO' | 'WARN' | 'ERROR',
  timestamp: '2025-01-15T10:30:00.000Z',
  component: 'scheduled-tiktok-uploads',
  operation: 'upload' | 'poll' | 'token-refresh',
  userId: 'user123',
  postId: 'post456',
  platformPostId: 'pp789',
  message: 'Upload successful',
  metadata: {
    publishId: 'tiktok123',
    retryCount: 0,
    duration: 1234
  }
}
```

### Alerting

**Critical Alerts** (immediate notification):
- Cron endpoint returns 500 for 3 consecutive runs
- Database connection failures
- Redis connection failures
- Token refresh failures > 10% of attempts

**Warning Alerts** (daily digest):
- Upload failures > 20% of attempts
- Rate limit hits > 50% of users
- Average cron execution time > 30 seconds

## Future Enhancements

### Short-term (Next Sprint)

1. **Retry Queue**:
   - Move failed uploads to a retry queue
   - Process retry queue separately from scheduled posts
   - Implement exponential backoff for retries

2. **User Notifications**:
   - Email notification when post published
   - Email notification when post fails
   - In-app notification system

3. **Analytics Dashboard**:
   - Show upload success rate
   - Show average time to publish
   - Show rate limit usage

### Long-term (Future Releases)

1. **Multi-Platform Support**:
   - Extend to YouTube Shorts
   - Extend to Instagram Reels
   - Unified scheduling interface

2. **Advanced Scheduling**:
   - Recurring posts
   - Optimal time suggestions
   - Timezone-aware scheduling UI

3. **Video Processing**:
   - Automatic thumbnail generation
   - Video format validation
   - Video compression

4. **Webhook Support**:
   - TikTok webhook for status updates
   - Eliminate need for status polling
   - Real-time status updates

## Appendix

### TikTok API Reference

**Upload Video Endpoint**:
```
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "post_info": {
    "title": "My Video Title",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_comment": false,
    "disable_duet": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "PULL_FROM_URL",
    "video_url": "https://example.com/video.mp4"
  }
}

Response 200:
{
  "data": {
    "publish_id": "v_pub_1234567890"
  },
  "error": {
    "code": "ok",
    "message": "",
    "log_id": "202501151030abcd"
  }
}
```

**Status Poll Endpoint**:
```
POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "publish_id": "v_pub_1234567890"
}

Response 200:
{
  "data": {
    "status": "PUBLISH_COMPLETE",
    "publicaly_available_post_id": ["7123456789012345678"],
    "uploaded_bytes": 5242880,
    "fail_reason": ""
  },
  "error": {
    "code": "ok",
    "message": "",
    "log_id": "202501151035abcd"
  }
}
```

**Status Values**:
- `PROCESSING_DOWNLOAD`: TikTok is downloading video from URL
- `PROCESSING_UPLOAD`: TikTok is processing the video
- `PUBLISH_COMPLETE`: Video published successfully
- `FAILED`: Upload or processing failed

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CRON_SECRET` | Yes | Secret for authenticating GitHub Actions | `a1b2c3d4e5f6...` (32+ chars) |
| `TIKTOK_CLIENT_KEY` | Yes | TikTok OAuth client key | `sbawcfk63413z82u36` |
| `TIKTOK_CLIENT_SECRET` | Yes | TikTok OAuth client secret | `rmBlOLIHJgZvriQs...` |
| `B2_ACCOUNT_ID` | Yes | Backblaze B2 account ID | `0038497fcecf92d0000000001` |
| `B2_APPLICATION_KEY` | Yes | Backblaze B2 application key | `K003yqBzQlf+V5BaFA6...` |
| `B2_BUCKET_ID` | Yes | Backblaze B2 bucket ID | `6854c9d72fec9e3c9fd9021d` |
| `B2_BUCKET_NAME` | Yes | Backblaze bucket name | `DragInDrop` |
| `B2_ENDPOINT_URL` | Yes | Backblaze S3-compatible endpoint | `s3.eu-central-003.backblazeb2.com` |
| `OAUTH_ENCRYPTION_KEY` | Yes | 64-char hex key for token encryption | `b4a17e0e287c6929...` |
| `REDIS_URL` | Yes | Redis connection URL | `rediss://default:pass@host:6379` |
| `DATABASE_URL` | Yes | PostgreSQL connection URL | `postgresql://user:pass@host/db` |

### Redis Key Schema

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `tiktok:upload:{userId}:{YYYYMMDD}` | Integer | Midnight UTC | Upload counter |
| `tiktok:poll:{userId}:{YYYYMMDD}` | Integer | Midnight UTC | Status poll counter |

### Database Query Patterns

**Find Scheduled Posts**:
```sql
SELECT p.*, pp.*, sa.*
FROM "Post" p
INNER JOIN "PlatformPost" pp ON pp."postId" = p.id
INNER JOIN "SocialAccount" sa ON sa.id = pp."socialAccountId"
WHERE p.status = 'SCHEDULED'
  AND p."scheduledFor" >= NOW() - INTERVAL '6 minutes'
  AND p."scheduledFor" <= NOW() + INTERVAL '6 minutes'
  AND pp.status = 'PENDING'
  AND sa.platform = 'TikTok'
  AND sa."isActive" = true;
```

**Find Publishing Posts**:
```sql
SELECT pp.*, sa.*
FROM "PlatformPost" pp
INNER JOIN "SocialAccount" sa ON sa.id = pp."socialAccountId"
WHERE pp.status = 'PUBLISHING'
  AND pp."publishId" IS NOT NULL
  AND sa.platform = 'TikTok'
  AND sa."isActive" = true;
```

**Sync Post Status**:
```sql
-- Get all platform posts for a post
SELECT status FROM "PlatformPost" WHERE "postId" = $1;

-- Update post status based on platform posts
UPDATE "Post"
SET status = $2, "updatedAt" = NOW()
WHERE id = $1;
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-15  
**Author**: AI Design Agent  
**Status**: Ready for Review

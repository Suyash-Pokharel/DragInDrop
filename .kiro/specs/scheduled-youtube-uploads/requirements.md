# Requirements Document

## Introduction

This document specifies the requirements for implementing scheduled YouTube video uploads using YouTube Data API v3 with resumable upload protocol. The system enables users to schedule YouTube posts that are automatically published at the specified time using a cron-job.org trigger (every 5 minutes) that initiates a Vercel API endpoint, which then delegates the actual video download and upload work to a Render.com background worker.

### Key Architectural Differences from TikTok Implementation

| Aspect | TikTok (Existing) | YouTube (New) |
|--------|-------------------|---------------|
| **Upload Method** | PULL_FROM_URL (TikTok downloads from Backblaze) | Resumable Upload (We download, then upload) |
| **Execution Location** | Vercel endpoint (10s timeout sufficient) | Render.com background worker (handles long operations) |
| **Video Download** | Not needed (TikTok downloads directly) | Required (250MB videos, takes time) |
| **File Size Handling** | Any size (TikTok handles download) | Up to 250MB (we must download and upload) |
| **API Complexity** | Simple POST with URL | Multi-step resumable upload protocol |
| **Status Tracking** | Poll TikTok API for status | Immediate video ID on completion |
| **Worker Communication** | N/A | HTTP POST to Render + callback/polling |

### Research Findings

#### YouTube Data API v3 Upload Process

Based on official Google documentation ([source](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)):

1. **Resumable Upload Protocol**: YouTube requires a multi-step upload process:
   - Step 1: POST to initiate session → receive upload URL
   - Step 2: PUT binary video data to upload URL
   - Step 3: Receive video resource on completion (201 Created)

2. **File Size Limits**: No explicit limit mentioned in current API docs, but resumable uploads are designed for large files

3. **Quota Costs**: Video upload costs 1600 quota units (default daily quota: 10,000 units = ~6 uploads/day)

4. **Authentication**: Requires OAuth 2.0 with `youtube.upload` scope (already implemented)

5. **Chunked Uploads**: Supported for progress tracking and unstable networks (chunks must be multiples of 256 KB)

6. **Privacy Levels**: PUBLIC, UNLISTED, PRIVATE (unlike TikTok sandbox limitation)

#### Render.com Free Tier Capabilities

Based on official Render documentation ([source](https://www.render.com/docs/free)):

**✅ CRITICAL FINDING: Background Workers are NOT available on Free tier**

The Render.com free tier documentation explicitly states:
- Free tier supports: Web Services, Static Sites, Postgres, Key Value
- Background Workers require paid plans
- Free web services have 15-minute spin-down after inactivity
- Free web services have 750 hours/month limit

**Alternative Architecture Required**: Since Render.com background workers are not free, we must use an alternative approach:

**Option 1: Render.com Free Web Service** (Recommended)
- Deploy a simple Express/Node.js web service on Render free tier
- Vercel endpoint sends HTTP POST to Render web service
- Render service downloads video and uploads to YouTube
- Returns status via HTTP response or callback
- **Limitation**: 15-minute spin-down (first request after spin-down takes ~1 minute)
- **Workaround**: Keep-alive ping every 14 minutes from Vercel cron

**Option 2: Vercel Background Functions** (Not viable)
- Vercel Hobby tier has 10-second execution limit
- Cannot download 250MB videos in 10 seconds

**Option 3: Self-hosted Worker** (Complex)
- Requires user to run own server
- Not suitable for this use case

#### BullMQ + Redis Queue (Considered but not viable)

- BullMQ requires a worker process running continuously
- Cannot run workers on Vercel (serverless)
- Would still need Render.com or similar for worker hosting
- Adds complexity without solving the free tier limitation

### Recommended Architecture

```
cron-job.org (every 5 minutes - upload processing)
    ↓ HTTP POST with CRON_SECRET
Vercel API Endpoint (/api/cron/process-scheduled-youtube-uploads)
    ↓ Query scheduled posts (±6 minute window)
    ↓ For each YouTube post:
    ↓ HTTP POST (job details + WORKER_SECRET)
Render.com Free Web Service (/upload)
    ↓ Download video from Backblaze (via Cloudflare Worker proxy)
    ↓ Upload to YouTube (resumable upload protocol)
    ↓ HTTP Response (success/failure)
Vercel API Endpoint
    ↓ Update database with result
    ↓ Sync Post status

cron-job.org (every 5 minutes - keep-alive)
    ↓ HTTP GET
Render.com Free Web Service (/health)
    ↓ HTTP 200 {status: "ok"}
```

**Key Timing Details**:
- **Upload processing cron**: `*/5 * * * *` (fires at 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
- **Keep-alive cron**: `*/5 * * * *` (fires at 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
- **Scheduling window**: ±6 minutes from current time (catches all posts within 5-minute cron interval)
- **Render.com spin-down**: 15 minutes of inactivity
- **Safety margin**: 10 minutes (15 min threshold - 5 min ping interval)
- **Result**: Service never spins down, no cold starts, all uploads processed within 5 minutes of scheduled time

## Glossary

- **Scheduler_Service**: The cron-job.org workflow that runs every 5 minutes to trigger scheduled post processing
- **Upload_Processor**: The Vercel API endpoint (`/api/cron/process-scheduled-youtube-uploads`) that processes scheduled YouTube uploads
- **Upload_Worker**: The Render.com free web service that downloads videos and uploads them to YouTube
- **YouTube_API**: YouTube Data API v3 for video uploads
- **Post_Record**: A database record in the Post table representing a scheduled post
- **Platform_Post_Record**: A database record in the PlatformPost table representing a platform-specific post
- **Social_Account_Record**: A database record in the SocialAccount table containing YouTube OAuth credentials
- **Backblaze_URL**: An HTTPS URL pointing to a video file in Backblaze B2 storage via Cloudflare Worker proxy
- **Publish_ID**: A unique identifier for tracking async upload jobs (used internally, not from YouTube API)
- **Video_ID**: The YouTube video ID returned after successful upload
- **Access_Token**: An encrypted OAuth 2.0 access token for authenticating with YouTube API
- **Refresh_Token**: An encrypted OAuth 2.0 refresh token for obtaining new access tokens
- **Token_Expiration**: The timestamp when an access token expires and requires refresh
- **Scheduling_Window**: A 12-minute time window (6 minutes before and 6 minutes after current time) for finding scheduled posts
- **Resumable_Upload_Session**: A temporary upload session created by YouTube API with a unique upload URL
- **Upload_URL**: The unique URL returned by YouTube for uploading video binary data
- **Rate_Limiter**: The system component that enforces API rate limits to prevent exceeding YouTube's quotas
- **Keep_Alive_Ping**: A periodic HTTP request to prevent Render.com free service from spinning down

## Requirements

### Requirement 1: Render.com Upload Worker Service

**User Story:** As the system, I want a dedicated web service on Render.com to handle video downloads and YouTube uploads, so that long-running operations don't exceed Vercel's 10-second timeout.

#### Acceptance Criteria

1. THE Upload_Worker SHALL be deployed as a free web service on Render.com
2. THE Upload_Worker SHALL expose an HTTP POST endpoint at `/upload`
3. WHEN the Upload_Worker receives a request, THE Upload_Worker SHALL validate the request contains required fields (postId, platformPostId, videoFileKey, title, description, accessToken, refreshToken, expiresAt)
4. THE Upload_Worker SHALL authenticate requests using a shared secret token (WORKER_SECRET)
5. IF the authentication token is invalid, THEN THE Upload_Worker SHALL return HTTP 401
6. THE Upload_Worker SHALL download the video from Backblaze using the Cloudflare Worker proxy URL
7. THE Upload_Worker SHALL upload the video to YouTube using the resumable upload protocol
8. THE Upload_Worker SHALL return HTTP 200 with upload result (success, videoId, videoUrl) or error details
9. THE Upload_Worker SHALL handle network timeouts with a 5-minute timeout for the entire operation
10. THE Upload_Worker SHALL log all operations with timestamps for debugging

### Requirement 2: Keep-Alive Service for Render.com

**User Story:** As the system, I want to prevent the Render.com service from spinning down, so that upload requests are processed quickly without 1-minute cold start delays.

#### Acceptance Criteria

1. THE Scheduler_Service SHALL send a keep-alive ping to the Upload_Worker every 5 minutes
2. THE Upload_Worker SHALL expose an HTTP GET endpoint at `/health` for keep-alive pings
3. WHEN the Upload_Worker receives a health check request, THE Upload_Worker SHALL return HTTP 200 with status "ok"
4. THE health check endpoint SHALL NOT require authentication
5. THE health check endpoint SHALL complete in under 1 second
6. THE Scheduler_Service SHALL log keep-alive ping results for monitoring

**Rationale:** Render.com free tier spins down after exactly 15 minutes of inactivity. Using a 5-minute interval ensures the service never spins down (maximum gap: 5 minutes, spin-down threshold: 15 minutes, safety margin: 10 minutes). A 14-minute interval would NOT work because cron expressions like `*/14 * * * *` fire at minutes 0, 14, 28, 42, 56 of each hour, creating a 4-minute gap between 56 and 00, then a 14-minute gap between 00 and 14, which would cause spin-down at minute 15.

### Requirement 3: Scheduled Upload Processing Endpoint

**User Story:** As the system, I want an API endpoint that processes scheduled YouTube uploads, so that posts are published at the correct time.

#### Acceptance Criteria

1. THE Upload_Processor SHALL expose a POST endpoint at `/api/cron/process-scheduled-youtube-uploads`
2. WHEN a request is received, THE Upload_Processor SHALL verify the authorization token matches the configured secret (CRON_SECRET)
3. IF the authorization token is invalid, THEN THE Upload_Processor SHALL return HTTP 401
4. THE Upload_Processor SHALL query for Post_Records with status SCHEDULED and scheduledFor within the Scheduling_Window
5. THE Upload_Processor SHALL filter Post_Records to only include those with YouTube Platform_Post_Records
6. FOR ALL matching Post_Records, THE Upload_Processor SHALL process each post independently
7. THE Upload_Processor SHALL return HTTP 200 with a summary of processed posts
8. WHEN database errors occur, THE Upload_Processor SHALL return HTTP 500 and log the error

### Requirement 4: Scheduling Window Calculation

**User Story:** As the system, I want to process posts within a 12-minute window, so that posts scheduled between cron runs are not missed.

#### Acceptance Criteria

1. THE Upload_Processor SHALL calculate the Scheduling_Window as current time minus 6 minutes to current time plus 6 minutes
2. THE Upload_Processor SHALL query Post_Records WHERE scheduledFor >= (now - 6 minutes) AND scheduledFor <= (now + 6 minutes)
3. THE Upload_Processor SHALL use UTC timezone for all time calculations
4. THE Upload_Processor SHALL process posts only once by checking Platform_Post_Record status is PENDING

### Requirement 5: YouTube OAuth Token Management

**User Story:** As the system, I want to manage YouTube access tokens, so that API requests are authenticated correctly.

#### Acceptance Criteria

1. WHEN processing a YouTube upload, THE Upload_Processor SHALL retrieve the Social_Account_Record for the user and platform YouTube
2. THE Upload_Processor SHALL decrypt the Access_Token from the Social_Account_Record
3. IF the Access_Token is expired (Token_Expiration < now + 5 minutes), THEN THE Upload_Processor SHALL refresh the token
4. WHEN refreshing tokens, THE Upload_Processor SHALL call Google's token refresh endpoint with the Refresh_Token
5. THE Upload_Processor SHALL encrypt and store the new Access_Token (and Refresh_Token if provided)
6. THE Upload_Processor SHALL update the Token_Expiration timestamp
7. IF token refresh fails with invalid_grant, THEN THE Upload_Processor SHALL deactivate the Social_Account_Record
8. IF token refresh fails with network error, THEN THE Upload_Processor SHALL retry up to 3 times with exponential backoff

### Requirement 6: Video Download from Backblaze

**User Story:** As the Upload_Worker, I want to download videos from Backblaze, so that I can upload them to YouTube.

#### Acceptance Criteria

1. THE Upload_Worker SHALL construct the Backblaze URL using the Cloudflare Worker proxy endpoint
2. THE Upload_Worker SHALL use the format: `https://upload.suyash-pokharel.com.np/{videoFileKey}`
3. THE Upload_Worker SHALL download the video file using HTTP GET request
4. THE Upload_Worker SHALL stream the download to avoid loading entire file into memory
5. THE Upload_Worker SHALL handle download errors (404, 403, 500, timeout)
6. IF download fails, THEN THE Upload_Worker SHALL return error to Upload_Processor
7. THE Upload_Worker SHALL validate the downloaded file size matches expected size (if provided)
8. THE Upload_Worker SHALL set a 2-minute timeout for video download

### Requirement 7: YouTube Resumable Upload Protocol

**User Story:** As the Upload_Worker, I want to upload videos to YouTube using the resumable upload protocol, so that large video uploads are reliable.

#### Acceptance Criteria

1. THE Upload_Worker SHALL initiate a resumable upload session by sending POST request to `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
2. THE Upload_Worker SHALL include the Authorization header with the decrypted Access_Token
3. THE Upload_Worker SHALL set the X-Upload-Content-Length header to the video file size
4. THE Upload_Worker SHALL set the X-Upload-Content-Type header to the video MIME type
5. THE Upload_Worker SHALL include the video metadata in the request body (title, description, privacyStatus, categoryId)
6. WHEN YouTube API returns 200 OK, THE Upload_Worker SHALL extract the upload URL from the Location header
7. THE Upload_Worker SHALL send PUT request to the upload URL with the video binary data
8. THE Upload_Worker SHALL set the Content-Length header to the video file size
9. THE Upload_Worker SHALL set the Content-Type header to the video MIME type
10. WHEN YouTube API returns 201 Created, THE Upload_Worker SHALL extract the video ID from the response
11. THE Upload_Worker SHALL construct the YouTube video URL as `https://www.youtube.com/watch?v={videoId}`
12. THE Upload_Worker SHALL return the video ID and URL to the Upload_Processor

### Requirement 8: YouTube API Error Handling

**User Story:** As the Upload_Worker, I want to handle YouTube API errors gracefully, so that failures are reported correctly.

#### Acceptance Criteria

1. WHEN YouTube API returns HTTP 400, THE Upload_Worker SHALL return error with message "Invalid request parameters"
2. WHEN YouTube API returns HTTP 401 or 403, THE Upload_Worker SHALL return error with message "Authentication failed"
3. WHEN YouTube API returns HTTP 429, THE Upload_Worker SHALL return error with message "Rate limit exceeded"
4. WHEN YouTube API returns HTTP 5xx, THE Upload_Worker SHALL return error with message "YouTube server error"
5. WHEN network timeout occurs, THE Upload_Worker SHALL return error with message "Request timeout"
6. THE Upload_Worker SHALL include the YouTube API error code and message in the error response
7. THE Upload_Worker SHALL log all YouTube API errors with full context

### Requirement 9: Upload Job Delegation

**User Story:** As the Upload_Processor, I want to delegate upload jobs to the Upload_Worker, so that long-running operations don't block the cron endpoint.

#### Acceptance Criteria

1. THE Upload_Processor SHALL send HTTP POST request to the Upload_Worker at `{RENDER_WORKER_URL}/upload`
2. THE Upload_Processor SHALL include the WORKER_SECRET in the Authorization header
3. THE Upload_Processor SHALL include the following fields in the request body: postId, platformPostId, videoFileKey, videoFileName, videoFileSize, title, description, accessToken, refreshToken, expiresAt, userId
4. THE Upload_Processor SHALL set a 6-minute timeout for the Upload_Worker request
5. WHEN the Upload_Worker returns success, THE Upload_Processor SHALL update Platform_Post_Record status to PUBLISHED
6. WHEN the Upload_Worker returns error, THE Upload_Processor SHALL update Platform_Post_Record status to FAILED
7. WHEN the Upload_Worker request times out, THE Upload_Processor SHALL increment Platform_Post_Record retryCount
8. IF retryCount exceeds 3, THEN THE Upload_Processor SHALL mark Platform_Post_Record status as FAILED
9. THE Upload_Processor SHALL log all Upload_Worker requests and responses

### Requirement 10: Post Status Synchronization

**User Story:** As a user, I want the post status to reflect the actual publishing state, so that I can see if my scheduled posts succeeded or failed.

#### Acceptance Criteria

1. WHEN all Platform_Post_Records for a Post_Record are PUBLISHED, THE Upload_Processor SHALL update Post_Record status to PUBLISHED
2. WHEN any Platform_Post_Record is FAILED and at least one is PUBLISHED, THE Upload_Processor SHALL update Post_Record status to PARTIALLY_PUBLISHED
3. WHEN all Platform_Post_Records for a Post_Record are FAILED, THE Upload_Processor SHALL update Post_Record status to FAILED
4. WHEN at least one Platform_Post_Record is PUBLISHING, THE Upload_Processor SHALL update Post_Record status to PUBLISHING
5. THE Upload_Processor SHALL update Post_Record.updatedAt timestamp when status changes

### Requirement 11: Rate Limiting

**User Story:** As the system, I want to enforce rate limits on YouTube API calls, so that I do not exceed YouTube's API quotas.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL track YouTube API calls per user per day
2. THE Rate_Limiter SHALL limit video upload requests to 6 per user per day (based on 10,000 quota units / 1600 per upload)
3. WHEN rate limit is reached, THE Upload_Processor SHALL skip processing for that user and log a warning
4. THE Rate_Limiter SHALL use Redis for distributed rate limiting across serverless instances
5. THE Rate_Limiter SHALL reset counters at midnight UTC
6. THE Rate_Limiter SHALL store rate limit data in Redis with key format: `youtube:upload:{userId}:{YYYYMMDD}`
7. THE Rate_Limiter SHALL set expiration on Redis keys to midnight UTC

### Requirement 12: Logging and Monitoring

**User Story:** As a developer, I want comprehensive logging of scheduled upload processing, so that I can debug issues and monitor system health.

#### Acceptance Criteria

1. THE Upload_Processor SHALL log the start and end of each cron execution with timestamp
2. THE Upload_Processor SHALL log the count of posts found in the Scheduling_Window
3. THE Upload_Processor SHALL log each Upload_Worker request with userId, postId, and endpoint
4. THE Upload_Processor SHALL log each Upload_Worker response with status code and video ID
5. THE Upload_Processor SHALL log all errors with full context (userId, postId, error message, stack trace)
6. THE Upload_Processor SHALL NOT log plaintext Access_Tokens or Refresh_Tokens
7. THE Upload_Worker SHALL log video download start and completion with file size
8. THE Upload_Worker SHALL log YouTube API requests and responses
9. THE Upload_Worker SHALL log all errors with full context

### Requirement 13: Environment Configuration

**User Story:** As a system administrator, I want to configure the system using environment variables, so that sensitive credentials are not hardcoded.

#### Acceptance Criteria

1. THE System SHALL require CRON_SECRET environment variable for authenticating cron-job.org requests
2. THE System SHALL require WORKER_SECRET environment variable for authenticating Upload_Worker requests
3. THE System SHALL require RENDER_WORKER_URL environment variable for the Upload_Worker endpoint URL
4. THE System SHALL require YOUTUBE_CLIENT_ID environment variable for YouTube OAuth
5. THE System SHALL require YOUTUBE_CLIENT_SECRET environment variable for token refresh
6. THE System SHALL require B2_ENDPOINT_URL environment variable for Backblaze Cloudflare Worker proxy
7. THE System SHALL require OAUTH_ENCRYPTION_KEY environment variable for token encryption/decryption
8. THE System SHALL require REDIS_URL environment variable for distributed rate limiting
9. WHEN any required environment variable is missing, THE System SHALL throw an error and refuse to start

### Requirement 14: Transaction Safety

**User Story:** As the system, I want database updates to be atomic, so that post status remains consistent even if errors occur.

#### Acceptance Criteria

1. WHEN updating Platform_Post_Record and Post_Record status, THE Upload_Processor SHALL use a database transaction
2. IF any database update fails, THEN THE Upload_Processor SHALL roll back all changes in the transaction
3. THE Upload_Processor SHALL commit the transaction only when all updates succeed
4. THE Upload_Processor SHALL log transaction failures with full context

### Requirement 15: Retry Logic

**User Story:** As the system, I want to retry failed uploads, so that temporary failures don't result in missed posts.

#### Acceptance Criteria

1. WHEN an upload fails with a retryable error (timeout, 5xx), THE Upload_Processor SHALL increment Platform_Post_Record retryCount
2. IF retryCount is less than or equal to 3, THEN THE Upload_Processor SHALL leave status as PENDING for retry on next cron run
3. IF retryCount exceeds 3, THEN THE Upload_Processor SHALL mark Platform_Post_Record status as FAILED
4. THE Upload_Processor SHALL log retry attempts with retry count
5. WHEN an upload fails with a non-retryable error (400, invalid token), THE Upload_Processor SHALL mark Platform_Post_Record status as FAILED immediately

### Requirement 16: Video Metadata Formatting

**User Story:** As the system, I want to format video metadata correctly for YouTube, so that videos are published with proper titles and descriptions.

#### Acceptance Criteria

1. THE Upload_Worker SHALL use the Post_Record title as the YouTube video title
2. THE Upload_Worker SHALL use the Post_Record description as the YouTube video description
3. THE Upload_Worker SHALL set the YouTube video category to 22 (People & Blogs) by default
4. THE Upload_Worker SHALL set the YouTube video privacy status to PUBLIC by default
5. THE Upload_Worker SHALL truncate title to 100 characters if longer
6. THE Upload_Worker SHALL truncate description to 5000 characters if longer
7. THE Upload_Worker SHALL escape special characters in title and description

### Requirement 17: Database Schema Extension for YouTube

**User Story:** As the system, I want to store YouTube-specific data in the database, so that I can track upload status and video URLs.

#### Acceptance Criteria

1. THE PlatformPost table SHALL use the existing platformPostId field to store YouTube video ID
2. THE PlatformPost table SHALL use the existing platformUrl field to store YouTube video URL
3. WHEN YouTube upload succeeds, THE Upload_Processor SHALL store the video ID in platformPostId
4. WHEN YouTube upload succeeds, THE Upload_Processor SHALL store the video URL in platformUrl
5. THE platformPostId field SHALL be indexed for efficient queries

### Requirement 18: Render.com Service Deployment

**User Story:** As a developer, I want to deploy the Upload_Worker to Render.com, so that it can handle video uploads.

#### Acceptance Criteria

1. THE Upload_Worker SHALL be deployed as a Node.js web service on Render.com free tier
2. THE Upload_Worker SHALL use the Express.js framework for HTTP server
3. THE Upload_Worker SHALL listen on the PORT environment variable provided by Render.com
4. THE Upload_Worker SHALL include a package.json with start script
5. THE Upload_Worker SHALL include a Dockerfile or use Render's auto-detect build
6. THE Upload_Worker SHALL be deployed from a Git repository (GitHub)
7. THE Upload_Worker SHALL have environment variables configured in Render dashboard (WORKER_SECRET)

### Requirement 19: Cron-job.org Configuration

**User Story:** As a system administrator, I want to configure cron-job.org to trigger scheduled uploads, so that posts are processed every 5 minutes.

#### Acceptance Criteria

1. THE Scheduler_Service SHALL be configured on cron-job.org with schedule `*/5 * * * *` (every 5 minutes) for upload processing
2. THE Scheduler_Service SHALL send HTTP POST request to `{VERCEL_URL}/api/cron/process-scheduled-youtube-uploads`
3. THE Scheduler_Service SHALL include the CRON_SECRET in the Authorization header as `Bearer {CRON_SECRET}`
4. THE Scheduler_Service SHALL have a separate job for keep-alive pings with schedule `*/5 * * * *` (every 5 minutes)
5. THE keep-alive job SHALL send HTTP GET request to `{RENDER_WORKER_URL}/health`
6. THE Scheduler_Service SHALL log all request results for monitoring

**Rationale:** Both jobs use 5-minute intervals to ensure:
- Upload processing: Posts are processed within 5 minutes of scheduled time (±6 minute window catches all posts)
- Keep-alive: Render.com service never spins down (15-minute threshold with 5-minute pings = 10-minute safety margin)
- No drift: Cron fires at consistent intervals (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 minutes)
- Optimal resource usage: Both jobs hit Render.com, ensuring it stays warm for actual upload requests

### Requirement 20: Error Recovery and Monitoring

**User Story:** As a developer, I want to monitor system health and recover from errors, so that the system remains reliable.

#### Acceptance Criteria

1. THE System SHALL log all errors to console with structured JSON format
2. THE System SHALL include the following fields in error logs: timestamp, component, operation, userId, postId, error, stack
3. THE System SHALL track the following metrics: posts processed, uploads succeeded, uploads failed, retry count
4. THE System SHALL expose metrics via the Upload_Processor response
5. WHEN Upload_Worker is unavailable, THE Upload_Processor SHALL log the error and continue processing other posts
6. WHEN Redis is unavailable, THE Rate_Limiter SHALL fail open (allow requests) and log the error
7. THE System SHALL send email notifications to admins when error rate exceeds 50% for 3 consecutive cron runs

### Requirement 21: Parser and Pretty Printer for YouTube API Responses

**User Story:** As a developer, I want to parse and format YouTube API responses, so that I can validate response structure and debug issues.

#### Acceptance Criteria

1. THE Response_Parser SHALL parse YouTube API JSON responses into typed objects
2. WHEN a YouTube API response is malformed, THE Response_Parser SHALL return a descriptive error
3. THE Pretty_Printer SHALL format YouTube API response objects back into valid JSON strings
4. FOR ALL valid YouTube API response objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)

## Implementation Notes

### Critical Timing Analysis: Why Every 5 Minutes for Both Jobs

**The Problem with 14-Minute Intervals:**

Many developers mistakenly believe that pinging every 14 minutes will prevent a 15-minute spin-down. However, cron expressions don't work that way.

**How Cron Expressions Actually Work:**

The expression `*/14 * * * *` means "at minute 0, 14, 28, 42, and 56 of every hour" - NOT "every 14 minutes from now."

**Timing Breakdown with `*/14 * * * *`:**
```
00:00 → ping (service active)
00:14 → ping (14 min gap) ✓
00:28 → ping (14 min gap) ✓
00:42 → ping (14 min gap) ✓
00:56 → ping (14 min gap) ✓
01:00 → ping (4 min gap!) ✗
01:14 → ping (14 min gap) ✓
01:15 → SERVICE SPINS DOWN (15 min after 01:00) ✗✗✗
```

**The Critical Failure:**
- Between 00:56 and 01:00: only 4 minutes
- Between 01:00 and 01:14: **14 minutes**
- At 01:15 (15 minutes after 01:00): **Service spins down**
- Next ping at 01:14 doesn't prevent the spin-down at 01:15

**The Solution: 5-Minute Intervals**

Using `*/5 * * * *` for both jobs ensures consistent timing:

**Timing Breakdown with `*/5 * * * *`:**
```
00:00 → ping (service active)
00:05 → ping (5 min gap) ✓
00:10 → ping (5 min gap) ✓
00:15 → ping (5 min gap) ✓
00:20 → ping (5 min gap) ✓
... (continues every 5 minutes)
```

**Why This Works:**
- **Maximum gap**: 5 minutes (consistent)
- **Spin-down threshold**: 15 minutes
- **Safety margin**: 10 minutes (15 - 5 = 10)
- **Result**: Service **never** spins down

**Scheduling Window Math:**

With 5-minute cron and ±6 minute window:
```
Cron fires at: 10:00, 10:05, 10:10, 10:15, 10:20, 10:25, 10:30...

At 10:05 cron run:
  Window: 09:59 to 10:11
  Catches: Posts scheduled for 10:00-10:10

At 10:10 cron run:
  Window: 10:04 to 10:16
  Catches: Posts scheduled for 10:05-10:15

Result: Every post is caught within 5 minutes of scheduled time
```

**No Duplicate Processing:**
- Posts are marked as PUBLISHING after first attempt
- Subsequent cron runs skip already-processing posts
- Database status prevents race conditions

### Architecture Decision: Why Render.com Free Web Service?

After thorough research, we determined that:

1. **Render.com Background Workers are NOT free** - they require paid plans
2. **Render.com Free Web Services** are available and suitable for this use case:
   - Can handle long-running HTTP requests (up to 5 minutes)
   - Sufficient for downloading 250MB videos and uploading to YouTube
   - Free tier includes 750 hours/month (enough for continuous operation)
   - 15-minute spin-down can be mitigated with keep-alive pings

3. **Alternative options considered**:
   - Vercel Background Functions: Not viable (10-second timeout)
   - Self-hosted worker: Too complex for users
   - BullMQ + Redis: Still requires worker hosting (same problem)

### Keep-Alive Strategy

The 15-minute spin-down limitation of Render.com free web services is addressed by:

1. **Separate cron job** on cron-job.org that pings `/health` endpoint every 5 minutes
2. **Why 5 minutes, not 14 minutes?**
   - Render.com spins down after **exactly 15 minutes** of inactivity
   - Cron expression `*/14 * * * *` fires at minutes: 0, 14, 28, 42, 56
   - This creates **inconsistent gaps**: 14 min (0→14), 14 min (14→28), 14 min (28→42), 14 min (42→56), **4 min (56→00)**, then 14 min (00→14)
   - The service would spin down at minute 15 (15 minutes after minute 00)
   - Using `*/5 * * * *` ensures **maximum 5-minute gap**, well below the 15-minute threshold
3. **Safety margin**: 15 min (spin-down) - 5 min (ping interval) = **10 minutes of safety**
4. This keeps the service "warm" and responsive for actual upload requests
5. Keep-alive pings are lightweight and don't consume significant resources
6. Both upload processing and keep-alive jobs hit Render.com every 5 minutes, ensuring optimal uptime

### YouTube API Quota Management

YouTube Data API v3 has strict quota limits:

- Default quota: 10,000 units/day
- Video upload cost: 1600 units
- Maximum uploads: ~6 videos/day per user

The rate limiter enforces this limit to prevent quota exhaustion.

### Security Considerations

1. **WORKER_SECRET**: Shared secret between Vercel and Render.com for authentication
2. **Token Encryption**: All OAuth tokens encrypted at rest using AES-256-GCM
3. **HTTPS Only**: All communication over HTTPS
4. **No Token Logging**: Plaintext tokens never logged

### Comparison with TikTok Implementation

| Feature | TikTok | YouTube |
|---------|--------|---------|
| **Cron Trigger** | cron-job.org (5 min) | cron-job.org (5 min) |
| **Vercel Endpoint** | `/api/cron/process-scheduled-tiktok-uploads` | `/api/cron/process-scheduled-youtube-uploads` |
| **Worker Service** | Not needed | Render.com free web service |
| **Video Download** | TikTok downloads from Backblaze | Worker downloads from Backblaze |
| **Upload Method** | PULL_FROM_URL (single POST) | Resumable upload (multi-step) |
| **Status Tracking** | Poll TikTok API | Immediate video ID |
| **Rate Limit** | 10 uploads/day | 6 uploads/day |
| **Privacy** | SELF_ONLY (sandbox) | PUBLIC/UNLISTED/PRIVATE |

### Future Enhancements

1. **Chunked Uploads**: Implement chunked upload for progress tracking
2. **Resume Interrupted Uploads**: Store upload session URLs for resuming
3. **Thumbnail Upload**: Support custom thumbnails
4. **Playlist Management**: Add videos to playlists automatically
5. **Analytics Integration**: Track video performance metrics
6. **Notification System**: Email/SMS notifications on upload completion

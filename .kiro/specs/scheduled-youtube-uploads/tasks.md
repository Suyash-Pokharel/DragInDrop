# Implementation Plan: Scheduled YouTube Video Uploads

## Overview

This implementation plan breaks down the scheduled YouTube video uploads feature into discrete coding tasks. The system uses cron-job.org as an external cron scheduler to trigger a Vercel API endpoint every 5 minutes, which delegates long-running video download and upload operations to a Render.com free web service. This architecture overcomes Vercel's 10-second timeout limitation while staying within free tier constraints.

**Implementation Language**: TypeScript (Vercel), JavaScript (Render.com worker)  
**Key Technologies**: Next.js, Prisma, Redis, YouTube Data API v3, Render.com, cron-job.org

## Tasks

- [ ] 1. Set up Render.com worker service repository
  - [x] 1.1 Create new GitHub repository for Render.com worker
    - Initialize repository with Node.js .gitignore
    - Create README.md with deployment instructions
    - Add MIT license
    - _Requirements: 18.6_
  
  - [x] 1.2 Create worker service structure
    - Create `index.js` with Express.js server setup
    - Create `package.json` with dependencies: express, axios, form-data
    - Create `.env.example` with WORKER_SECRET template
    - Create `README.md` with setup and deployment instructions
    - Configure server to listen on PORT environment variable (Render.com requirement)
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [ ] 2. Implement Render.com worker upload endpoint
  - [x] 2.1 Implement /upload POST endpoint
    - Validate WORKER_SECRET from Authorization header
    - Return HTTP 401 if secret is invalid or missing
    - Validate required request fields: postId, platformPostId, videoFileKey, videoFileName, videoFileSize, title, description, accessToken, refreshToken, expiresAt, userId
    - Return HTTP 400 if required fields are missing
    - Implement video download from Backblaze via Cloudflare Worker proxy
    - Implement YouTube resumable upload protocol (initiate session + upload binary data)
    - Return HTTP 200 with success result: {success: true, videoId, videoUrl}
    - Return HTTP 500 with error details on failure: {success: false, error, details}
    - Set 5-minute timeout for entire operation
    - Log all operations with timestamps
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_
  
  - [x] 2.2 Implement video download from Backblaze
    - Construct Backblaze URL: `https://upload.suyash-pokharel.com.np/{videoFileKey}`
    - Send HTTP GET request to download video
    - Stream download to avoid loading entire file into memory
    - Set 2-minute timeout for download
    - Handle download errors: 404 (not found), 403 (forbidden), 500 (server error), timeout
    - Validate downloaded file size matches expected size (if provided)
    - Return error to caller if download fails
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 2.3 Implement YouTube resumable upload protocol
    - Step 1: Initiate resumable upload session
      - Send POST to `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
      - Include Authorization header with Bearer token
      - Set X-Upload-Content-Length header to video file size
      - Set X-Upload-Content-Type header to video MIME type (video/mp4)
      - Include request body with video metadata: {snippet: {title, description, categoryId: "22"}, status: {privacyStatus: "public"}}
      - Extract upload URL from Location header in 200 OK response
    - Step 2: Upload video binary data
      - Send PUT request to upload URL with video binary data
      - Set Content-Length header to video file size
      - Set Content-Type header to video MIME type
      - Handle 201 Created response with video resource
      - Extract video ID from response body
      - Construct YouTube video URL: `https://www.youtube.com/watch?v={videoId}`
    - Return video ID and URL to caller
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_
  
  - [x] 2.4 Implement YouTube API error handling
    - Handle HTTP 400: Return error "Invalid request parameters"
    - Handle HTTP 401/403: Return error "Authentication failed"
    - Handle HTTP 429: Return error "Rate limit exceeded"
    - Handle HTTP 5xx: Return error "YouTube server error"
    - Handle network timeout: Return error "Request timeout"
    - Include YouTube API error code and message in error response
    - Log all YouTube API errors with full context
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  
  - [x] 2.5 Implement /health GET endpoint for keep-alive
    - Return HTTP 200 with {status: "ok"}
    - No authentication required
    - Complete in under 1 second
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Implement YouTube rate limiter module
  - [x] 3.1 Create rate limiter module at `src/lib/youtube/rateLimiter.ts`
    - Define TypeScript interfaces: `RateLimitConfig`, `RateLimitResult`
    - Implement `checkUploadRateLimit(userId: string): Promise<RateLimitResult>` function
    - Implement `incrementUploadCounter(userId: string): Promise<void>` function
    - Use Redis key: `youtube:upload:{userId}:{YYYYMMDD}`
    - Set key expiration to midnight UTC
    - Enforce limit: 6 uploads per user per day (based on 10,000 quota / 1600 per upload)
    - Return {allowed: boolean, remaining: number, resetAt: Date}
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  
  - [ ]* 3.2 Write unit tests for rate limiter
    - Mock Redis using ioredis-mock
    - Test within limit returns allowed=true
    - Test at limit returns allowed=false
    - Test counter increments correctly
    - Test counters reset at midnight UTC
    - Test remaining count decreases correctly
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 4. Implement Vercel scheduled upload processing API endpoint
  - [x] 4.1 Create API route at `src/app/api/cron/process-scheduled-youtube-uploads/route.ts`
    - Implement POST handler function
    - Implement `verifyCronSecret(request: NextRequest): boolean` function to check Authorization header
    - Return HTTP 401 if CRON_SECRET is invalid or missing
    - Implement `getSchedulingWindow(): { start: Date; end: Date }` function (current time ±6 minutes)
    - Query database for Post records with status=SCHEDULED and scheduledFor within scheduling window
    - Filter to only include posts with YouTube PlatformPost records where status=PENDING
    - Join with SocialAccount records where platform=YouTube and isActive=true
    - Return HTTP 200 with summary: processed count, uploaded count, errors array
    - Return HTTP 500 on database errors with error details
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4_
  
  - [x] 4.2 Implement upload job delegation to Render.com worker
    - For each scheduled post, retrieve SocialAccount with encrypted tokens
    - Decrypt access token and refresh token using existing encryption utilities
    - Check if access token is expired (expiresAt < now + 5 minutes)
    - If expired, refresh token using Google's token refresh endpoint
    - Encrypt and store new access token and refresh token
    - If token refresh fails with invalid_grant, deactivate SocialAccount
    - If token refresh fails with network error, retry up to 3 times with exponential backoff
    - Check upload rate limit using rate limiter module
    - If rate limit exceeded, skip post and log warning
    - Send HTTP POST to `{RENDER_WORKER_URL}/upload` with 6-minute timeout
    - Include Authorization header with WORKER_SECRET
    - Include request body: {postId, platformPostId, videoFileKey, videoFileName, videoFileSize, title, description, accessToken, refreshToken, expiresAt, userId}
    - Handle worker response: success → update status to PUBLISHED, error → update status to FAILED
    - Handle worker timeout: increment retryCount, mark as FAILED if retryCount > 3
    - Increment upload rate limit counter on success
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 11.2, 11.3_
  
  - [x] 4.3 Implement database update functions
    - Implement `updatePlatformPostStatus(platformPostId: string, status: PlatformPostStatus, videoId?: string, videoUrl?: string, errorMessage?: string): Promise<void>` function
    - Implement `syncPostStatus(postId: string): Promise<void>` function
    - Use database transactions for atomic updates
    - Calculate Post status based on all PlatformPost records: all PUBLISHED → PUBLISHED, all FAILED → FAILED, any PUBLISHING → PUBLISHING, mix → PARTIALLY_PUBLISHED
    - Update Post.updatedAt timestamp when status changes
    - Roll back transaction if any update fails
    - Store YouTube video ID in PlatformPost.platformPostId
    - Store YouTube video URL in PlatformPost.platformUrl
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 14.1, 14.2, 14.3, 14.4, 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [x] 4.4 Implement error handling and retry logic
    - Handle worker HTTP 401: Log error and mark as FAILED (authentication issue)
    - Handle worker HTTP 400: Mark as FAILED with error message (no retry)
    - Handle worker HTTP 500: Increment retryCount, mark as FAILED if retryCount > 3
    - Handle worker timeout: Increment retryCount, mark as FAILED if retryCount > 3
    - Leave status as PENDING for retryable errors when retryCount ≤ 3
    - Log retry attempts with retry count
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [x] 4.5 Add comprehensive logging
    - Log cron execution start and end with timestamp
    - Log count of posts found in scheduling window
    - Log each worker request with userId, postId, endpoint
    - Log each worker response with status code and video ID
    - Log all errors with full context: userId, postId, error message, stack trace
    - NEVER log plaintext access tokens, refresh tokens, CRON_SECRET, or WORKER_SECRET
    - Log token refresh attempts and results
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

- [ ] 5. Implement video metadata formatting
  - [x] 5.1 Create metadata formatter utility
    - Truncate title to 100 characters if longer
    - Truncate description to 5000 characters if longer
    - Escape special characters in title and description
    - Set default category to 22 (People & Blogs)
    - Set default privacy status to PUBLIC
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

- [ ]* 6. Write unit tests for Vercel API endpoint
  - Test valid CRON_SECRET returns 200
  - Test invalid CRON_SECRET returns 401
  - Test missing Authorization header returns 401
  - Test scheduling window calculation (±6 minutes from current time)
  - Test posts within window are selected
  - Test posts outside window are excluded
  - Test only YouTube PENDING posts are processed
  - Test token refresh triggered when token expired
  - Test upload skipped when rate limit exceeded
  - Test status synchronization logic for all combinations
  - Test transaction rollback on database errors
  - Test retry count increments on retryable errors
  - Test max retries marks post as FAILED
  - Test metadata truncation and escaping
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.3, 5.4, 10.1, 10.2, 10.3, 10.4, 14.1, 14.2, 14.3, 15.1, 15.2, 15.3, 16.5, 16.6_

- [ ] 7. Deploy Render.com worker service
  - [x] 7.1 Deploy to Render.com
    - Sign up for Render.com (free, no credit card required)
    - Create new Web Service (not Background Worker - not available on free tier)
    - Connect GitHub repository
    - Configure build settings: Environment=Node, Build Command=npm install, Start Command=npm start
    - Set environment variable: WORKER_SECRET (generate with `openssl rand -hex 32`)
    - Deploy service
    - Copy service URL (e.g., https://youtube-worker.onrender.com)
    - Verify service is running by accessing /health endpoint
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_
  
  - [x] 7.2 Test worker endpoints
    - Test /health endpoint returns 200 with {status: "ok"}
    - Test /upload endpoint with invalid WORKER_SECRET returns 401
    - Test /upload endpoint with missing fields returns 400
    - Test /upload endpoint with valid request (use test video and YouTube test account)
    - Verify video downloads from Backblaze successfully
    - Verify video uploads to YouTube successfully
    - Verify response includes videoId and videoUrl
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5_

- [ ] 8. Configure cron-job.org schedulers
  - [x] 8.1 Create upload processing cron job
    - Sign up for cron-job.org (free, no credit card required)
    - Create new cron job with title "YouTube Scheduled Uploads"
    - Set URL: `{VERCEL_URL}/api/cron/process-scheduled-youtube-uploads`
    - Set schedule: `*/5 * * * *` (every 5 minutes)
    - Set request method: POST
    - Add header: `Authorization: Bearer {CRON_SECRET}`
    - Enable job
    - Test manual trigger
    - _Requirements: 19.1, 19.2, 19.3_
  
  - [x] 8.2 Create keep-alive cron job
    - Create new cron job with title "Render Worker Keep-Alive"
    - Set URL: `{RENDER_WORKER_URL}/health`
    - Set schedule: `*/5 * * * *` (every 5 minutes)
    - Set request method: GET
    - No authentication required
    - Enable job
    - Test manual trigger
    - Verify Render.com service stays warm (no 15-minute spin-down)
    - _Requirements: 2.1, 19.4, 19.5, 19.6_

- [ ] 9. Environment configuration and validation
  - [x] 9.1 Configure Vercel environment variables
    - Add CRON_SECRET (same value as cron-job.org)
    - Add WORKER_SECRET (same value as Render.com)
    - Add RENDER_WORKER_URL (from Render.com deployment)
    - Add YOUTUBE_CLIENT_ID (already configured)
    - Add YOUTUBE_CLIENT_SECRET (already configured)
    - Add B2_ENDPOINT_URL (already configured: upload.suyash-pokharel.com.np)
    - Add OAUTH_ENCRYPTION_KEY (already configured)
    - Add REDIS_URL (already configured)
    - Verify all variables are set in both preview and production environments
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_
  
  - [x] 9.2 Add environment variable validation
    - Validate all required variables on application startup
    - Throw descriptive errors when required variables are missing
    - Test with missing variables to verify error handling
    - _Requirements: 13.9_

- [ ]* 10. Write integration tests for end-to-end flows
  - Test end-to-end upload flow: create scheduled post → trigger cron → verify worker called → verify database updated
  - Test token refresh flow: create post with expired token → trigger cron → verify token refreshed → verify upload succeeds
  - Test rate limiting flow: exhaust rate limit → trigger cron → verify upload skipped → verify error logged
  - Test worker timeout flow: simulate slow worker → verify timeout handling → verify retry logic
  - Mock worker responses, use ioredis-mock for Redis, use test database for Prisma
  - _Requirements: 5.4, 5.5, 5.6, 9.1, 9.2, 9.3, 9.4, 9.5, 11.2, 11.3_

- [x] 11. Checkpoint - Manual testing and verification
  - Deploy code to Vercel preview environment
  - Verify Render.com worker is deployed and accessible
  - Verify cron-job.org jobs are configured and enabled
  - Test successful upload: create scheduled post → wait for cron (max 5 minutes) → verify status changes to PUBLISHED → verify video appears on YouTube
  - Test failed upload: create post with invalid video URL → verify status changes to FAILED with error message
  - Test token refresh: manually expire token → create scheduled post → verify token refreshed → verify upload succeeds
  - Test rate limiting: create 7 posts for same user → verify first 6 upload → verify 7th skipped with rate limit log
  - Test keep-alive: monitor Render.com service → verify no spin-downs occur → verify response times stay fast
  - Test worker cold start: manually stop Render.com service → wait 15 minutes → trigger upload → verify service spins up and processes request
  - Verify all logs show expected behavior
  - Ensure all tests pass, ask the user if questions arise
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 11.2, 11.3_

- [x] 12. Production deployment and monitoring
  - Deploy code to Vercel production environment
  - Verify all environment variables are set in production
  - Verify Render.com worker is running in production mode
  - Verify cron-job.org jobs are pointing to production URLs
  - Monitor first few cron runs for errors
  - Verify logs show successful processing
  - Set up alerts for critical errors: 500 responses, database failures, token refresh failures, worker timeouts, rate limit exceeded
  - Document deployment process and troubleshooting steps
  - Monitor Render.com service uptime and response times
  - Verify keep-alive job prevents spin-downs
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

- [x] 13. Documentation and cleanup
  - Update README with YouTube upload feature documentation
  - Document Render.com worker deployment process
  - Document cron-job.org configuration steps
  - Document environment variable requirements
  - Document rate limiting behavior (6 uploads/day per user)
  - Document troubleshooting steps for common issues
  - Document keep-alive strategy and timing rationale
  - Add architecture diagrams showing Vercel → Render.com → YouTube flow
  - Document differences between TikTok and YouTube implementations

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and allow for user feedback
- The implementation uses TypeScript for Vercel and JavaScript for Render.com worker
- Property-based testing is not applicable to this feature (infrastructure and external service integration)
- Unit tests and integration tests provide comprehensive coverage for business logic
- Manual testing is required for YouTube API and Render.com integration verification
- **Render.com free tier does NOT support Background Workers** - using Web Service instead
- **Keep-alive strategy uses 5-minute intervals** - NOT 14 minutes (see timing analysis in requirements)
- **Both cron jobs use 5-minute intervals** - ensures service never spins down (10-minute safety margin)
- **Scheduling window is ±6 minutes** - catches all posts within 5-minute cron interval
- **Worker timeout is 6 minutes** - sufficient for 250MB video download + upload
- **Rate limit is 6 uploads/day** - based on YouTube API quota (10,000 units / 1600 per upload)

## Critical Timing Strategy

**Why 5 Minutes for Both Cron Jobs:**

The cron expression `*/14 * * * *` fires at minutes 0, 14, 28, 42, 56 of each hour, creating inconsistent gaps:
- 14 min (0→14), 14 min (14→28), 14 min (28→42), 14 min (42→56), **4 min (56→00)**, then 14 min (00→14)
- Service spins down at minute 15 (15 minutes after minute 00)

Using `*/5 * * * *` ensures:
- **Consistent 5-minute gaps** between all pings
- **Maximum gap: 5 minutes** (well below 15-minute spin-down threshold)
- **Safety margin: 10 minutes** (15 min threshold - 5 min interval)
- **Service never spins down**
- **No cold starts** (service always warm)

## Implementation Phases

1. **Phase 1: Render.com Worker** (Tasks 1-2) - 2 days
2. **Phase 2: Rate Limiter** (Task 3) - 0.5 day
3. **Phase 3: Vercel API Endpoint** (Tasks 4-5) - 2 days
4. **Phase 4: Testing** (Tasks 6, 10) - 1 day (optional)
5. **Phase 5: Deployment** (Tasks 7-9) - 1 day
6. **Phase 6: Verification** (Tasks 11-12) - 1.5 days
7. **Phase 7: Documentation** (Task 13) - 0.5 day

**Total Estimated Time**: 8.5 days (6.5 days without optional testing)

## Architecture Comparison: TikTok vs YouTube

| Component | TikTok | YouTube |
|-----------|--------|---------|
| **Cron Scheduler** | cron-job.org (5 min) | cron-job.org (5 min upload + 5 min keep-alive) |
| **Vercel Endpoint** | `/api/cron/process-scheduled-tiktok-uploads` | `/api/cron/process-scheduled-youtube-uploads` |
| **Worker Service** | Not needed | Render.com free web service |
| **Video Download** | TikTok downloads from Backblaze | Worker downloads from Backblaze |
| **Upload Method** | PULL_FROM_URL (single POST) | Resumable upload (multi-step) |
| **Status Tracking** | Poll TikTok API | Immediate video ID |
| **Rate Limit** | 10 uploads/day | 6 uploads/day |
| **Privacy** | SELF_ONLY (sandbox) | PUBLIC/UNLISTED/PRIVATE |
| **Execution Time** | <10 seconds (Vercel only) | 2-5 minutes (Render.com worker) |
| **Keep-Alive** | Not needed | Required (5-minute pings) |


# Implementation Plan: Scheduled TikTok Video Uploads

## Overview

This implementation plan breaks down the scheduled TikTok video uploads feature into discrete coding tasks. The system uses GitHub Actions as an external cron scheduler to trigger a Vercel API endpoint every 5 minutes, which processes scheduled posts and uploads them to TikTok using the Content Posting API v2 with PULL_FROM_URL method.

**Implementation Language**: TypeScript  
**Key Technologies**: Next.js, Prisma, Redis, TikTok API v2, GitHub Actions

## Tasks

- [x] 1. Database schema migration for TikTok publish ID tracking
  - Add `publishId` field (nullable String) to PlatformPost table
  - Create database migration script using Prisma
  - Add index on `publishId` field for efficient status polling queries
  - Test migration on development database
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [x] 2. Implement Backblaze signed URL builder module
  - [x] 2.1 Create signed URL builder module at `src/lib/backblaze/urlBuilder.ts`
    - Implement `buildSignedVideoUrl(videoFileKey: string): Promise<SignedUrlResult>` function
    - Implement `authorizeB2Account(accountId: string, applicationKey: string): Promise<B2AuthResponse>` function
    - Implement `getDownloadAuthorization(params): Promise<string>` function to call B2 API
    - Implement `getBackblazeConfig(): BackblazeConfig` function with environment variable validation
    - Call `b2_authorize_account` API to get authorization token
    - Call `b2_get_download_authorization` API with bucketId, fileNamePrefix, validDurationInSeconds (3600)
    - Construct signed URL: `https://{endpoint}/file/{bucket}/{fileKey}?Authorization={token}`
    - Ensure HTTPS protocol and proper URL encoding of special characters
    - Throw descriptive errors when B2_ACCOUNT_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME, or B2_ENDPOINT_URL are missing
    - Handle B2 API errors gracefully
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_
  
  - [ ]* 2.2 Write unit tests for signed URL builder
    - Mock B2 API responses for authorization and download authorization
    - Test valid videoFileKey produces correct signed HTTPS URL format with authorization token
    - Test special characters in videoFileKey are properly URL-encoded
    - Test missing environment variables throw errors
    - Test empty videoFileKey is rejected
    - Test B2 API errors are handled gracefully
    - Test authorization token is appended as query parameter
    - Test signed URL expiration is set to 1 hour
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

- [x] 3. Implement TikTok API integration module
  - [x] 3.1 Create TikTok API module at `src/lib/tiktok/api.ts`
    - Define TypeScript interfaces: `UploadVideoParams`, `UploadVideoResponse`, `PollStatusParams`, `PollStatusResponse`, `TikTokUploadResponse`, `TikTokStatusResponse`
    - Implement `uploadVideo(params: UploadVideoParams): Promise<UploadVideoResponse>` function
    - Implement `pollStatus(params: PollStatusParams): Promise<PollStatusResponse>` function
    - Set 30-second timeout for all TikTok API requests
    - Handle HTTP error codes: 400 (invalid request), 401/403 (auth), 429 (rate limit), 5xx (server error)
    - Parse TikTok API JSON responses and extract publish_id, status, error codes
    - _Requirements: 6.2, 6.8, 6.9, 8.2, 8.3, 8.4, 8.5, 15.1, 15.2_
  
  - [ ]* 3.2 Write unit tests for TikTok API module
    - Mock TikTok API responses using msw (Mock Service Worker)
    - Test successful upload returns publish_id
    - Test successful status poll returns correct status values
    - Test HTTP 400 returns error message
    - Test HTTP 401/403 triggers auth error
    - Test HTTP 429 returns rate limit error
    - Test HTTP 5xx returns server error
    - Test network timeout after 30 seconds
    - _Requirements: 6.2, 6.8, 6.9, 7.1, 7.2, 7.3, 7.4, 15.1, 15.2_

- [x] 4. Implement Redis-based rate limiter module
  - [x] 4.1 Create rate limiter module at `src/lib/tiktok/rateLimiter.ts`
    - Define TypeScript interfaces: `RateLimitConfig`, `RateLimitResult`
    - Implement `checkUploadRateLimit(userId: string): Promise<RateLimitResult>` function
    - Implement `checkStatusPollRateLimit(userId: string): Promise<RateLimitResult>` function
    - Implement `incrementUploadCounter(userId: string): Promise<void>` function
    - Implement `incrementStatusPollCounter(userId: string): Promise<void>` function
    - Use Redis keys: `tiktok:upload:{userId}:{YYYYMMDD}` and `tiktok:poll:{userId}:{YYYYMMDD}`
    - Set key expiration to midnight UTC
    - Enforce limits: 10 uploads per user per day, 100 status polls per user per day
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ]* 4.2 Write unit tests for rate limiter
    - Mock Redis using ioredis-mock
    - Test within limit returns allowed=true
    - Test at limit returns allowed=false
    - Test counter increments correctly
    - Test counters reset at midnight UTC
    - Test separate counters for uploads and status polls
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 5. Checkpoint - Ensure all module tests pass
  - Run all unit tests for URL builder, TikTok API, and rate limiter modules
  - Verify >80% code coverage for core modules
  - Ensure all tests pass, ask the user if questions arise

- [x] 6. Implement scheduled upload processing API endpoint
  - [x] 6.1 Create API route at `src/app/api/cron/process-scheduled-tiktok-uploads/route.ts`
    - Implement POST handler function
    - Implement `verifyCronSecret(request: NextRequest): boolean` function to check Authorization header
    - Return HTTP 401 if CRON_SECRET is invalid or missing
    - Implement `getSchedulingWindow(): { start: Date; end: Date }` function (current time ±6 minutes)
    - Query database for Post records with status=SCHEDULED and scheduledFor within scheduling window
    - Filter to only include posts with TikTok PlatformPost records where status=PENDING
    - Join with SocialAccount records where platform=TikTok and isActive=true
    - Return HTTP 200 with summary: processed count, uploaded count, polled count, errors array
    - Return HTTP 500 on database errors with error details
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4_
  
  - [x] 6.2 Implement upload processing logic
    - Implement `processScheduledPosts(): Promise<ProcessResult>` function
    - For each scheduled post, retrieve SocialAccount with encrypted tokens
    - Decrypt access token using existing encryption utilities
    - Check if access token is expired (expiresAt < now)
    - If expired, refresh token using TikTok token refresh endpoint
    - Encrypt and store new access token and refresh token
    - If token refresh fails, mark PlatformPost status as FAILED with error message
    - Check upload rate limit using rate limiter module
    - If rate limit exceeded, skip post and log warning
    - Generate signed Backblaze URL using signed URL builder module (includes authorization token, 1-hour expiration)
    - Call TikTok API uploadVideo() with signed video URL, title, and privacy settings
    - Extract publish_id from response and store in PlatformPost.publishId
    - Update PlatformPost status to PUBLISHING
    - Increment upload rate limit counter
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 9.2, 9.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_
  
  - [x] 6.3 Implement status polling logic
    - Implement `pollUploadStatus(platformPost: PlatformPost, socialAccount: SocialAccount): Promise<StatusResult>` function
    - Query database for PlatformPost records with status=PUBLISHING and platform=TikTok
    - For each publishing post, check status poll rate limit
    - If rate limit exceeded, skip post and log warning
    - Call TikTok API pollStatus() with publish_id
    - If status is PUBLISH_COMPLETE, update PlatformPost status to PUBLISHED
    - If status is FAILED, update PlatformPost status to FAILED with fail_reason
    - If status is PROCESSING_DOWNLOAD or PROCESSING_UPLOAD, leave status as PUBLISHING
    - Increment status poll rate limit counter
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.3, 9.4_
  
  - [x] 6.4 Implement database update functions
    - Implement `updatePlatformPostStatus(platformPostId: string, status: PlatformPostStatus, publishId?: string, errorMessage?: string): Promise<void>` function
    - Implement `syncPostStatus(postId: string): Promise<void>` function
    - Use database transactions for atomic updates
    - Calculate Post status based on all PlatformPost records: all PUBLISHED → PUBLISHED, all FAILED → FAILED, any PUBLISHING → PUBLISHING, mix → PARTIALLY_PUBLISHED
    - Update Post.updatedAt timestamp when status changes
    - Roll back transaction if any update fails
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 14.1, 14.2, 14.3, 14.4_
  
  - [x] 6.5 Implement error handling and retry logic
    - Handle TikTok API HTTP 400: mark as FAILED with error message (no retry)
    - Handle TikTok API HTTP 401/403: attempt token refresh and retry once
    - Handle TikTok API HTTP 429: log error and skip until next cron run
    - Handle TikTok API HTTP 5xx: increment retryCount, mark as FAILED if retryCount > 3
    - Handle network timeouts: increment retryCount, mark as FAILED if retryCount > 3
    - Leave status as PENDING for retryable errors when retryCount ≤ 3
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.2, 15.3_
  
  - [x] 6.6 Add comprehensive logging
    - Log cron execution start and end with timestamp
    - Log count of posts found in scheduling window
    - Log each TikTok API request with userId, postId, endpoint
    - Log each TikTok API response with status code and publish_id
    - Log all errors with full context: userId, postId, error message, stack trace
    - NEVER log plaintext access tokens, refresh tokens, or CRON_SECRET
    - Log token refresh attempts and results
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ]* 7. Write unit tests for API endpoint
  - Test valid CRON_SECRET returns 200
  - Test invalid CRON_SECRET returns 401
  - Test missing Authorization header returns 401
  - Test scheduling window calculation (±6 minutes from current time)
  - Test posts within window are selected
  - Test posts outside window are excluded
  - Test only TikTok PENDING posts are processed
  - Test token refresh triggered when token expired
  - Test upload skipped when rate limit exceeded
  - Test status synchronization logic for all combinations
  - Test transaction rollback on database errors
  - Test retry count increments on retryable errors
  - Test max retries marks post as FAILED
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.3, 5.4, 7.4, 7.5, 7.6, 9.4, 10.1, 10.2, 10.3, 10.4, 14.1, 14.2, 14.3_

- [x] 8. Create GitHub Actions workflow for cron scheduling
  - [x] 8.1 Create workflow file at `.github/workflows/scheduled-tiktok-uploads.yml`
    - Configure cron schedule: `*/5 * * * *` (every 5 minutes)
    - Add workflow_dispatch trigger for manual testing
    - Implement job that sends HTTP POST to Vercel API endpoint
    - Include Authorization header with CRON_SECRET from GitHub Secrets
    - Set Content-Type header to application/json
    - Use VERCEL_API_URL from GitHub Secrets for base URL
    - Log response status and any errors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 8.2 Configure GitHub Secrets
    - Document required secrets: CRON_SECRET, VERCEL_API_URL
    - Add instructions for setting secrets in repository settings
    - Verify secrets are set correctly
    - _Requirements: 12.1_

- [ ]* 9. Write integration tests for end-to-end flows
  - Test end-to-end upload flow: create scheduled post → trigger cron → verify TikTok API called → verify database updated
  - Test status polling flow: create PUBLISHING post → trigger cron → verify status API called → verify status updated
  - Test token refresh flow: create post with expired token → trigger cron → verify token refreshed → verify upload succeeds
  - Test rate limiting flow: exhaust rate limit → trigger cron → verify upload skipped → verify error logged
  - Use msw for mocking TikTok API, ioredis-mock for Redis, test database for Prisma
  - _Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.8, 6.9, 8.1, 8.2, 9.2, 9.3, 9.4_

- [x] 10. Environment configuration and validation
  - Verify all required environment variables are documented
  - Add environment variable validation on application startup
  - Ensure CRON_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, B2_ACCOUNT_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME, B2_ENDPOINT_URL, OAUTH_ENCRYPTION_KEY, REDIS_URL are set
  - Throw descriptive errors when required variables are missing
  - Test with missing variables to verify error handling
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11_

- [x] 11. Checkpoint - Manual testing and verification
  - Deploy database migration to development environment
  - Deploy code to Vercel preview environment
  - Configure GitHub Actions workflow in test repository
  - **Verify Backblaze bucket is set to PRIVATE** (not public)
  - Test signed URL generation: verify URLs include authorization token and are valid for 1 hour
  - Test successful upload: create scheduled post → wait for cron → verify status changes to PUBLISHING → verify status changes to PUBLISHED
  - Test failed upload: create post with invalid video URL → verify status changes to FAILED with error message
  - Test token refresh: manually expire token → create scheduled post → verify token refreshed → verify upload succeeds
  - Test rate limiting: create 11 posts for same user → verify first 10 upload → verify 11th skipped
  - Verify signed URLs work without domain verification in TikTok Developer Portal
  - Ensure all tests pass, ask the user if questions arise
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 12. Production deployment and monitoring
  - Deploy database migration to production
  - Deploy code to Vercel production environment
  - Configure GitHub Actions workflow in production repository
  - Set all required environment variables in Vercel production settings (including B2_ACCOUNT_ID, B2_APPLICATION_KEY, B2_BUCKET_ID)
  - Set CRON_SECRET and VERCEL_API_URL in GitHub Secrets
  - **Verify Backblaze bucket remains PRIVATE in production**
  - Monitor first few cron runs for errors
  - Verify logs show successful processing and signed URL generation
  - Set up alerts for critical errors (500 responses, database failures, token refresh failures, B2 API errors)
  - Document deployment process and troubleshooting steps
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and allow for user feedback
- The implementation uses TypeScript throughout for type safety
- Property-based testing is not applicable to this feature (infrastructure and external service integration)
- Unit tests and integration tests provide comprehensive coverage for business logic
- Manual testing is required for TikTok API integration verification
- **Backblaze bucket MUST remain PRIVATE** - signed URLs provide secure temporary access
- **NO domain verification required** - signed URLs work without TikTok domain verification
- Signed URLs are valid for 1 hour, providing sufficient time for TikTok to download videos

## Implementation Phases

1. **Phase 1: Database Schema** (Task 1) - 1 day
2. **Phase 2: Core Modules** (Tasks 2-4) - 3 days
3. **Phase 3: API Endpoint** (Tasks 6-7) - 2 days
4. **Phase 4: GitHub Actions** (Task 8) - 0.5 day
5. **Phase 5: Testing** (Tasks 5, 9, 11) - 2 days
6. **Phase 6: Deployment** (Tasks 10, 12) - 1 day

**Total Estimated Time**: 9.5 days

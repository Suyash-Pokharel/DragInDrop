# Requirements Document

## Introduction

This document specifies the requirements for implementing scheduled TikTok video uploads using TikTok's Content Posting API with direct URL-based video downloads from Backblaze B2 storage. The system enables users to schedule TikTok posts that are automatically published at the specified time using a GitHub Actions cron job that triggers a Vercel API endpoint every 5 minutes.

## Glossary

- **Scheduler_Service**: The GitHub Actions workflow that runs every 5 minutes to trigger scheduled post processing
- **Upload_Processor**: The Vercel API endpoint that processes scheduled TikTok uploads
- **TikTok_API**: TikTok's Content Posting API v2 for direct post video publishing
- **Post_Record**: A database record in the Post table representing a scheduled post
- **Platform_Post_Record**: A database record in the PlatformPost table representing a platform-specific post
- **Social_Account_Record**: A database record in the SocialAccount table containing TikTok OAuth credentials
- **Backblaze_URL**: A temporary signed HTTPS URL with authorization token pointing to a video file in private Backblaze B2 storage
- **Domain_Verification**: NOT REQUIRED - Signed URLs work without domain verification
- **Publish_ID**: A unique identifier returned by TikTok API for tracking upload and publishing status
- **Access_Token**: An encrypted OAuth 2.0 access token for authenticating with TikTok API
- **Refresh_Token**: An encrypted OAuth 2.0 refresh token for obtaining new access tokens
- **Token_Expiration**: The timestamp when an access token expires and requires refresh
- **Scheduling_Window**: A 12-minute time window (6 minutes before and 6 minutes after current time) for finding scheduled posts
- **Status_Polling**: The process of checking TikTok API for upload and publishing status updates
- **Rate_Limiter**: The system component that enforces API rate limits to prevent exceeding TikTok's quotas

## Requirements

### Requirement 1: Backblaze Signed URL Generation for Secure Video Access

**User Story:** As the system, I want to generate temporary signed URLs for private Backblaze videos, so that TikTok can download videos securely without making the bucket public.

#### Acceptance Criteria

1. THE System SHALL keep the Backblaze B2 bucket configured as PRIVATE (not public)
2. WHEN uploading to TikTok, THE System SHALL generate a signed URL with 1-hour expiration for the video file
3. THE System SHALL use Backblaze B2 API to generate signed download URLs with authorization tokens
4. THE signed URL SHALL include the authorization token as a query parameter
5. THE signed URL SHALL be valid for 3600 seconds (1 hour) to allow TikTok sufficient time to download the video
6. THE System SHALL construct the base file URL in the format: https://{B2_ENDPOINT_URL}/file/{B2_BUCKET_NAME}/{videoFileKey}
7. THE System SHALL append the authorization token to the URL: ?Authorization={token}
8. THE System SHALL NOT require domain verification with TikTok (signed URLs work without verification)

#### Implementation Notes

**Why Signed URLs Instead of Public Bucket:**
- **Security**: Bucket remains private, videos not accessible without authorization
- **Cost**: No bandwidth charges for public access (Backblaze charges for public bandwidth)
- **Temporary Access**: URLs expire after 1 hour, preventing unauthorized long-term access
- **No Domain Verification**: Signed URLs work immediately without TikTok domain verification process

**Backblaze B2 Signed URL Generation:**
1. Call `b2_get_download_authorization` API endpoint
2. Provide: bucketId, fileNamePrefix (the videoFileKey), validDurationInSeconds (3600)
3. Receive: authorizationToken
4. Construct signed URL: `https://{endpoint}/file/{bucket}/{fileKey}?Authorization={token}`
5. TikTok downloads video using this signed URL
6. Token expires after 1 hour

**Security Benefits:**
- Videos remain private in Backblaze B2
- Each upload gets a unique, time-limited authorization token
- No risk of unauthorized access to other videos
- No bandwidth costs for public bucket access

### Requirement 2: GitHub Actions Cron Scheduler

**User Story:** As a system, I want a reliable external cron trigger, so that scheduled posts are processed every 5 minutes without relying on Vercel's limited cron capabilities.

#### Acceptance Criteria

1. THE Scheduler_Service SHALL run every 5 minutes using GitHub Actions cron syntax (*/5 * * * *)
2. WHEN the Scheduler_Service runs, THE Scheduler_Service SHALL send an HTTP POST request to the Vercel API endpoint
3. THE Scheduler_Service SHALL include an authorization header with a secret token for authentication
4. THE Scheduler_Service SHALL log the response status and any errors
5. WHEN the GitHub Actions workflow fails, THE Scheduler_Service SHALL retry on the next scheduled run
6. THE Scheduler_Service SHALL run in a public repository to utilize unlimited GitHub Actions minutes

### Requirement 3: Scheduled Upload Processing Endpoint

**User Story:** As the system, I want an API endpoint that processes scheduled TikTok uploads, so that posts are published at the correct time.

#### Acceptance Criteria

1. THE Upload_Processor SHALL expose a POST endpoint at /api/cron/process-scheduled-tiktok-uploads
2. WHEN a request is received, THE Upload_Processor SHALL verify the authorization token matches the configured secret
3. IF the authorization token is invalid, THEN THE Upload_Processor SHALL return HTTP 401
4. THE Upload_Processor SHALL query for Post_Records with status SCHEDULED and scheduledFor within the Scheduling_Window
5. THE Upload_Processor SHALL filter Post_Records to only include those with TikTok Platform_Post_Records
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

### Requirement 5: TikTok OAuth Token Management

**User Story:** As the system, I want to manage TikTok access tokens, so that API requests are authenticated correctly.

#### Acceptance Criteria

1. WHEN processing a TikTok upload, THE Upload_Processor SHALL retrieve the Social_Account_Record for the user and platform TikTok
2. THE Upload_Processor SHALL decrypt the Access_Token from the Social_Account_Record
3. IF the Access_Token is expired (Token_Expiration < now), THEN THE Upload_Processor SHALL refresh the token
4. WHEN refreshing tokens, THE Upload_Processor SHALL call TikTok's token refresh endpoint with the Refresh_Token
5. THE Upload_Processor SHALL encrypt and store the new Access_Token and Refresh_Token
6. THE Upload_Processor SHALL update the Token_Expiration timestamp
7. IF token refresh fails, THEN THE Upload_Processor SHALL mark the Platform_Post_Record status as FAILED with error message "Token refresh failed"

### Requirement 6: TikTok Video Upload via PULL_FROM_URL

**User Story:** As the system, I want to upload videos to TikTok using direct URLs, so that TikTok downloads videos from Backblaze without file transfers through Vercel.

#### Acceptance Criteria

1. THE Upload_Processor SHALL construct the Backblaze_URL from the Post_Record videoFileKey
2. THE Upload_Processor SHALL call TikTok API endpoint POST /v2/post/publish/video/init/ with source=PULL_FROM_URL
3. THE Upload_Processor SHALL include the Post_Record title as the post_info.title parameter
4. THE Upload_Processor SHALL set post_info.privacy_level to PUBLIC_TO_EVERYONE
5. THE Upload_Processor SHALL set post_info.disable_comment to false
6. THE Upload_Processor SHALL set post_info.disable_duet to false
7. THE Upload_Processor SHALL set post_info.disable_stitch to false
8. THE Upload_Processor SHALL include the decrypted Access_Token in the Authorization header
9. WHEN TikTok API returns success, THE Upload_Processor SHALL extract the Publish_ID from the response
10. THE Upload_Processor SHALL store the Publish_ID in the Platform_Post_Record
11. THE Upload_Processor SHALL update the Platform_Post_Record status to PUBLISHING

### Requirement 7: TikTok API Error Handling

**User Story:** As the system, I want to handle TikTok API errors gracefully, so that failures are logged and retried appropriately.

#### Acceptance Criteria

1. WHEN TikTok API returns HTTP 400, THE Upload_Processor SHALL mark Platform_Post_Record status as FAILED with the error message
2. WHEN TikTok API returns HTTP 401 or 403, THE Upload_Processor SHALL attempt token refresh and retry once
3. WHEN TikTok API returns HTTP 429 (rate limit), THE Upload_Processor SHALL log the error and skip processing until next cron run
4. WHEN TikTok API returns HTTP 5xx, THE Upload_Processor SHALL increment Platform_Post_Record retryCount
5. IF retryCount exceeds 3, THEN THE Upload_Processor SHALL mark Platform_Post_Record status as FAILED
6. IF retryCount is 3 or less, THEN THE Upload_Processor SHALL leave status as PENDING for retry on next cron run
7. THE Upload_Processor SHALL log all TikTok API errors with userId, postId, and error details

### Requirement 8: Upload Status Polling

**User Story:** As the system, I want to check the status of TikTok uploads, so that I can update post status when publishing completes.

#### Acceptance Criteria

1. THE Upload_Processor SHALL query for Platform_Post_Records with status PUBLISHING and platform TikTok
2. FOR ALL PUBLISHING Platform_Post_Records, THE Upload_Processor SHALL call TikTok API POST /v2/post/publish/status/fetch/ with the Publish_ID
3. WHEN TikTok API returns status PUBLISH_COMPLETE, THE Upload_Processor SHALL update Platform_Post_Record status to PUBLISHED
4. WHEN TikTok API returns status FAILED, THE Upload_Processor SHALL update Platform_Post_Record status to FAILED with error message
5. WHEN TikTok API returns status PROCESSING_DOWNLOAD or PROCESSING_UPLOAD, THE Upload_Processor SHALL leave status as PUBLISHING
6. THE Upload_Processor SHALL update the Post_Record status based on all Platform_Post_Records for that post
7. IF all Platform_Post_Records are PUBLISHED, THEN THE Upload_Processor SHALL set Post_Record status to PUBLISHED
8. IF any Platform_Post_Record is FAILED and others are PUBLISHED, THEN THE Upload_Processor SHALL set Post_Record status to PARTIALLY_PUBLISHED
9. IF all Platform_Post_Records are FAILED, THEN THE Upload_Processor SHALL set Post_Record status to FAILED

### Requirement 9: Rate Limiting

**User Story:** As the system, I want to enforce rate limits on TikTok API calls, so that I do not exceed TikTok's API quotas.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL track TikTok API calls per user per time window
2. THE Rate_Limiter SHALL limit video upload requests to 10 per user per day
3. THE Rate_Limiter SHALL limit status polling requests to 100 per user per day
4. WHEN rate limit is reached, THE Upload_Processor SHALL skip processing for that user and log a warning
5. THE Rate_Limiter SHALL use Redis for distributed rate limiting across serverless instances
6. THE Rate_Limiter SHALL reset counters at midnight UTC

### Requirement 10: Post Status Synchronization

**User Story:** As a user, I want the post status to reflect the actual publishing state, so that I can see if my scheduled posts succeeded or failed.

#### Acceptance Criteria

1. WHEN all Platform_Post_Records for a Post_Record are PUBLISHED, THE Upload_Processor SHALL update Post_Record status to PUBLISHED
2. WHEN any Platform_Post_Record is FAILED and at least one is PUBLISHED, THE Upload_Processor SHALL update Post_Record status to PARTIALLY_PUBLISHED
3. WHEN all Platform_Post_Records for a Post_Record are FAILED, THE Upload_Processor SHALL update Post_Record status to FAILED
4. WHEN at least one Platform_Post_Record is PUBLISHING, THE Upload_Processor SHALL update Post_Record status to PUBLISHING
5. THE Upload_Processor SHALL update Post_Record.updatedAt timestamp when status changes

### Requirement 11: Logging and Monitoring

**User Story:** As a developer, I want comprehensive logging of scheduled upload processing, so that I can debug issues and monitor system health.

#### Acceptance Criteria

1. THE Upload_Processor SHALL log the start and end of each cron execution with timestamp
2. THE Upload_Processor SHALL log the count of posts found in the Scheduling_Window
3. THE Upload_Processor SHALL log each TikTok API request with userId, postId, and endpoint
4. THE Upload_Processor SHALL log each TikTok API response with status code and Publish_ID
5. THE Upload_Processor SHALL log all errors with full context (userId, postId, error message, stack trace)
6. THE Upload_Processor SHALL NOT log plaintext Access_Tokens or Refresh_Tokens
7. THE Upload_Processor SHALL log token refresh attempts and results

### Requirement 12: Environment Configuration

**User Story:** As a system administrator, I want to configure the system using environment variables, so that sensitive credentials are not hardcoded.

#### Acceptance Criteria

1. THE System SHALL require CRON_SECRET environment variable for authenticating GitHub Actions requests
2. THE System SHALL require TIKTOK_CLIENT_KEY environment variable for TikTok API authentication
3. THE System SHALL require TIKTOK_CLIENT_SECRET environment variable for token refresh
4. THE System SHALL require B2_ACCOUNT_ID environment variable for Backblaze API authentication
5. THE System SHALL require B2_APPLICATION_KEY environment variable for Backblaze API authentication
6. THE System SHALL require B2_BUCKET_ID environment variable for generating signed URLs
7. THE System SHALL require B2_BUCKET_NAME environment variable for constructing file URLs
8. THE System SHALL require B2_ENDPOINT_URL environment variable for constructing file URLs
9. THE System SHALL require OAUTH_ENCRYPTION_KEY environment variable for token encryption/decryption
10. THE System SHALL require REDIS_URL environment variable for distributed rate limiting
11. WHEN any required environment variable is missing, THE System SHALL throw an error and refuse to start

### Requirement 13: Backblaze Signed URL Construction

**User Story:** As the system, I want to construct valid signed Backblaze URLs, so that TikTok can download videos from private buckets securely.

#### Acceptance Criteria

1. THE Upload_Processor SHALL call Backblaze B2 API `b2_get_download_authorization` to generate authorization tokens
2. THE Upload_Processor SHALL provide bucketId, fileNamePrefix (videoFileKey), and validDurationInSeconds (3600) to the API
3. THE Upload_Processor SHALL construct the base file URL as: https://{B2_ENDPOINT_URL}/file/{B2_BUCKET_NAME}/{videoFileKey}
4. THE Upload_Processor SHALL append the authorization token as a query parameter: ?Authorization={token}
5. THE Upload_Processor SHALL ensure the signed URL uses HTTPS protocol
6. THE Upload_Processor SHALL validate the videoFileKey is not empty before constructing the URL
7. THE Upload_Processor SHALL URL-encode the videoFileKey if it contains special characters
8. THE signed URL SHALL be valid for 3600 seconds (1 hour) to allow TikTok sufficient time to download
9. THE Upload_Processor SHALL handle B2 API errors when generating authorization tokens

### Requirement 14: Transaction Safety

**User Story:** As the system, I want database updates to be atomic, so that post status remains consistent even if errors occur.

#### Acceptance Criteria

1. WHEN updating Platform_Post_Record and Post_Record status, THE Upload_Processor SHALL use a database transaction
2. IF any database update fails, THEN THE Upload_Processor SHALL roll back all changes in the transaction
3. THE Upload_Processor SHALL commit the transaction only when all updates succeed
4. THE Upload_Processor SHALL log transaction failures with full context

### Requirement 15: TikTok API Timeout Handling

**User Story:** As the system, I want to handle slow TikTok API responses, so that the cron job does not hang indefinitely.

#### Acceptance Criteria

1. THE Upload_Processor SHALL set a 30-second timeout for all TikTok API requests
2. WHEN a TikTok API request times out, THE Upload_Processor SHALL treat it as a temporary failure
3. THE Upload_Processor SHALL increment Platform_Post_Record retryCount on timeout
4. THE Upload_Processor SHALL log timeout errors with userId and postId

### Requirement 16: Parser and Pretty Printer for TikTok API Responses

**User Story:** As a developer, I want to parse and format TikTok API responses, so that I can validate response structure and debug issues.

#### Acceptance Criteria

1. THE Response_Parser SHALL parse TikTok API JSON responses into typed objects
2. WHEN a TikTok API response is malformed, THE Response_Parser SHALL return a descriptive error
3. THE Pretty_Printer SHALL format TikTok API response objects back into valid JSON strings
4. FOR ALL valid TikTok API response objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)

### Requirement 17: Database Schema Extension for TikTok Publish ID

**User Story:** As the system, I want to store TikTok's publish_id in the database, so that I can track upload status and poll for completion.

#### Acceptance Criteria

1. THE PlatformPost table SHALL have a publishId field of type String (nullable)
2. WHEN TikTok API returns a publish_id, THE Upload_Processor SHALL store it in the PlatformPost.publishId field
3. WHEN polling for status, THE Upload_Processor SHALL use the publishId from the PlatformPost record
4. THE publishId field SHALL be indexed for efficient status polling queries

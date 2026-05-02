# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Production Error Logging
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the three production errors exist
  - **Scoped PBT Approach**: Scope the property to concrete failing cases (DEP0169 warnings, Redis timeouts, Twitter OAuth warnings)
  - Test implementation details from Bug Condition in design:
    - Access `/api/auth/session` with `NODE_OPTIONS=--trace-deprecation` and verify DEP0169 warnings appear in logs
    - Access `/api/auth/session` with simulated 4-second Redis latency and verify timeout errors appear
    - Access `/api/auth/session` and verify Twitter OAuth beta warnings appear in logs
    - Access `/dashboard` and verify multiple errors can appear simultaneously
  - The test assertions should match the Expected Behavior Properties from design (clean logs, no warnings, no timeouts)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist)
  - Document counterexamples found:
    - Exact DEP0169 warning message and stack trace
    - Exact Redis timeout error message and timing
    - Exact Twitter OAuth warning message and frequency
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Authentication Functionality
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for all authentication flows:
    - Google OAuth: login flow, user data mapping, session creation
    - Facebook OAuth: login flow, user data mapping, session creation
    - TikTok OAuth: login flow, user data mapping, session creation
    - LinkedIn OAuth: login flow, user data mapping, session creation
    - Twitter OAuth: login flow, user data mapping, session creation (warning present but functional)
    - Credentials login: email/password validation, rate limiting, session creation
    - Session validation: JWT token validation, user data retrieval
    - Rate limiting: Redis usage, in-memory fallback, limit enforcement
    - Account linking prevention: OAuth sign-in with existing email blocked
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all OAuth providers, verify user profile data mapping is consistent
    - For all authentication requests, verify session tokens contain correct user data
    - For all rate limit scenarios, verify Redis and fallback behavior work correctly
    - For all protected routes, verify session validation returns correct results
    - For all OAuth sign-ins with existing emails, verify account linking is blocked
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14_

- [ ] 3. Fix for Vercel production errors (next-auth v5 migration, Redis timeout increase, Twitter OAuth warning suppression)

  - [ ] 3.1 Prepare for next-auth v5 migration
    - Read official next-auth v5 (Auth.js) migration guide: https://authjs.dev/getting-started/migrating-to-v5
    - Document all breaking changes that affect current implementation
    - Identify required changes to configuration, callbacks, providers, and middleware
    - Create migration checklist for each affected file
    - _Bug_Condition: Authentication routes trigger DEP0169 warnings due to next-auth v4 using deprecated url.parse()_
    - _Expected_Behavior: No DEP0169 warnings after upgrading to next-auth v5 which uses WHATWG URL API_
    - _Preservation: All authentication flows must continue working exactly as before_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.12, 3.13, 3.14_

  - [ ] 3.2 Upgrade next-auth package to v5
    - Update `package.json`: change `"next-auth": "^4.24.13"` to `"next-auth": "^5.0.0-beta.25"` (or latest stable v5)
    - Update `@next-auth/prisma-adapter` to version compatible with next-auth v5
    - Run `pnpm install` to install new versions
    - Verify no dependency conflicts in package-lock.json
    - _Bug_Condition: next-auth v4 uses deprecated url.parse() internally_
    - _Expected_Behavior: next-auth v5 uses WHATWG URL API, eliminating DEP0169 warnings_
    - _Preservation: Package upgrade alone does not change behavior until code is migrated_
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [ ] 3.3 Create new auth.ts configuration file
    - Create `src/auth.ts` file (next-auth v5 uses centralized config instead of route handler)
    - Import NextAuth from "next-auth"
    - Import all providers: GoogleProvider, FacebookProvider, TwitterProvider, CredentialsProvider
    - Import PrismaAdapter from "@next-auth/prisma-adapter"
    - Import getPrisma from "@/lib/prisma"
    - Import rate limiters from "@/lib/limiter"
    - Import bcrypt from "bcryptjs"
    - Set up basic NextAuth configuration structure with empty providers array
    - Export `auth`, `signIn`, `signOut` functions from NextAuth()
    - _Bug_Condition: next-auth v4 route handler structure incompatible with v5_
    - _Expected_Behavior: Centralized auth.ts configuration following v5 best practices_
    - _Preservation: No functionality yet, just file structure setup_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.4 Migrate Google OAuth provider to v5
    - Copy GoogleProvider configuration from old route.ts to new auth.ts
    - Verify clientId and clientSecret environment variables are correct
    - Test Google OAuth flow: authorization → callback → user creation → session
    - Verify user profile data mapping (id, email, name, image) matches v4 behavior
    - Document any differences in provider configuration syntax
    - _Bug_Condition: Google OAuth must work identically after migration_
    - _Expected_Behavior: Google OAuth authenticates users successfully with same profile data_
    - _Preservation: Google OAuth functionality unchanged (requirement 3.1)_
    - _Requirements: 3.1, 3.6, 3.7, 3.12, 3.13, 3.14_

  - [ ] 3.5 Migrate Facebook OAuth provider to v5
    - Copy FacebookProvider configuration from old route.ts to new auth.ts
    - Verify clientId and clientSecret environment variables are correct
    - Test Facebook OAuth flow: authorization → callback → user creation → session
    - Verify user profile data mapping (id, email, name, image) matches v4 behavior
    - Document any differences in provider configuration syntax
    - _Bug_Condition: Facebook OAuth must work identically after migration_
    - _Expected_Behavior: Facebook OAuth authenticates users successfully with same profile data_
    - _Preservation: Facebook OAuth functionality unchanged (requirement 3.2)_
    - _Requirements: 3.2, 3.6, 3.7, 3.12, 3.13, 3.14_

  - [ ] 3.6 Migrate TikTok OAuth provider to v5
    - Copy TikTok custom OAuth provider configuration from old route.ts to new auth.ts
    - Verify TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET environment variables are correct
    - Update authorization URL, token URL, and userinfo URL if v5 syntax differs
    - Update profile mapping function to match v5 provider interface
    - Test TikTok OAuth flow: authorization → callback → user creation → session
    - Verify user profile data mapping (open_id, email, display_name, avatar_url) matches v4 behavior
    - _Bug_Condition: TikTok OAuth must work identically after migration_
    - _Expected_Behavior: TikTok OAuth authenticates users successfully with same profile data_
    - _Preservation: TikTok OAuth functionality unchanged (requirement 3.3)_
    - _Requirements: 3.3, 3.6, 3.7, 3.12, 3.13, 3.14_

  - [ ] 3.7 Migrate Twitter OAuth provider to v5 with warning suppression
    - Copy TwitterProvider configuration from old route.ts to new auth.ts
    - Keep `version: "2.0"` configuration for OAuth 2.0 support
    - Verify X_CLIENT_ID and X_CLIENT_SECRET environment variables are correct
    - Add logger configuration to suppress Twitter OAuth beta warning:
      ```typescript
      logger: {
        warn: (code) => {
          if (code === 'TWITTER_OAUTH_2_BETA') return; // Suppress Twitter beta warning
          console.warn(code);
        },
      }
      ```
    - Test Twitter OAuth flow: authorization → callback → user creation → session
    - Verify user profile data mapping matches v4 behavior
    - Verify Twitter OAuth beta warning NO LONGER appears in logs
    - _Bug_Condition: Twitter OAuth triggers repetitive beta warnings (requirement 1.7, 1.8, 1.9)_
    - _Expected_Behavior: Twitter OAuth works without logging beta warnings (requirement 2.7, 2.8, 2.9)_
    - _Preservation: Twitter OAuth functionality unchanged (requirement 3.5)_
    - _Requirements: 1.7, 1.8, 1.9, 2.7, 2.8, 2.9, 3.5, 3.6, 3.7, 3.12, 3.13, 3.14_

  - [ ] 3.8 Migrate LinkedIn OAuth provider to v5
    - Copy LinkedIn custom OAuth provider configuration from old route.ts to new auth.ts
    - Verify LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables are correct
    - Update authorization URL, token URL, and userinfo URL if v5 syntax differs
    - Update profile mapping function to match v5 provider interface
    - Test LinkedIn OAuth flow: authorization → callback → user creation → session
    - Verify user profile data mapping (id, localizedFirstName, localizedLastName, email, profilePicture) matches v4 behavior
    - _Bug_Condition: LinkedIn OAuth must work identically after migration_
    - _Expected_Behavior: LinkedIn OAuth authenticates users successfully with same profile data_
    - _Preservation: LinkedIn OAuth functionality unchanged (requirement 3.4)_
    - _Requirements: 3.4, 3.6, 3.7, 3.12, 3.13, 3.14_

  - [ ] 3.9 Migrate Credentials provider to v5
    - Copy CredentialsProvider configuration from old route.ts to new auth.ts
    - Update authorize function signature to match v5 interface (check if req parameter structure changed)
    - Preserve all existing logic:
      - Email and password validation
      - Email normalization (trim, lowercase)
      - IP address extraction from headers
      - Rate limiting with perIpLoginLimiter and perEmailLoginLimiter
      - User lookup by email
      - Email verification check
      - Password hash verification with bcrypt
      - Return user object with correct fields (id, email, name, role, emailVerified, image)
    - Test credentials login flow: email/password → validation → rate limiting → session creation
    - Verify rate limiting still works correctly (Redis and in-memory fallback)
    - Verify error messages match v4 behavior
    - _Bug_Condition: Credentials authentication must work identically after migration_
    - _Expected_Behavior: Email/password login works with same validation and rate limiting_
    - _Preservation: Credentials authentication functionality unchanged (requirement 3.5)_
    - _Requirements: 3.5, 3.6, 3.7, 3.9, 3.10, 3.11_

  - [ ] 3.10 Migrate session configuration to v5
    - Copy session configuration from old route.ts to new auth.ts
    - Set `strategy: "jwt"` (same as v4)
    - Set `maxAge: 7 * 24 * 60 * 60` (7 days, same as v4)
    - Verify session configuration syntax matches v5 requirements
    - Test session creation and validation
    - Verify JWT tokens contain correct user data
    - _Bug_Condition: Session management must work identically after migration_
    - _Expected_Behavior: JWT sessions work with same maxAge and user data_
    - _Preservation: Session management functionality unchanged (requirement 3.6, 3.7)_
    - _Requirements: 3.6, 3.7, 3.8_

  - [ ] 3.11 Migrate signIn callback to v5
    - Copy signIn callback from old route.ts to new auth.ts
    - Update callback signature to match v5 interface (check parameter names and types)
    - Preserve all existing logic:
      - OAuth provider detection (account?.provider !== "credentials")
      - Email extraction and normalization
      - Existing user lookup with Account relation
      - Provider account linking check
      - Account linking prevention (return false if user exists but doesn't have this provider)
      - Email verification update logic (check time since creation)
    - Test signIn callback with all OAuth providers
    - Test account linking prevention (OAuth sign-in with existing email should be blocked)
    - Verify error handling matches v4 behavior
    - _Bug_Condition: OAuth account creation and linking must work identically after migration_
    - _Expected_Behavior: signIn callback handles account creation and linking correctly_
    - _Preservation: OAuth account linking prevention unchanged (requirement 3.12, 3.13)_
    - _Requirements: 3.12, 3.13_

  - [ ] 3.12 Migrate jwt callback to v5
    - Copy jwt callback from old route.ts to new auth.ts
    - Update callback signature to match v5 interface (check parameter names and types)
    - Preserve all existing logic:
      - Initial sign-in: add user.id, user.email to token
      - OAuth provider role fetch: query database for role if account?.provider !== "credentials"
      - Credentials provider role: use user.role directly
      - OAuth emailVerified: set to current date
      - Update trigger: refresh user data from database (role, email, name, image)
    - Test jwt callback with all authentication methods
    - Verify token contains correct user data (sub, email, role, emailVerified)
    - Verify role assignment works for both OAuth and credentials
    - _Bug_Condition: JWT token generation must work identically after migration_
    - _Expected_Behavior: JWT tokens contain correct user data and role information_
    - _Preservation: JWT callback functionality unchanged (requirement 3.7, 3.8)_
    - _Requirements: 3.7, 3.8_

  - [ ] 3.13 Migrate session callback to v5
    - Copy session callback from old route.ts to new auth.ts
    - Update callback signature to match v5 interface (check parameter names and types)
    - Preserve all existing logic:
      - Add token.sub to session.user.id
      - Add token.email to session.user.email
      - Add token.role to session.user.role
      - Add token.emailVerified to session.user.emailVerified
    - Test session callback with all authentication methods
    - Verify session object contains correct user data
    - Verify protected routes receive correct user information
    - _Bug_Condition: Session data must be identical after migration_
    - _Expected_Behavior: Session callback returns correct user data to client_
    - _Preservation: Session callback functionality unchanged (requirement 3.6, 3.7)_
    - _Requirements: 3.6, 3.7_

  - [ ] 3.14 Migrate PrismaAdapter to v5
    - Copy PrismaAdapter configuration from old route.ts to new auth.ts
    - Verify PrismaAdapter is compatible with next-auth v5 (check @next-auth/prisma-adapter version)
    - Keep getSafePrisma() wrapper for error handling
    - Test adapter with OAuth providers (adapter only used for OAuth, not JWT validation)
    - Verify user and account records are created correctly in database
    - Verify adapter does not interfere with JWT session validation
    - _Bug_Condition: PrismaAdapter must work identically after migration_
    - _Expected_Behavior: PrismaAdapter creates user and account records correctly_
    - _Preservation: Database adapter functionality unchanged_
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.12, 3.13_

  - [ ] 3.15 Migrate pages configuration to v5
    - Copy pages configuration from old route.ts to new auth.ts
    - Set signIn page: "/login"
    - Set error page: "/login"
    - Set signOut page: "/login"
    - Verify page redirects work correctly after authentication
    - Test error handling redirects to login page
    - _Bug_Condition: Page redirects must work identically after migration_
    - _Expected_Behavior: Authentication pages redirect correctly_
    - _Preservation: Page configuration unchanged_
    - _Requirements: 3.6_

  - [ ] 3.16 Create new API route handler for next-auth v5
    - Create/update `src/app/api/auth/[...nextauth]/route.ts` to use new auth.ts configuration
    - Import `auth` from "@/auth" (or wherever auth.ts is located)
    - Export GET and POST handlers using next-auth v5 API:
      ```typescript
      import { handlers } from "@/auth"
      export const { GET, POST } = handlers
      ```
    - Verify route handler syntax matches v5 requirements
    - Test that `/api/auth/session`, `/api/auth/signin`, `/api/auth/signout` endpoints work
    - _Bug_Condition: API route handler must work with v5 configuration_
    - _Expected_Behavior: Auth API routes work correctly with new handler structure_
    - _Preservation: API endpoints remain at same URLs_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.17 Update middleware.ts for next-auth v5
    - Read current middleware.ts implementation
    - Check if middleware uses next-auth functions (getToken, withAuth, etc.)
    - Update imports to next-auth v5 API if needed
    - Verify getToken() function signature is compatible with v5
    - Test middleware with protected routes (/dashboard, /admin, /calendar, /settings)
    - Test middleware with /createpassword and /resetpassword token validation
    - Verify user headers (x-user-id, x-user-email) are still injected correctly
    - Verify admin route protection still works (role check)
    - Verify cache control headers are still set correctly
    - _Bug_Condition: Middleware must work identically after migration_
    - _Expected_Behavior: Middleware validates sessions and protects routes correctly_
    - _Preservation: Middleware functionality unchanged (requirement 3.6)_
    - _Requirements: 3.6_

  - [ ] 3.18 Update client-side authentication code for next-auth v5
    - Search for all files using `useSession`, `signIn`, `signOut` from "next-auth/react"
    - Verify imports are compatible with next-auth v5
    - Update function calls if v5 changed signatures
    - Test client-side session access in components
    - Test client-side sign-in and sign-out functionality
    - Verify session data structure matches v4 (user.id, user.email, user.role, user.emailVerified)
    - _Bug_Condition: Client-side authentication must work identically after migration_
    - _Expected_Behavior: useSession, signIn, signOut work correctly in client components_
    - _Preservation: Client-side authentication functionality unchanged_
    - _Requirements: 3.6, 3.7_

  - [ ] 3.19 Increase Redis commandTimeout from 3s to 10s
    - Open `src/lib/redis.ts`
    - Change `commandTimeout: 3000` to `commandTimeout: 10000`
    - Verify no other Redis configuration needs adjustment
    - Test Redis connection with new timeout
    - Simulate network latency (4-8 seconds) and verify commands complete successfully
    - Verify rate limiting still works correctly with new timeout
    - Verify no timeout errors appear in logs under normal conditions
    - _Bug_Condition: Redis commands timeout prematurely at 3 seconds (requirement 1.4, 1.5, 1.6)_
    - _Expected_Behavior: Redis commands have 10 seconds to complete, preventing false timeouts (requirement 2.4, 2.5, 2.6)_
    - _Preservation: Redis functionality unchanged, just timeout increased (requirement 3.9, 3.10)_
    - _Requirements: 1.4, 1.5, 1.6, 2.4, 2.5, 2.6, 3.9, 3.10_

  - [ ] 3.20 Test complete authentication flow end-to-end
    - Test Google OAuth: login → session creation → protected route access → logout
    - Test Facebook OAuth: login → session creation → protected route access → logout
    - Test TikTok OAuth: login → session creation → protected route access → logout
    - Test LinkedIn OAuth: login → session creation → protected route access → logout
    - Test Twitter OAuth: login → session creation → protected route access → logout
    - Test credentials login: email/password → session creation → protected route access → logout
    - Test rate limiting: exceed limits → verify rejection → wait → verify reset
    - Test account linking prevention: OAuth sign-in with existing email → verify blocked
    - Test session validation: access /dashboard → verify user data correct
    - Test admin route protection: non-admin access /admin → verify redirect
    - _Bug_Condition: All authentication flows must work identically after migration_
    - _Expected_Behavior: Complete authentication flows work end-to-end_
    - _Preservation: All authentication functionality preserved_
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14_

  - [ ] 3.21 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Clean Production Logs
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1:
      - Access `/api/auth/session` with `NODE_OPTIONS=--trace-deprecation` → verify NO DEP0169 warnings
      - Access `/api/auth/session` with simulated 4-second Redis latency → verify NO timeout errors
      - Access `/api/auth/session` → verify NO Twitter OAuth beta warnings
      - Access `/dashboard` → verify clean logs with no errors
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - Document test results:
      - DEP0169 warnings eliminated (next-auth v5 uses WHATWG URL API)
      - Redis timeout errors eliminated (10-second timeout allows commands to complete)
      - Twitter OAuth warnings eliminated (logger suppresses beta warnings)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ] 3.22 Verify preservation tests still pass
    - **Property 2: Preservation** - Authentication Functionality
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2:
      - Google OAuth: verify same user data, session tokens, database records
      - Facebook OAuth: verify same behavior
      - TikTok OAuth: verify same behavior
      - LinkedIn OAuth: verify same behavior
      - Twitter OAuth: verify same behavior (warning suppressed but functionality unchanged)
      - Credentials login: verify same authentication logic, rate limiting, session creation
      - Session validation: verify same user data returned
      - Rate limiting: verify same limits and fallback behavior
      - Account linking prevention: verify same blocking behavior
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - Document any unexpected differences (should be none)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14_

- [ ] 4. Checkpoint - Ensure all tests pass and production logs are clean
  - Run complete test suite (unit tests, integration tests, property-based tests)
  - Verify all tests pass
  - Deploy to Vercel production (or staging environment)
  - Monitor production logs for 24-48 hours
  - Verify NO DEP0169 deprecation warnings appear
  - Verify NO Redis timeout errors appear under normal conditions
  - Verify NO Twitter OAuth beta warnings appear
  - Verify all authentication flows work correctly in production
  - Ask the user if questions arise or if additional testing is needed

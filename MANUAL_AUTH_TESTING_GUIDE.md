# 🔐 Complete Authentication Flow Manual Testing Guide

This guide provides step-by-step instructions to manually verify all authentication flows work correctly in the DragInDrop application.

## ✅ Prerequisites

Before testing, ensure:
- Development server is running (`pnpm dev`)
- Database is accessible (Neon Postgres)
- RESEND_API_KEY is configured in .env.local
- NEXT_PUBLIC_APP_URL is set correctly
- Google OAuth credentials are configured

---

## 📋 Test 1: Registration Flow

### Steps:
1. Navigate to `http://localhost:3000/register`
2. Fill in the registration form:
   - First Name: `Test`
   - Last Name: `User`
   - Email: Use a real email you can access
3. Click "Create Account"

### Expected Results:
✅ Success modal appears with message "Check your email"
✅ Modal shows the email address you entered
✅ No errors in browser console

### Email Verification:
4. Check your email inbox
5. Look for email from "onboarding@resend.dev"
6. Subject should be "Verify your DragInDrop Account"

### Expected Email Content:
✅ Email has proper styling and branding
✅ Email contains "Welcome to DragInDrop, Test!"
✅ Email has a blue "Verify Email & Set Password" button
✅ Link format: `https://dragindrop.vercel.app/createpassword?token=...`
✅ Email mentions "This link expires in 24 hours"

### Database Verification:
7. Open Neon Postgres dashboard in Vercel
8. Navigate to the `User` table
9. Find the record with your email

### Expected Database State:
✅ User record exists with:
  - `firstName`: "Test"
  - `lastName`: "User"
  - `email`: your email (lowercase)
  - `emailVerified`: NULL (not verified yet)
  - `password`: NULL (not set yet)
  - `role`: "USER"
  - `createdAt`: timestamp
  - `updatedAt`: timestamp

10. Check `VerificationToken` table

### Expected Token State:
✅ Token record exists with:
  - `tokenHash`: 64-character hex string (SHA-256 hash)
  - `type`: "VERIFY"
  - `userId`: matches your User id
  - `expiresAt`: 24 hours from now
  - `createdAt`: timestamp

---

## 📋 Test 2: Create Password Flow

### Steps:
1. Click the verification link in your email
2. Verify you're redirected to `/createpassword` page

### Expected Page State:
✅ Page loads successfully
✅ Lock icon displayed
✅ "Set Password" heading visible
✅ Two password input fields shown
✅ "Complete Registration" button visible

### Password Validation Testing:
3. Click in the "Password" field (focus it)

### Expected Behavior:
✅ Password requirements checklist appears below the field
✅ Checklist shows 5 requirements:
  - 8+ Characters
  - Uppercase (A-Z)
  - Lowercase (a-z)
  - Number (0-9)
  - Symbol (!@#$)

4. Type a weak password: `test`

### Expected Behavior:
✅ Requirements remain red/unchecked
✅ Error message appears: "MIN 8 CHARS" or "WEAK PASSWORD"
✅ "Complete Registration" button is disabled

5. Type a strong password: `TestPass123!`

### Expected Behavior:
✅ Requirements turn green as you meet them
✅ All 5 requirements show checkmarks
✅ No error messages
✅ "Complete Registration" button becomes enabled

6. Type the same password in "Confirm Password" field
7. Click "Complete Registration"

### Expected Results:
✅ Loading spinner appears
✅ Redirected to `/dashboard`
✅ You're logged in (can see dashboard content)
✅ No errors in browser console

### Database Verification:
8. Check Neon Postgres `User` table again

### Expected Database State:
✅ User record updated with:
  - `emailVerified`: timestamp (not NULL anymore)
  - `password`: bcrypt hash (starts with `$2a$` or `$2b$`)
  - Password is NOT plain text

9. Check `VerificationToken` table

### Expected Token State:
✅ Verification token is DELETED (no longer exists)

---

## 📋 Test 3: Login Flow

### Steps:
1. Logout or open incognito window
2. Navigate to `http://localhost:3000/login`
3. Enter your email and password
4. Click "Login"

### Expected Results:
✅ Loading spinner appears
✅ Redirected to `/dashboard`
✅ Session cookie is set (check browser DevTools → Application → Cookies)
✅ Cookie name: `session`
✅ Cookie is HttpOnly: true
✅ Cookie is Secure: true (in production)

### Error Testing:
5. Try logging in with wrong password

### Expected Behavior:
✅ Error message: "Invalid email or password"
✅ NOT redirected
✅ Form remains on login page

6. Try logging in with non-existent email

### Expected Behavior:
✅ Error message: "Invalid email or password"
✅ Same error as wrong password (security - don't reveal which is wrong)

---

## 📋 Test 4: Forgot Password Flow

### Steps:
1. Navigate to `http://localhost:3000/login`
2. Click "Forgot Password?" link
3. Modal appears with email input

### Expected Modal State:
✅ Modal has mail icon
✅ Heading: "Forgot password?"
✅ Description explains what will happen
✅ Email input field visible
✅ "Get Email" button visible

4. Enter your email address
5. Click "Get Email"

### Expected Results:
✅ Loading spinner appears on button
✅ Success view appears with:
  - Green checkmark icon
  - "Check your email" heading
  - Your email address displayed
  - Instructions to click the link

### Email Verification:
6. Check your email inbox
7. Look for email from "onboarding@resend.dev"
8. Subject should be "Reset Your DragInDrop Password"

### Expected Email Content:
✅ Email has proper styling
✅ Email contains "Hi Test," (your first name)
✅ Email explains password reset request
✅ Email has blue "Reset Password" button
✅ Link format: `https://dragindrop.vercel.app/reset-password?token=...`
✅ Email mentions "This link expires in 1 hour"
✅ Email has disclaimer: "If you didn't request this, you can safely ignore this email"

### Database Verification:
9. Check `VerificationToken` table

### Expected Token State:
✅ New token record exists with:
  - `type`: "RESET_PASSWORD"
  - `userId`: your user id
  - `expiresAt`: 1 hour from now
  - `tokenHash`: 64-character hex string

---

## 📋 Test 5: Reset Password Flow

### Steps:
1. Click the reset link in your email
2. Verify you're redirected to `/reset-password` page

### Expected Page State:
✅ Page loads successfully
✅ Lock icon displayed
✅ "Reset Password" heading visible
✅ Two password input fields shown
✅ "Reset Password" button visible

3. Enter a new strong password: `NewPass456!`
4. Confirm the password
5. Click "Reset Password"

### Expected Results:
✅ Loading spinner appears
✅ Success view appears with:
  - Green checkmark icon
  - "Password Reset!" heading
  - "Redirecting to login..." message
✅ Automatically redirected to `/login` after 2 seconds

### Login with New Password:
6. Enter your email
7. Enter the NEW password (`NewPass456!`)
8. Click "Login"

### Expected Results:
✅ Login successful
✅ Redirected to `/dashboard`
✅ Can access protected routes

### Database Verification:
9. Check `User` table

### Expected Database State:
✅ `password` field has NEW bcrypt hash (different from before)

10. Check `VerificationToken` table

### Expected Token State:
✅ Reset password token is DELETED (no longer exists)

---

## 📋 Test 6: Google OAuth Flow

### Steps:
1. Login to your account
2. Navigate to `http://localhost:3000/settings/social-accounts`
3. Find the Google platform card
4. Click "Connect" button

### Expected Behavior:
✅ Redirected to Google OAuth consent screen
✅ URL starts with `https://accounts.google.com/o/oauth2/v2/auth`
✅ Shows your Google account(s)
✅ Requests permissions for:
  - YouTube Data API
  - Email
  - Profile

5. Select a Google account
6. Click "Allow" to grant permissions

### Expected Results:
✅ Redirected back to `/settings/social-accounts`
✅ URL contains `?success=google_connected`
✅ Google card now shows "Connected" status
✅ "Connect" button changes to "Disconnect"
✅ No errors in browser console

### Database Verification:
7. Check Neon Postgres `SocialAccount` table

### Expected Database State:
✅ New record exists with:
  - `userId`: your user id
  - `platform`: "Google"
  - `accessToken`: long string (OAuth access token)
  - `refreshToken`: long string or NULL
  - `expiresAt`: timestamp (token expiration)
  - `createdAt`: timestamp
  - `updatedAt`: timestamp

### Persistence Testing:
8. Refresh the page (F5 or Ctrl+R)

### Expected Behavior:
✅ Google still shows as "Connected"
✅ Connection status persists across page refreshes
✅ Data loaded from database, not local state

### Disconnect Testing:
9. Click "Disconnect" button

### Expected Results:
✅ Confirmation or immediate disconnect
✅ Google card shows "Connect" button again
✅ Status changes to disconnected

10. Check `SocialAccount` table again

### Expected Database State:
✅ Record is DELETED (no longer exists for Google + your userId)

---

## 📋 Test 7: Rate Limiting

### Registration Rate Limiting:
1. Try registering 5+ times quickly with different emails

### Expected Behavior:
✅ After 5 attempts, error appears:
  - "Too many requests from this IP. Try again later."
  - OR "Too many requests from this device. Try again later."
  - OR "Too many emails sent to this address. Try again later."

### Login Rate Limiting:
2. Try logging in with wrong password 10+ times

### Expected Behavior:
✅ After 10 attempts, error appears:
  - "Too many login attempts. Please try again later."
  - OR "Too many login attempts for this account. Please try again later."

---

## 📋 Test 8: Error Handling

### Expired Verification Token:
1. Wait 24+ hours after registration
2. Try clicking the verification link

### Expected Behavior:
✅ Error message: "Token has expired. Please register again."
✅ NOT redirected to dashboard
✅ User remains unverified in database

### Expired Reset Token:
1. Wait 1+ hour after requesting password reset
2. Try clicking the reset link

### Expected Behavior:
✅ Error message: "Reset token has expired. Please request a new one."
✅ NOT able to reset password
✅ Token deleted from database

### Invalid Token:
1. Try accessing `/createpassword` without token parameter
2. Try accessing `/reset-password` without token parameter

### Expected Behavior:
✅ Error message appears
✅ Cannot proceed without valid token

---

## 📋 Test 9: Email Delivery Verification

### Resend Dashboard Check:
1. Login to Resend dashboard (https://resend.com/emails)
2. Check "Emails" tab

### Expected Results:
✅ All sent emails appear in the list:
  - Verification emails
  - Password reset emails
✅ Emails show "Delivered" status
✅ Sender: "onboarding@resend.dev"
✅ Recipients match your test emails
✅ No bounces or failures

### Email Queue Fallback:
If email sending fails:
1. Check `EmailQueue` table in database

### Expected Behavior:
✅ Failed emails are queued with:
  - `to`: recipient email
  - `from`: sender email
  - `subject`: email subject
  - `html`: email content
  - `attempts`: 0 (initially)
  - `createdAt`: timestamp

2. Wait for cron job to run (every 3 minutes)
3. Check `EmailQueue` table again

### Expected Behavior:
✅ Record is deleted (email sent successfully)
✅ OR `attempts` incremented (if still failing)
✅ Records with `attempts >= 3` are deleted

---

## 🎯 Success Criteria

All tests should pass with the following outcomes:

### Registration & Verification:
- ✅ Users can register with valid email
- ✅ Verification emails are sent via Resend
- ✅ Email links work and redirect correctly
- ✅ Passwords are hashed in database
- ✅ Email verification updates database

### Login & Session:
- ✅ Users can login with correct credentials
- ✅ Session cookies are set correctly
- ✅ Protected routes are accessible after login
- ✅ Invalid credentials show appropriate errors

### Password Reset:
- ✅ Users can request password reset
- ✅ Reset emails are sent via Resend
- ✅ Reset links work and allow password change
- ✅ New passwords are hashed and stored
- ✅ Users can login with new password

### Google OAuth:
- ✅ OAuth flow redirects to Google
- ✅ Tokens are stored in database
- ✅ Connections persist across page refreshes
- ✅ Disconnect removes database records

### Security & Validation:
- ✅ Rate limiting prevents abuse
- ✅ Expired tokens are rejected
- ✅ Password validation enforces strong passwords
- ✅ CSRF protection works (state parameter)
- ✅ HttpOnly cookies prevent XSS

### Database Integrity:
- ✅ All user data is properly stored
- ✅ Relations work correctly
- ✅ Tokens are deleted after use
- ✅ Cascade deletes work properly

---

## 🐛 Common Issues & Solutions

### Issue: Emails not received
**Solution**: 
- Check RESEND_API_KEY is configured
- Check Resend dashboard for delivery status
- Check spam folder
- Verify email address is valid

### Issue: OAuth redirect fails
**Solution**:
- Check Google OAuth credentials are correct
- Verify redirect URI matches in Google Console
- Check NEXT_PUBLIC_APP_URL is set correctly

### Issue: Database connection fails
**Solution**:
- Check DATABASE_URL is configured
- Verify Neon Postgres is accessible
- Run `pnpm db:push` to sync schema

### Issue: Session not persisting
**Solution**:
- Check SESSION_SECRET is configured
- Verify cookies are enabled in browser
- Check cookie settings (HttpOnly, Secure, SameSite)

---

## 📊 Testing Checklist

Use this checklist to track your testing progress:

- [ ] Registration flow complete
- [ ] Email verification received and works
- [ ] Create password flow complete
- [ ] Database stores user correctly
- [ ] Login with correct credentials works
- [ ] Login with wrong credentials fails appropriately
- [ ] Forgot password flow complete
- [ ] Password reset email received
- [ ] Reset password flow complete
- [ ] Login with new password works
- [ ] Google OAuth connection works
- [ ] OAuth tokens stored in database
- [ ] Connection persists after refresh
- [ ] Disconnect removes database record
- [ ] Rate limiting prevents abuse
- [ ] Expired tokens are rejected
- [ ] All emails delivered via Resend
- [ ] Email queue fallback works
- [ ] Database integrity maintained
- [ ] No console errors during any flow

---

## ✅ Final Verification

After completing all tests, verify:

1. **All authentication flows work end-to-end**
2. **Emails are delivered reliably via Resend**
3. **Database stores all data correctly**
4. **Security measures are in place**
5. **Error handling is appropriate**
6. **User experience is smooth**

**If all tests pass, the authentication system is ready for production! 🚀**

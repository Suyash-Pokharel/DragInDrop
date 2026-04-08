-- Add missing indexes for NextAuth models
-- Account and Session tables already exist, this migration adds the required indexes

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- Update Account table columns to use TEXT type for large tokens
-- Note: PostgreSQL automatically handles TEXT vs VARCHAR, so this is mainly for schema consistency
ALTER TABLE "Account" ALTER COLUMN "refresh_token" TYPE TEXT;
ALTER TABLE "Account" ALTER COLUMN "access_token" TYPE TEXT;
ALTER TABLE "Account" ALTER COLUMN "id_token" TYPE TEXT;

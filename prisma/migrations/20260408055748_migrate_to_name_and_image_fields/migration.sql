/*
  Warnings:

  - You are about to drop the column `firstName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `profilePic` on the `User` table. All the data in the column will be lost.

*/

-- Step 1: Add new columns
ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "image" TEXT;

-- Step 2: Migrate existing data
UPDATE "User" 
SET "name" = CASE 
  WHEN "lastName" IS NOT NULL AND "lastName" != '' 
  THEN "firstName" || ' ' || "lastName"
  ELSE "firstName"
END;

UPDATE "User" 
SET "image" = "profilePic";

-- Step 3: Drop old columns
ALTER TABLE "User" DROP COLUMN "firstName";
ALTER TABLE "User" DROP COLUMN "lastName";
ALTER TABLE "User" DROP COLUMN "profilePic";

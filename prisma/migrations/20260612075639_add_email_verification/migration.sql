-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" VARCHAR(512),
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

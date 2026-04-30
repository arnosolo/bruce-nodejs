-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentKey" VARCHAR(512),
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'TEXT';

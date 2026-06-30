-- AlterTable
ALTER TABLE "User" ADD COLUMN     "loginCode" VARCHAR(10),
ADD COLUMN     "loginCodeExpires" TIMESTAMP(3);

/*
  Warnings:

  - You are about to drop the column `playerId` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_playerId_fkey";

-- AlterTable
ALTER TABLE "GameSession" DROP COLUMN "playerId",
ADD COLUMN     "pseudo" TEXT NOT NULL DEFAULT 'Anonymous';

-- DropTable
DROP TABLE "User";

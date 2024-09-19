-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "foundCharactersName" TEXT[] DEFAULT ARRAY[]::TEXT[];

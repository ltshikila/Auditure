-- CreateEnum
CREATE TYPE "VoiceTier" AS ENUM ('STANDARD', 'NEURAL');

-- AlterTable
ALTER TABLE "episodes" ADD COLUMN "voiceTier" "VoiceTier" NOT NULL DEFAULT 'NEURAL';

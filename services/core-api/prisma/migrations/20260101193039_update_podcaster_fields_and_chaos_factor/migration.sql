-- AlterEnum
BEGIN;
CREATE TYPE "VoiceModel_new" AS ENUM ('CUSTOM', 'CONVERSATIONAL', 'ENERGETIC', 'CALM', 'SARCASTIC', 'ACADEMIC');
ALTER TABLE "podcasters" ALTER COLUMN "voiceModel" TYPE "VoiceModel_new" USING ("voiceModel"::text::"VoiceModel_new");
ALTER TYPE "VoiceModel" RENAME TO "VoiceModel_old";
ALTER TYPE "VoiceModel_new" RENAME TO "VoiceModel";
DROP TYPE "public"."VoiceModel_old";
COMMIT;

-- AlterTable
ALTER TABLE "podcasters" DROP COLUMN "vocabularyComplexity",
ADD COLUMN     "chaosFactor" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "emotionalExpression" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "sentenceStructure" INTEGER NOT NULL DEFAULT 5;

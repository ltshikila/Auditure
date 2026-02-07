-- Remove GROUP from EpisodeType enum
-- Note: Ensure no episodes exist with episodeType = 'GROUP' before applying
ALTER TYPE "EpisodeType" RENAME TO "EpisodeType_old";
CREATE TYPE "EpisodeType" AS ENUM ('MONOLOGUE', 'DUO');
ALTER TABLE "episodes" ALTER COLUMN "episodeType" TYPE "EpisodeType" USING ("episodeType"::text::"EpisodeType");
DROP TYPE "EpisodeType_old";

-- Live transcript timing produced by forced alignment in the ai-worker.
-- Shape: [{ "text": string, "start": number, "end": number }] with times in
-- seconds. Nullable: episodes without alignment simply have no live sync.
ALTER TABLE "episodes" ADD COLUMN "transcriptSegments" JSONB;

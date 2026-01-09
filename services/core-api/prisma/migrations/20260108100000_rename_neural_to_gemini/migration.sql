-- Add GEMINI to VoiceTier enum
-- GEMINI = Gemini 2.5 Pro TTS (~$0.32/10-min episode)
-- Note: NEURAL value remains for backwards compatibility but is deprecated

-- Add new enum value GEMINI
ALTER TYPE "VoiceTier" ADD VALUE 'GEMINI';

-- Update the default value to STANDARD (free tier)
ALTER TABLE "episodes" ALTER COLUMN "voiceTier" SET DEFAULT 'STANDARD';

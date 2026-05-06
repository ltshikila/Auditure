-- Adds nested reply support to episode_comments and a NEW_REPLY notification type.
-- Idempotent: safe to re-run.

-- 1. NEW_REPLY enum value
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_REPLY';

-- 2. parentCommentId column on episode_comments
ALTER TABLE "episode_comments" ADD COLUMN IF NOT EXISTS "parentCommentId" TEXT;

-- 3. Self-referential FK with cascade delete
DO $$ BEGIN
    ALTER TABLE "episode_comments"
        ADD CONSTRAINT "episode_comments_parentCommentId_fkey"
        FOREIGN KEY ("parentCommentId") REFERENCES "episode_comments"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Index for fetching replies by parent
CREATE INDEX IF NOT EXISTS "episode_comments_parentCommentId_idx"
    ON "episode_comments"("parentCommentId");

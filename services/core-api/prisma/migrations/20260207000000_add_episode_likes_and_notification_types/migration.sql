-- Comprehensive idempotent migration: creates all enums and tables
-- that were previously applied via `prisma db push` but had no migration file.
-- Uses DO blocks with exception handling so this works whether or not
-- the objects already exist in the target database.

-- ============================================================
-- 1. CREATE MISSING ENUMS (idempotent via exception handling)
-- ============================================================

-- SubscriptionTier enum
DO $$ BEGIN
    CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ThemePreference enum
DO $$ BEGIN
    CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- NotificationType enum
DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM (
        'EPISODE_READY', 'EPISODE_FAILED', 'NEW_COMMENT', 'NEW_RATING',
        'NEW_LIKE', 'BOOK_READY', 'BOOK_FAILED', 'SUBSCRIPTION_WARNING',
        'WELCOME', 'MILESTONE', 'SYSTEM'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- If the enums already existed (from db push), add any values that might be missing
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EPISODE_READY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EPISODE_FAILED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_COMMENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_RATING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_LIKE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOK_READY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOK_FAILED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_WARNING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WELCOME';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MILESTONE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM';

ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'FREE';
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'STARTER';
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'PRO';

ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'LIGHT';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'DARK';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'SYSTEM';


-- ============================================================
-- 2. CREATE MISSING TABLES (idempotent via IF NOT EXISTS)
-- ============================================================

-- PodcasterRating
CREATE TABLE IF NOT EXISTS "podcaster_ratings" (
    "id" TEXT NOT NULL,
    "podcasterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcaster_ratings_pkey" PRIMARY KEY ("id")
);

-- EpisodeComment
CREATE TABLE IF NOT EXISTS "episode_comments" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episode_comments_pkey" PRIMARY KEY ("id")
);

-- UserSettings
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmailsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "expoPushToken" TEXT,
    "profilePublic" BOOLEAN NOT NULL DEFAULT false,
    "showListeningActivity" BOOLEAN NOT NULL DEFAULT true,
    "autoPlayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "playbackSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "downloadOverWifiOnly" BOOLEAN NOT NULL DEFAULT true,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "privacyPolicyAcceptedAt" TIMESTAMP(3),
    "privacyPolicyVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- Subscription
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "geminiEpisodesUsed" INTEGER NOT NULL DEFAULT 0,
    "standardEpisodesUsed" INTEGER NOT NULL DEFAULT 0,
    "usagePeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geminiEpisodeLimit" INTEGER NOT NULL DEFAULT 1,
    "standardEpisodeLimit" INTEGER NOT NULL DEFAULT 2,
    "paystackCustomerCode" TEXT,
    "paystackSubscriptionCode" TEXT,
    "paystackEmailToken" TEXT,
    "premiumStartedAt" TIMESTAMP(3),
    "premiumExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- TermsAndConditions
CREATE TABLE IF NOT EXISTS "terms_and_conditions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_and_conditions_pkey" PRIMARY KEY ("id")
);

-- EpisodeLike
CREATE TABLE IF NOT EXISTS "episode_likes" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episode_likes_pkey" PRIMARY KEY ("id")
);

-- Notification
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);


-- ============================================================
-- 3. CREATE INDEXES (idempotent via IF NOT EXISTS)
-- ============================================================

-- podcaster_ratings indexes
CREATE UNIQUE INDEX IF NOT EXISTS "podcaster_ratings_podcasterId_userId_key" ON "podcaster_ratings"("podcasterId", "userId");
CREATE INDEX IF NOT EXISTS "podcaster_ratings_podcasterId_idx" ON "podcaster_ratings"("podcasterId");
CREATE INDEX IF NOT EXISTS "podcaster_ratings_userId_idx" ON "podcaster_ratings"("userId");

-- episode_comments indexes
CREATE INDEX IF NOT EXISTS "episode_comments_episodeId_idx" ON "episode_comments"("episodeId");
CREATE INDEX IF NOT EXISTS "episode_comments_userId_idx" ON "episode_comments"("userId");
CREATE INDEX IF NOT EXISTS "episode_comments_createdAt_idx" ON "episode_comments"("createdAt");

-- user_settings indexes
CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_userId_key" ON "user_settings"("userId");

-- subscriptions indexes
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE INDEX IF NOT EXISTS "subscriptions_tier_idx" ON "subscriptions"("tier");
CREATE INDEX IF NOT EXISTS "subscriptions_usagePeriodStart_idx" ON "subscriptions"("usagePeriodStart");
CREATE INDEX IF NOT EXISTS "subscriptions_paystackCustomerCode_idx" ON "subscriptions"("paystackCustomerCode");

-- terms_and_conditions indexes
CREATE UNIQUE INDEX IF NOT EXISTS "terms_and_conditions_version_key" ON "terms_and_conditions"("version");

-- episode_likes indexes
CREATE UNIQUE INDEX IF NOT EXISTS "episode_likes_episodeId_userId_key" ON "episode_likes"("episodeId", "userId");
CREATE INDEX IF NOT EXISTS "episode_likes_userId_idx" ON "episode_likes"("userId");
CREATE INDEX IF NOT EXISTS "episode_likes_episodeId_idx" ON "episode_likes"("episodeId");

-- notifications indexes
CREATE INDEX IF NOT EXISTS "notifications_userId_read_createdAt_idx" ON "notifications"("userId", "read", "createdAt" DESC);


-- ============================================================
-- 4. ADD FOREIGN KEYS (idempotent via exception handling)
-- ============================================================

-- podcaster_ratings foreign keys
DO $$ BEGIN
    ALTER TABLE "podcaster_ratings" ADD CONSTRAINT "podcaster_ratings_podcasterId_fkey" FOREIGN KEY ("podcasterId") REFERENCES "podcasters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "podcaster_ratings" ADD CONSTRAINT "podcaster_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- episode_comments foreign keys
DO $$ BEGIN
    ALTER TABLE "episode_comments" ADD CONSTRAINT "episode_comments_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "episode_comments" ADD CONSTRAINT "episode_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- user_settings foreign keys
DO $$ BEGIN
    ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- subscriptions foreign keys
DO $$ BEGIN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- episode_likes foreign keys
DO $$ BEGIN
    ALTER TABLE "episode_likes" ADD CONSTRAINT "episode_likes_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "episode_likes" ADD CONSTRAINT "episode_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- notifications foreign keys
DO $$ BEGIN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

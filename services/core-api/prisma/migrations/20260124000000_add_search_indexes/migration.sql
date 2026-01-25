-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- B-tree indexes for exact and prefix matching
-- ============================================

-- Books: Search indexes
CREATE INDEX IF NOT EXISTS "books_title_idx" ON "books"("title");
CREATE INDEX IF NOT EXISTS "books_author_idx" ON "books"("author");
CREATE INDEX IF NOT EXISTS "books_userId_extractionStatus_idx" ON "books"("userId", "extractionStatus");

-- Episodes: Search indexes
CREATE INDEX IF NOT EXISTS "episodes_title_idx" ON "episodes"("title");
CREATE INDEX IF NOT EXISTS "episodes_isPublic_generationStatus_playCount_idx" ON "episodes"("isPublic", "generationStatus", "playCount");
CREATE INDEX IF NOT EXISTS "episodes_userId_generationStatus_idx" ON "episodes"("userId", "generationStatus");

-- Podcasters: Search indexes
CREATE INDEX IF NOT EXISTS "podcasters_name_idx" ON "podcasters"("name");
CREATE INDEX IF NOT EXISTS "podcasters_isPublic_playCount_idx" ON "podcasters"("isPublic", "playCount");

-- ============================================
-- GIN indexes for fuzzy text search (pg_trgm)
-- These enable efficient ILIKE and similarity searches
-- ============================================

-- Episodes: GIN trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS "episodes_title_trgm_idx" ON "episodes" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "episodes_description_trgm_idx" ON "episodes" USING GIN ("description" gin_trgm_ops);

-- Books: GIN trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS "books_title_trgm_idx" ON "books" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "books_author_trgm_idx" ON "books" USING GIN ("author" gin_trgm_ops);

-- Podcasters: GIN trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS "podcasters_name_trgm_idx" ON "podcasters" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "podcasters_description_trgm_idx" ON "podcasters" USING GIN ("description" gin_trgm_ops);

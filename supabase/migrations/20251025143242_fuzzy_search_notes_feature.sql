-- Migration: Fuzzy Search Notes Feature
-- Description: Create parallel note system with message-first architecture and fuzzy search
-- Author: Claude Code
-- Date: 2025-10-25

-- ============================================================================
-- Part 1: Enable PostgreSQL Extensions
-- ============================================================================

-- Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Set similarity threshold to 0.4 (40% match required)
-- This provides a good balance between fuzzy matching and false positives
ALTER DATABASE postgres SET pg_trgm.similarity_threshold = 0.4;

-- ============================================================================
-- Part 2: Create New Tables (Parallel to z_messages and z_links)
-- ============================================================================

-- Create z_notes table (parallel to z_messages)
CREATE TABLE IF NOT EXISTS z_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create z_note_links table (parallel to z_links)
CREATE TABLE IF NOT EXISTS z_note_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES z_notes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  og_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Part 3: Create Indexes
-- ============================================================================

-- Standard indexes for filtering
CREATE INDEX IF NOT EXISTS idx_notes_telegram_user ON z_notes(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON z_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_links_note_id ON z_note_links(note_id);

-- GIN trigram indexes for fuzzy text matching
CREATE INDEX IF NOT EXISTS idx_notes_content_trgm ON z_notes USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_note_links_url_trgm ON z_note_links USING GIN (url gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_note_links_title_trgm ON z_note_links USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_note_links_description_trgm ON z_note_links USING GIN (description gin_trgm_ops);

-- ============================================================================
-- Part 4: Create Search Functions
-- ============================================================================

-- Function: search_notes_fuzzy
-- Purpose: Fuzzy search across notes and their links with weighted relevance scoring
-- Returns: Paginated notes with aggregated links as JSON
CREATE OR REPLACE FUNCTION search_notes_fuzzy(
  telegram_user_id_param BIGINT,
  search_keyword TEXT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 5
)
RETURNS TABLE (
  note_id UUID,
  note_content TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ,
  links JSONB,
  relevance_score NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS note_id,
    n.content AS note_content,
    n.telegram_message_id,
    n.created_at,
    -- Aggregate all links for this note as JSON array
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', nl.id,
          'url', nl.url,
          'title', nl.title,
          'description', nl.description,
          'og_image', nl.og_image,
          'created_at', nl.created_at,
          'updated_at', nl.updated_at
        )
        ORDER BY nl.created_at DESC
      ) FILTER (WHERE nl.id IS NOT NULL),
      '[]'::jsonb
    ) AS links,
    -- Calculate weighted relevance score
    -- Note content: 10 (most important for standalone notes)
    -- Link title: 4 (most relevant for links)
    -- Link URL: 3
    -- Link description: 2
    (
      similarity(LOWER(COALESCE(n.content, '')), LOWER(search_keyword)) * 10 +
      COALESCE(MAX(similarity(LOWER(COALESCE(nl.title, '')), LOWER(search_keyword)) * 4), 0) +
      COALESCE(MAX(similarity(LOWER(COALESCE(nl.url, '')), LOWER(search_keyword)) * 3), 0) +
      COALESCE(MAX(similarity(LOWER(COALESCE(nl.description, '')), LOWER(search_keyword)) * 2), 0)
    ) / 10.0 AS relevance_score
  FROM z_notes n
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE
    n.telegram_user_id = telegram_user_id_param
    AND (
      -- Match in note content
      LOWER(COALESCE(n.content, '')) % LOWER(search_keyword)
      OR
      -- Match in any link field
      LOWER(COALESCE(nl.url, '')) % LOWER(search_keyword)
      OR LOWER(COALESCE(nl.title, '')) % LOWER(search_keyword)
      OR LOWER(COALESCE(nl.description, '')) % LOWER(search_keyword)
    )
  GROUP BY n.id, n.content, n.telegram_message_id, n.created_at
  ORDER BY relevance_score DESC, n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- Function: search_notes_fuzzy_count
-- Purpose: Count total matching notes for pagination
-- Returns: Total count of notes matching search criteria
CREATE OR REPLACE FUNCTION search_notes_fuzzy_count(
  telegram_user_id_param BIGINT,
  search_keyword TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  total_count INT;
BEGIN
  SELECT COUNT(DISTINCT n.id) INTO total_count
  FROM z_notes n
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE
    n.telegram_user_id = telegram_user_id_param
    AND (
      LOWER(COALESCE(n.content, '')) % LOWER(search_keyword)
      OR LOWER(COALESCE(nl.url, '')) % LOWER(search_keyword)
      OR LOWER(COALESCE(nl.title, '')) % LOWER(search_keyword)
      OR LOWER(COALESCE(nl.description, '')) % LOWER(search_keyword)
    );

  RETURN total_count;
END;
$$;

-- Function: get_notes_with_pagination
-- Purpose: Get all notes without search, paginated
-- Returns: Paginated notes with aggregated links
CREATE OR REPLACE FUNCTION get_notes_with_pagination(
  telegram_user_id_param BIGINT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 5
)
RETURNS TABLE (
  note_id UUID,
  note_content TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ,
  links JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS note_id,
    n.content AS note_content,
    n.telegram_message_id,
    n.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', nl.id,
          'url', nl.url,
          'title', nl.title,
          'description', nl.description,
          'og_image', nl.og_image,
          'created_at', nl.created_at,
          'updated_at', nl.updated_at
        )
        ORDER BY nl.created_at DESC
      ) FILTER (WHERE nl.id IS NOT NULL),
      '[]'::jsonb
    ) AS links
  FROM z_notes n
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE n.telegram_user_id = telegram_user_id_param
  GROUP BY n.id, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- Function: get_notes_count
-- Purpose: Count total notes for pagination
-- Returns: Total count of notes for user
CREATE OR REPLACE FUNCTION get_notes_count(
  telegram_user_id_param BIGINT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  total_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count
  FROM z_notes
  WHERE telegram_user_id = telegram_user_id_param;

  RETURN total_count;
END;
$$;

-- ============================================================================
-- Part 5: Enable Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE z_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE z_note_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Part 6: Create RLS Policies
-- ============================================================================

-- Note: These policies use telegram_user_id since this is a Telegram bot
-- In a typical Supabase app, you'd use auth.uid() instead

-- Policy: Allow authenticated service role to bypass RLS
-- (Used by the Telegram bot application)
CREATE POLICY "Service role has full access to notes" ON z_notes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to note_links" ON z_note_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Migration Notes
-- ============================================================================

-- This migration creates a parallel note system alongside the existing
-- z_messages and z_links tables. The old tables remain untouched.
--
-- Next steps after deployment:
-- 1. Implement dual-write in application (save to both old and new)
-- 2. Create data migration to backfill historical data
-- 3. Switch reads to new tables
-- 4. Deprecate old tables when safe
--
-- To rollback:
-- DROP FUNCTION IF EXISTS get_notes_count(BIGINT);
-- DROP FUNCTION IF EXISTS get_notes_with_pagination(BIGINT, INT, INT);
-- DROP FUNCTION IF EXISTS search_notes_fuzzy_count(BIGINT, TEXT);
-- DROP FUNCTION IF EXISTS search_notes_fuzzy(BIGINT, TEXT, INT, INT);
-- DROP TABLE IF EXISTS z_note_links CASCADE;
-- DROP TABLE IF EXISTS z_notes CASCADE;
-- -- Note: Dropping pg_trgm extension may affect other features, handle carefully

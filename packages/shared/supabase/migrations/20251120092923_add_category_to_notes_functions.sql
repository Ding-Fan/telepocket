-- Migration: add_category_to_notes_functions
-- Description: Update get_notes_with_pagination and search_notes_fuzzy_optimized to include category field
-- Rollback: Revert functions to previous version without category field

-- ============================================================================
-- Part 1: Update get_notes_with_pagination to include category
-- ============================================================================

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS get_notes_with_pagination(BIGINT, INT, INT);

CREATE OR REPLACE FUNCTION get_notes_with_pagination(
  telegram_user_id_param BIGINT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 5
)
RETURNS TABLE (
  note_id UUID,
  category TEXT,
  note_content TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ,
  links JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS note_id,
    nc.category,
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
    -- Add total count using window function
    COUNT(*) OVER() AS total_count
  FROM z_notes n
  INNER JOIN z_note_categories nc ON n.id = nc.note_id
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE n.telegram_user_id = telegram_user_id_param
    AND n.status = 'active'
    AND nc.user_confirmed = true
  GROUP BY n.id, nc.category, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- ============================================================================
-- Part 2: Update search_notes_fuzzy_optimized to include category
-- ============================================================================

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS search_notes_fuzzy_optimized(BIGINT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION search_notes_fuzzy_optimized(
  telegram_user_id_param BIGINT,
  search_keyword TEXT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 5
)
RETURNS TABLE (
  note_id UUID,
  category TEXT,
  note_content TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ,
  links JSONB,
  relevance_score NUMERIC,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set similarity threshold for this query only
  SET LOCAL pg_trgm.similarity_threshold = 0.4;

  RETURN QUERY
  WITH matched_notes AS (
    SELECT
      n.id AS note_id,
      nc.category,
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
      (
        similarity(LOWER(COALESCE(n.content, '')), LOWER(search_keyword)) * 10 +
        COALESCE(MAX(similarity(LOWER(COALESCE(nl.title, '')), LOWER(search_keyword)) * 4), 0) +
        COALESCE(MAX(similarity(LOWER(COALESCE(nl.url, '')), LOWER(search_keyword)) * 3), 0) +
        COALESCE(MAX(similarity(LOWER(COALESCE(nl.description, '')), LOWER(search_keyword)) * 2), 0)
      ) / 10.0 AS relevance_score
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    LEFT JOIN z_note_links nl ON n.id = nl.note_id
    WHERE
      n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
      AND (
        -- Match in note content
        LOWER(COALESCE(n.content, '')) % LOWER(search_keyword)
        OR
        -- Match in any link field
        LOWER(COALESCE(nl.url, '')) % LOWER(search_keyword)
        OR LOWER(COALESCE(nl.title, '')) % LOWER(search_keyword)
        OR LOWER(COALESCE(nl.description, '')) % LOWER(search_keyword)
      )
    GROUP BY n.id, nc.category, n.content, n.telegram_message_id, n.created_at
  )
  SELECT
    mn.*,
    COUNT(*) OVER() AS total_count
  FROM matched_notes mn
  ORDER BY relevance_score DESC, created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- ============================================================================
-- Update function comments
-- ============================================================================

COMMENT ON FUNCTION get_notes_with_pagination IS 'Get paginated active notes with category and total count using window function';
COMMENT ON FUNCTION search_notes_fuzzy_optimized IS 'Optimized fuzzy search for active notes with category and total count using window function';

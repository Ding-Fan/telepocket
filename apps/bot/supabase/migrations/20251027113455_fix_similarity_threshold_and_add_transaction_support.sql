-- Migration: Fix Similarity Threshold Scope and Add Transaction Support
-- Description: Move similarity threshold from database-level to session-level and add atomic save function
-- Author: Claude Code
-- Date: 2025-10-27

-- Note: Cannot reset database-level pg_trgm.similarity_threshold with anon key
-- The session-level SET LOCAL in functions is sufficient

-- ============================================================================
-- Part 1: Fix Similarity Threshold (Critical Security Fix)
-- ============================================================================

-- Update search_notes_fuzzy function to use session-level threshold
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
  -- Set similarity threshold for this query only
  SET LOCAL pg_trgm.similarity_threshold = 0.4;

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

-- Update search_notes_fuzzy_count function to use session-level threshold
CREATE OR REPLACE FUNCTION search_notes_fuzzy_count(
  telegram_user_id_param BIGINT,
  search_keyword TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  total_count BIGINT;
BEGIN
  -- Set similarity threshold for this query only
  SET LOCAL pg_trgm.similarity_threshold = 0.4;

  SELECT COUNT(DISTINCT n.id)
  INTO total_count
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
    );

  RETURN total_count;
END;
$$;

-- ============================================================================
-- Part 2: Add Transaction Support for Note+Links (High Priority Fix)
-- ============================================================================

-- Function: save_note_with_links_atomic
-- Purpose: Atomically save a note with its links in a single transaction
-- Returns: note_id and success status
CREATE OR REPLACE FUNCTION save_note_with_links_atomic(
  telegram_user_id_param BIGINT,
  telegram_message_id_param BIGINT,
  content_param TEXT,
  links_param JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  note_id UUID,
  links_saved INT,
  success BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  new_note_id UUID;
  link_record JSONB;
  saved_count INT := 0;
BEGIN
  -- Insert note and get ID
  INSERT INTO z_notes (telegram_user_id, telegram_message_id, content)
  VALUES (telegram_user_id_param, telegram_message_id_param, content_param)
  RETURNING id INTO new_note_id;

  -- Insert links if provided
  IF jsonb_array_length(links_param) > 0 THEN
    FOR link_record IN SELECT * FROM jsonb_array_elements(links_param)
    LOOP
      INSERT INTO z_note_links (note_id, url, title, description, og_image)
      VALUES (
        new_note_id,
        link_record->>'url',
        link_record->>'title',
        link_record->>'description',
        link_record->>'og_image'
      );
      saved_count := saved_count + 1;
    END LOOP;
  END IF;

  -- Return result
  RETURN QUERY SELECT new_note_id, saved_count, TRUE;

EXCEPTION
  WHEN OTHERS THEN
    -- On any error, the transaction will be rolled back automatically
    RAISE NOTICE 'Error saving note with links: %', SQLERRM;
    RETURN QUERY SELECT NULL::UUID, 0, FALSE;
END;
$$;

-- ============================================================================
-- Part 3: Optimize Pagination Queries (High Priority Performance Fix)
-- ============================================================================

-- Update get_notes_with_pagination to return count using window function
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
  links JSONB,
  total_count BIGINT
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
    -- Add total count using window function
    COUNT(*) OVER() AS total_count
  FROM z_notes n
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE n.telegram_user_id = telegram_user_id_param
  GROUP BY n.id, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- Update search_notes_fuzzy to return count using window function
CREATE OR REPLACE FUNCTION search_notes_fuzzy_optimized(
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

-- Add comments documenting the fixes
COMMENT ON FUNCTION search_notes_fuzzy IS 'Fuzzy search notes with session-level similarity threshold (0.4)';
COMMENT ON FUNCTION search_notes_fuzzy_count IS 'Count matching notes for pagination with session-level similarity threshold (0.4)';
COMMENT ON FUNCTION save_note_with_links_atomic IS 'Atomically save note with links in a single transaction to prevent data inconsistency';
COMMENT ON FUNCTION get_notes_with_pagination IS 'Get paginated notes with total count using window function (single query optimization)';
COMMENT ON FUNCTION search_notes_fuzzy_optimized IS 'Optimized fuzzy search with total count using window function (single query optimization)';

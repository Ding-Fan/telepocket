-- Migration: create_archived_notes_functions
-- Description: Create database functions for archived notes pagination and search
-- Rollback: DROP FUNCTION get_archived_notes_with_pagination; DROP FUNCTION search_archived_notes_fuzzy_optimized;

-- Function: get_archived_notes_with_pagination
-- Purpose: Get paginated archived notes with total count
CREATE OR REPLACE FUNCTION get_archived_notes_with_pagination(
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
    COUNT(*) OVER() AS total_count
  FROM z_notes n
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE n.telegram_user_id = telegram_user_id_param
    AND n.status = 'archived'  -- Filter archived notes only
  GROUP BY n.id, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- Function: search_archived_notes_fuzzy_optimized
-- Purpose: Fuzzy search in archived notes with relevance scoring
CREATE OR REPLACE FUNCTION search_archived_notes_fuzzy_optimized(
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
  SET LOCAL pg_trgm.similarity_threshold = 0.4;

  RETURN QUERY
  WITH matched_notes AS (
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
      ) AS links,
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
      AND n.status = 'archived'  -- Filter archived notes only
      AND (
        LOWER(COALESCE(n.content, '')) % LOWER(search_keyword)
        OR LOWER(COALESCE(nl.url, '')) % LOWER(search_keyword)
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

-- Add comments for documentation
COMMENT ON FUNCTION get_archived_notes_with_pagination IS 'Get paginated archived notes (status=archived) with total count using window function';
COMMENT ON FUNCTION search_archived_notes_fuzzy_optimized IS 'Optimized fuzzy search for archived notes (status=archived) with total count using window function';

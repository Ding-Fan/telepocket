-- Migration: fix_notes_visibility_support_both_categories_and_tags
-- Description: Update 3 critical functions to query BOTH z_note_categories (old) and z_note_tags (new)
-- Issue: Notes created after Nov 24 are invisible because bot uses z_note_tags but web queries z_note_categories
-- Solution: LEFT JOIN both tables, prioritize tags, fallback to categories for backward compatibility

-- ============================================================================
-- Part 1: Update get_notes_with_pagination to support both systems
-- ============================================================================

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
  WITH note_tags AS (
    -- Get first confirmed tag for each note (new system)
    SELECT DISTINCT ON (nt.note_id)
      nt.note_id,
      t.tag_name
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    ORDER BY nt.note_id, nt.created_at DESC
  )
  SELECT
    n.id AS note_id,
    -- Prioritize tag_name (new system), fallback to category (old system), default to NULL
    COALESCE(nt.tag_name, nc.category) AS category,
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
  LEFT JOIN note_tags nt ON n.id = nt.note_id
  LEFT JOIN z_note_categories nc ON n.id = nc.note_id AND nc.user_confirmed = true
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE n.telegram_user_id = telegram_user_id_param
    AND n.status = 'active'
  GROUP BY n.id, nt.tag_name, nc.category, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- ============================================================================
-- Part 2: Update get_notes_by_category to support both systems
-- ============================================================================

DROP FUNCTION IF EXISTS get_notes_by_category(BIGINT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION get_notes_by_category(
  telegram_user_id_param BIGINT,
  category_param TEXT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 20
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
  WITH note_tags AS (
    -- Get first confirmed tag for each note (new system)
    SELECT DISTINCT ON (nt.note_id)
      nt.note_id,
      t.tag_name
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    ORDER BY nt.note_id, nt.created_at DESC
  )
  SELECT
    n.id AS note_id,
    -- Prioritize tag_name (new system), fallback to category (old system)
    COALESCE(nt.tag_name, nc.category) AS category,
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
  LEFT JOIN note_tags nt ON n.id = nt.note_id
  LEFT JOIN z_note_categories nc ON n.id = nc.note_id AND nc.user_confirmed = true
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE n.telegram_user_id = telegram_user_id_param
    AND n.status = 'active'
    AND (
      nt.tag_name = category_param
      OR nc.category = category_param
    )
  GROUP BY n.id, nt.tag_name, nc.category, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- ============================================================================
-- Part 3: Update search_notes_fuzzy_optimized to support both systems
-- ============================================================================

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
  SET LOCAL pg_trgm.similarity_threshold = 0.4;

  RETURN QUERY
  WITH note_tags AS (
    SELECT DISTINCT ON (nt.note_id)
      nt.note_id,
      t.tag_name
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    ORDER BY nt.note_id, nt.created_at DESC
  ),
  matched_notes AS (
    SELECT
      n.id AS note_id,
      COALESCE(nt.tag_name, nc.category) AS category,
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
    LEFT JOIN note_tags nt ON n.id = nt.note_id
    LEFT JOIN z_note_categories nc ON n.id = nc.note_id AND nc.user_confirmed = true
    LEFT JOIN z_note_links nl ON n.id = nl.note_id
    WHERE
      n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND (
        LOWER(COALESCE(n.content, '')) % LOWER(search_keyword)
        OR
        LOWER(COALESCE(nl.url, '')) % LOWER(search_keyword)
        OR LOWER(COALESCE(nl.title, '')) % LOWER(search_keyword)
        OR LOWER(COALESCE(nl.description, '')) % LOWER(search_keyword)
      )
    GROUP BY n.id, nt.tag_name, nc.category, n.content, n.telegram_message_id, n.created_at
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

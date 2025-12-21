-- Migration: add_tags_array_to_note_functions
-- Description: Update note functions to return all confirmed tags as an array
-- Issue: NoteCard component needs to display multiple tags, but functions only return first tag
-- Solution: Add tags TEXT[] field with array_agg of all confirmed tags, keep category for backward compat
--
-- Rollback instructions:
-- 1. Restore previous function versions from 20251203161603_fix_notes_visibility_support_both_categories_and_tags.sql
-- 2. Remove tags column from return types

-- ============================================================================
-- Part 1: Update get_notes_with_pagination to return tags array
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
  tags TEXT[],  -- NEW: Array of all confirmed tags
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
    -- Get first confirmed tag for each note (for category field - backward compat)
    SELECT DISTINCT ON (nt.note_id)
      nt.note_id,
      t.tag_name
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    ORDER BY nt.note_id, nt.created_at DESC
  ),
  all_note_tags AS (
    -- Get ALL confirmed tags for each note (for tags array)
    SELECT
      nt.note_id,
      array_agg(t.tag_name ORDER BY nt.created_at DESC) AS tag_names
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    GROUP BY nt.note_id
  )
  SELECT
    n.id AS note_id,
    -- Prioritize tag_name (new system), fallback to category (old system), default to NULL
    COALESCE(nt.tag_name, nc.category) AS category,
    -- NEW: Array of all confirmed tags
    COALESCE(ant.tag_names, ARRAY[]::TEXT[]) AS tags,
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
  LEFT JOIN all_note_tags ant ON n.id = ant.note_id
  LEFT JOIN z_note_categories nc ON n.id = nc.note_id AND nc.user_confirmed = true
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE n.telegram_user_id = telegram_user_id_param
    AND n.status = 'active'
  GROUP BY n.id, nt.tag_name, ant.tag_names, nc.category, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- ============================================================================
-- Part 2: Update get_notes_by_category to return tags array
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
  tags TEXT[],  -- NEW: Array of all confirmed tags
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
    -- Get first confirmed tag for each note (for category field - backward compat)
    SELECT DISTINCT ON (nt.note_id)
      nt.note_id,
      t.tag_name
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    ORDER BY nt.note_id, nt.created_at DESC
  ),
  all_note_tags AS (
    -- Get ALL confirmed tags for each note (for tags array)
    SELECT
      nt.note_id,
      array_agg(t.tag_name ORDER BY nt.created_at DESC) AS tag_names
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    GROUP BY nt.note_id
  )
  SELECT
    n.id AS note_id,
    -- Prioritize tag_name (new system), fallback to category (old system)
    COALESCE(nt.tag_name, nc.category) AS category,
    -- NEW: Array of all confirmed tags
    COALESCE(ant.tag_names, ARRAY[]::TEXT[]) AS tags,
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
  LEFT JOIN all_note_tags ant ON n.id = ant.note_id
  LEFT JOIN z_note_categories nc ON n.id = nc.note_id AND nc.user_confirmed = true
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  WHERE n.telegram_user_id = telegram_user_id_param
    AND n.status = 'active'
    AND (
      nt.tag_name = category_param
      OR nc.category = category_param
    )
  GROUP BY n.id, nt.tag_name, ant.tag_names, nc.category, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

-- ============================================================================
-- Part 3: Update search_notes_fuzzy_optimized to return tags array
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
  tags TEXT[],  -- NEW: Array of all confirmed tags
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
  all_note_tags AS (
    -- Get ALL confirmed tags for each note (for tags array)
    SELECT
      nt.note_id,
      array_agg(t.tag_name ORDER BY nt.created_at DESC) AS tag_names
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    GROUP BY nt.note_id
  ),
  matched_notes AS (
    SELECT
      n.id AS note_id,
      COALESCE(nt.tag_name, nc.category) AS category,
      COALESCE(ant.tag_names, ARRAY[]::TEXT[]) AS tags,
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
    LEFT JOIN all_note_tags ant ON n.id = ant.note_id
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
    GROUP BY n.id, nt.tag_name, ant.tag_names, nc.category, n.content, n.telegram_message_id, n.created_at
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
-- Part 4: Update get_notes_priority_stream to return tags array
-- ============================================================================

DROP FUNCTION IF EXISTS get_notes_priority_stream(BIGINT, INT, INT);

CREATE OR REPLACE FUNCTION get_notes_priority_stream(
  telegram_user_id_param BIGINT,
  priority_limit INT DEFAULT 3,
  notes_per_category INT DEFAULT 2
)
RETURNS TABLE (
  note_id UUID,
  category TEXT,
  tags TEXT[],  -- NEW: Array of all confirmed tags
  content TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  telegram_message_id BIGINT,
  link_count BIGINT,
  image_count BIGINT,
  is_marked BOOLEAN,
  impression_count INT,
  row_number BIGINT,
  category_total BIGINT,
  section TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Get all confirmed tags for each note
  all_note_tags AS (
    SELECT
      nt.note_id,
      array_agg(t.tag_name ORDER BY nt.created_at DESC) AS tag_names
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    GROUP BY nt.note_id
  ),
  -- Calculate average impression count per category for TODO filtering
  category_avg_impressions AS (
    SELECT
      nc.category,
      AVG(n.impression_count)::INT AS avg_impression
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    WHERE n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
      AND nc.category = 'todo'
    GROUP BY nc.category
  ),
  -- Priority notes: marked notes + high-impression TODOs
  priority_candidates AS (
    SELECT
      n.id AS note_id,
      nc.category,
      COALESCE(ant.tag_names, ARRAY[]::TEXT[]) AS tags,
      n.content,
      n.updated_at,
      n.created_at,
      n.telegram_message_id,
      (SELECT COUNT(*) FROM z_note_links nl WHERE nl.note_id = n.id) AS link_count,
      (SELECT COUNT(*) FROM z_note_images ni WHERE ni.note_id = n.id) AS image_count,
      n.is_marked,
      COALESCE(n.impression_count, 0) AS impression_count,
      0::BIGINT AS row_number, -- Not used for priority
      0::BIGINT AS category_total, -- Not used for priority
      'priority'::TEXT AS section
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    LEFT JOIN all_note_tags ant ON n.id = ant.note_id
    LEFT JOIN category_avg_impressions cai ON nc.category = cai.category
    WHERE n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
      AND (
        n.is_marked = true
        OR (
          nc.category = 'todo'
          AND COALESCE(n.impression_count, 0) >= COALESCE(cai.avg_impression, 0)
        )
      )
    ORDER BY
      n.is_marked DESC,
      COALESCE(n.impression_count, 0) DESC,
      n.updated_at DESC
    LIMIT priority_limit
  ),
  -- Category notes: exclude priority notes, 2 per category
  category_notes AS (
    SELECT
      n.id AS note_id,
      nc.category,
      COALESCE(ant.tag_names, ARRAY[]::TEXT[]) AS tags,
      n.content,
      n.updated_at,
      n.created_at,
      n.telegram_message_id,
      (SELECT COUNT(*) FROM z_note_links nl WHERE nl.note_id = n.id) AS link_count,
      (SELECT COUNT(*) FROM z_note_images ni WHERE ni.note_id = n.id) AS image_count,
      n.is_marked,
      COALESCE(n.impression_count, 0) AS impression_count,
      ROW_NUMBER() OVER (PARTITION BY nc.category ORDER BY n.updated_at DESC) AS row_num,
      COUNT(*) OVER (PARTITION BY nc.category) AS category_total,
      'category'::TEXT AS section
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    LEFT JOIN all_note_tags ant ON n.id = ant.note_id
    WHERE n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
      AND n.id NOT IN (SELECT note_id FROM priority_candidates)
    ORDER BY nc.category, n.updated_at DESC
  )
  -- Return priority notes first, then category notes
  SELECT
    pc.note_id,
    pc.category,
    pc.tags,
    pc.content,
    pc.updated_at,
    pc.created_at,
    pc.telegram_message_id,
    pc.link_count,
    pc.image_count,
    pc.is_marked,
    pc.impression_count,
    pc.row_number,
    pc.category_total,
    pc.section
  FROM priority_candidates pc

  UNION ALL

  SELECT
    cn.note_id,
    cn.category,
    cn.tags,
    cn.content,
    cn.updated_at,
    cn.created_at,
    cn.telegram_message_id,
    cn.link_count,
    cn.image_count,
    cn.is_marked,
    cn.impression_count,
    cn.row_num AS row_number,
    cn.category_total,
    cn.section
  FROM category_notes cn
  WHERE cn.row_num <= notes_per_category

  ORDER BY
    CASE WHEN section = 'priority' THEN 0 ELSE 1 END,
    CASE WHEN section = 'priority' THEN is_marked ELSE false END DESC,
    CASE WHEN section = 'priority' THEN impression_count ELSE 0 END DESC,
    updated_at DESC;
END;
$$ SECURITY DEFINER SET search_path = public;

-- Grant access
GRANT EXECUTE ON FUNCTION get_notes_with_pagination(BIGINT, INT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_notes_by_category(BIGINT, TEXT, INT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_notes_fuzzy_optimized(BIGINT, TEXT, INT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_notes_priority_stream(BIGINT, INT, INT) TO anon, authenticated, service_role;

-- Add comments
COMMENT ON FUNCTION get_notes_with_pagination(BIGINT, INT, INT) IS 'Get paginated notes with all confirmed tags as array. Category field maintains backward compatibility.';
COMMENT ON FUNCTION get_notes_by_category(BIGINT, TEXT, INT, INT) IS 'Get notes by category/tag with all confirmed tags as array.';
COMMENT ON FUNCTION search_notes_fuzzy_optimized(BIGINT, TEXT, INT, INT) IS 'Fuzzy search notes with all confirmed tags as array.';
COMMENT ON FUNCTION get_notes_priority_stream(BIGINT, INT, INT) IS 'Get priority stream glance view with all confirmed tags as array.';

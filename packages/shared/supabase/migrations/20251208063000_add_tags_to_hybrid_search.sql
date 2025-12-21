-- Migration: add_tags_to_hybrid_search
-- Description: Update search_notes_hybrid function to return all confirmed tags as an array
-- Issue: Search feature broken - missing tags field that all other note functions return
-- Solution: Add tags TEXT[] field with array_agg of all confirmed tags, keep category for backward compat
--
-- Rollback instructions:
-- 1. Restore previous function version from 20251124002314_add_category_filter_to_hybrid_search.sql
-- 2. Remove tags column from return type

DROP FUNCTION IF EXISTS search_notes_hybrid(vector(768), text, bigint, float, int, text);

CREATE OR REPLACE FUNCTION search_notes_hybrid(
  query_embedding vector(768),
  query_text text,
  user_id bigint,
  match_threshold float default 0.5,
  page_size int default 20,
  category_filter text default null
)
RETURNS TABLE (
  id uuid,
  content text,
  category text,
  tags TEXT[],  -- NEW: Array of all confirmed tags
  relevance_score float,
  search_type text,
  links jsonb,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Get first confirmed tag for each note (for category field - backward compat)
  note_tags AS (
    SELECT DISTINCT ON (nt.note_id)
      nt.note_id,
      t.tag_name
    FROM z_note_tags nt
    INNER JOIN z_tags t ON nt.tag_id = t.id
    WHERE nt.user_confirmed = true
      AND t.is_archived = false
    ORDER BY nt.note_id, nt.created_at DESC
  ),
  -- Get ALL confirmed tags for each note (for tags array)
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
  semantic_results AS (
    SELECT
      n.id,
      n.content,
      (
        SELECT c.category
        FROM z_note_categories c
        WHERE c.note_id = n.id
        ORDER BY c.user_confirmed DESC, c.confidence DESC
        LIMIT 1
      ) AS category_from_old_system,
      nt.tag_name AS category_from_tags,
      COALESCE(ant.tag_names, ARRAY[]::TEXT[]) AS tags,
      (1 - (n.embedding <=> query_embedding)) * 0.7 AS score,
      'semantic' AS type,
      n.created_at
    FROM z_notes n
    LEFT JOIN note_tags nt ON n.id = nt.note_id
    LEFT JOIN all_note_tags ant ON n.id = ant.note_id
    WHERE n.telegram_user_id = user_id
    AND n.status = 'active'
    AND (1 - (n.embedding <=> query_embedding)) > match_threshold
    -- Category filter: only apply if category_filter is provided
    AND (
      category_filter IS NULL
      OR EXISTS (
        SELECT 1
        FROM z_note_categories c
        WHERE c.note_id = n.id
        AND c.category = category_filter
      )
      OR EXISTS (
        SELECT 1
        FROM z_note_tags nt2
        INNER JOIN z_tags t2 ON nt2.tag_id = t2.id
        WHERE nt2.note_id = n.id
        AND t2.tag_name = category_filter
        AND nt2.user_confirmed = true
        AND t2.is_archived = false
      )
    )
    ORDER BY score DESC
    LIMIT page_size * 2
  ),
  fuzzy_results AS (
    SELECT
      n.id,
      n.content,
      (
        SELECT c.category
        FROM z_note_categories c
        WHERE c.note_id = n.id
        ORDER BY c.user_confirmed DESC, c.confidence DESC
        LIMIT 1
      ) AS category_from_old_system,
      nt.tag_name AS category_from_tags,
      COALESCE(ant.tag_names, ARRAY[]::TEXT[]) AS tags,
      -- If exact substring match, ensure a minimum score boost
      CASE
        WHEN n.content ILIKE '%' || query_text || '%' THEN GREATEST(similarity(n.content, query_text), 0.2) * 0.3
        ELSE similarity(n.content, query_text) * 0.3
      END AS score,
      'fuzzy' AS type,
      n.created_at
    FROM z_notes n
    LEFT JOIN note_tags nt ON n.id = nt.note_id
    LEFT JOIN all_note_tags ant ON n.id = ant.note_id
    WHERE n.telegram_user_id = user_id
    AND n.status = 'active'
    AND (
      similarity(n.content, query_text) > 0.1
      OR n.content ILIKE '%' || query_text || '%'
    )
    -- Category filter: only apply if category_filter is provided
    AND (
      category_filter IS NULL
      OR EXISTS (
        SELECT 1
        FROM z_note_categories c
        WHERE c.note_id = n.id
        AND c.category = category_filter
      )
      OR EXISTS (
        SELECT 1
        FROM z_note_tags nt2
        INNER JOIN z_tags t2 ON nt2.tag_id = t2.id
        WHERE nt2.note_id = n.id
        AND t2.tag_name = category_filter
        AND nt2.user_confirmed = true
        AND t2.is_archived = false
      )
    )
    ORDER BY score DESC
    LIMIT page_size * 2
  ),
  combined_results AS (
    SELECT
      COALESCE(s.id, f.id) AS id,
      COALESCE(s.content, f.content) AS content,
      -- Prioritize tag_name (new system), fallback to category (old system)
      COALESCE(s.category_from_tags, f.category_from_tags, s.category_from_old_system, f.category_from_old_system) AS category,
      -- Merge tags from both result sets (should be same, but use COALESCE for safety)
      COALESCE(s.tags, f.tags, ARRAY[]::TEXT[]) AS tags,
      COALESCE(s.score, 0) + COALESCE(f.score, 0) AS total_score,
      CASE
        WHEN s.id IS NOT NULL AND f.id IS NOT NULL THEN 'semantic+fuzzy'
        WHEN s.id IS NOT NULL THEN 'semantic'
        ELSE 'fuzzy'
      END AS search_type,
      COALESCE(s.created_at, f.created_at) AS created_at
    FROM semantic_results s
    FULL OUTER JOIN fuzzy_results f ON s.id = f.id
  ),
  final_results AS (
    SELECT
      c.id,
      c.content,
      c.category,
      c.tags,
      c.total_score AS relevance_score,
      c.search_type,
      c.created_at,
      COUNT(*) OVER() AS total_count
    FROM combined_results c
    ORDER BY c.total_score DESC, c.created_at DESC
    LIMIT page_size
  )
  SELECT
    fr.id,
    fr.content,
    fr.category,
    fr.tags,
    fr.relevance_score,
    fr.search_type,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'url', l.url,
            'title', l.title,
            'description', l.description,
            'og_image', l.og_image,
            'created_at', l.created_at,
            'updated_at', l.updated_at
          )
        )
        FROM z_note_links l
        WHERE l.note_id = fr.id
      ),
      '[]'::jsonb
    ) AS links,
    fr.created_at,
    fr.total_count
  FROM final_results fr;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION search_notes_hybrid(vector(768), text, bigint, float, int, text) TO anon, authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION search_notes_hybrid(vector(768), text, bigint, float, int, text) IS 'Hybrid search (semantic + fuzzy) with all confirmed tags as array. Category field maintains backward compatibility.';

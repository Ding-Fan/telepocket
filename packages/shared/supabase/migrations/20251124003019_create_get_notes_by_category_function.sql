-- Create get_notes_by_category function for filtering notes by category
-- This was missing and causing errors when category filter is applied

-- ROLLBACK INSTRUCTIONS:
-- DROP FUNCTION IF EXISTS get_notes_by_category(BIGINT, TEXT, INT, INT);

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
    AND nc.category = category_param
    AND nc.user_confirmed = true
  GROUP BY n.id, nc.category, n.content, n.telegram_message_id, n.created_at
  ORDER BY n.created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;

COMMENT ON FUNCTION get_notes_by_category IS 'Get paginated active notes filtered by category with total count using window function';

-- Migration: Create get_suggestions_by_impression function
-- Purpose: Fetch notes from past N days with min impression count per category for weighted suggestion algorithm
-- Dependencies: z_notes, z_note_categories, impression_count column, last_shown_at column
--
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, create a new migration with:
-- DROP FUNCTION IF EXISTS get_suggestions_by_impression(BIGINT, INT);

CREATE OR REPLACE FUNCTION get_suggestions_by_impression(
  telegram_user_id_param BIGINT,
  days_back INT DEFAULT 7
)
RETURNS TABLE (
  note_id UUID,
  category TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  impression_count INT,
  last_shown_at TIMESTAMPTZ,
  telegram_message_id BIGINT,
  link_count BIGINT,
  image_count BIGINT,
  min_impression_count INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH category_notes AS (
    -- Get all notes from past N days with their categories
    SELECT
      n.id AS note_id,
      nc.category,
      n.content,
      n.created_at,
      n.impression_count,
      n.last_shown_at,
      n.telegram_message_id,
      -- Count links for this note
      (SELECT COUNT(*) FROM z_note_links nl WHERE nl.note_id = n.id) AS link_count,
      -- Count images for this note
      (SELECT COUNT(*) FROM z_note_images ni WHERE ni.note_id = n.id) AS image_count,
      -- Calculate minimum impression_count within each category (for weighted selection)
      MIN(n.impression_count) OVER (PARTITION BY nc.category) AS min_impression_count
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    WHERE n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'  -- Exclude archived notes
      AND nc.user_confirmed = true  -- Only show user-confirmed categories
      AND n.created_at >= NOW() - INTERVAL '1 day' * days_back  -- Filter by time range
  )
  SELECT
    cn.note_id,
    cn.category,
    cn.content,
    cn.created_at,
    cn.impression_count,
    cn.last_shown_at,
    cn.telegram_message_id,
    cn.link_count,
    cn.image_count,
    cn.min_impression_count
  FROM category_notes cn
  ORDER BY cn.category, cn.created_at DESC;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION get_suggestions_by_impression(BIGINT, INT) IS
  'Fetch notes from past N days with minimum impression count per category. Used by suggestion algorithm for weighted selection (70% least-shown, 30% random). Returns active notes with user-confirmed categories only.';

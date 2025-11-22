-- Migration: create_glance_view_function
-- Description: Create function to fetch glance view - 2 most recent notes per category
-- Rollback: DROP FUNCTION get_notes_glance_view

CREATE OR REPLACE FUNCTION get_notes_glance_view(
  telegram_user_id_param BIGINT,
  notes_per_category INT DEFAULT 2
)
RETURNS TABLE (
  note_id UUID,
  category TEXT,
  content TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  telegram_message_id BIGINT,
  link_count BIGINT,
  image_count BIGINT,
  row_number BIGINT,
  category_total BIGINT,
  category_max_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH category_notes AS (
    -- Get all notes with their confirmed categories
    SELECT
      n.id AS note_id,
      nc.category,
      n.content,
      n.updated_at,
      n.created_at,
      n.telegram_message_id,
      -- Count links for this note
      (SELECT COUNT(*) FROM z_note_links nl WHERE nl.note_id = n.id) AS link_count,
      -- Count images for this note
      (SELECT COUNT(*) FROM z_note_images ni WHERE ni.note_id = n.id) AS image_count,
      -- Row number within category (for limiting to N per category)
      ROW_NUMBER() OVER (PARTITION BY nc.category ORDER BY n.updated_at DESC) AS row_num,
      -- Total notes in this category
      COUNT(*) OVER (PARTITION BY nc.category) AS category_total,
      -- Most recent update in this category (for sorting categories)
      MAX(n.updated_at) OVER (PARTITION BY nc.category) AS category_max_updated
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    WHERE n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
    ORDER BY nc.category, n.updated_at DESC
  )
  SELECT
    cn.note_id,
    cn.category,
    cn.content,
    cn.updated_at,
    cn.created_at,
    cn.telegram_message_id,
    cn.link_count,
    cn.image_count,
    cn.row_num AS row_number,
    cn.category_total,
    cn.category_max_updated
  FROM category_notes cn
  WHERE cn.row_num <= notes_per_category
  ORDER BY cn.category_max_updated DESC, cn.category, cn.updated_at DESC;
END;
$$;

-- Add comment
COMMENT ON FUNCTION get_notes_glance_view IS 'Get glance view of notes - N most recent notes per category, sorted by category recent activity';

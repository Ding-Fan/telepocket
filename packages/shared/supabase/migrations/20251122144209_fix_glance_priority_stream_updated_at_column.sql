-- Migration: fix_glance_priority_stream_updated_at_column
-- Description: Fix column reference error - z_notes table doesn't have updated_at, only created_at
-- Rollback: Re-run previous migration 20251122020318_create_glance_priority_stream_function.sql

CREATE OR REPLACE FUNCTION get_notes_priority_stream(
  telegram_user_id_param BIGINT,
  priority_limit INT DEFAULT 3,
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
      n.content,
      n.created_at AS updated_at, -- FIX: Use created_at as updated_at (column doesn't exist)
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
      n.created_at DESC  -- FIX: Use created_at instead of updated_at
    LIMIT priority_limit
  ),
  -- Category notes: exclude priority notes, 2 per category
  category_notes AS (
    SELECT
      n.id AS note_id,
      nc.category,
      n.content,
      n.created_at AS updated_at, -- FIX: Use created_at as updated_at (column doesn't exist)
      n.created_at,
      n.telegram_message_id,
      (SELECT COUNT(*) FROM z_note_links nl WHERE nl.note_id = n.id) AS link_count,
      (SELECT COUNT(*) FROM z_note_images ni WHERE ni.note_id = n.id) AS image_count,
      n.is_marked,
      COALESCE(n.impression_count, 0) AS impression_count,
      ROW_NUMBER() OVER (PARTITION BY nc.category ORDER BY n.created_at DESC) AS row_num, -- FIX: Use created_at
      COUNT(*) OVER (PARTITION BY nc.category) AS category_total,
      'category'::TEXT AS section
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    WHERE n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
      AND n.id NOT IN (SELECT note_id FROM priority_candidates)
    ORDER BY nc.category, n.created_at DESC  -- FIX: Use created_at instead of updated_at
  )
  -- Return priority notes first, then category notes
  SELECT
    pc.note_id,
    pc.category,
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

-- Add comment
COMMENT ON FUNCTION get_notes_priority_stream(BIGINT, INT, INT) IS 'Get priority stream glance view - top 3 priority notes (marked + high-impression TODOs) followed by 2 notes per category. Priority notes excluded from category sections. Fixed to use created_at since z_notes has no updated_at column.';

-- Grant access to anon and authenticated users
GRANT EXECUTE ON FUNCTION get_notes_priority_stream(BIGINT, INT, INT) TO anon, authenticated, service_role;

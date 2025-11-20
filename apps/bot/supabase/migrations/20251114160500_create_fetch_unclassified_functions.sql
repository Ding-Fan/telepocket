-- Migration: create_fetch_unclassified_functions
-- Description: Creates functions to fetch unclassified notes and links for /classify command
-- Uses NOT EXISTS pattern for proper unclassified detection
--
-- Rollback instructions:
-- DROP FUNCTION IF EXISTS fetch_unclassified_notes(BIGINT);
-- DROP FUNCTION IF EXISTS fetch_unclassified_links(BIGINT);

-- Function to fetch unclassified notes (notes without any category)
CREATE OR REPLACE FUNCTION fetch_unclassified_notes(
  user_id_param BIGINT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  telegram_message_id BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.content,
    n.telegram_message_id
  FROM z_notes n
  WHERE n.telegram_user_id = user_id_param
    AND n.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM z_note_categories nc
      WHERE nc.note_id = n.id
    )
  ORDER BY n.created_at DESC;
END;
$$;

-- Function to fetch unclassified links (links without any category)
CREATE OR REPLACE FUNCTION fetch_unclassified_links(
  user_id_param BIGINT
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  description TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.url,
    l.title,
    l.description
  FROM z_note_links l
  INNER JOIN z_notes n ON l.note_id = n.id
  WHERE n.telegram_user_id = user_id_param
    AND n.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM z_note_categories nc
      WHERE nc.link_id = l.id
    )
  ORDER BY l.created_at DESC;
END;
$$;

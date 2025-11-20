-- Migration: create_get_note_detail_function
-- Description: Create function to fetch a single note with all details (category, links, images)
-- Rollback: DROP FUNCTION get_note_detail

CREATE OR REPLACE FUNCTION get_note_detail(
  note_id_param UUID,
  telegram_user_id_param BIGINT
)
RETURNS TABLE (
  note_id UUID,
  category TEXT,
  content TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  telegram_user_id BIGINT,
  telegram_message_id BIGINT,
  links JSONB,
  images JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS note_id,
    nc.category,
    n.content,
    n.updated_at,
    n.created_at,
    n.telegram_user_id,
    n.telegram_message_id,
    -- Aggregate all links for this note as JSON array
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'link_id', nl.id,
          'note_id', nl.note_id,
          'url', nl.url,
          'title', nl.title,
          'description', nl.description,
          'image_url', nl.og_image,
          'created_at', nl.created_at
        )
        ORDER BY jsonb_build_object(
          'link_id', nl.id,
          'note_id', nl.note_id,
          'url', nl.url,
          'title', nl.title,
          'description', nl.description,
          'image_url', nl.og_image,
          'created_at', nl.created_at
        )
      ) FILTER (WHERE nl.id IS NOT NULL),
      '[]'::jsonb
    ) AS links,
    -- Aggregate all images for this note as JSON array
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'image_id', ni.id,
          'note_id', ni.note_id,
          'file_id', ni.file_id,
          'file_path', ni.file_path,
          'file_size', ni.file_size,
          'mime_type', ni.mime_type,
          'created_at', ni.created_at
        )
        ORDER BY jsonb_build_object(
          'image_id', ni.id,
          'note_id', ni.note_id,
          'file_id', ni.file_id,
          'file_path', ni.file_path,
          'file_size', ni.file_size,
          'mime_type', ni.mime_type,
          'created_at', ni.created_at
        )
      ) FILTER (WHERE ni.id IS NOT NULL),
      '[]'::jsonb
    ) AS images
  FROM z_notes n
  LEFT JOIN z_note_categories nc ON n.id = nc.note_id AND nc.user_confirmed = true
  LEFT JOIN z_note_links nl ON n.id = nl.note_id
  LEFT JOIN z_note_images ni ON n.id = ni.note_id
  WHERE
    n.id = note_id_param
    AND n.telegram_user_id = telegram_user_id_param
    AND n.status = 'active'
  GROUP BY n.id, nc.category, n.content, n.updated_at, n.created_at, n.telegram_user_id, n.telegram_message_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION get_note_detail IS 'Get full details of a single note including category, links, and images';

-- Migration: fix_note_images_column_names
-- Description: Fix column names for z_note_images table
-- Rollback: Use previous version

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
  WITH note_data AS (
    -- Use same structure as glance view
    SELECT
      n.id AS note_id,
      nc.category,
      n.content,
      nc.updated_at,
      n.created_at,
      n.telegram_message_id,
      n.telegram_user_id
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    WHERE n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
      AND n.id = note_id_param
  )
  SELECT
    nd.note_id,
    nd.category,
    nd.content,
    nd.updated_at,
    nd.created_at,
    nd.telegram_user_id,
    nd.telegram_message_id,
    -- Aggregate links
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'link_id', nl.id,
            'note_id', nl.note_id,
            'url', nl.url,
            'title', nl.title,
            'description', nl.description,
            'image_url', nl.og_image,
            'created_at', nl.created_at
          )
          ORDER BY nl.created_at ASC
        )
        FROM z_note_links nl
        WHERE nl.note_id = nd.note_id
      ),
      '[]'::jsonb
    ) AS links,
    -- Aggregate images with CORRECT column names
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'image_id', ni.id,
            'note_id', ni.note_id,
            'file_id', ni.telegram_file_id,
            'file_path', ni.cloudflare_url,
            'file_size', ni.file_size,
            'mime_type', ni.mime_type,
            'created_at', ni.created_at
          )
          ORDER BY ni.created_at ASC
        )
        FROM z_note_images ni
        WHERE ni.note_id = nd.note_id
      ),
      '[]'::jsonb
    ) AS images
  FROM note_data nd;
END;
$$;

-- Add comment
COMMENT ON FUNCTION get_note_detail IS 'Get full details of a single note including category, links, and images (v4 - fixed image column names)';

-- Migration: update_get_note_detail_add_categories_and_status
-- Description: Update get_note_detail to include status and confirmed_categories array
-- Rollback: Use previous version

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS get_note_detail(UUID, BIGINT);

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
  status TEXT,
  confirmed_categories JSONB,
  links JSONB,
  images JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH note_data AS (
    -- Use LEFT JOIN to get notes even without confirmed categories
    SELECT
      n.id AS note_id,
      COALESCE(nc.category, 'idea') AS category,  -- Default to 'idea' if no category
      n.content,
      COALESCE(nc.updated_at, n.created_at) AS updated_at,  -- Fallback to created_at
      n.created_at,
      n.telegram_message_id,
      n.telegram_user_id,
      COALESCE(n.status, 'active') AS status
    FROM z_notes n
    LEFT JOIN z_note_categories nc ON n.id = nc.note_id AND nc.user_confirmed = true
    WHERE n.telegram_user_id = telegram_user_id_param
      AND COALESCE(n.status, 'active') = 'active'
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
    nd.status,
    -- Get all confirmed categories for this note
    COALESCE(
      (
        SELECT jsonb_agg(nc.category)
        FROM z_note_categories nc
        WHERE nc.note_id = nd.note_id
          AND nc.user_confirmed = true
      ),
      '[]'::jsonb
    ) AS confirmed_categories,
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
    -- Aggregate images
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
COMMENT ON FUNCTION get_note_detail IS 'Get full details of a single note including category, links, images, status, and confirmed categories (v6)';

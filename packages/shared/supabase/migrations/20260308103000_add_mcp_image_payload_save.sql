BEGIN;

CREATE OR REPLACE FUNCTION save_note_payload_from_source(
  telegram_user_id_param BIGINT,
  telegram_message_id_param BIGINT,
  content_param TEXT,
  links_param JSONB DEFAULT '[]'::jsonb,
  images_param JSONB DEFAULT '[]'::jsonb,
  source_param TEXT DEFAULT NULL,
  source_item_id_param TEXT DEFAULT NULL,
  idempotency_key_param TEXT DEFAULT NULL,
  created_at_param TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  note_id UUID,
  links_saved INT,
  images_saved INT,
  success BOOLEAN,
  deduplicated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_note_id UUID;
  new_note_id UUID;
  link_record JSONB;
  image_record JSONB;
  saved_link_count INT := 0;
  saved_image_count INT := 0;
BEGIN
  IF idempotency_key_param IS NOT NULL THEN
    SELECT id INTO existing_note_id
    FROM z_notes
    WHERE telegram_user_id = telegram_user_id_param
      AND idempotency_key = idempotency_key_param
    LIMIT 1;
  END IF;

  IF existing_note_id IS NULL AND source_param IS NOT NULL AND source_item_id_param IS NOT NULL THEN
    SELECT id INTO existing_note_id
    FROM z_notes
    WHERE telegram_user_id = telegram_user_id_param
      AND source = source_param
      AND source_item_id = source_item_id_param
    LIMIT 1;
  END IF;

  IF existing_note_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      existing_note_id,
      (SELECT COUNT(*)::INT FROM z_note_links WHERE note_id = existing_note_id),
      (SELECT COUNT(*)::INT FROM z_note_images WHERE note_id = existing_note_id),
      TRUE,
      TRUE;
    RETURN;
  END IF;

  INSERT INTO z_notes (
    telegram_user_id,
    telegram_message_id,
    content,
    created_at,
    source,
    source_item_id,
    idempotency_key
  )
  VALUES (
    telegram_user_id_param,
    telegram_message_id_param,
    content_param,
    created_at_param,
    source_param,
    source_item_id_param,
    idempotency_key_param
  )
  RETURNING id INTO new_note_id;

  IF jsonb_array_length(links_param) > 0 THEN
    FOR link_record IN SELECT * FROM jsonb_array_elements(links_param)
    LOOP
      INSERT INTO z_note_links (note_id, url, title, description, og_image)
      VALUES (
        new_note_id,
        link_record->>'url',
        NULLIF(link_record->>'title', ''),
        NULLIF(link_record->>'description', ''),
        NULLIF(link_record->>'og_image', '')
      );
      saved_link_count := saved_link_count + 1;
    END LOOP;
  END IF;

  IF jsonb_array_length(images_param) > 0 THEN
    FOR image_record IN SELECT * FROM jsonb_array_elements(images_param)
    LOOP
      INSERT INTO z_note_images (
        note_id,
        telegram_file_id,
        telegram_file_unique_id,
        cloudflare_url,
        file_name,
        file_size,
        mime_type,
        width,
        height
      )
      VALUES (
        new_note_id,
        image_record->>'telegram_file_id',
        image_record->>'telegram_file_unique_id',
        image_record->>'cloudflare_url',
        image_record->>'file_name',
        COALESCE((image_record->>'file_size')::BIGINT, 0),
        image_record->>'mime_type',
        NULLIF(image_record->>'width', '')::INTEGER,
        NULLIF(image_record->>'height', '')::INTEGER
      );
      saved_image_count := saved_image_count + 1;
    END LOOP;
  END IF;

  RETURN QUERY SELECT new_note_id, saved_link_count, saved_image_count, TRUE, FALSE;

EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO existing_note_id
    FROM z_notes
    WHERE telegram_user_id = telegram_user_id_param
      AND (
        (idempotency_key_param IS NOT NULL AND idempotency_key = idempotency_key_param)
        OR (source_param IS NOT NULL AND source_item_id_param IS NOT NULL AND source = source_param AND source_item_id = source_item_id_param)
      )
    LIMIT 1;

    RETURN QUERY
    SELECT
      existing_note_id,
      (SELECT COUNT(*)::INT FROM z_note_links WHERE note_id = existing_note_id),
      (SELECT COUNT(*)::INT FROM z_note_images WHERE note_id = existing_note_id),
      TRUE,
      TRUE;
  WHEN OTHERS THEN
    RAISE NOTICE 'Error saving note payload from source: %', SQLERRM;
    RETURN QUERY SELECT NULL::UUID, 0, 0, FALSE, FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION save_note_payload_from_source(BIGINT, BIGINT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION save_note_payload_from_source(BIGINT, BIGINT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  IS 'Idempotently save a note with links and images from non-Telegram sources such as MCP/OpenClaw.';

COMMIT;

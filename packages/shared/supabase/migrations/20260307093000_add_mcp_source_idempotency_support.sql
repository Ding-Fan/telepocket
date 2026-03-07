BEGIN;

ALTER TABLE z_notes
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_item_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_z_notes_source_created_at
  ON z_notes (source, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_z_notes_idempotency_key_unique
  ON z_notes (telegram_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_z_notes_source_item_unique
  ON z_notes (telegram_user_id, source, source_item_id)
  WHERE source IS NOT NULL AND source_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION save_note_with_links_from_source(
  telegram_user_id_param BIGINT,
  telegram_message_id_param BIGINT,
  content_param TEXT,
  links_param JSONB DEFAULT '[]'::jsonb,
  source_param TEXT DEFAULT NULL,
  source_item_id_param TEXT DEFAULT NULL,
  idempotency_key_param TEXT DEFAULT NULL,
  created_at_param TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  note_id UUID,
  links_saved INT,
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
  saved_count INT := 0;
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
      COUNT(*)::INT,
      TRUE,
      TRUE
    FROM z_note_links
    WHERE note_id = existing_note_id;
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
      saved_count := saved_count + 1;
    END LOOP;
  END IF;

  RETURN QUERY SELECT new_note_id, saved_count, TRUE, FALSE;

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
      COUNT(*)::INT,
      TRUE,
      TRUE
    FROM z_note_links
    WHERE note_id = existing_note_id;
  WHEN OTHERS THEN
    RAISE NOTICE 'Error saving note from source: %', SQLERRM;
    RETURN QUERY SELECT NULL::UUID, 0, FALSE, FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION save_note_with_links_from_source(BIGINT, BIGINT, TEXT, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION save_note_with_links_from_source(BIGINT, BIGINT, TEXT, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  IS 'Idempotently save a note with links from non-Telegram sources such as MCP/OpenClaw.';

COMMIT;

BEGIN;

CREATE OR REPLACE FUNCTION record_link_exposures(
  telegram_user_id_param BIGINT,
  events JSONB
)
RETURNS TABLE (
  inserted_count INT,
  deduplicated_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_event_count INT := 0;
  inserted_event_count INT := 0;
BEGIN
  IF events IS NULL OR jsonb_typeof(events) <> 'array' THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  WITH normalized_events AS (
    SELECT
      telegram_user_id_param AS telegram_user_id,
      NULLIF(TRIM(event_record.event_item->>'canonical_url'), '') AS canonical_url,
      NULLIF(TRIM(event_record.event_item->>'url'), '') AS url,
      NULLIF(TRIM(event_record.event_item->>'surface'), '') AS surface,
      NULLIF(TRIM(event_record.event_item->>'source'), '') AS source,
      NULLIF(TRIM(event_record.event_item->>'idempotency_key'), '') AS idempotency_key,
      CASE
        WHEN NULLIF(event_record.event_item->>'note_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (event_record.event_item->>'note_id')::UUID
        ELSE NULL
      END AS note_id,
      COALESCE(NULLIF(event_record.event_item->>'exposed_at', '')::TIMESTAMPTZ, NOW()) AS exposed_at
    FROM jsonb_array_elements(events) AS event_record(event_item)
  ),
  valid_events AS (
    SELECT *
    FROM normalized_events
    WHERE canonical_url IS NOT NULL
      AND url IS NOT NULL
      AND surface IS NOT NULL
      AND source IS NOT NULL
      AND idempotency_key IS NOT NULL
  ),
  inserted_rows AS (
    INSERT INTO z_link_exposures (
      telegram_user_id,
      canonical_url,
      url,
      surface,
      source,
      note_id,
      idempotency_key,
      exposed_at
    )
    SELECT
      telegram_user_id,
      canonical_url,
      url,
      surface,
      source,
      note_id,
      idempotency_key,
      exposed_at
    FROM valid_events
    ON CONFLICT (telegram_user_id, idempotency_key) DO NOTHING
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INT FROM valid_events),
    (SELECT COUNT(*)::INT FROM inserted_rows)
  INTO valid_event_count, inserted_event_count;

  RETURN QUERY
  SELECT
    inserted_event_count,
    GREATEST(valid_event_count - inserted_event_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION record_link_exposures(BIGINT, JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION record_link_exposures(BIGINT, JSONB)
  TO service_role;

COMMENT ON FUNCTION record_link_exposures(BIGINT, JSONB)
  IS 'Record link exposure events idempotently using (telegram_user_id, idempotency_key), returning inserted vs deduplicated counts.';

COMMIT;

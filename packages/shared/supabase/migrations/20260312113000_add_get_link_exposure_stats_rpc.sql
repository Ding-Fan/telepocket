BEGIN;

CREATE OR REPLACE FUNCTION get_link_exposure_stats(
  telegram_user_id_param BIGINT,
  keys TEXT[],
  window_days INT
)
RETURNS TABLE (
  canonical_url TEXT,
  exposure_count BIGINT,
  last_exposed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH requested_keys AS (
    SELECT DISTINCT requested_key.canonical_url
    FROM unnest(COALESCE(keys, ARRAY[]::TEXT[])) AS requested_key(canonical_url)
    WHERE requested_key.canonical_url IS NOT NULL
  )
  SELECT
    requested_keys.canonical_url,
    COUNT(exposure.id) AS exposure_count,
    MAX(exposure.exposed_at) AS last_exposed_at
  FROM requested_keys
  LEFT JOIN z_link_exposures AS exposure
    ON exposure.telegram_user_id = telegram_user_id_param
    AND exposure.canonical_url = requested_keys.canonical_url
    AND exposure.exposed_at >= NOW() - ((window_days || ' days')::INTERVAL)
  GROUP BY requested_keys.canonical_url;
END;
$$;

REVOKE ALL ON FUNCTION get_link_exposure_stats(BIGINT, TEXT[], INT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION get_link_exposure_stats(BIGINT, TEXT[], INT)
  TO service_role;

COMMENT ON FUNCTION get_link_exposure_stats(BIGINT, TEXT[], INT)
  IS 'Return exposure_count and last_exposed_at for each requested canonical URL within the specified time window.';

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS z_link_exposures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  canonical_url TEXT NOT NULL,
  url TEXT NOT NULL,
  surface TEXT NOT NULL,
  source TEXT NOT NULL,
  note_id UUID REFERENCES z_notes(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  exposed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_z_link_exposures_user_idempotency_unique
  ON z_link_exposures (telegram_user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_z_link_exposures_user_canonical_exposed_at
  ON z_link_exposures (telegram_user_id, canonical_url, exposed_at DESC);

CREATE INDEX IF NOT EXISTS idx_z_link_exposures_user_exposed_at
  ON z_link_exposures (telegram_user_id, exposed_at DESC);

ALTER TABLE z_link_exposures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to link_exposures" ON z_link_exposures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

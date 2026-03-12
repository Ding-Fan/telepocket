2026-03-12
- Implemented `z_link_exposures.note_id` as nullable FK to `z_notes(id)` with `ON DELETE SET NULL` to keep event rows while allowing note lifecycle changes.
- Used unique index `idx_z_link_exposures_user_idempotency_unique` for `(telegram_user_id, idempotency_key)` enforcement.
- Matched note-table access pattern by enabling RLS and adding `FOR ALL TO service_role USING (true) WITH CHECK (true)` policy only.
- Implemented `get_link_exposure_stats(BIGINT, TEXT[], INT)` as a `SECURITY DEFINER` function with `SET search_path = public` and execute grants to `anon, authenticated, service_role`, matching existing callable RPC migration patterns.
- Used requested-key CTE with `SELECT DISTINCT` to ensure one output row per requested canonical URL while preserving the provided key string as `canonical_url`.
- Hardened `get_link_exposure_stats` access by switching to `SECURITY INVOKER`, revoking execute from `PUBLIC`, `anon`, and `authenticated`, and granting execute only to `service_role` to avoid arbitrary-user reads through a privileged definer function.
- Added migration `20260312113000_add_record_link_exposures_rpc.sql` with `record_link_exposures(BIGINT, JSONB)` as `SECURITY DEFINER` + `search_path = public`, aligned with existing callable RPC style.
- Chose table return shape `RETURNS TABLE(inserted_count INT, deduplicated_count INT)` to provide stable structured deduplication outcomes for callers.
- Tightened RPC access control for `record_link_exposures` by explicitly revoking execute from `PUBLIC`, `anon`, and `authenticated`, then granting execute only to `service_role` to avoid exposing `SECURITY DEFINER` writes.

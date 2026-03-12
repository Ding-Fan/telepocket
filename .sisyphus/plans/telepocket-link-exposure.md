# Telepocket Link Exposure Tracking (For `reading-feed` Skill)

## TL;DR
> Add link-level exposure tracking to Telepocket (DB + RPC + MCP tools) so the portable `reading-feed` skill can (1) select least-exposed links and (2) log exposures day one with idempotent retries.

**Deliverables**:
- Supabase migrations for `z_link_exposures` + RPCs: `record_link_exposures`, `get_link_exposure_stats`
- MCP tools: `links.exposure.record`, `links.exposure.stats`
- Fix `notes.search` (non-query path) to exclude archived notes by default

**Estimated Effort**: Medium
**Parallel Execution**: YES (3 waves)
**Critical Path**: DB migrations → MCP tool wrappers → end-to-end verification

---

## Context

### Original Request
Build a portable skill that returns 3 links (latest, least exposed last-week, random) and relies on Telepocket MCP to retrieve data and log exposures.

### Confirmed Product Rules (from skill)
- Exposure key: `canonical_url`
- Canonicalization: conservative (lowercase host; strip `#fragment`; drop `utm_*`, `fbclid`, `gclid`, etc.)
- Idempotency: `idempotency_key = {feed_request_id}:{canonical_url}`
- Feed diversity: distinct by `canonical_url` only (no hostname diversity)
- Archived scope: exclude archived notes/links from candidate selection

### Repo Evidence / References
- Note system schema includes `z_note_links.created_at`: `packages/shared/supabase/migrations/20251025143242_fuzzy_search_notes_feature.sql`
- Archive filtering already applied in fuzzy-search RPC (`status='active'`): `packages/shared/supabase/migrations/20251105155457_update_functions_filter_active_notes.sql`
- MCP tool registration: `packages/mcp-server/src/index.ts`
- MCP `notes.search` list-path currently does not filter by `status`: `packages/mcp-server/src/telepocket.ts`
- Skill contracts to follow: `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/exposure-contract.md`, `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/canonical-url.md`

---

## Work Objectives

### Core Objective
Provide a link exposure tracking system in Telepocket that any agent (OpenClaw or others) can use via MCP to read windowed exposure stats and to record exposures idempotently.

### Must Have
- Record exposures as events (not clicks) with `surface` + `source`
- Idempotent recording enforced at the database level (race-safe)
- Stats API returns counts for requested keys within a time window
- Works for the configured Telepocket user (`config.telepocket.userId`) without accepting arbitrary user IDs

### Must NOT Have (Guardrails)
- No “feed picking” logic in DB/RPC; only record + aggregate stats
- No web fetching / crawling for canonicalization
- No breaking changes to existing `notes.*` MCP tools

---

## Verification Strategy

> ZERO HUMAN INTERVENTION — verification is agent-executed.

### Test Decision
- **Existing test infra**: Repo has Jest for bot, but DB migrations/RPC are best verified via Supabase CLI + SQL queries.
- **Automated tests**: Tests-after (optional); primary verification is scripted DB + MCP calls.

### QA Policy
Each task includes:
- DB-level verification (Supabase CLI + SQL)
- MCP-level verification (tool call + expected JSON)
Evidence saved to `.sisyphus/evidence/`.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (DB foundation — can run in parallel):
- T1 Create `z_link_exposures` table + indexes + policies
- T2 Add `record_link_exposures` RPC (idempotent)
- T3 Add `get_link_exposure_stats` RPC (windowed counts)

Wave 2 (MCP surface + retrieval correctness — parallel):
- T4 Add canonicalization util in MCP server (match `tracking/canonical-url.md`)
- T5 Add MCP tool `links.exposure.record`
- T6 Add MCP tool `links.exposure.stats`
- T7 Fix `notes.search` list-path to exclude archived (`status='active'`)

Wave 3 (Integration verification):
- T8 End-to-end: record → stats (idempotency + window semantics)
- T9 MCP tool listing + schema validation

---

## TODOs

- [x] 1. Create `z_link_exposures` table (event log)

  **What to do**:
  - Create a Supabase migration in `packages/shared/supabase/migrations/` that adds a new table (name: `z_link_exposures`).
  - Columns (minimum):
    - `id uuid primary key default gen_random_uuid()`
    - `telegram_user_id bigint not null`
    - `canonical_url text not null`
    - `url text not null`
    - `surface text not null`
    - `source text not null`
    - `note_id uuid null`
    - `idempotency_key text not null`
    - `exposed_at timestamptz not null default now()`
  - Add a **unique constraint** to enforce idempotency: `(telegram_user_id, idempotency_key)`.
  - Add indexes:
    - `(telegram_user_id, canonical_url, exposed_at desc)`
    - `(telegram_user_id, exposed_at desc)`
  - Add RLS + policies consistent with the rest of the note system (service-role usage is acceptable; avoid opening write access to anon).

  **Must NOT do**:
  - Do not add feed selection logic.
  - Do not introduce aggressive canonicalization in DB.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: DB schema + RLS/policy correctness.
  - **Skills**: `supabase`
    - `supabase`: mandatory migration workflow + deployment safety.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-3)
  - **Blocks**: 2, 3, 5, 6, 8
  - **Blocked By**: None

  **References**:
  - `packages/shared/supabase/migrations/20251025143242_fuzzy_search_notes_feature.sql` - existing table patterns (`z_notes`, `z_note_links`).
  - `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/exposure-contract.md` - event fields + idempotency contract.

  **Acceptance Criteria**:
  - [ ] `cd packages/shared/supabase && supabase db push` succeeds.
  - [ ] SQL check returns expected columns + unique constraint:
    - `select column_name from information_schema.columns where table_name='z_link_exposures' order by column_name;`
  - [ ] Unique idempotency constraint exists for `(telegram_user_id, idempotency_key)`.

  **QA Scenarios**:
  ```
  Scenario: Table exists with idempotency constraint
    Tool: Bash (supabase + psql)
    Steps:
      1. Run: cd packages/shared/supabase && supabase db push
      2. Run psql against the target DB to introspect z_link_exposures
    Expected Result: table present; unique constraint present
    Evidence: .sisyphus/evidence/task-1-schema.txt
  ```

- [x] 2. Add RPC `record_link_exposures(events jsonb)` (idempotent)

  **What to do**:
  - Create a migration adding an RPC that inserts exposure events.
  - Input: JSONB array of events (each includes `canonical_url`, `url`, `surface`, `source`, `note_id?`, `idempotency_key`, `exposed_at?`).
  - RPC must:
    - enforce `telegram_user_id` from param (NOT from event payload)
    - insert rows with `ON CONFLICT (telegram_user_id, idempotency_key) DO NOTHING`
    - return counts: `{ inserted: int, deduplicated: int }` (or equivalent)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `supabase`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: 5, 8
  - **Blocked By**: 1

  **References**:
  - `packages/shared/supabase/migrations/20260307093000_add_mcp_source_idempotency_support.sql` - idempotency patterns.
  - `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/exposure-contract.md` - idempotency key format + event contract.

  **Acceptance Criteria**:
  - [ ] RPC exists and can be called from SQL.
  - [ ] Calling twice with same `(telegram_user_id, idempotency_key)` inserts once.

  **QA Scenarios**:
  ```
  Scenario: Idempotent record behavior
    Tool: Bash (psql)
    Steps:
      1. Call record_link_exposures with a single event
      2. Call it again with the same idempotency_key
      3. Query z_link_exposures for that idempotency_key
    Expected Result: exactly 1 row; RPC indicates second call deduplicated
    Evidence: .sisyphus/evidence/task-2-idempotency.txt
  ```

- [x] 3. Add RPC `get_link_exposure_stats(keys text[], window_days int)`

  **What to do**:
  - Create a migration adding an RPC that returns stats for each requested `canonical_url`.
  - Input: `telegram_user_id_param`, `keys text[]`, `window_days int`.
  - Output: one row per requested key (including zero counts), with:
    - `canonical_url`, `exposure_count`, `last_exposed_at`
  - Windowing: `exposed_at >= now() - (window_days || ' days')::interval`.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `supabase`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: 6, 8
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/exposure-contract.md` - expected stats contract.

  **Acceptance Criteria**:
  - [ ] For an unexposed key, stats returns `exposure_count=0`.
  - [ ] For an exposed key, stats returns correct count + last_exposed_at.

  **QA Scenarios**:
  ```
  Scenario: Stats include zero-count rows
    Tool: Bash (psql)
    Steps:
      1. Call get_link_exposure_stats with two keys (one exposed, one never exposed)
      2. Verify both keys appear
    Expected Result: both keys present; one has count 0
    Evidence: .sisyphus/evidence/task-3-stats.txt
  ```

- [x] 4. Implement `canonical_url` normalization in MCP server

  **What to do**:
  - Add a small canonicalization utility in MCP server code that implements the conservative rules from `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/canonical-url.md`.
  - Use it in the new MCP tools so Telepocket recomputes canonical_url server-side (do not trust clients).

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5-7)
  - **Blocks**: 5, 6
  - **Blocked By**: None

  **References**:
  - `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/canonical-url.md` - exact normalization rules.

  **Acceptance Criteria**:
  - [ ] Utility is unit-testable (pure function) and used by both exposure tools.

  **QA Scenarios**:
  ```
  Scenario: Canonicalization strips tracking params
    Tool: Bash (node)
    Steps:
      1. Run a node one-liner importing the canonicalize function
      2. Pass URL containing utm_source + fragment
    Expected Result: host lowercased; fragment removed; utm_* removed
    Evidence: .sisyphus/evidence/task-4-canonicalize.txt
  ```

- [x] 5. Add MCP tool `links.exposure.record`

  **What to do**:
  - Create `packages/mcp-server/src/tools/linksExposureRecord.ts` (name flexible) implementing MCP tool:
    - name: `links.exposure.record`
    - input: `{ feed_request_id: string, items: [{ url: string, surface?: string, source?: string, note_id?: string, exposed_at?: string }] }`
  - Tool handler must:
    - canonicalize `url` → `canonical_url`
    - set `idempotency_key = {feed_request_id}:{canonical_url}`
    - call Supabase RPC `record_link_exposures` for the configured user
    - return inserted/deduplicated counts
  - Register tool in `packages/mcp-server/src/index.ts` and update `packages/mcp-server/src/tools/systemHealth.ts` tools list.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6, 7)
  - **Blocks**: 8, 9
  - **Blocked By**: 2, 4

  **References**:
  - `packages/mcp-server/src/tools/searchNotes.ts` - tool schema + handler patterns.
  - `packages/mcp-server/src/index.ts` - tool registration.
  - `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/exposure-contract.md` - idempotency format.

  **Acceptance Criteria**:
  - [ ] `pnpm --filter @telepocket/mcp-server build` passes.
  - [ ] Calling handler twice with same input yields `inserted=1` then `deduplicated>0`.

  **QA Scenarios**:
  ```
  Scenario: MCP record is idempotent
    Tool: Bash (node)
    Steps:
      1. Build: pnpm --filter @telepocket/mcp-server build
      2. Run node --input-type=module to import dist tool and call handler twice
    Expected Result: second call does not increase DB row count
    Evidence: .sisyphus/evidence/task-5-mcp-record.txt
  ```

- [x] 6. Add MCP tool `links.exposure.stats`

  **What to do**:
  - Create `packages/mcp-server/src/tools/linksExposureStats.ts` implementing MCP tool:
    - name: `links.exposure.stats`
    - input: `{ urls: string[], window_days: number }`
  - Tool handler must:
    - canonicalize all urls into keys
    - call Supabase RPC `get_link_exposure_stats`
    - return one row per requested canonical_url (including zeros)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 7)
  - **Blocks**: 8, 9
  - **Blocked By**: 3, 4

  **References**:
  - `packages/mcp-server/src/tools/searchNotes.ts` - schema validation patterns (`additionalProperties: false`).
  - `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/exposure-contract.md` - stats contract.

  **Acceptance Criteria**:
  - [ ] For an unknown url, returned count is 0.
  - [ ] For a recorded url, returned count matches DB.

  **QA Scenarios**:
  ```
  Scenario: Stats reflect recorded exposure
    Tool: Bash (node)
    Steps:
      1. Call links.exposure.record for a url
      2. Call links.exposure.stats for same url with window_days=7
    Expected Result: exposure_count >= 1
    Evidence: .sisyphus/evidence/task-6-mcp-stats.txt
  ```

- [x] 7. Fix `notes.search` list-path to exclude archived notes

  **What to do**:
  - Update `packages/mcp-server/src/telepocket.ts` in `searchNotes` (no-query branch) to filter `z_notes.status = 'active'`.
  - Keep query branch as-is (RPC already filters active): `packages/shared/supabase/migrations/20251105155457_update_functions_filter_active_notes.sql`.
  - (Optional) include `status` in results for debugging, but do not change output contract unless needed.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4-6)
  - **Blocks**: reading-feed correctness
  - **Blocked By**: None

  **References**:
  - `packages/mcp-server/src/telepocket.ts` - current list query to patch.
  - `packages/shared/supabase/migrations/20251105155457_update_functions_filter_active_notes.sql` - canonical status filtering used elsewhere.

  **Acceptance Criteria**:
  - [ ] `notes.search` with no query does not return notes where `status != 'active'`.

  **QA Scenarios**:
  ```
  Scenario: List-path excludes archived
    Tool: Bash (node)
    Steps:
      1. Create one archived note and one active note in DB (existing app tooling)
      2. Call notes.search with no query
    Expected Result: only active note appears
    Evidence: .sisyphus/evidence/task-7-notes-search-active.txt
  ```

- [x] 8. End-to-end verification: record → stats (window + idempotency)

  **What to do**:
  - Add an agent-executed verification script or one-liners that:
    - records exposures for 2 URLs (one with tracking params + fragment)
    - checks canonicalization produces the same key on record + stats
    - verifies idempotency by re-recording same feed_request_id
    - verifies windowing (`window_days=7`) counts the events

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 9, final verification
  - **Blocked By**: 1-6

  **References**:
  - `packages/mcp-server/package.json` - build/start scripts.
  - `.sisyphus/drafts/openclaw-reading-feed-skill/tracking/canonical-url.md` - canonical key expectations.

  **Acceptance Criteria**:
  - [ ] Replaying same `feed_request_id` does not increase counts.
  - [ ] Stats returns 0 for an unknown URL and >=1 for known URLs.

  **QA Scenarios**:
  ```
  Scenario: E2E exposure workflow
    Tool: Bash (node + SQL)
    Steps:
      1. pnpm --filter @telepocket/mcp-server build
      2. Call links.exposure.record with feed_request_id='test-001'
      3. Call links.exposure.record again with same feed_request_id
      4. Call links.exposure.stats with window_days=7
    Expected Result: inserted only once; stats count stable
    Evidence: .sisyphus/evidence/task-8-e2e.txt
  ```

- [x] 9. Tool registry + schema validation

  **What to do**:
  - Ensure new tools are listed by MCP server and reject unknown fields.
  - Update `system.health` tool list string.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: final verification
  - **Blocked By**: 5, 6

  **References**:
  - `packages/mcp-server/src/index.ts` - tool registry.
  - `packages/mcp-server/src/tools/systemHealth.ts` - tools list.

  **Acceptance Criteria**:
  - [ ] ListTools contains `links.exposure.record` and `links.exposure.stats`.
  - [ ] Tool call with an extra input field fails with a clear error.

  **QA Scenarios**:
  ```
  Scenario: Tools appear and validate schema
    Tool: Bash (node)
    Steps:
      1. Build: pnpm --filter @telepocket/mcp-server build
      2. Create a tiny SDK harness script under `.sisyphus/evidence/mcp-harness.mjs` that:
         - spawns `pnpm --filter @telepocket/mcp-server start` as a child process
         - connects via stdio using `@modelcontextprotocol/sdk`
         - calls `listTools`
         - calls `callTool` for `links.exposure.record` with an extra unknown field
      3. Run the harness and capture output
      4. Fallback check (if SDK client API is unavailable): grep `packages/mcp-server/src/index.ts` and `packages/mcp-server/src/tools/systemHealth.ts` for tool names and confirm tool schemas set `additionalProperties: false`.
    Expected Result: tools appear in listTools; unknown field rejected (or fallback checks pass)
    Evidence: .sisyphus/evidence/task-9-registry.txt
  ```

---

## Final Verification Wave

- Run DB verification commands (migrations applied; RPCs callable; idempotency enforced)
- Run MCP verification (tools list includes new tools; calls succeed)
- Confirm `notes.search` does not return archived notes on list-path

---

## Commit Strategy

- 1 commit for DB migrations
- 1 commit for MCP server additions

---

## Success Criteria

- `links.exposure.record` can be called repeatedly with same `idempotency_key` and does not double-count.
- `links.exposure.stats` returns correct counts for a given `window_days`.
- `notes.search` (no query) excludes archived notes by default.

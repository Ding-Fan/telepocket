# Telepocket MCP Adapter Notes

This is guidance for using the skill against Telepocket today.

## Candidate retrieval

- Call `notes.search` with:
  - `has_links=true`
  - `limit=20` (increase if not enough links)
  - optional `source='openclaw'` if you want OpenClaw-only items

From each note result:
- emit one `CandidateLink` per `links[]`
- map `note_id`, `note_snippet`, and fallback timestamps

Link timestamps:
- `notes.search` link objects may not include `created_at`.
- If you need true per-link `created_at` (for the "Latest" pick), call `notes.get` for only the small set of recent candidate notes and take `links[].created_at` from that response.

## Exposure tracking

Until Telepocket exposes link-level tracking, the skill can:
- treat exposure store as a separate provider (local or external)
- OR approximate using note impression tracking (less accurate)

Telepocket link-level target tools (to implement):
- `links.exposure.record` (writes exposures)
- `links.exposure.stats` (reads per-link stats for a window)

Idempotency:
- `links.exposure.record` should accept an `idempotency_key` per event or per batch, so retries don't double-count.

Canonicalization:
- Use the conservative rules in `tracking/canonical-url.md` so keys match between skill and Telepocket.

Archived filtering:
- Skill requires archived notes/links be excluded.
- Telepocket MCP currently returns notes without an explicit `status` in `notes.search`; Telepocket should add a server-side filter (e.g. `status != 'archived'`) or a tool parameter like `include_archived` default false.

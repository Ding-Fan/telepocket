---
name: reading-feed
description: Portable skill that picks 3 reading links (latest, least-exposed-last-week, random) using MCP data sources and a link exposure tracking contract.
---

# OpenClaw Skill: Reading Feed

## What this skill does

When the user asks for something to read, return **3 links**:
1. **Latest** saved link
2. **Least exposed** link among links saved in the last 7 days
3. **Random** link from all time

Constraint: the 3 picks should be **different** if possible.

Scope:
- Exclude archived notes/links.

## Data sources

This skill is designed to be portable.

- It uses MCP tools when available (Telepocket: `notes.search`, `notes.get`).
- It expects a generic “candidate links” shape (see `data-contract.md`).

## Exposure tracking

This skill assumes link exposure tracking exists via a provider interface, but includes the full contract so it can be implemented later inside Telepocket (or elsewhere).

See:
- `tracking/README.md`
- `tracking/exposure-contract.md`
- `tracking/canonical-url.md`

## Default choreography (Telepocket)

1) Fetch recent notes with links (`notes.search` with `has_links=true`, limit 20)
2) Extract link candidates; choose **Latest** by link created_at (or note created_at fallback)
3) Fetch more candidates if needed (repeat with higher limit / older window)
4) Query exposure store for last 7 days candidates; select least exposed
5) Random pick from all candidates, excluding already selected
6) Record exposures for the returned 3 items (at least: `exposed_at=now`, `surface=reading_feed`)

Idempotency:
- Generate a stable `feed_request_id` per feed run; set `idempotency_key={feed_request_id}:{canonical_url}`.

## Output format

Return a compact “3-card” response:
- Title + URL (+ optional reason)
- Short note context snippet if available

## Non-goals

- No web fetching of live URLs.
- No DB access directly; only through MCP/provider.

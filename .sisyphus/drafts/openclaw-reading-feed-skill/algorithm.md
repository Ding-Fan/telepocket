# Picking Algorithm

## Inputs

- Candidates: list of `CandidateLink`
- Exposure provider: `LinkExposureProvider` (see `tracking/exposure-contract.md`)

## Parameters (defaults)

- `N = 3`
- `last_week_days = 7`
- `prefer_distinct = true`

## Steps

1) **Latest**
- Choose candidate with max(`created_at`).

2) **Least exposed (last week)**
- Filter candidates where `created_at >= now - 7 days`.
- For each candidate, read `exposure_count` within last 7 days.
- Pick smallest exposure_count; tiebreaker: older first (to surface neglected items).

Fallback:
- If there are **0** candidates in the last-week window, omit this slot (return only Latest + Random).

3) **Random (all time)**
- Uniform random over all candidates not already selected.
- If empty, allow duplicates only as last resort.

4) **Diversity**
- If two picks share the same `key`, replace the later one with next-best option.

Decision:
- Only enforce distinctness by `canonical_url` (no hostname diversity).

5) **Record exposure**
- For each returned pick, write an exposure event with `surface='reading_feed'` and a stable `idempotency_key`.
- Idempotency key format: `{feed_request_id}:{canonical_url}`.

## Empty states

- No candidates: respond with a short guidance: “No saved links yet; send me a URL to save.”
- <3 candidates: return what exists, no filler.

## Scope filter

Decision:
- Exclude archived notes/links from candidate selection.

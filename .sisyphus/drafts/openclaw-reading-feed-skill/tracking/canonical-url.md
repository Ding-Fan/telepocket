# Canonical URL Normalization

Decision: **Conservative normalization**.

Goal:
- Create a stable `canonical_url` key for exposure tracking.
- Avoid collapsing meaningfully distinct URLs.

## Rules

Given an input `url`:

1) Parse as URL.

2) Normalize the host:
- lowercase the hostname

3) Remove fragment:
- strip `#...`

4) Remove common tracking query params:
- drop any query param whose key matches:
  - `utm_*`
  - `fbclid`
  - `gclid`
  - `igshid`
  - `mc_cid`, `mc_eid`

5) Keep all other query params unchanged (order preserved).

6) Keep the path as-is (do not add/remove trailing slashes).

Result is `canonical_url`.

## Notes

- This is intentionally NOT aggressive (we do NOT strip all query params).
- Different projects can tighten rules later, but should not loosen without migrating keys.

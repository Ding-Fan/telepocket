# Exposure Contract

## Identifier

Each link needs a stable identifier (`key`).

Decision (portable default):
- Use `canonical_url` as `key`.

Canonicalization rules are defined in `canonical-url.md`.

Notes:
- If multi-tenant is ever needed, the provider can namespace keys internally (e.g., `${user_id}:${canonical_url}`).

## Data model

```ts
type LinkExposureEvent = {
  key: string;
  url: string;
  exposed_at: string;       // ISO
  surface: 'reading_feed' | string;
  source: 'openclaw' | string;
  note_id?: string;
  idempotency_key: string;
};

## Idempotency rule (decision)

Idempotency keys MUST be generated as:

`{feed_request_id}:{canonical_url}`

Where:
- `feed_request_id` is stable for a single feed generation run (retry-safe)
- `canonical_url` follows `canonical-url.md`

type LinkExposureStats = {
  key: string;
  exposure_count: number;
  last_exposed_at?: string;
};
```

## Provider interface

```ts
interface LinkExposureProvider {
  getStats(keys: string[], windowDays: number): Promise<Map<string, LinkExposureStats>>;
  recordExposures(events: LinkExposureEvent[]): Promise<void>;
}
```

## Telepocket target (later)

Add:
- table `z_link_exposures` (or similar)
- unique constraint to enforce idempotency, e.g. `(telegram_user_id, idempotency_key)`
- RPC `record_link_exposures(events)`
- RPC `get_link_exposure_stats(keys, window_days)`

Expose via MCP tools:
- `links.exposure.stats`
- `links.exposure.record`

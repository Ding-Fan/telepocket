# Data Contract: Candidate Links

The picker works on normalized candidates.

## CandidateLink (minimum)

```ts
type CandidateLink = {
  key: string;              // stable tracking key (canonical_url)
  url: string;
  title?: string;
  created_at: string;       // ISO timestamp (link created_at if available; else note created_at fallback)
  source?: string;          // e.g. telepocket
  note_id?: string;         // if link is attached to a note
  note_snippet?: string;    // optional user context
};
```

## Normalization rules

1. `key` MUST be stable across calls and SHOULD be `canonical_url`.
2. `canonical_url` SHOULD follow `tracking/canonical-url.md`.
2. `created_at` MUST be parseable ISO.
3. Prefer `title` from stored metadata; fallback to hostname/path.

## Telepocket mapping (current)

- `notes.search` results contain `links[]` with `id`, `url`, `title` and note fields like `note_id`, `created_at`, `snippet`.
- If link-level `created_at` is not available, use note `created_at` as a fallback.
- If accuracy is needed (e.g. "Latest" link), call `notes.get` for candidate note_ids; it returns `links[].created_at`.

# Decisions - Link Preview Cards

## [2026-01-27T18:46:23Z] Architectural Choices

### Type Normalization Strategy
- Create `NoteCardLink` interface in NoteCardV2.tsx
- Normalize `og_image` → `image_url` at calling sites (NotesList, SearchResults)
- Reason: Keeps LinkPreviewCard contract intact, handles RPC mismatch

### Rendering Strategy
- Render link previews BETWEEN content and tags
- Use `onClick={(e) => e.stopPropagation()}` to prevent card navigation
- Reason: Link clicks should open URL, not navigate to note detail

### Graceful Degradation
- SearchResults: Map to null description/image_url (data not available)
- NotesList: Full metadata from RPC
- Reason: Different data sources, different capabilities

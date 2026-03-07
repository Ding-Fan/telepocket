# Issues - Link Preview Cards

## [2026-01-27T18:46:23Z] Known Gotchas

### Type Mismatches
- RPC returns `og_image`, but LinkPreviewCard expects `image_url`
- Solution: Map at calling sites, not in component

### Data Availability
- NotesList: Full link metadata available
- SearchResults: Only id/url/title available (no description/image)
- GlanceSection: No links data at all (out of scope)

### Click Propagation
- Link preview cards are inside clickable NoteCardV2
- Must stopPropagation to prevent navigation on link click

# Clickable Links in Note Content - Task

## Objective
Make URLs in note content clickable so users can open links in new tabs without copy-pasting.

## Context
Currently, URLs in note content are displayed as plain text. This creates friction when users want to visit referenced links - they must manually select, copy, and paste URLs into their browser.

## Requirements
1. Detect URLs in note content using regex pattern
2. Convert URLs to clickable anchor tags
3. Open links in new tab with security attributes
4. Style links to match ocean theme (cyan color)
5. Preserve existing text formatting

## Success Criteria
- [x] URLs are automatically detected and converted to links
- [x] Links open in new tab when clicked
- [x] Links have proper security attributes (`rel="noopener noreferrer"`)
- [x] Links styled with cyan color and underline
- [x] Non-URL text remains unchanged
- [x] Whitespace formatting preserved

## Implementation
**File**: `apps/web/components/notes/NoteDetail.tsx`

**Changes**:
1. Add `linkifyContent()` function to detect and convert URLs
2. Update content rendering to use linkified output
3. Apply ocean theme styling to links

**Testing**:
- Test with single URL in content
- Test with multiple URLs in content
- Test with mixed text and URLs
- Test with no URLs (plain text only)
- Verify new tab behavior
- Verify hover effects

## Timeline
- Estimated: 1 hour
- Actual: 1 hour
- Deployed: 2025-11-23

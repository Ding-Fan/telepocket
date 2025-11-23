# Clickable Links in Note Content - Implementation Plan

## Phase 1: URL Detection Function
**Time**: 15 minutes

### Steps
1. Add `linkifyContent()` utility function to `NoteDetail.tsx`
2. Implement regex pattern for HTTP/HTTPS URL detection
3. Split text by URL pattern
4. Map parts to JSX elements (text or anchor tags)

### Validation
- Function correctly identifies URLs
- Function preserves non-URL text
- Function returns array of strings and JSX elements

## Phase 2: Link Component
**Time**: 15 minutes

### Steps
1. Create anchor tag with proper attributes
2. Add `target="_blank"` for new tab behavior
3. Add `rel="noopener noreferrer"` for security
4. Apply Tailwind CSS classes for styling

### Validation
- Links open in new tab
- Security attributes prevent tab-napping
- Styling matches ocean theme

## Phase 3: Integration
**Time**: 15 minutes

### Steps
1. Update content section in NoteDetail component
2. Change `<p>` to `<div>` for mixed content support
3. Replace plain text with `{linkifyContent(note.content)}`
4. Preserve existing prose and whitespace classes

### Validation
- Content renders correctly
- Links are clickable
- Text formatting preserved
- No layout issues

## Phase 4: Testing & Deployment
**Time**: 15 minutes

### Steps
1. Build monorepo with changes
2. Deploy web app using PM2
3. Test with real note content
4. Verify hover effects and transitions

### Validation
- Build succeeds without errors
- Web app restarts successfully
- Links work in production
- No console errors

## Total Effort
**Estimated**: 1 hour
**Actual**: 1 hour

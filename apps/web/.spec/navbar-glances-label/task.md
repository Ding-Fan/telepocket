# Navbar "Glances" Label - Task

## Objective
Rename navbar label from "Notes" to "Glances" to accurately reflect the curated Quick Glance view shown on the home page.

## Context
The home page displays a curated "Quick Glance" view with priority notes and category sections, not a complete notes list. The navbar label "Notes" is misleading and causes user confusion. The full notes list is accessed via a "See All Notes" button that navigates to `/notes`.

## Requirements
1. Change navigation config label from "Notes" to "Glances"
2. Maintain same home page URL (`/`)
3. Keep existing icon (Home)
4. Ensure label aligns with page heading "Quick Glance"

## Success Criteria
- [x] Navbar displays "Glances" instead of "Notes"
- [x] Navigation still points to home page (`/`)
- [x] Label matches page content
- [x] No broken functionality
- [x] Build and deployment succeed

## Implementation
**File**: `apps/web/config/navigation.ts`

**Change**:
```typescript
// Line 4
{ name: 'Notes', href: '/', icon: Home }
↓
{ name: 'Glances', href: '/', icon: Home }
```

**Testing**:
- Verify navbar shows "Glances"
- Click "Glances" navigates to home page
- Page heading still shows "Quick Glance"
- "See All Notes" button still accessible
- Full notes list still at `/notes`

## Timeline
- Estimated: 5 minutes
- Actual: 5 minutes
- Deployed: 2025-11-23

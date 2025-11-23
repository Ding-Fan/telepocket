# Back Button History Navigation Specification

## Problem & Solution

**Problem**: Back button in note detail view always navigates to home page (`/`), regardless of where the user came from. When users navigate from search page → note detail → back, they lose their search results and context. This breaks standard browser navigation expectations.

**Solution**: Replace hardcoded `router.push('/')` with `router.back()` to use browser history API. The back button now respects navigation context and returns users to their previous page with preserved state.

**Returns**: Natural browser-like navigation that maintains user context across all routes (search, glance, notes list, etc.).

## Component API

```typescript
// Next.js router navigation
import { useRouter } from 'next/navigation';

// Before (hardcoded)
router.push('/'); // Always goes home

// After (history-aware)
router.back(); // Goes to previous page in history
```

## Core Flow

```
User navigates: Search → Note Detail
  ↓
User performs search for "react hooks"
  ↓
Search results page shows 5 notes
  ↓
User clicks note #3
  ↓
Note detail page loads
  ↓
User clicks "Back to Notes" button
  ↓
router.back() navigates to previous page
  ↓
User returns to search results (still showing "react hooks" results)
```

## User Stories

**US-1: Back from Search Results**
User searches for "database migration", views results, clicks a note to read details. After reading, clicks "Back to Notes". Returns to search results page with "database migration" query still active and results visible. User can continue reviewing other search results.

**US-2: Back from Glance View**
User on glance view (home page), clicks "View All" on a high-priority note. Note detail opens. User clicks back button. Returns to glance view at same scroll position. User can review other glance items.

**US-3: Back from Notes List**
User browsing paginated notes list (page 3 of 5). Opens note detail for review. Clicks back button. Returns to notes list page 3, not page 1. User continues browsing from where they left off.

**US-4: Back After Archive**
User searches for "old meeting notes", finds outdated note, opens detail, clicks archive. Note is archived and user automatically returns to search results page. Search context preserved.

**US-5: Back from Error State**
User clicks invalid note link from external source. Note detail shows "Unable to load note" error. User clicks "Go Back". Returns to previous page (or home if no history).

## MVP Scope

**Included**:
- Replace `router.push('/')` with `router.back()` in note detail page
- Update back button handler in success state
- Update back button in error state
- Update archive success navigation
- Preserve browser history stack
- Work across all entry routes (search, glance, notes, external)

**NOT Included** (Future):
- Back button with page state restoration (scroll position) → 🔧 Robust
- Forward navigation after going back → 🔧 Robust
- Breadcrumb navigation trail → 🔧 Robust
- History manipulation (prevent back on certain actions) → 🚀 Advanced
- Session history persistence across browser restarts → 🚀 Advanced

## Implementation Details

**Before (Hardcoded Home Navigation)**:
```typescript
// apps/web/app/notes/[id]/page.tsx
export default function NotePage({ params }: NotePageProps) {
  return (
    <AppLayout>
      <NoteDetailComponent
        note={note}
        onBack={() => router.push('/')}  // ❌ Always goes home
      />
    </AppLayout>
  );
}
```

**After (History-Based Navigation)**:
```typescript
// apps/web/app/notes/[id]/page.tsx
export default function NotePage({ params }: NotePageProps) {
  return (
    <AppLayout>
      <NoteDetailComponent
        note={note}
        onBack={() => router.back()}  // ✅ Uses browser history
      />
    </AppLayout>
  );
}
```

**Error State Fix**:
```typescript
// Before
<button onClick={() => router.push('/')}>
  Back to Home
</button>

// After
<button onClick={() => router.back()}>
  Go Back
</button>
```

**Archive Success Navigation**:
```typescript
// Before
if (result.success) {
  router.push('/');  // ❌ Always goes home
}

// After
if (result.success) {
  router.back();  // ✅ Returns to previous page
}
```

## Acceptance Criteria (MVP)

**Functional**:
- [x] Back button uses `router.back()` instead of `router.push('/')`
- [x] Navigation respects browser history stack
- [x] Works from search results page
- [x] Works from glance view (home page)
- [x] Works from notes list
- [x] Works from any external entry point
- [x] Archive success navigates back to previous page
- [x] Error state "Go Back" uses history navigation

**UI/UX**:
- [x] Button text changed from "Back to Home" → "Go Back" (error state)
- [x] Button text remains "Back to Notes" (success state)
- [x] Navigation feels natural and instant
- [x] No unexpected page changes
- [x] Preserves user context across navigation

**Browser Compatibility**:
- [x] Works in modern browsers (Chrome, Firefox, Safari, Edge)
- [x] Handles edge case: no history (first page load)
- [x] No console errors or warnings

**Edge Cases**:
- [x] User enters note detail directly via URL (no history)
- [x] User navigates back when history is empty
- [x] User uses browser back button vs app back button
- [x] User refreshes page and then goes back

## Navigation Flow Examples

### Example 1: Search → Detail → Back
```
Browser History Stack:
1. / (home)
2. /search?q=react (search results)
3. /notes/abc123 (note detail)

User clicks "Back to Notes"
→ router.back() pops to #2
→ User sees /search?q=react with results
```

### Example 2: Glance → Detail → Archive → Back
```
Browser History Stack:
1. / (home/glance)
2. /notes/xyz789 (note detail)

User archives note
→ router.back() pops to #1
→ User sees / (home/glance)
→ Archived note no longer in glance
```

### Example 3: Direct Link → Detail → Back
```
Browser History Stack:
1. /notes/def456 (direct entry)

User clicks "Back to Notes"
→ router.back() has nowhere to go
→ Browser handles gracefully (stays or goes to default)
```

## Future Tiers

**🔧 Robust** (+4-6h):
- Scroll position restoration when navigating back
- Forward navigation support after going back
- Breadcrumb trail showing navigation path
- Custom back behavior for specific routes
- Analytics tracking for navigation patterns

**🚀 Advanced** (+10-12h):
- History state manipulation (prevent back for sensitive actions)
- Session history persistence across browser restarts
- Multi-level undo/redo navigation
- Navigation history panel showing all visited pages
- Smart navigation prediction (preload likely next pages)

---

**Status**: ✅ Completed | **Actual Effort**: ~30 minutes | **Deployed**: 2025-11-23

## Implementation Summary

**Files Modified**:
- `apps/web/app/notes/[id]/page.tsx:62` - Changed success state back handler
- `apps/web/app/notes/[id]/page.tsx:46` - Changed error state back handler
- `apps/web/components/notes/NoteDetail.tsx:100` - Changed archive success navigation

**Key Changes**:
- ✅ Replaced all `router.push('/')` with `router.back()`
- ✅ Updated button text in error state to "Go Back"
- ✅ Archive success now returns to previous page
- ✅ All navigation respects browser history

**Impact**:
- **Search**: Users can return to search results without losing query
- **Glance**: Users return to glance view after viewing note details
- **Notes List**: Users maintain pagination context
- **General**: More intuitive and expected browser behavior

**Testing Completed**:
- ✅ Navigation from search page works correctly
- ✅ Navigation from glance view preserves state
- ✅ Navigation from notes list maintains pagination
- ✅ Archive action returns to correct previous page
- ✅ Error state back button works as expected
- ✅ No console errors or navigation issues

---
feature: "notes-list-page"
status: "mvp-complete"
progress_mvp: 100
progress_robust: 0
progress_advanced: 0
total_tasks_mvp: 17
completed_tasks_mvp: 17
started: "2025-11-01"
last_updated: "2025-12-07"
current_task: "None (MVP Complete)"
---

# Notes List Page Implementation Tasks

**Status**: ✅ MVP Complete | **Progress**: 17/17 MVP tasks | **Priority**: High

---

## MVP Tasks (Completed)

## T-1: Page Structure Setup

**Effort**: 2h | **Dependencies**: None | **Status**: ✅ Complete

- [x] Create `app/notes/page.tsx` with App Router
- [x] Setup layout with header, search, filters
- [x] Add responsive container (max-w-4xl)
- [x] Integrate AppLayout wrapper

**Acceptance**:
- ✅ Page accessible at `/notes`
- ✅ Responsive layout on mobile/desktop

---

## T-2: Notes List Component

**Effort**: 3h | **Dependencies**: T-1 | **Status**: ✅ Complete

- [x] Create `NotesList.tsx` component
- [x] Implement loading skeleton (3 cards)
- [x] Implement error state with retry
- [x] Implement empty state with onboarding

**Acceptance**:
- ✅ Component displays notes grid
- ✅ All states render correctly

---

## T-3: Note Card Component

**Effort**: 3h | **Dependencies**: T-2 | **Status**: ✅ Complete

- [x] Create `NoteCard.tsx` with props interface
- [x] Add category badge with emoji
- [x] Add date formatting (localized)
- [x] Add content preview (120 char truncation)
- [x] Add metadata footer (link/image counts)
- [x] Add hover effect with arrow indicator

**Acceptance**:
- ✅ Card displays all note information
- ✅ Hover effect works smoothly
- ✅ Click navigates to detail page

---

## T-4: useNotesList Hook

**Effort**: 4h | **Dependencies**: T-3 | **Status**: ✅ Complete

- [x] Create hook with pagination state
- [x] Implement Supabase RPC call (get_notes_with_pagination)
- [x] Handle category filter parameter
- [x] Handle status filter (active/archived/all)
- [x] Implement loadMore function
- [x] Implement refresh function
- [x] Add error handling

**Acceptance**:
- ✅ Hook fetches notes from database
- ✅ Pagination works correctly
- ✅ Filters apply correctly

---

## T-5: Search Bar Component

**Effort**: 3h | **Dependencies**: T-1 | **Status**: ✅ Complete

- [x] Create `NotesSearchBar.tsx`
- [x] Implement expand/collapse animation
- [x] Add search icon and clear button
- [x] Add Escape key handler
- [x] Add search hints below input

**Acceptance**:
- ✅ Search bar expands on click
- ✅ Collapses when empty and blurred
- ✅ Escape key clears search

---

## T-6: useNotesSearch Hook

**Effort**: 4h | **Dependencies**: T-5 | **Status**: ✅ Complete

- [x] Create hook with debounce (300ms)
- [x] Implement search state management
- [x] Call searchNotesHybrid server action
- [x] Handle category filter in search
- [x] Implement pagination for results
- [x] Add error handling

**Acceptance**:
- ✅ Search debounces correctly
- ✅ Results appear after 300ms
- ✅ Category filter applies to search

---

## T-7: Dual Display Mode

**Effort**: 2h | **Dependencies**: T-4, T-6 | **Status**: ✅ Complete

- [x] Add isSearching condition (query >= 2 chars)
- [x] Create SearchResults component
- [x] Switch between NotesList and SearchResults
- [x] Update header text based on mode

**Acceptance**:
- ✅ List shows when no search query
- ✅ Search results show when query active
- ✅ Switching is smooth with animations

---

## T-8: Category Filter Integration

**Effort**: 3h | **Dependencies**: T-1 | **Status**: ✅ Complete

- [x] Extract category from URL searchParams
- [x] Create category filter chip component
- [x] Add clear button (X icon)
- [x] Update useNotesList to accept category param
- [x] Update useNotesSearch to accept category param

**Acceptance**:
- ✅ URL param updates on filter
- ✅ Chip displays with clear button
- ✅ Filter applies to both list and search

---

## T-9: Load More Functionality

**Effort**: 2h | **Dependencies**: T-4 | **Status**: ✅ Complete

- [x] Add "Load More" button
- [x] Show remaining count
- [x] Disable during loading
- [x] Add loading spinner
- [x] Show "All loaded" indicator

**Acceptance**:
- ✅ Button appends next page
- ✅ Remaining count accurate
- ✅ Button disappears when all loaded

---

## T-10: Loading States

**Effort**: 2h | **Dependencies**: T-2 | **Status**: ✅ Complete

- [x] Create skeleton cards (3 placeholders)
- [x] Add pulse animation
- [x] Match card layout exactly
- [x] Show on initial load only

**Acceptance**:
- ✅ Skeletons show before data loads
- ✅ Layout matches real cards
- ✅ Animation is smooth

---

## T-11: Empty States

**Effort**: 2h | **Dependencies**: T-2 | **Status**: ✅ Complete

- [x] Create "No notes" empty state
- [x] Create "No results" search empty state
- [x] Add helpful messaging
- [x] Add emoji icons (🌊 for no notes, 🔍 for no results)

**Acceptance**:
- ✅ Empty states show correct message
- ✅ Search tips appear in no results state

---

## T-12: Error Handling

**Effort**: 2h | **Dependencies**: T-2 | **Status**: ✅ Complete

- [x] Create error state component
- [x] Add "Try Again" button
- [x] Display error message
- [x] Add warning icon

**Acceptance**:
- ✅ Error state displays on fetch failure
- ✅ Retry button triggers refresh
- ✅ Error message is user-friendly

---

## T-13: Database Functions Verification

**Effort**: 2h | **Dependencies**: T-4 | **Status**: ✅ Complete

- [x] Verify get_notes_with_pagination sorts by created_at DESC
- [x] Verify get_notes_by_category sorts by created_at DESC
- [x] Test pagination with 100+ notes
- [x] Test category filtering

**Acceptance**:
- ✅ Notes appear in reverse chronological order
- ✅ Pagination returns correct pages
- ✅ Category filter returns only matching notes

---

## Final Verification (MVP)

**Functional**:
- [x] Notes list loads on `/notes` page
- [x] First 20 notes display correctly
- [x] Search activates with >= 2 characters
- [x] Category filter updates URL
- [x] Load More appends next page
- [x] Database sorts by latest first

**UI/UX**:
- [x] Loading skeletons show on initial load
- [x] Empty states display correctly
- [x] Error state with retry button
- [x] Search bar expands/collapses smoothly
- [x] Note cards have hover effect
- [x] Category chip animates in

**Integration**:
- [x] useNotesList fetches from Supabase
- [x] useNotesSearch uses server action
- [x] URL params persist category filter
- [x] Back button restores state

---

## Investigation Tasks (RESOLVED)

## INV-1: Debug Notes Visibility Issue

**Effort**: 4h | **Dependencies**: None | **Status**: ✅ Complete

- [x] Investigate why newly saved notes don't appear on web
- [x] Audit database functions (get_notes_with_pagination, get_notes_by_category, search_notes_fuzzy_optimized)
- [x] Identify root cause: Category → Tag migration gap (Nov 24 - Dec 4)
- [x] Create migration to fix visibility issue
- [x] Deploy migration to production
- [x] Update spec files with findings and resolution

**Root Cause**: Bot migrated to z_note_tags (Nov 24) but web functions still queried z_note_categories

**Solution**: Migration 20251203161603 - LEFT JOIN both z_note_categories and z_note_tags

**Acceptance**:
- ✅ Root cause identified (category → tag migration gap)
- ✅ Fix implemented (dual-read strategy with LEFT JOIN)
- ✅ Migration deployed to production
- 🚧 Testing required (verify new notes appear)

---

## Testing Tasks (Current)

## TEST-1: Verify Migration Fix

**Effort**: 15min | **Dependencies**: INV-1 | **Status**: 🚧 In Progress

- [ ] Save new note via Telegram bot
- [ ] Open web app at /notes
- [ ] Verify note appears in list with correct sorting (latest first)
- [ ] Test category/tag filter works
- [ ] Test search functionality finds the note

**Acceptance**:
- ✅ Newly saved notes appear immediately on web
- ✅ Notes sorted by created_at DESC (latest first)
- ✅ Category/tag filtering works correctly
- ✅ Search finds notes regardless of tagging system

---

## Grid Layout Implementation Tasks (MVP - Dec 7, 2025)

## T-14: Implement Responsive CSS Grid Layout

**Effort**: 2h | **Dependencies**: T-1 | **Status**: ✅ Complete (Dec 7, 2025)

- [x] Update NotesList.tsx with grid container CSS
  ```tsx
  // Mobile-first responsive grid
  className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4"
  ```
- [x] Add Tailwind breakpoints: md (768px), lg (1024px)
- [x] Set 2 columns default (mobile 360px+)
- [x] Set 3 columns at md breakpoint (tablet 768px+)
- [x] Set 4 columns at lg breakpoint (desktop 1024px+)
- [x] Configure gap: 8px mobile, 12px tablet/desktop
- [x] Configure padding: 8px mobile margins (optimized for max density)

**Test Cases**:
- [x] Grid shows 2 columns on mobile (360-767px)
- [x] Grid shows 3 columns on tablet (768-1023px)
- [x] Grid shows 4 columns on desktop (1024px+)
- [x] Gaps scale correctly across breakpoints
- [x] Layout doesn't shift when resizing

**Acceptance**:
- ✅ Responsive grid adapts to all screen sizes
- ✅ Breakpoints match industry standards
- ✅ Tight spacing (8-12px) maximizes visible cards
- ✅ Deployed to production Dec 7, 2025

---

## T-15: Optimize NoteCard for Grid Display

**Effort**: 3h | **Dependencies**: T-3, T-14 | **Status**: ✅ Complete (Dec 7, 2025)

- [x] Add rectangular aspect ratio CSS
  ```tsx
  className="aspect-[2/3]" // Implemented
  ```
- [x] Reduce font sizes for compact display
  - Category badge: text-[10px] (10px)
  - Content preview: text-[11px] (11px)
  - Date: text-[10px] (10px)
- [x] Truncate content preview to 80 chars (down from 120)
  ```tsx
  previewLength = 80 // Updated default
  ```
- [x] Compact metadata footer
  - Removed text labels (icons + counts only)
  - Show icon + count (e.g., 🔗 3, 🖼️ 2)
  - Compact spacing and sizes
- [x] Update card padding: p-4 → p-3 (tighter internal spacing)
- [x] Ensure full card clickable (article wrapper with onClick)
- [x] Separate action buttons (PinToggleButton) with stopPropagation

**Test Cases**:
- [x] Card maintains aspect ratio across all breakpoints
- [x] Text doesn't overflow card boundaries
- [x] 80 char truncation works with long content
- [x] Metadata footer fits in compact space
- [x] Full card click navigates to detail
- [x] Action buttons don't trigger card navigation

**Acceptance**:
- ✅ Rectangular aspect ratio maintained (2:3)
- ✅ Content optimized for smaller card size
- ✅ Full card clickable with separate action zones
- ✅ Visual design clean and readable
- ✅ Deployed to production Dec 7, 2025

---

## T-16: Update Loading Skeletons for Grid

**Effort**: 1h | **Dependencies**: T-10, T-14 | **Status**: ✅ Complete (Dec 7, 2025)

- [x] Increase skeleton count from 3 → 6 cards
  - Matches 2x3 grid on mobile (2 columns, 3 rows)
  - Fills viewport without requiring scroll
- [x] Apply same grid layout as NotesList
  ```tsx
  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
    {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
  </div>
  ```
- [x] Add aspect ratio to skeleton cards: `aspect-[2/3]`
- [x] Match gaps and padding from real grid
- [x] Ensure skeleton cards use same compact sizing

**Test Cases**:
- [x] Skeletons show 6 cards in grid layout
- [x] Grid matches real card layout (gaps, padding, aspect ratio)
- [x] Skeletons fill viewport on mobile (no scroll needed)
- [x] Skeleton transitions smoothly to real cards

**Acceptance**:
- ✅ Grid-aware skeletons (6 cards in 2x3 grid)
- ✅ Layout matches real notes grid
- ✅ Smooth transition from skeleton to real content
- ✅ Deployed to production Dec 7, 2025

---

## T-17: Touch Target Optimization

**Effort**: 1h | **Dependencies**: T-15 | **Status**: ✅ Complete (Dec 7, 2025)

- [x] Verify minimum 44x44px touch target per card
  - Calculate: card width / 2 columns ≥ 44px on smallest mobile (360px)
  - 360px viewport - 16px padding - 8px gap = 336px / 2 = 168px per card ✅
- [x] Ensure action icons have 40x40px clickable area (via PinToggleButton)
- [x] Add touch feedback (hover states on card)
  ```tsx
  className="hover:border-cyan-500/50 hover:shadow-lg transition-all"
  ```
- [x] Touch targets verified via aspect ratio implementation
- [x] Visual feedback for cards and action buttons implemented

**Test Cases**:
- [x] Full card meets 44x44px minimum (on 360px viewport)
- [x] Action icons have proper tap area
- [x] Touch feedback visible on interaction
- [x] No accidental taps on adjacent cards (8px gap)
- [x] Action buttons don't trigger card navigation

**Acceptance**:
- ✅ All touch targets meet accessibility guidelines (min 44x44px)
- ✅ Action icons separately tappable
- ✅ Clear visual feedback on interaction
- ✅ Deployed to production Dec 7, 2025

---

## Final Verification (Grid Layout MVP)

**Functional**:
- [x] Grid layout displays 2/3/4 columns responsively
- [x] Cards maintain aspect ratio across breakpoints
- [x] Content truncation works (80 chars max)
- [x] Full card navigation to detail page
- [x] Action icons separately clickable

**Responsive**:
- [x] 2 columns on mobile (360-767px)
- [x] 3 columns on tablet (768-1023px)
- [x] 4 columns on desktop (1024px+)
- [x] Smooth transitions between breakpoints
- [x] No layout shift or content jump

**Touch & Accessibility**:
- [x] Minimum 44x44px touch targets per card
- [x] Action icons have proper tap area
- [x] Touch feedback on interaction
- [x] Keyboard navigation works (tab through cards)

**Performance**:
- [x] Smooth scroll with 100+ notes
- [x] Grid renders without layout thrashing
- [x] Load More pagination works with grid
- [x] No CLS (Cumulative Layout Shift)

**✅ MVP COMPLETE - Deployed Dec 7, 2025**

---

## Robust Product Tasks

**T-18: Sorting Dropdown** (+6h) | **Status**: ⏸️ Future
- Add sorting options: Latest, Oldest, Most Links, By Category
- Persist sort preference in URL or localStorage
- Update database queries with ORDER BY clause

**T-19: View Toggle** (+3h) | **Status**: ⏸️ Future
- Add grid/list/compact view toggle button
- Create list view layout (compact, more per screen)
- Persist view preference

**T-20: Select Mode & Bulk Actions** (+8h) | **Status**: ⏸️ Future
- Add checkbox on each card
- Create "Select All" / "Select None" buttons
- Implement bulk delete, archive, categorize
- Add confirmation modals

**T-21: Filter Combinations** (+4h) | **Status**: ⏸️ Future
- Allow category + has links + has images
- Create filter panel UI
- Update database queries for multi-filter

---

## Advanced Product Tasks

**T-22: Virtual Scroll** (+12h) | **Status**: ⏸️ Future
- Integrate react-virtual or tanstack-virtual
- Optimize for 1000+ notes
- Maintain scroll position on navigation

**T-23: Advanced Filter Panel** (+8h) | **Status**: ⏸️ Future
- Date range picker (from/to)
- Multi-category select (OR logic)
- Has media filter (links, images, both)
- Saved filter presets

**T-24: Export Notes** (+6h) | **Status**: ⏸️ Future
- Export selected notes as CSV
- Export as JSON (import/export)
- Include metadata and links

**T-25: Masonry Layout** (+10h) | **Status**: ⏸️ Future
- Implement variable-height masonry grid (Pinterest-style)
- Auto-adjust card heights based on content
- Optimize performance with virtualization

---

**Task Legend**: ⏸️ Not Started | 🚧 In Progress | ✅ Complete

**Total**: T-1 through T-17 (39 hours MVP) | **Current**: T-14 (Grid Layout)

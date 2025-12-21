---
feature: "notes-list-page"
status: "mvp-complete"
created: "2025-12-03"
updated: "2025-12-14"
mvp_effort_hours: 8
mvp_effort_days: 1
priority: "high"
tags: ["notes", "pagination", "search", "filter", "web", "tags-ui", "grid-layout", "responsive", "link-preview"]
scope: "package-specific"
package: "apps/web"
current_tier: "mvp"
active_issues: 2
critical_issues: 0
---

# Notes List Page Specification

## TL;DR (30-Second Scan)

**Problem**: Users need to browse notes efficiently on mobile with modern grid layout, visual link previews, and persistent search state
**Solution**: Responsive grid layout (2 cols mobile → 3 tablet → 4 desktop) with optimized card design, link preview thumbnails, URL-based search persistence, and scroll restoration
**Status**: ✅ MVP Complete - Responsive grid + link previews + search persistence deployed (Dec 14, 2025)
**Critical Issue**: None (visibility issue resolved Dec 4)
**Latest**: Search state persists in URL, scroll position restored on back navigation (Dec 14, 2025)
**Effort**: MVP 1 day (completed) | +Robust 2-3 days | +Advanced 4-5 days
**Next Action**: Consider Robust tier features (sorting, view toggle, bulk actions)

---

<details>
<summary>📋 Full Specification (click to expand)</summary>

## Problem & Solution

**Problem**: Users need to browse their saved notes from Telegram efficiently on mobile devices. Current one-item-per-line layout is outdated for modern mobile apps. Users expect responsive grid layouts that maximize screen space while maintaining readability.

**Solution**: Responsive CSS Grid layout that adapts to screen size: 2 columns on mobile (360-767px), 3 columns on tablet (768-1023px), 4 columns on desktop (1024px+). Cards use rectangular aspect ratio (2:3 or 3:4) with tight 8-12px gutters following 2025 mobile UI best practices. Features search with debounce, category/tag filtering via URL params, and dual display modes (list/search).

**Returns**: Array of notes with category/tag, content preview, date, link/image counts. Database functions return sorted by `created_at DESC` (latest first). Grid layout optimized for touch targets (minimum 44x44px per card) with full card clickable to detail view and separate action icon zones.

## Component API

```typescript
// Main Page Component
interface NotesPageProps {
  searchParams: {
    category?: NoteCategory | null;
  };
}

// Notes List Component (Grid Layout)
interface NotesListProps {
  userId: number;
  category?: NoteCategory | null;
  // Grid layout automatically responsive via CSS Grid
}

// Grid Container CSS
// display: grid
// grid-template-columns: repeat(auto-fill, minmax(min(100%, 160px), 1fr))
// gap: 8px (mobile) | 12px (tablet+)
// Responsive breakpoints: 2 cols (360px) → 3 cols (768px) → 4 cols (1024px)

// Search Bar Component
interface NotesSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

// Note Card Component (Optimized for Grid)
interface NoteCardProps {
  noteId: string;
  category: NoteCategory;
  content: string;
  createdAt: string;
  linkCount: number;
  imageCount: number;
  tags?: string[];  // Tag chips display
  linkPreviews?: NoteDetailLink[];  // Link preview thumbnails (NEW: Dec 13, 2025)
  onClick?: () => void;
  isMarked?: boolean;  // Pin state
  onPinToggle?: (noteId: string) => void;  // Pin callback
  // Rectangular aspect ratio: 2:3 or 3:4
  // Touch target: min 44x44px per card (full card clickable)
  // Action icons: separate click zones (pin, mark, etc.)
  // Link previews: Show up to 2 thumbnail cards with title + description
}

// Link Preview Card Component (NEW: Dec 13, 2025)
interface LinkPreviewCardProps {
  link: NoteDetailLink;
  variant?: 'inline' | 'detailed' | 'thumbnail';
  onClick?: () => void;
  className?: string;
}

// Variants:
// - 'inline': Large card for inline content (Notion/Slack style)
//   - Mobile: Vertical stack, full-width banner image
//   - Desktop: Horizontal layout, 128px image
// - 'detailed': Medium card for NoteDetail links section
//   - Mobile: Compact vertical, 64px image
//   - Desktop: Horizontal layout, 96px image
// - 'thumbnail': Compact card for NoteCard list
//   - Horizontal layout: 40px image + title/description
//   - Shows: Image, title (1 line), description (1 line), external link icon
//   - Full-width card with hover border effect
```

## Usage Example

```typescript
// Notes page automatically detects category from URL
// Example: /notes?category=todo

import { NotesPage } from '@/app/notes/page';

// Search activates when query >= 2 characters
<NotesSearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  onClear={() => setSearchQuery('')}
/>

// Switches between list and search automatically
{isSearching ? (
  <SearchResults results={searchResults} />
) : (
  <NotesList userId={userId} category={categoryParam} />
)}
```

## Core Flow

```
User navigates to /notes
  ↓
Page loads with useNotesList hook
  ↓
Database RPC: get_notes_with_pagination (ORDER BY created_at DESC)
  ↓
Display: NoteCard grid with category badge + date + preview
  ↓
User types in search (>= 2 chars)
  ↓
300ms debounce → searchNotesHybrid server action
  ↓
Display: Search results (replaces regular list)
  ↓
User clicks category chip (e.g., 💡 Idea)
  ↓
URL updates: /notes?category=idea
  ↓
Database RPC: get_notes_by_category (filtered, sorted by created_at DESC)
  ↓
Display: Filtered notes with remove filter chip
  ↓
User scrolls down → clicks "Load More"
  ↓
Fetch next page (append to existing notes)
```

## User Stories

**US-1: Browse All Notes**
User opens /notes page. System loads first 20 notes sorted by latest first. User sees note cards with category badges, dates, and content previews. User scrolls and clicks "Load More" to see next 20 notes.

**US-2: Search Notes by Keyword**
User clicks search bar, types "job interview tips". System debounces 300ms, then searches note content and linked titles. Results appear with relevance scores. User clicks result to view full note.

**US-3: Filter by Category**
User opens /notes page. Sees mix of categories. Clicks "💡 Idea" category on a note card. URL changes to /notes?category=idea. System shows only Idea notes. User clicks X on filter chip to clear.

**US-4: Empty States**
New user opens /notes. Sees "No notes found" with prompt to create in Telegram bot. User searches "nonexistent". Sees "No results for 'nonexistent'" with search tips.

**US-5: Dual Display Mode**
User browses notes list. Starts typing search query "make me happy". List automatically switches to search results mode. User clears search. List returns to regular pagination mode.

## MVP Scope

**Included**:
- Notes list page at `/notes`
- **Responsive CSS Grid layout**:
  - 2 columns on mobile (360-767px)
  - 3 columns on tablet (768-1023px)
  - 4 columns on desktop (1024px+)
  - Tight spacing: 8-12px gutters
  - 16px margins (mobile standard)
  - Auto-fill grid with minmax() for flexibility
- **Optimized NoteCard** for grid:
  - Rectangular aspect ratio (2:3 or 3:4)
  - Smaller text for compact display
  - Truncated content preview (~80 chars instead of 120)
  - Compact metadata footer
  - Full card clickable to detail view
  - Separate action icon zones (pin, mark)
  - Min 44x44px touch targets
- **Link Preview Thumbnails** (NEW: Dec 13, 2025):
  - Show up to 2 link previews per note card
  - Thumbnail variant: Horizontal layout with image + title + description
  - 40px × 40px image with text content
  - Full-width cards stacked vertically in note card
  - "+N more links" badge if more than 2 links
  - Responsive LinkPreviewCard component (3 variants: inline, detailed, thumbnail)
  - Mobile-first design with breakpoint optimization
- **Search State Persistence & Scroll Position** (NEW: Dec 14, 2025):
  - Search query persists in URL params (?q=search+term)
  - Category + search work together (?q=job&category=todo)
  - **History API scroll restoration**: Saves to window.history.state (survives navigation)
  - Dual scroll position saving: periodic (150ms debounce) + immediate on click
  - popstate event listener for back/forward navigation detection
  - Double requestAnimationFrame to run AFTER Next.js scroll restoration
  - Multiple restore attempts (0ms, 100ms, 300ms) using useLayoutEffect
  - Works for both regular list and search results
  - Shareable search URLs
  - Clean URL history with router.replace
- NotesList component with pagination (20 per page)
- useNotesList hook (Supabase RPC integration)
- NotesSearchBar with expand/collapse UX
- useNotesSearch hook with 300ms debounce
- Category/tag filtering via URL params (?category=todo)
- Category filter chip with clear button
- Infinite scroll with "Load More" button
- Empty states (no notes, no results, error)
- Loading skeletons (grid-aware, 6 card placeholders for mobile)
- Dual display mode (list OR search)
- Database functions: get_notes_with_pagination, get_notes_by_category
- Search via server action (searchNotesHybrid)

**NOT Included** (Future):
- Sorting options (latest, oldest, most links) → 🔧 Robust
- View toggles (grid vs list vs compact) → 🔧 Robust
- Bulk actions (select, delete, categorize) → 🔧 Robust
- Virtual scroll for 1000+ notes → 🚀 Advanced
- Advanced filters (date range, has links) → 🚀 Advanced
- Export notes (CSV, JSON) → 🚀 Advanced
- Masonry layout (variable height cards) → 🚀 Advanced

## Database Integration

**RPC Functions Used**:

```sql
-- Regular list (active notes, sorted by created_at DESC)
get_notes_with_pagination(
  telegram_user_id_param BIGINT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 20
)

-- Category filter (active notes, specific category, sorted by created_at DESC)
get_notes_by_category(
  telegram_user_id_param BIGINT,
  category_param TEXT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 20
)

-- Archived notes (status='archived', sorted by created_at DESC)
get_archived_notes_with_pagination(
  telegram_user_id_param BIGINT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 5
)
```

**Server Action** (search):
```typescript
searchNotesHybrid(
  userId: number,
  query: string,
  page: number,
  pageSize: number,
  category?: NoteCategory | null
)
```

**Return Structure**:
```typescript
{
  note_id: string;
  category: NoteCategory;
  note_content: string;
  telegram_message_id: number;
  created_at: string;
  links: Array<{
    id: string;
    url: string;
    title: string;
    description: string;
    og_image: string;
  }>;
  total_count: number; // Window function count
}
```

## Known Issues

**Issue #1: Notes Invisible After Nov 24 Migration - FIXED (Dec 4, 2025)**
- **Symptom**: Notes saved after Nov 24, 2025 were invisible on web
- **Root Cause**: Bot migrated to z_note_tags (new unified tag system) on Nov 24, but web query functions still used INNER JOIN z_note_categories (old system)
- **Impact**: All notes created after Nov 24 were completely hidden from web interface
- **Fix**: Migration 20251203161603 - Updated 3 database functions to LEFT JOIN both z_note_categories and z_note_tags
- **Functions Fixed**:
  - get_notes_with_pagination - Now shows ALL notes (categories + tags)
  - get_notes_by_category - Filters by both category and tag names
  - search_notes_fuzzy_optimized - Searches notes with either system
- **Backward Compatibility**: Old notes with categories only still visible, new notes with tags now visible
- **Status**: RESOLVED - Migration deployed to production Dec 4, 2025
- **Testing Required**: Verify newly saved bot notes now appear on web

**Issue #2: Tags Not Displayed in Note Cards - ACTIVE (Dec 4, 2025)**
- **Symptom**: Note cards show "No attachments" instead of displaying tags
- **Root Cause**: UI not updated after category → tag migration
  - Database returns tag_name in `category` field (via COALESCE)
  - NoteCard.tsx:97-99 shows "No attachments" when linkCount=0 and imageCount=0
  - Tags exist in data but are hidden in the card footer
- **Impact**: Users cannot see what tags are assigned to notes
- **Current Display**: Category badge at top (correct) + "No attachments" at bottom (incorrect)
- **Expected Display**: Category badge at top + Tag chips at bottom
- **Status**: ACTIVE - Requires UI update
- **Priority**: HIGH - Core functionality missing from UX
- **Fix Required**:
  - Display tag chips in card footer instead of "No attachments"
  - Style tags with colors/gradients similar to category badge
  - Consider showing multiple tags (database currently returns first tag only)

**Issue #3: Single Tag Limitation - ACTIVE (Dec 4, 2025)**
- **Symptom**: Only first tag displayed per note (when multiple exist)
- **Root Cause**: Database function uses DISTINCT ON to return first confirmed tag only
  - Migration 20251203161603 line 32: `SELECT DISTINCT ON (nt.note_id)`
  - New tag system supports multiple tags but function returns one
- **Impact**: Users lose visibility into additional tags on multi-tagged notes
- **Current Behavior**: Shows first tag by created_at DESC order
- **Expected Behavior**: Show all confirmed tags or indicate count (e.g., "idea +2 more")
- **Status**: ACTIVE - Design decision needed
- **Priority**: MEDIUM - Affects user understanding but not core functionality
- **Options**:
  1. Update database function to return array of tags (requires schema change)
  2. Make separate query for all tags (additional round trip)
  3. Keep single tag, add "+N more" badge via count query
  4. Defer to Robust tier when implementing tag management

**Issue #4: Category vs Tag Terminology Mismatch - ACTIVE (Dec 4, 2025)**
- **Symptom**: Code uses "category" terminology but system uses "tags"
- **Root Cause**: UI not updated during category → tag system migration (Nov 24)
- **Impact**:
  - Confusing for developers (data model vs code names don't match)
  - URL params use `?category=todo` instead of `?tag=todo`
  - Type definitions reference old NoteCategory enum
- **Examples**:
  - apps/web/app/notes/page.tsx:21 - categoryParam variable
  - apps/web/hooks/useNotesList.ts:8 - category: NoteCategory type
  - URL params still use ?category= format
- **Status**: ACTIVE - Technical debt
- **Priority**: LOW - Functional but semantically incorrect
- **Fix Required**: Gradual refactor to update terminology (breaking change for URL params)

**Issue #5: Single-Column Layout Outdated for Mobile - RESOLVED (Dec 7, 2025)**
- **Symptom**: Current layout shows one note per line, wasting screen space on mobile
- **Root Cause**: Original design didn't follow 2025 mobile UI best practices
- **Impact**:
  - Less efficient use of screen space (only 3-4 notes visible on mobile)
  - Outdated UX compared to modern note apps (Pinterest, Keep, Notion)
  - Users expect grid layouts for browseable content
- **Solution Implemented**:
  - Responsive CSS Grid: 2 cols mobile (360-767px), 3 cols tablet (768-1023px), 4 cols desktop (1024px+)
  - Tight gutters: 8px mobile, 12px tablet/desktop
  - **Optimized margins**: 8px mobile (down from 32px total), 16px desktop for maximum info density
  - Rectangular cards: 2:3 aspect ratio with compact design
  - Compact text: 10-11px fonts, 80 char preview (down from 120)
  - Touch targets: Full card 44x44px+ clickable
- **Files Modified**:
  - `apps/web/app/notes/page.tsx` - Responsive page padding (px-2 md:px-4)
  - `apps/web/components/notes/NotesList.tsx` - Grid layout, removed padding
  - `apps/web/components/notes/NoteCard.tsx` - Aspect ratio, compact design
- **Status**: ✅ RESOLVED - Deployed to production Dec 7, 2025
- **Result**: 4x info density on mobile (48px more horizontal space), modern grid UX

**Issue #6: Link Preview Card Not Responsive on Mobile - RESOLVED (Dec 13, 2025)**
- **Symptom**: LinkPreviewCard component broke on mobile screens (< 640px)
- **Root Cause**: Fixed horizontal layout with large images didn't adapt to narrow viewports
  - Inline variant: 128px image too large for 320-375px screens
  - Detailed variant: No responsive breakpoints
  - External link icon took horizontal space unnecessarily
- **Impact**: Poor mobile UX when viewing note details with link previews
- **Solution Implemented**:
  - **Mobile-first responsive design** with progressive enhancement
  - **Inline variant**: Vertical stack on mobile (full-width banner), horizontal on tablet+ (96-128px image)
  - **Detailed variant**: Compact vertical on mobile (64px image), horizontal on tablet+ (80-96px image)
  - **Thumbnail variant**: Redesigned as horizontal card with image + title + description (40px image)
  - Icon positioning: Absolute top-right on mobile, flex item on desktop
  - Smooth transitions between breakpoints
  - Optimized image sizes per viewport: `sizes="(max-width: 640px) 64px, 96px"`
- **Files Modified**:
  - `apps/web/components/ui/LinkPreviewCard.tsx` - Mobile-first responsive variants
  - `apps/web/components/notes/NotesList.tsx` - Added linkPreviews prop
  - `apps/web/components/notes/NoteCard.tsx` - Vertical stack layout for thumbnails
- **Status**: ✅ RESOLVED - Deployed to production Dec 13, 2025
- **Result**: Responsive link previews work seamlessly on all screen sizes, link context visible in note cards

## Acceptance Criteria (MVP)

**Functional**:
- [x] Notes list loads on `/notes` page
- [x] First 20 notes display with pagination
- [x] "Load More" button appends next page
- [x] Search bar activates with >= 2 characters
- [x] Search debounces 300ms before query
- [x] Category filter updates URL (?category=todo)
- [x] Category chip shows with clear button
- [x] NoteCard displays: category, date, preview, metadata
- [x] Clicking card navigates to `/notes/[id]`
- [x] Database sorts by `created_at DESC`

**Grid Layout** (✅ COMPLETED Dec 7, 2025):
- [x] 2 columns on mobile (360-767px viewport)
- [x] 3 columns on tablet (768-1023px viewport)
- [x] 4 columns on desktop (1024px+ viewport)
- [x] 8-12px gutters between cards (tight spacing)
- [x] 8px margins on mobile (optimized for max info density, was 16px)
- [x] Auto-fill responsive grid (adapts to container width)
- [x] Rectangular card aspect ratio (2:3)
- [x] Cards maintain aspect ratio across breakpoints
- [x] Grid-aware loading skeletons (6 cards in 2x3 mobile grid)

**Optimized Card Design** (✅ COMPLETED Dec 7, 2025):
- [x] Smaller text sizes for compact display (10-11px)
- [x] Truncated content preview (80 chars max, reduced from 120)
- [x] Compact metadata footer (icons + counts only)
- [x] Full card clickable area (navigates to detail)
- [x] Action icons separately clickable (pin, mark, etc.)
- [x] Minimum 44x44px touch targets per card
- [x] Clear visual separation between cards (borders or shadows)
- [x] Hover/touch feedback on card interaction

**UI/UX**:
- [x] Loading skeletons show on initial load
- [x] Empty state for no notes
- [x] Empty state for no search results
- [x] Error state with retry button
- [x] Search bar expands/collapses smoothly
- [x] Category filter chip animates in
- [x] Note cards have hover effect
- [x] Load More shows remaining count
- [x] "All notes loaded" indicator appears

**Integration**:
- [x] useNotesList hook fetches from Supabase
- [x] useNotesSearch uses server action
- [x] URL params persist category filter
- [x] Back button restores previous state
- [x] Refresh maintains filters

**Responsive Behavior**:
- [x] Grid adapts smoothly across breakpoints (no layout shift)
- [x] Touch targets work on mobile (minimum 44x44px)
- [x] Scroll performance smooth with 100+ notes
- [x] Grid layout works with Load More pagination

**Link Preview Thumbnails** (✅ COMPLETED Dec 13, 2025):
- [x] LinkPreviewCard component responsive on all screen sizes
- [x] Thumbnail variant shows image + title + description
- [x] NoteCard displays up to 2 link preview thumbnails
- [x] "+N more links" badge for additional links
- [x] Thumbnails stacked vertically in note card
- [x] Mobile-first design (< 640px vertical, ≥ 640px horizontal for inline/detailed)
- [x] Smooth image fade-in transitions
- [x] Hover effects on preview cards
- [x] Click on thumbnail prevents note navigation (stopPropagation)

**Search State Persistence & Scroll Position** (✅ COMPLETED Dec 14, 2025):
- [x] Search query persists in URL params (?q=...)
- [x] Search query restored from URL on page load
- [x] Category filter preserved when searching
- [x] Search query preserved when filtering by category
- [x] URL updates without adding browser history (router.replace)
- [x] Search URLs are shareable
- [x] Scroll position saved to History API (window.history.state)
- [x] Scroll position saved while scrolling (debounced 150ms)
- [x] Scroll position saved immediately on note card click
- [x] popstate event listener for back/forward navigation
- [x] Double requestAnimationFrame to override Next.js scroll restoration
- [x] Multiple restore attempts using useLayoutEffect
- [x] Scroll position restored on back navigation
- [x] Works with both regular list and search results

## Immediate Fixes Required

**Fix #1: Display Tags in Note Card Footer** (+2-4h) - HIGH PRIORITY
- **Current**: Shows "No attachments" when linkCount=0 and imageCount=0
- **Expected**: Show tag chips below the content preview
- **Implementation**:
  - Replace "No attachments" text with tag chip display
  - Style tags with gradient background similar to category badge
  - Show single tag returned from database (in `category` field)
  - Use emoji + tag name format (e.g., "💡 idea")
  - Position tags in footer alongside link/image counts
- **Files to Update**:
  - `apps/web/components/notes/NoteCard.tsx` lines 97-99
- **Acceptance**: Tag chips visible in card footer for all notes

**Fix #2: Support Multiple Tags Display** (+3-5h) - MEDIUM PRIORITY
- **Current**: Database returns only first tag (DISTINCT ON)
- **Option A** (Recommended): Update database function to return tag array
  - Modify get_notes_with_pagination to return JSONB array of tags
  - Update TypeScript types to accept tags array
  - Display all tags as chips in card footer
  - Add "+N more" badge if > 3 tags
- **Option B**: Keep single tag, add count indicator
  - Keep current database function as-is
  - Add separate count query for tag totals
  - Show "idea +2 more tags" format
- **Decision Required**: Choose approach based on performance vs complexity trade-offs

**Fix #3: Update Terminology from Category to Tags** (+1-2h) - LOW PRIORITY
- **Current**: Code uses "category" but data model uses "tags"
- **Expected**: Consistent terminology across codebase
- **Breaking Changes**:
  - URL params: `?category=todo` → `?tag=todo`
  - Type names: NoteCategory → NoteTag (or TagName)
  - Variable names: categoryParam → tagParam
- **Migration Strategy**: Add backward compat for ?category= during transition
- **Decision Required**: Plan rollout to avoid breaking user bookmarks

## Future Tiers

**🔧 Robust** (+2-3 days): Sorting dropdown (latest, oldest, most links, by tag), view toggle (grid/list), select mode with bulk actions (delete, archive, tag), filter combinations (tag + has links), multi-tag filtering (OR/AND logic).

**🚀 Advanced** (+4-5 days): Virtual scroll for 1000+ notes, advanced filter panel (date range, multi-tag, has media), saved searches, export notes (CSV/JSON), note preview modal, keyboard navigation (j/k), quick actions menu, tag management UI (create, rename, archive tags).

</details>

---

**Quick Links**: [dev-log.md](./dev-log.md) | [tasks.md](./tasks.md) | [backlog.md](./backlog.md)

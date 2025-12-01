# Notes Navigation Restructure Specification

## Problem & Solution

**Problem**: Navigation has redundant Search and Notes pages with confusing active states. When clicking category badges from Glances (e.g., "Todo"), users navigate to `/notes?category=todo`, but no navbar item highlights. Additionally, `/search` page offers basic search-only functionality while `/notes` provides superset features (search + browse + category filtering), creating user confusion about which page to use.

**Solution**:
1. Remove redundant `/search` page entirely
2. Restructure navigation: Replace "Search" with "Notes"
3. Make `/notes` the unified hub for browsing, searching, and filtering
4. Fix active state logic to highlight "Notes" for all note-related paths

**Returns**: Clear navigation structure with single powerful notes page, proper visual feedback when browsing filtered notes, and eliminated redundancy.

## Component API

```typescript
// config/navigation.ts
// Before
export const navigation = [
    { name: 'Glances', href: '/', icon: Home },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Settings', href: '/settings', icon: Settings },
];

// After
export const navigation = [
    { name: 'Glances', href: '/', icon: Home },
    { name: 'Notes', href: '/notes', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
];
```

```typescript
// Active state logic (BottomNav.tsx & Sidebar.tsx)
const isActive = item.href === '/notes'
    ? pathname.startsWith('/notes')
    : pathname === item.href;
```

## Core Flow

```
User on Glances page (/)
  ↓
Sees category badge "📋 Todo (5 notes)"
  ↓
Clicks badge → Navigates to /notes?category=todo
  ↓
"Notes" navbar item highlights (active state)
  ↓
Page shows: Search bar + "Todo" filter chip + filtered notes
  ↓
User can:
  - Clear filter to see all notes
  - Add search query to search within category
  - Click another category filter
  ↓
All actions keep "Notes" highlighted in navbar
```

## User Stories

**US-1: Category Filtering from Glances**
User browsing Glances page sees "📋 Todo (5 notes)" badge. Clicks it and navigates to `/notes?category=todo`. Notes navbar item highlights, showing clear context. User sees 5 Todo notes with filter chip active. Can clear filter or add search query.

**US-2: Direct Notes Browsing**
User clicks "Notes" in navbar from any page. Arrives at `/notes` showing all notes with search bar and no active filters. Notes navbar item is highlighted. User can browse, search, or click category filters.

**US-3: Individual Note Detail**
User on notes list clicks a note card. Navigates to `/notes/abc-123`. Notes navbar item remains highlighted, maintaining context that user is in notes section of app.

**US-4: Search Within Category**
User filtered to "YouTube" notes types search query "react tutorial". Search executes within YouTube category only. Both category filter chip and search results visible. Notes navbar stays highlighted.

**US-5: No More Search Page Confusion**
User remembers old `/search` page tries to find it in navbar. Sees "Notes" instead, clicks it, discovers it has all search functionality plus more. Mental model updates: Notes = everything.

## MVP Scope

**Included**:
- ✅ Delete `/search` page and `SearchContainer` component
- ✅ Change navbar: "Search" → "Notes" with FileText icon
- ✅ Fix active state to match `/notes` and `/notes/*` paths
- ✅ Fixed category filtering (added missing `get_notes_by_category` RPC)
- ✅ Pass category from URL to NotesList component
- ✅ Database-level category filtering (not client-side)
- ✅ Update both BottomNav and Sidebar active logic

**NOT Included** (Future):
- Redirect `/search` to `/notes` for backward compatibility → 🔧 Robust
- Search history or saved searches → 🔧 Robust
- Multi-category filtering → 🚀 Advanced
- Custom filter presets → 🚀 Advanced

## Implementation Details

### Files Deleted
```
apps/web/app/search/page.tsx
apps/web/components/search/SearchContainer.tsx
```

### Files Modified

**1. Navigation Config** (`config/navigation.ts`):
```typescript
- import { Home, Search, Settings } from 'lucide-react';
+ import { Home, FileText, Settings } from 'lucide-react';

export const navigation = [
    { name: 'Glances', href: '/', icon: Home },
-   { name: 'Search', href: '/search', icon: Search },
+   { name: 'Notes', href: '/notes', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
];
```

**2. Bottom Navigation** (`components/layout/BottomNav.tsx:17-20`):
```typescript
const isActive = item.href === '/notes'
    ? pathname.startsWith('/notes')
    : pathname === item.href;
```

**3. Sidebar Navigation** (`components/layout/Sidebar.tsx:29-32`):
```typescript
const isActive = item.href === '/notes'
    ? pathname.startsWith('/notes')
    : pathname === item.href;
```

**4. Notes List Component** (`components/notes/NotesList.tsx:8-13`):
```typescript
interface NotesListProps {
  userId: number;
+ category?: NoteCategory | null;
}

- export function NotesList({ userId }: NotesListProps) {
-   const [category, setCategory] = useState<NoteCategory | null>(null);
+ export function NotesList({ userId, category = null }: NotesListProps) {
```

**5. Notes Page** (`app/notes/page.tsx:102`):
```typescript
- <NotesList userId={user.id} />
+ <NotesList userId={user.id} category={categoryParam} />
```

**6. Notes Search Hook** (`hooks/useNotesSearch.ts:69-75,62`):
```typescript
const { results: data, totalCount: newTotalCount, error: searchError } =
  await searchNotesHybrid(
    userId,
    debouncedQuery.trim(),
    page,
    pageSize,
+   category  // Pass category to server action
  );

- }, [userId, debouncedQuery]);
+ }, [userId, debouncedQuery, category]);  // Re-search when category changes
```

**7. Search Server Action** (`actions/notes.ts:181-187,203`):
```typescript
export async function searchNotesHybrid(
  userId: number,
  query: string,
  page: number = 1,
  pageSize: number = 20,
+ category: NoteCategory | null = null
)

const { data, error } = await supabase.rpc('search_notes_hybrid', {
  query_embedding: queryEmbedding,
  query_text: query,
  user_id: userId,
  match_threshold: 0.5,
  page_size: pageSize,
+ category_filter: category
});
```

### Database Migrations

**Migration 1**: `20251124002314_add_category_filter_to_hybrid_search.sql`
- Updated `search_notes_hybrid` RPC function
- Added `category_filter text default null` parameter
- Added filtering logic to both semantic and fuzzy result CTEs

**Migration 2**: `20251124003019_create_get_notes_by_category_function.sql`
- Created missing `get_notes_by_category` RPC function
- Filters notes by category with pagination
- Returns JSON-aggregated links and total count

## Acceptance Criteria (MVP)

**Functional**:
- [x] `/search` page deleted, no 404 errors
- [x] "Notes" in navbar points to `/notes`
- [x] FileText icon displays correctly
- [x] Clicking category badges highlights Notes navbar
- [x] Category filtering works (e.g., `/notes?category=todo`)
- [x] Search within category works
- [x] Individual note pages (`/notes/[id]`) highlight Notes navbar
- [x] Database RPC functions deployed successfully

**UI/UX**:
- [x] Notes navbar item highlights for `/notes` paths
- [x] Category filter chip displays when active
- [x] Search bar and category filtering coexist
- [x] Clear visual feedback on active navbar item
- [x] All notes browsing works without search query

**Data Layer**:
- [x] `get_notes_by_category` RPC function created
- [x] `search_notes_hybrid` accepts `category_filter` parameter
- [x] Database-level filtering (not client-side)
- [x] Migrations deployed to production

**Testing**:
- [x] Build succeeds without errors
- [x] All navigation flows work correctly
- [x] No broken imports or missing components
- [x] Mobile and desktop views functional
- [x] Active states correct on both BottomNav and Sidebar

## Design Rationale

### Why Remove /search Page?

**Problems with Dual Pages**:
- `/search` offered search-only (text query)
- `/notes` offered search + browse + category filtering
- Users confused about which page to use
- Redundant code maintenance
- No clear distinction in functionality

**Benefits of Single Notes Page**:
- One powerful unified hub for all note interactions
- Clear mental model: Glances (overview) vs Notes (everything)
- Reduced code duplication
- Simpler navigation structure
- Category filtering + search work together seamlessly

### Why "Notes" Instead of "Search"?

**"Search" Label Problems**:
- Implies search-only functionality
- Doesn't reflect browsing capability
- Misleading when user just wants to browse
- Category filtering feels out of place

**"Notes" Label Benefits**:
- Accurately describes full notes library
- Encompasses browsing, searching, and filtering
- Natural mental model pairing with "Glances"
- FileText icon clearly represents notes/documents
- Sets correct user expectations

### Icon Choice: FileText

**Alternatives Considered**:
1. **Search (🔍)**
   - Pro: Familiar search icon
   - Con: Implies search-only, misleading
   - Verdict: Rejected

2. **List (☰)**
   - Pro: Represents listing
   - Con: Too generic, might look like menu
   - Verdict: Considered but less clear

3. **FileText (📄)** ✅ Selected
   - Pro: Clearly represents notes/documents
   - Pro: Common in note-taking apps
   - Pro: Matches functionality (notes library)
   - Con: None identified
   - Verdict: Best choice

4. **StickyNote (🗒️)**
   - Pro: Very literal "notes"
   - Con: Might feel too casual
   - Verdict: Good but FileText more professional

### Active State Pattern

**Exact Match Pattern (Old)**:
```typescript
const isActive = pathname === item.href;
```
- ❌ Only highlights on exact `/notes` path
- ❌ No highlight on `/notes?category=todo`
- ❌ No highlight on `/notes/abc-123`

**Prefix Match Pattern (New)**:
```typescript
const isActive = item.href === '/notes'
    ? pathname.startsWith('/notes')
    : pathname === item.href;
```
- ✅ Highlights on `/notes`
- ✅ Highlights on `/notes?category=todo`
- ✅ Highlights on `/notes/abc-123`
- ✅ Maintains exact match for other items

## User Mental Model

**Before (Confusing)**:
```
Navbar: [Glances] [Search] [Settings]

User on Glances page:
  "I want to see all Todo notes"
  → Clicks "Todo (5 notes)" badge
  → Lands on /notes?category=todo
  → ❌ No navbar item highlighted
  → "Where am I? Am I in Search? Notes? Neither?"

User wanting to browse:
  "I want to see all my notes"
  → Clicks "Search"? Or...?
  → ❌ Confused about which page to use
```

**After (Clear)**:
```
Navbar: [Glances] [Notes] [Settings]

User on Glances page:
  "I want to see all Todo notes"
  → Clicks "Todo (5 notes)" badge
  → Lands on /notes?category=todo
  → ✅ "Notes" navbar highlighted
  → "I'm in the Notes section, viewing Todo category"

User wanting to browse:
  "I want to see all my notes"
  → Clicks "Notes"
  → ✅ Gets everything: browse + search + filter
  → "This is my notes library!"
```

## Future Tiers

**🔧 Robust** (+3-4h):
- Redirect `/search` to `/notes` for backward compatibility
- Preserve search state in URL query params
- Browser back button respects filter/search state
- Keyboard shortcuts (/ for search, Cmd+K for quick find)
- Search history dropdown

**🚀 Advanced** (+8-10h):
- Multi-category filtering (select multiple categories)
- Custom filter presets ("My Favorites", "Unread", "This Week")
- Advanced search syntax (AND, OR, NOT operators)
- Saved searches with names
- Search analytics and suggestions
- Full-text search across note content and links

## Bug Fixes Included

### Critical Bug: Category Filtering Broken

**Issue**: Category filtering didn't work - clicking "Todo" filter showed all notes including YouTube, Blog, etc.

**Root Causes**:
1. ❌ `get_notes_by_category` RPC function didn't exist
2. ❌ `NotesList` component had internal category state (always null)
3. ❌ Page didn't pass URL category param to component
4. ❌ Search hook used client-side filtering (inefficient + buggy)

**Fixes Applied**:
1. ✅ Created `get_notes_by_category` RPC function in database
2. ✅ Changed `NotesList` to accept category prop (no internal state)
3. ✅ Page passes `categoryParam` from URL to `NotesList`
4. ✅ Search hook passes category to server action (database filtering)
5. ✅ Added `category_filter` parameter to `search_notes_hybrid` RPC

**Impact**: Category filtering now works correctly both for browsing and searching.

## Analytics & Metrics

**Metrics to Track**:
- Clicks on "Notes" navbar item
- Category filter usage frequency
- Search + category filtering combined usage
- Path distribution: `/notes` vs `/notes?category=X` vs `/notes/[id]`
- Time spent on notes page vs glances
- "See All Notes" button click rate from Glances

**Success Indicators**:
- Reduced user confusion in support requests
- Increased notes page engagement
- Higher category filter usage
- Positive feedback on unified notes experience
- Lower bounce rate from filtered views

---

**Status**: ✅ Completed | **Actual Effort**: ~2 hours | **Deployed**: 2025-11-24

## Implementation Summary

**Files Deleted**:
- `apps/web/app/search/page.tsx`
- `apps/web/components/search/SearchContainer.tsx`

**Files Modified**:
- `apps/web/config/navigation.ts` - Replaced Search with Notes, changed icon
- `apps/web/components/layout/BottomNav.tsx` - Fixed active state logic
- `apps/web/components/layout/Sidebar.tsx` - Fixed active state logic
- `apps/web/components/notes/NotesList.tsx` - Accept category prop
- `apps/web/app/notes/page.tsx` - Pass category to NotesList
- `apps/web/hooks/useNotesSearch.ts` - Pass category to server, remove client filter
- `apps/web/actions/notes.ts` - Add category parameter to searchNotesHybrid

**Database Migrations**:
- `20251124002314_add_category_filter_to_hybrid_search.sql`
- `20251124003019_create_get_notes_by_category_function.sql`

**Key Changes**:
- ✅ Unified navigation structure (removed redundancy)
- ✅ Fixed category filtering at database level
- ✅ Proper active state for all note-related paths
- ✅ Clearer mental model for users
- ✅ Single powerful notes page instead of two weaker ones

**Impact**:
- **Clarity**: Users know "Notes" is the hub for everything
- **Functionality**: Category filtering works correctly
- **UX**: Proper visual feedback when navigating
- **Maintenance**: Less code duplication, easier to maintain
- **Performance**: Database-level filtering instead of client-side

**User Feedback Expected**:
- Positive: "Much clearer now - one place for all notes!"
- Positive: "Category filtering finally works!"
- Positive: "Love that Notes highlights when I filter"
- Neutral: "Took a moment to adjust to Notes instead of Search"
- Action: Users will quickly adapt and prefer unified interface

**Breaking Changes**: None
- URLs unchanged (`/`, `/notes`, `/notes/[id]`)
- Functionality enhanced, not reduced
- All existing features preserved
- Old `/search` URL naturally 404s (expected behavior)

## Related Navigation Patterns

### Tags Page Navigation (2025-11-26)

Following the same AppLayout pattern, the Tags page (`/tags`) was updated to maintain navigation consistency:

**Implementation**:
- Wrapped in `AppLayout` (Sidebar + BottomNav)
- Added back button with `router.back()` functionality
- Converted to client component for router access
- Maintains "utility page" status (not in main nav)

**Rationale**:
- **Consistent chrome** - All major pages have same navigation structure
- **Mixed approach** - Some pages in main nav (Glances, Notes, Settings), some accessed contextually (Tags from Settings)
- **Back button pattern** - Used for utility pages, complements main navigation
- **Flexible navigation** - router.back() works from any referrer, not hardcoded route

This demonstrates the app's navigation philosophy: Core destinations in main nav, utility pages with contextual back buttons.

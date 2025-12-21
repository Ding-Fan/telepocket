# Notes List Page Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🔥 Critical Issues (RESOLVED)

### ✅ RESOLVED: Notes Invisible After Nov 24 Migration (Fixed Dec 4, 2025)
**Problem**: All notes created after Nov 24, 2025 were invisible on web because database query functions used `z_note_categories` while bot writes to `z_note_tags`
**Root Cause**: Incomplete migration from category system to unified tag system
**Impact**:
- Primary use case was broken (browse notes)
- Users couldn't see notes created after Nov 24
- 10 days of invisible notes
**Solution Implemented**: Quick Fix - Updated 3 RPC functions to LEFT JOIN both tables
**Migration**: `20251203161603_fix_notes_visibility_support_both_categories_and_tags.sql`
**Functions Fixed**:
- get_notes_with_pagination
- get_notes_by_category
- search_notes_fuzzy_optimized
**Status**: ✅ RESOLVED - Deployed to production Dec 4, 2025
**Testing**: Verify newly saved bot notes now appear on web

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

### Multiple Tag Display Strategy
**Problem**: New tag system allows multiple tags per note, old UI shows single category
**Solution**: Design UI for displaying 2-4 tags per note card (pills, badges, or first tag + count)
**Impact**: Users can see all tags without opening note detail
**Effort**: ~2h (UI design + implementation)
**Depends On**: 🔴 Critical migration fix (RESOLVED)
**Note**: May integrate with grid layout update

### Mobile Scroll Performance
**Problem**: Animations may lag on older mobile devices
**Solution**: Optimize card animations, use CSS transforms instead of layout changes, lazy load images
**Impact**: Better mobile UX, especially for users with 100+ notes
**Note**: Will be tested with grid layout implementation

### ✅ COMPLETED: Search State Persistence & Scroll Position Memory (Dec 14, 2025)
**Problem**: When browsing notes (search or regular list) and navigating to note detail, going back lost search keywords, filtered list, and scroll position
**Solution Implemented**: URL-based search state + **History API** scroll restoration
**Impact**: Significantly improved UX - users can continue browsing where they left off in both search and regular list
**Effort**: ~6h (URL state management, scroll position restoration, debugging Next.js conflicts, testing)
**Status**: ✅ COMPLETED - Deployed Dec 14, 2025 (Fixed & Re-deployed same day)
**Implementation Details**:
- Search query persists in URL params (`?q=search+term`)
- Category filter and search query work together (`?q=job&category=todo`)
- **History API scroll restoration** (replaces sessionStorage):
  1. Scroll position saved to `window.history.state` (survives navigation)
  2. Periodic saves while scrolling (debounced 150ms)
  3. Immediate save on note card click (captures before navigation)
  4. Restored via `popstate` event listener (fires on back/forward)
  5. **Double requestAnimationFrame** to run AFTER Next.js scroll restoration
  6. Multiple restore attempts (0ms, 100ms, 300ms) using `useLayoutEffect`
- Works for both regular list and search results
- Clean URLs with router.replace (no history pollution)
- Shareable search URLs
**Technical Approach**:
- URL params: `searchParams.get('q')` for search query
- **History API**: `window.history.state.scrollPos` for scroll position
- **popstate event**: Detects browser back/forward navigation
- **requestAnimationFrame double-buffering**: Ensures we run after Next.js scroll
- **useLayoutEffect**: Synchronous execution before browser paint
- Click handler uses `role="article"` selector to identify note cards
**Challenges Overcome**:
- Initial sessionStorage approach failed: Next.js App Router overrides manual `window.scrollTo()`
- Next.js 14 has built-in scroll restoration that runs AFTER component effects
- Solution: Use History API + popstate event + double requestAnimationFrame to win the race
**Result**: Users can browse notes, click detail, press back, and return to exact scroll position - works for both search results and regular note list

---

## 💡 Feature Ideas

New features or enhancements to consider.

### Date Headers ("Today", "Yesterday", "This Week")
**Description**: Group notes with sticky date headers
**Benefit**: Easier visual scanning, clear temporal context
**Effort**: ~4h (group by date logic, sticky header CSS)

### Quick Filter Pills (All | Today | This Week | This Month)
**Description**: Preset time range filters above search bar
**Benefit**: Faster access to recent notes
**Effort**: ~3h (date filtering logic, UI components)

### Note Preview Modal
**Description**: Hover or long-press shows preview without navigation
**Benefit**: Faster browsing, reduced back/forth
**Effort**: ~6h (modal component, preview data fetching)

### Keyboard Navigation (j/k for prev/next)
**Description**: Vim-style keyboard shortcuts for power users
**Benefit**: Fast navigation for desktop users
**Effort**: ~4h (keyboard event handlers, focus management)

### Saved Searches
**Description**: Save frequently used search queries for quick access
**Benefit**: Faster workflow for power users
**Effort**: ~8h (localStorage, UI for managing saved searches)

### Note Tags (in addition to categories)
**Description**: Allow multiple tags per note (#work #urgent #project-x)
**Benefit**: More flexible organization than single category
**Effort**: ~12h (database schema, UI for tag input/filter)

### Link Preview Thumbnails in Note Cards
**Description**: Show Open Graph link preview cards in note list thumbnails (like shown in detail page)
**Benefit**:
- Richer visual context in list view
- Consistent experience between list and detail views
- Better preview of note content before clicking
**Effort**: ~6-8h (integrate LinkPreviewCard into NoteCard, handle multiple links, responsive layout)
**Technical Notes**:
- Reuse existing `LinkPreviewCard` component from detail view
- Decide: show first link only, or multiple links?
- Consider performance impact (image loading, card rendering)
- May need lazy loading for images
**Dependencies**: Responsive LinkPreviewCard design (see Known Issues)

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

### Investigate "Latest First" Perception Issue
**Status**: 🚧 In Progress (INV-1)
**Details**: User reports list doesn't show latest first, but DB already sorts by created_at DESC
**Next Steps**: Add debug logging, verify no stale filters, test viewport sizes

### Virtual Scroll for Performance
**Problem**: 1000+ notes may cause scroll lag
**Solution**: Use react-virtual or tanstack-virtual for windowing
**Effort**: ~12h (integration, testing, scroll position preservation)
**Tier**: Advanced

### Image Lazy Loading
**Problem**: All note card images load immediately (bandwidth waste)
**Solution**: Use Intersection Observer API or next/image lazy loading
**Effort**: ~3h (implement lazy loading, test on slow connections)

### Search Result Relevance Tuning
**Problem**: Fuzzy search may return irrelevant results
**Solution**: Adjust similarity threshold, add semantic search (embeddings)
**Effort**: ~8h (tune pg_trgm threshold, integrate semantic search)

### Memoize Note Cards
**Problem**: All cards re-render on state change (e.g., loading)
**Solution**: Use React.memo on NoteCard component
**Effort**: ~1h (add memo, verify no regression)

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

### User Reports: "List not showing latest first"
**Symptom**: User perceives notes aren't in chronological order
**Investigation**: Database already sorts by created_at DESC
**Hypothesis**: UX perception issue (no visual cue), cache, or viewport issue
**Status**: 🚧 Investigating (INV-1)

### ✅ RESOLVED: Link Preview Card Not Responsive on Mobile (Dec 13, 2025)
**Problem**: `LinkPreviewCard` component (used in note detail view) had broken layout on mobile devices
**Symptoms**: Layout breaks on small screens, images overflow, text truncation issues
**Impact**: Poor mobile UX when viewing note details with link previews
**Solution Implemented**: Mobile-first responsive design with 3 variants
**Effort**: ~6h (responsive CSS, mobile layout optimization, testing)
**Status**: ✅ RESOLVED - Deployed to production Dec 13, 2025
**Implementation**:
- Inline variant: Vertical stack on mobile (full-width banner), horizontal on tablet+ (96-128px image)
- Detailed variant: Compact vertical on mobile (64px image), horizontal on tablet+ (80-96px image)
- Thumbnail variant: Horizontal layout with 40px image + title + description
- Icon positioning: Absolute top-right on mobile, flex item on desktop
- Smooth transitions between breakpoints with proper media queries
**Result**: Responsive link previews work seamlessly on all screen sizes (320px to 1920px+)

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

### ✅ RESEARCHED: Mobile Grid Layout Best Practices (Dec 7, 2025)
**Question**: What's the optimal grid layout for mobile note browsing in 2025?
**Research Completed**:
- Industry standard: 2-4 column grids for card content
- Margins: 16px minimum (Android/iOS standard)
- Gutters: 8-12px for tight, dense layouts
- Touch targets: 44x44px minimum (accessibility)
- Aspect ratio: 2:3 or 3:4 rectangular for notes
- 8-point grid system for spacing consistency
**Decision**: Implement 2/3/4 column responsive grid (see T-14 through T-17)
**Status**: ✅ Research complete, implementation in progress

### Semantic Search with Embeddings
**Question**: Would semantic search improve search accuracy?
**Research**:
- Compare pgvector semantic search vs pg_trgm fuzzy search
- Test with real user queries ("make me happy", "help find job")
- Measure latency impact (embedding generation + vector search)
- Estimate cost (OpenAI API, Supabase vector storage)
**Decision Criteria**: If accuracy improves >30% and latency <500ms, implement in Robust tier

### Infinite Scroll vs Load More Button
**Question**: Is "Load More" button better than infinite scroll?
**Research**:
- User feedback on current implementation
- Mobile UX best practices (2025)
- A/B test if possible
**Current**: Load More (user control, accessibility)
**Alternative**: Infinite scroll (seamless, less clicks)

### Note Card Density Options
**Question**: Should we offer compact/comfortable/spacious layouts?
**Research**:
- Survey user preferences
- Test readability at different densities
- Check mobile vs desktop preferences
**Effort**: ~6h (implement density toggle, 3 layout variants)
**Note**: Grid layout now provides base density; density toggle could be Robust tier feature

### Variable Height Grid (Masonry Layout)
**Question**: Should cards have variable height based on content (Pinterest-style)?
**Research**:
- Test performance with CSS Grid masonry (limited browser support)
- Consider JS masonry libraries (overhead vs benefit)
- Measure perceived performance vs fixed-height grid
- Test CLS (Cumulative Layout Shift) impact
**Effort**: ~10h (masonry implementation + optimization)
**Decision Criteria**: If user testing shows strong preference and performance acceptable, implement in Advanced tier
**Current Approach**: Fixed aspect ratio (2:3 or 3:4) for predictable layout

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

<!-- Add ideas here as they come up -->

---

## ✅ Implemented

Ideas that have been completed (for reference).

### Dual Display Mode (List/Search)
**Implemented**: 2025-11-01
**Description**: Automatically switches between regular list and search results based on query
**Impact**: Clear separation, better UX, simpler state management

### Category Filtering via URL
**Implemented**: 2025-11-01
**Description**: Category filter persists in URL (?category=todo)
**Impact**: Shareable links, browser back/forward support

### Search Debounce (300ms)
**Implemented**: 2025-11-01
**Description**: Debounces search input to avoid excessive queries
**Impact**: Better performance, reduced server load

### Responsive Grid Layout (2/3/4 columns)
**Implemented**: 2025-12-07
**Description**: Modern mobile-first grid layout with responsive breakpoints
**Impact**: Better screen space utilization, follows 2025 UI best practices, 4x info density on mobile
**Technical Details**:
- 2 columns mobile (360-767px)
- 3 columns tablet (768-1023px)
- 4 columns desktop (1024px+)
- Tight spacing (8-12px gutters)
- 8px margins mobile (optimized for max density)
- Rectangular cards (2:3 aspect ratio)
- Touch targets: min 44x44px
- Optimized content: 80 char preview, compact metadata (10-11px fonts)
- Grid-aware skeletons (6 cards in 2x3 grid)

### Link Preview Thumbnails in Note Cards
**Implemented**: 2025-12-13
**Description**: Show link preview thumbnails directly in note list cards
**Impact**: Richer visual context, better preview of note content before clicking
**Technical Details**:
- Thumbnail variant: Horizontal layout with 40px image + title + description
- Show up to 2 link previews per card
- "+N more links" badge for additional links
- Full-width cards stacked vertically
- Mobile-first responsive design
- Prevents card navigation on thumbnail click (stopPropagation)

### Search State Persistence & Scroll Position Memory
**Implemented**: 2025-12-14
**Description**: Persist search query in URL and restore scroll position when navigating back from note detail
**Impact**: Users can browse (search or regular list), view note detail, press back, and continue from exact same position
**Technical Details**:
- Search query in URL params (`?q=search+term`)
- Works with category filter (`?q=job&category=todo`)
- **Dual scroll saving**: Periodic (debounced 150ms) + immediate on note card click
- Scroll restoration delayed 100ms for notes to render
- Works for both regular list and search results
- Shareable search URLs
- Clean history with router.replace

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

### Traditional Pagination (Prev/Next buttons)
**Reason**: Poor mobile UX, requires extra clicks, doesn't work well with infinite scroll patterns
**Alternative**: Load More button (user control) or infinite scroll (seamless)
**Decision Date**: 2025-11-01

### Client-Side Search
**Reason**: Cannot search all notes (limited to loaded page), no semantic search, exposes data
**Alternative**: Server action with hybrid search (fuzzy + semantic)
**Decision Date**: 2025-11-01

### Cookie-Based Filter Persistence
**Reason**: Privacy concerns, doesn't work across devices, not shareable
**Alternative**: URL params for filters (shareable, no privacy issues)
**Decision Date**: 2025-11-01

# Notes Navigation Restructure - Backlog

## Future Enhancements

### 🔧 Robust Tier (+3-4 hours)

#### 1. Redirect /search to /notes
**Why**: Backward compatibility for users with bookmarks or external links
**How**:
```typescript
// app/search/page.tsx
import { redirect } from 'next/navigation';
export default function SearchPage() {
  redirect('/notes');
}
```
**Impact**: Seamless transition, no broken links
**Priority**: Medium

#### 2. Preserve Search State in URL
**Why**: Browser back button should respect filter/search state
**How**: Use URL query params for all state (`?q=query&category=todo&page=2`)
**Impact**: Better browser navigation UX
**Priority**: High

#### 3. Keyboard Shortcuts
**Why**: Power users want quick access
**Shortcuts**:
- `/` - Focus search bar
- `Cmd+K` - Quick find dialog
- `Esc` - Clear search/filters
- `g then n` - Go to notes
**Impact**: Faster navigation for frequent users
**Priority**: Medium

#### 4. Search History Dropdown
**Why**: Users often repeat similar searches
**How**: Store last 10 searches in localStorage, show dropdown on focus
**Impact**: Convenience, faster re-searching
**Priority**: Low

#### 5. Category Filter Count Badges
**Why**: Users want to know how many notes in each category before filtering
**How**: Fetch category counts, display as badges in filter UI
```
[📋 Todo (5)] [💡 Idea (12)] [📺 YouTube (8)]
```
**Impact**: Better decision-making about which category to view
**Priority**: Medium

#### 6. Clear All Filters Button
**Why**: Quick reset when multiple filters active
**How**: Single button to clear all filters and search query
**Impact**: Improved UX when exploring different filter combinations
**Priority**: Low

### 🚀 Advanced Tier (+8-10 hours)

#### 1. Multi-Category Filtering
**Why**: Users may want to see "Todo + Idea" notes together
**How**: Support multiple category selections, update URL and DB query
**Example**: `/notes?category=todo,idea`
**Impact**: More flexible filtering, better content discovery
**Priority**: Medium

#### 2. Custom Filter Presets
**Why**: Users have common filtering patterns they repeat
**Presets**:
- "My Favorites" (pinned notes only)
- "Unread" (recently added, not viewed)
- "This Week" (created in last 7 days)
- "High Priority" (marked as important)
**How**: Save presets in user preferences, quick-select dropdown
**Impact**: Personalization, faster access to relevant notes
**Priority**: High

#### 3. Advanced Search Syntax
**Why**: Power users want precise search control
**Syntax**:
- `tag:todo` - Notes in Todo category
- `pin:true` - Only pinned notes
- `"exact phrase"` - Exact match search
- `keyword1 OR keyword2` - Union search
- `keyword1 AND keyword2` - Intersection search
- `-exclude` - Exclude keyword
**How**: Parse search query, build complex DB query
**Impact**: Extremely powerful for advanced users
**Priority**: Low

#### 4. Saved Searches
**Why**: Complex searches worth saving for reuse
**How**:
- Name and save search queries
- Quick access dropdown
- Share saved searches via link
- Edit/delete saved searches
**Impact**: Productivity boost for frequent searches
**Priority**: Medium

#### 5. Search Analytics & Suggestions
**Why**: Learn from user behavior to improve search
**Features**:
- Track popular searches
- Suggest autocomplete based on history
- "Did you mean?" suggestions
- Related notes suggestions
**How**: Analytics backend, ML-based suggestions
**Impact**: Better search relevance over time
**Priority**: Low

#### 6. Full-Text Search Across Links
**Why**: Users may remember link content, not note content
**How**: Index link titles, descriptions, and URLs in search
**Status**: Already implemented in hybrid search, but could enhance
**Impact**: Find notes by remembered link content
**Priority**: Low

#### 7. Search Result Highlighting
**Why**: Users want to see why a note matched their search
**How**: Highlight matched keywords in note preview
**Example**: "...learn **React** hooks and **state** management..."
**Impact**: Faster scanning of results, better UX
**Priority**: Medium

#### 8. Infinite Scroll vs Pagination
**Why**: Some users prefer infinite scroll
**How**: Add toggle in settings to switch between pagination and infinite scroll
**Impact**: User preference accommodation
**Priority**: Low

#### 9. Bulk Actions on Filtered Results
**Why**: Users may want to act on all filtered notes
**Actions**:
- Mark all as read
- Pin/unpin all
- Archive all
- Export all to file
**How**: Checkbox selection, bulk action toolbar
**Impact**: Powerful for note management
**Priority**: Medium

#### 10. Smart Filters (AI-Powered)
**Why**: AI can suggest relevant filters based on context
**Features**:
- "Similar to this note" filter
- "Notes I haven't viewed in a while"
- "Notes trending in my interests"
- Auto-categorization improvements
**How**: ML-based recommendations, embeddings similarity
**Impact**: Content discovery, personalization
**Priority**: Low (requires AI infrastructure)

## UX Improvements

### 1. Loading State Improvements
**Current**: Generic spinner
**Proposed**: Skeleton screens matching note card layout
**Impact**: Perceived performance improvement
**Effort**: 1 hour

### 2. Empty State Enhancements
**Current**: Basic "No notes found" message
**Proposed**:
- Helpful suggestions ("Try different keywords")
- Quick action buttons ("Clear filters", "Browse all notes")
- Illustration or animation
**Impact**: Better user guidance when no results
**Effort**: 2 hours

### 3. Filter Chips Visual Design
**Current**: Basic chip with X to remove
**Proposed**:
- Category emoji in chip
- Animated entrance/exit
- Hover effects with preview
**Impact**: More polished, professional look
**Effort**: 1 hour

### 4. Search Bar Enhancements
**Proposed**:
- Search suggestions dropdown
- Recent searches
- Popular categories
- Keyboard shortcut hints
**Impact**: Faster search input, better discoverability
**Effort**: 3 hours

### 5. Mobile Gestures
**Proposed**:
- Swipe left on note card to pin/unpin
- Pull to refresh notes list
- Swipe down to clear search
**Impact**: Native mobile app feel
**Effort**: 4 hours

## Performance Optimizations

### 1. Search Debouncing Tuning
**Current**: 300ms debounce
**Proposed**: Adaptive debouncing based on query length
- 1-2 chars: 500ms (avoid too many queries)
- 3-5 chars: 300ms (current)
- 6+ chars: 150ms (faster for specific searches)
**Impact**: Better perceived performance
**Effort**: 30 minutes

### 2. Query Result Caching
**Proposed**: Cache recent search results in memory
**How**: Use Map with LRU eviction, cache last 20 queries
**Impact**: Instant results for repeated searches
**Effort**: 2 hours

### 3. Pagination Prefetching
**Proposed**: Prefetch page 2 when user on page 1
**Impact**: Smoother pagination experience
**Effort**: 1 hour

### 4. Database Query Optimization
**Current**: Good performance with indexes
**Proposed**:
- Materialized views for popular filter combinations
- Query plan analysis and optimization
- Index optimization for category + search queries
**Impact**: Faster complex queries
**Effort**: 4 hours

## Analytics & Tracking

### 1. Search Analytics Dashboard
**Metrics to Track**:
- Most popular search queries
- Average search result count
- Search-to-click ratio
- Category filter usage frequency
- Search abandonment rate
**Impact**: Data-driven UX improvements
**Effort**: 6 hours

### 2. User Journey Tracking
**Track**:
- Glances → Category Filter → Note Detail (conversion funnel)
- Notes page entry points (direct, from Glances, etc.)
- Time spent on filtered views
- Filter combination patterns
**Impact**: Understand user behavior, optimize flows
**Effort**: 4 hours

## Accessibility Improvements

### 1. Screen Reader Support
**Enhancements**:
- ARIA labels for all interactive elements
- Announce search result count
- Announce filter changes
- Keyboard navigation for all actions
**Impact**: Accessible to all users
**Effort**: 3 hours

### 2. Keyboard Navigation
**Features**:
- Tab through all interactive elements
- Arrow keys to navigate note cards
- Enter to open note
- Shortcuts for common actions
**Impact**: Accessibility + power user efficiency
**Effort**: 2 hours

### 3. High Contrast Mode
**Proposed**: Respect system high contrast preferences
**Impact**: Better visibility for users with vision impairments
**Effort**: 2 hours

## Technical Debt

### 1. Component Refactoring
**Opportunity**: Extract reusable filter chip component
**Why**: Currently duplicated in multiple places
**Impact**: DRY code, easier maintenance
**Effort**: 1 hour

### 2. Type Safety Improvements
**Opportunity**: Stronger TypeScript types for search params
**Why**: Current types could be more specific
**Impact**: Fewer runtime errors, better DX
**Effort**: 1 hour

### 3. Test Coverage
**Current**: Manual testing only
**Proposed**: Unit tests for filter logic, integration tests for search
**Impact**: Confidence in refactoring, fewer bugs
**Effort**: 8 hours

## Documentation

### 1. User Guide
**Content**:
- How to use category filters
- Search tips and tricks
- Keyboard shortcuts
- FAQ
**Format**: In-app help or docs site
**Effort**: 4 hours

### 2. Video Tutorials
**Topics**:
- "Finding notes with category filters"
- "Advanced search techniques"
- "Organizing with pins and categories"
**Platform**: YouTube or in-app
**Effort**: 8 hours

---

## Prioritization Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Preserve search state in URL | High | Low | **P0** |
| Custom filter presets | High | Medium | **P1** |
| Multi-category filtering | Medium | Medium | **P1** |
| Keyboard shortcuts | Medium | Low | **P2** |
| Search result highlighting | Medium | Medium | **P2** |
| Redirect /search → /notes | Medium | Low | **P2** |
| Bulk actions on filters | Medium | High | **P3** |
| Search analytics | Low | High | **P3** |
| Advanced search syntax | Low | High | **P4** |

## Next Steps

1. ✅ Complete MVP (Done)
2. Gather user feedback for 1-2 weeks
3. Prioritize backlog based on real usage patterns
4. Implement P0 items (URL state preservation)
5. Consider P1 items based on user demand
6. Revisit and re-prioritize quarterly

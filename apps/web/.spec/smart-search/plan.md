# Smart Search Enhancement Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Query Parsing** | Regex-based keyword detection | Simple, fast, no LLM overhead. Sufficient for MVP keyword extraction. |
| **State Management** | URL params + React state | Shareable links + browser history. Follows Next.js patterns. |
| **History Storage** | LocalStorage (max 5) | No backend changes. Simple persistence. Privacy-friendly (client-only). |
| **Filter Application** | Client-side filtering | Existing `searchNotesHybrid` API returns all results. Filter post-processing. |
| **Component Structure** | Modular sub-components | SmartSearchBar, QuickActionChips, ActiveFiltersBar, SearchHistoryDropdown. |
| **Keyword Detection** | Case-insensitive regex | Matches partial words ("todo" in "todos"). Remove from query after detection. |
| **URL Serialization** | URLSearchParams | Native browser API. Handles arrays, booleans, nested objects. |

## Codebase Integration Strategy

**Component Location**: `apps/web/components/search/`
- Follows existing structure (`SearchContainer.tsx`, `NotesSearchBar.tsx`)
- New components: `SmartSearchBar.tsx`, `QuickActionChips.tsx`, `ActiveFiltersBar.tsx`, `SearchHistoryDropdown.tsx`
- Modular organization for testability

**Utility Location**: `apps/web/utils/`
- New: `searchParser.ts` - Query parsing logic
- New: `searchHistory.ts` - LocalStorage operations
- New: `searchFilters.ts` - Filter application logic
- New: `urlState.ts` - URL param serialization/deserialization

**Hook Integration**:
- Enhance existing `useNotesSearch` hook with filter support
- New: `useSearchHistory` hook for LocalStorage operations
- New: `useSearchFilters` hook for URL state management

**Type Integration**:
- Import `NoteCategory` from `@telepocket/shared`
- Extend `HybridSearchResult` type if needed
- Define new types: `SearchFilters`, `ParsedQuery`, `QuickAction`, `SearchHistoryItem`

**API Integration**:
- Reuse `searchNotesHybrid` server action from `actions/notes.ts`
- Apply filters client-side after receiving results
- Future: Enhance RPC function to accept filter params (Robust tier)

## Technical Approach

**Existing Patterns to Follow**:
1. **Component Styling**: Study `GlanceCard.tsx` for glass morphism, hover effects, gradient accents
2. **Search UX**: Study `SearchContainer.tsx` for loading states, empty states, error handling
3. **Type Imports**: Use `@telepocket/shared` for all shared types (NoteCategory, etc.)
4. **Server Actions**: Follow `actions/notes.ts` pattern for async operations

**Component Composition**:
```
SearchContainer (refactored)
├── SmartSearchBar
│   ├── Input (with autocomplete hints)
│   └── SearchHistoryDropdown (conditional)
├── QuickActionChips (empty state only)
├── ActiveFiltersBar (when filters active)
└── Results (existing NoteCard grid)
```

**Query Parsing Flow**:
1. User types query → debounced input (500ms)
2. `parseSearchQuery(query)` → detects keywords → returns `ParsedQuery`
3. Extract filters → update URL params → update React state
4. Clean query (remove keywords) → pass to `searchNotesHybrid`
5. Apply filters client-side → display results
6. Save query + filters to LocalStorage history

**URL State Flow**:
1. Filters change → serialize to URL params (`?category=todo&pinned=true&date=recent`)
2. Component mount → deserialize URL params → restore filters
3. Browser back/forward → URL change → restore state

**LocalStorage Flow**:
1. Search executed → save to history array (max 5, FIFO)
2. Component mount → read history → display in dropdown
3. Clear history → remove from LocalStorage

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Keyword conflicts** | Use word boundaries in regex. Test edge cases ("idea" in "video"). |
| **LocalStorage quota** | Limit history to 5 items. Graceful fallback if quota exceeded. |
| **URL length limits** | Encode filter params efficiently. Test with max filters. |
| **Client-side filter performance** | Apply filters before rendering. Optimize for 1000+ results. |
| **Date range ambiguity** | Document keyword precedence ("recent" = last 7 days). Add tooltips. |

## Integration Points

**SearchContainer**: `apps/web/components/search/SearchContainer.tsx` (refactor)
**useNotesSearch**: `apps/web/hooks/useNotesSearch.ts` (enhance with filters)
**Server Action**: `apps/web/actions/notes.ts` (existing `searchNotesHybrid`)
**Shared Types**: `packages/shared/src/types.ts` (import `NoteCategory`)
**Constants**: `packages/shared/src/constants.ts` (import `CATEGORY_EMOJI`, `CATEGORY_LABELS`)

## Success Criteria

**Technical**:
- Query parser correctly extracts filters from 50+ test cases
- LocalStorage operations handle errors gracefully (quota, corruption)
- URL state serialization supports all filter combinations
- Filter application completes in <50ms for 1000 results
- Component re-renders optimized (no unnecessary searches)

**User**:
- Users discover search features via quick action chips
- Natural language queries feel intuitive ("recent todos" works)
- Filter chips provide clear visual feedback on active filters
- Recent history saves time for repeated searches
- Shareable URLs work across browsers/devices

**Business**:
- Search engagement increases (more searches per session)
- Empty state bounce rate decreases
- Advanced search features adoption (pinned, date filters)

## Robust Product (+2-3 days)

Command palette (Cmd+K) for global search, saved searches with custom names, advanced date parsing ("last 30 days", "Jan 1 - Feb 15"), filter combination UI (AND/OR logic), search tips modal.

## Advanced Product (+4-5 days)

ML query suggestions from history patterns, search analytics dashboard, common query detection, custom filter presets, bulk actions (archive/mark all results), export results to CSV/JSON.

---

**Total MVP Effort**: 24-32 hours (3-4 days) | **Dependencies**: None

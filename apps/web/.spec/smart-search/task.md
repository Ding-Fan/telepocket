# Smart Search Enhancement Implementation Tasks

**Status**: Not Started | **MVP Effort**: 24-32 hours | **Priority**: High

---

## T-1: Type Definitions and Utilities Setup

**Effort**: 2h | **Dependencies**: None

- [ ] Define `SearchFilters` interface in new file `types/search.ts`
- [ ] Define `ParsedQuery`, `QuickAction`, `SearchHistoryItem` interfaces
- [ ] Create `utils/searchParser.ts` with keyword detection regexes
  ```typescript
  export function parseSearchQuery(query: string): ParsedQuery {
    // Category detection: todo|todos, idea|ideas, etc.
    // Date range detection: today, recent, week, month
    // Content type detection: pinned, links, images
    // Sort detection: newest, oldest, most-viewed
    // Return cleanQuery + filters + detectedKeywords
  }
  ```
- [ ] Create `utils/searchHistory.ts` with LocalStorage operations
- [ ] Create `utils/searchFilters.ts` with filter application logic
- [ ] Create `utils/urlState.ts` with serialize/deserialize functions

**Acceptance**:
- ✅ All interfaces properly typed with JSDoc comments
- ✅ Parser correctly detects keywords from spec
- ✅ LocalStorage handles quota errors gracefully
- ✅ URL serialization supports all filter types

---

## T-2: Query Parser Implementation

**Effort**: 4h | **Dependencies**: T-1

- [ ] Implement category keyword detection (case-insensitive, word boundaries)
- [ ] Implement date range keyword detection (today, recent, week, month)
- [ ] Implement content type detection (pinned, links, images)
- [ ] Implement sort keyword detection (newest, oldest, most-viewed)
- [ ] Remove detected keywords from query (preserve other text)
- [ ] Add keyword precedence rules (category > date > content)
- [ ] Write unit tests for 20+ query variations

**Test Cases**:
- [ ] "recent pinned todos" → cleanQuery="", filters={category:'todo', dateRange:'recent', isPinned:true}
- [ ] "idea with links" → cleanQuery="", filters={category:'idea', hasLinks:true}
- [ ] "react hooks tutorial" → cleanQuery="react hooks tutorial", filters={}
- [ ] "todos from last week" → cleanQuery="", filters={category:'todo', dateRange:'week'}

**Acceptance**:
- ✅ Parser passes all test cases
- ✅ Keyword removal preserves important query text
- ✅ Multiple keywords of same type handled correctly

---

## T-3: LocalStorage History Hook

**Effort**: 2h | **Dependencies**: T-1

- [ ] Create `useSearchHistory` hook in `hooks/useSearchHistory.ts`
- [ ] Implement `addToHistory(query, filters)` - FIFO with max 5
- [ ] Implement `getHistory()` - returns sorted by timestamp DESC
- [ ] Implement `clearHistory()` - removes all items
- [ ] Handle LocalStorage quota errors (fallback to empty array)
- [ ] Handle JSON parse errors (corrupted data)
- [ ] Add timestamp to each history item

**Acceptance**:
- ✅ History limited to 5 most recent items
- ✅ Oldest item removed when adding 6th
- ✅ Graceful fallback if LocalStorage unavailable

---

## T-4: URL State Management Hook

**Effort**: 3h | **Dependencies**: T-1

- [ ] Create `useSearchFilters` hook in `hooks/useSearchFilters.ts`
- [ ] Serialize filters to URL params on filter change
- [ ] Deserialize URL params to filters on component mount
- [ ] Handle browser back/forward navigation (restore state)
- [ ] Handle invalid URL params (fallback to empty filters)
- [ ] Use Next.js `useRouter` and `useSearchParams`
- [ ] Debounce URL updates (avoid excessive history entries)

**Acceptance**:
- ✅ URL updates when filters change
- ✅ Browser back/forward restores filter state
- ✅ Shareable URLs work across sessions

---

## T-5: QuickActionChips Component

**Effort**: 3h | **Dependencies**: T-1

- [ ] Create `components/search/QuickActionChips.tsx`
- [ ] Define 6 quick actions with emoji + label + filters
- [ ] Render chips in 2-row grid (mobile: 2 cols, desktop: 3 cols)
- [ ] Handle chip click → apply filters → execute search
- [ ] Style chips with glass morphism (follow GlanceCard pattern)
- [ ] Add hover effects (scale 1.05, gradient border)
- [ ] Show only when query is empty (empty state)

**Quick Actions**:
```typescript
const quickActions: QuickAction[] = [
  { label: 'Recent Notes', emoji: '📅', filters: { dateRange: 'recent' } },
  { label: 'Pinned', emoji: '📌', filters: { isPinned: true } },
  { label: 'TODOs', emoji: '📋', filters: { category: 'todo' } },
  { label: 'Ideas', emoji: '💡', filters: { category: 'idea' } },
  { label: 'Has Links', emoji: '🔗', filters: { hasLinks: true } },
  { label: 'Has Images', emoji: '🖼️', filters: { hasImages: true } }
];
```

**Acceptance**:
- ✅ All 6 chips render correctly
- ✅ Clicking chip executes search with filters
- ✅ Chips hidden when query not empty

---

## T-6: SearchHistoryDropdown Component

**Effort**: 3h | **Dependencies**: T-3

- [ ] Create `components/search/SearchHistoryDropdown.tsx`
- [ ] Render last 5 searches with query + filter badges
- [ ] Handle history item click → restore query + filters
- [ ] Add "Clear History" button at bottom
- [ ] Show dropdown on input focus (if history exists)
- [ ] Hide dropdown on blur or selection
- [ ] Style with glass morphism dropdown panel
- [ ] Add keyboard navigation (arrow keys, enter)

**Acceptance**:
- ✅ History items show query + active filters
- ✅ Clicking item restores exact search state
- ✅ Clear history removes all items
- ✅ Keyboard navigation works

---

## T-7: ActiveFiltersBar Component

**Effort**: 3h | **Dependencies**: T-1

- [ ] Create `components/search/ActiveFiltersBar.tsx`
- [ ] Render filter chips with label + X button
- [ ] Handle chip remove → update filters → re-run search
- [ ] Show "Clear All" button when 2+ filters active
- [ ] Style filter chips (cyan accent for active state)
- [ ] Add smooth animations (fade in/out on add/remove)
- [ ] Show only when filters are active

**Filter Chip Labels**:
- Category: "Category: {label}" (e.g., "Category: Todo")
- Date Range: "Date: {range}" (e.g., "Date: Recent")
- Pinned: "Pinned"
- Has Links: "Has Links"
- Has Images: "Has Images"

**Acceptance**:
- ✅ All active filters displayed as chips
- ✅ Removing chip updates search results
- ✅ Clear All removes all filters
- ✅ Smooth animations on add/remove

---

## T-8: SmartSearchBar Component

**Effort**: 4h | **Dependencies**: T-2, T-6

- [ ] Create `components/search/SmartSearchBar.tsx`
- [ ] Integrate search input with debounce (500ms)
- [ ] Parse query on change → update filters
- [ ] Show autocomplete hints below input (detected keywords)
- [ ] Integrate SearchHistoryDropdown
- [ ] Handle clear button → reset query + filters
- [ ] Style with gradient border on focus
- [ ] Add loading indicator during search

**Acceptance**:
- ✅ Query parsing happens on every change
- ✅ Autocomplete hints show detected keywords
- ✅ History dropdown appears on focus
- ✅ Clear button resets everything

---

## T-9: Filter Application Logic

**Effort**: 2h | **Dependencies**: T-1

- [ ] Implement `applyFilters(results, filters)` in `utils/searchFilters.ts`
- [ ] Filter by category (exact match)
- [ ] Filter by date range (today, recent, week, month)
- [ ] Filter by pinned status
- [ ] Filter by hasLinks (link_count > 0)
- [ ] Filter by hasImages (image_count > 0)
- [ ] Sort results (newest, oldest, most-viewed, relevance)
- [ ] Optimize for 1000+ results (<50ms)

**Acceptance**:
- ✅ All filter types work correctly
- ✅ Filters combine with AND logic
- ✅ Performance <50ms for 1000 results

---

## T-10: SearchContainer Refactor

**Effort**: 4h | **Dependencies**: T-5, T-7, T-8, T-9

- [ ] Replace NotesSearchBar with SmartSearchBar
- [ ] Add QuickActionChips to empty state
- [ ] Add ActiveFiltersBar above results
- [ ] Integrate useSearchHistory hook
- [ ] Integrate useSearchFilters hook (URL state)
- [ ] Apply filters to search results
- [ ] Save successful searches to history
- [ ] Update empty state layout (chips + history)
- [ ] Handle loading/error states

**Acceptance**:
- ✅ All components integrated correctly
- ✅ Search flow works end-to-end
- ✅ URL state syncs with filters
- ✅ History saves after search

---

## T-11: Edge Cases and Error Handling

**Effort**: 2h | **Dependencies**: T-10

- [ ] Handle empty query with filters (show results)
- [ ] Handle query with no keywords (pass through to hybrid search)
- [ ] Handle conflicting keywords ("todo idea" → use first)
- [ ] Handle LocalStorage quota exceeded (disable history)
- [ ] Handle invalid URL params (fallback to defaults)
- [ ] Handle search API errors (show error state)
- [ ] Test with very long queries (>200 chars)

**Acceptance**:
- ✅ All edge cases handled gracefully
- ✅ No crashes or console errors
- ✅ Appropriate fallbacks for errors

---

## T-12: Testing and Polish

**Effort**: 3h | **Dependencies**: T-11

- [ ] Test 50+ query variations (spec keyword examples)
- [ ] Test all quick action chips
- [ ] Test history add/remove/clear
- [ ] Test filter chip add/remove
- [ ] Test URL sharing across browsers
- [ ] Test mobile responsiveness
- [ ] Verify animations smooth (60fps)
- [ ] Add loading skeletons for empty state
- [ ] Add transition animations (fade, slide)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

**Acceptance**:
- ✅ All test cases pass
- ✅ Smooth animations on all interactions
- ✅ Responsive on mobile/tablet/desktop
- ✅ Works on all major browsers

---

## Final Verification (MVP)

**Functional**:
- [ ] Parser detects all keyword types correctly
- [ ] Quick action chips execute searches
- [ ] Recent history saves/restores searches
- [ ] Active filters display and remove correctly
- [ ] URL params sync with filter state
- [ ] Shareable URLs work across sessions
- [ ] Client-side filtering applies correctly

**UI/UX**:
- [ ] Empty state shows chips + history
- [ ] Filter chips visually distinct
- [ ] Autocomplete hints helpful
- [ ] Smooth transitions on all changes
- [ ] Glass morphism styling consistent
- [ ] Mobile layout responsive

**Integration**:
- [ ] Uses existing searchNotesHybrid API
- [ ] Integrates with useNotesSearch hook
- [ ] Follows GlanceCard styling patterns
- [ ] Uses @telepocket/shared types
- [ ] Error handling robust

---

## Robust Product Tasks

**T-13: Command Palette Integration** (+6h)
- Implement Cmd+K global shortcut
- Modal overlay with search interface
- Navigate results with keyboard
- Close on Esc or selection

**T-14: Saved Searches** (+4h)
- Save searches with custom names
- Bookmark icon in search bar
- Manage saved searches UI
- LocalStorage or backend persistence

**T-15: Advanced Date Parsing** (+3h)
- "last 30 days", "last 90 days"
- Specific date ranges ("Jan 1 - Feb 15")
- Relative dates ("3 days ago")
- Date picker UI

**T-16: Filter Combination UI** (+4h)
- AND/OR logic toggle
- Filter groups (category AND date OR content)
- Visual grouping with parentheses
- Advanced mode toggle

---

## Advanced Product Tasks

**T-17: ML Query Suggestions** (+8h)
- Analyze user search patterns
- Suggest queries based on history
- Predict next search from context
- Train model on user data (privacy-first)

**T-18: Search Analytics** (+6h)
- Dashboard with search metrics
- Most common queries
- Filter usage statistics
- Search success rate (clicks on results)

**T-19: Custom Filter Presets** (+4h)
- Save filter combinations with names
- Quick access to presets
- Share presets via URL
- Preset management UI

**T-20: Bulk Actions** (+6h)
- Select multiple results (checkboxes)
- Bulk archive, mark, categorize
- Confirm dialog for destructive actions
- Progress indicator for bulk operations

---

**Total MVP Tasks**: T-1 through T-12 | **Effort**: 24-32 hours

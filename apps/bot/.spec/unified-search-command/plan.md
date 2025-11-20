# Unified Search Command Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Search Execution** | Parallel Promise.all() | Both searches are independent, parallel execution reduces latency by 50% compared to sequential |
| **Result Merging** | Client-side merge + sort | Database functions are optimized separately, merging in TypeScript keeps DB functions simple and maintainable |
| **Pagination Strategy** | Post-merge pagination | Fetch larger batches from both sources (100 items each), merge/sort, then paginate client-side for accurate ranking |
| **Type Differentiation** | Emoji indicators (📝/🔗) | Visual distinction matches existing bot UI patterns, scannable at a glance |
| **Command Location** | Add to client.ts setupCommands() | Follows existing pattern for `/notes` and `/links` commands, keeps all commands centralized |
| **Callback Handling** | New callback_data pattern | Use `unified_search_{page}_{keyword}` to distinguish from existing note/link search callbacks |
| **Database Functions** | Reuse existing functions | No migrations needed, leverages battle-tested fuzzy search logic already in production |

## Codebase Integration Strategy

**Command Location**: `src/bot/client.ts`
- Add `/search` handler in `setupCommands()` method (line ~260)
- Follows same pattern as existing `/notes` and `/links` commands
- Integrates with existing authorization check (`isAuthorizedUser()`)

**Method Integration**:
- Create new `showUnifiedSearchResults()` method in TelegramClient class
- Place after `showLinksOnlySearchResults()` method (~line 1460)
- Reuse existing validation (`validateSearchKeyword()`)
- Use existing status message manager for typing indicator

**Callback Query Integration**:
- Add new callback pattern in existing `callback_query` handler (~line 286)
- Pattern: `unified_search_{page}_{encodedKeyword}`
- Reuse existing pagination logic structure

**Display Integration**:
- Reuse `formatNoteForDisplay()` for note results
- Reuse link formatting from `showLinksOnlySearchResults()`
- Maintain consistent MarkdownV2 escaping patterns

## Technical Approach

**Existing Patterns to Follow**:
1. **Command Pattern**: Study `setupCommands()` for `/notes` and `/links` (client.ts:121-260)
2. **Search Pattern**: Study `showNoteSearchResults()` (client.ts:1148) and `showLinksOnlySearchResults()` (client.ts:1357)
3. **Validation**: Use `validateSearchKeyword()` from `utils/validation.ts`
4. **Status Messages**: Use `StatusMessageManager.start()` pattern (noteHandlers.ts:126-130)

**Component Composition**:
```typescript
/search command handler
  ↓
validateSearchKeyword()
  ↓
StatusMessageManager.start() (typing indicator)
  ↓
Promise.all([
  noteOps.searchNotesWithPagination(userId, keyword, 1, 100),
  noteOps.searchLinksOnlyWithPagination(userId, keyword, 1, 100)
])
  ↓
mergeAndSortResults() (new utility function)
  ↓
paginateResults() (client-side)
  ↓
formatUnifiedResults() (new display function)
  ↓
status.complete() with pagination keyboard
```

**Search Result Merging Flow**:
1. Execute both searches in parallel (fetch 100 from each)
2. Transform note results to unified format (type: 'note')
3. Transform link results to unified format (type: 'link')
4. Concatenate both arrays
5. Sort by relevance_score DESC
6. Slice for current page (e.g., items 0-9 for page 1)
7. Calculate totalCount, totalPages from merged array length

**Display Format**:
```
🔍 Search Results for "keyword" (Page 1/5)
📊 Found: 42 results (28 notes, 14 links)

📝 1. [Note content preview...]
     • Link 1 title (90%)
     • Link 2 title (85%)

🔗 2. Link title (88%)
     🔗 https://example.com
     Description preview...

📝 3. [Another note...]
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Performance degradation** | Fetch limits (100 each), parallel execution, client-side pagination is fast for <1000 items |
| **Memory usage** | Reasonable limits (200 items max in memory), paginate before display |
| **Duplicate results** | Note search includes link metadata, link search is link-only - inherently different scopes, duplicates unlikely |
| **Pagination complexity** | Reuse existing pagination patterns, test edge cases (empty results, single page) |
| **Callback data size** | URL-encode keywords, Telegram supports up to 64 bytes, typical keywords fit easily |
| **Breaking existing commands** | `/notes search` and `/links search` remain unchanged, no modifications to existing code |

## Integration Points

**Modified Files**:
- `src/bot/client.ts` - Add `/search` command handler and `showUnifiedSearchResults()` method

**Dependencies**:
- `src/database/noteOperations.ts` - Existing search functions (no changes)
- `src/utils/validation.ts` - Existing validation (no changes)
- `src/utils/linkFormatter.ts` - Existing formatters (no changes)
- `src/utils/statusMessageManager.ts` - Existing status messages (no changes)

## Success Criteria

**Technical**:
- Parallel search executes in <1 second
- Client-side merge handles up to 200 results efficiently
- No regression in existing `/notes search` and `/links search`
- Memory usage remains under 10MB for typical queries

**User**:
- Single command easier to remember than two separate commands
- Mixed results ranked by relevance feel intuitive
- Type indicators (📝/🔗) make results scannable
- Pagination works smoothly across merged results

**Business**:
- Reduces user friction (one command vs two)
- Maintains backward compatibility (old commands still work)
- Zero database migration cost (reuses existing functions)
- Foundation for future unified search features

## Robust Product (+0.5 days)

Search filters (type: notes/links/all buttons, date range selectors), result type toggle (switch between mixed/notes-only/links-only views), search history tracking (store last 10 searches with timestamps), inline filter buttons for quick category filtering.

## Advanced Product (+1 day)

Result grouping UI (separate sections for notes/links with independent pagination), export functionality (CSV/JSON/Markdown formats), saved search queries (name and save common searches), search analytics dashboard (most searched terms, search patterns), search result caching for instant repeat queries.

---

**Total MVP Effort**: 8 hours (1 day) | **Dependencies**: None

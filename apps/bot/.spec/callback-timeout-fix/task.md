# Callback Query Timeout Fix - Implementation Tasks

**Status**: Not Started | **MVP Effort**: 4-6 hours | **Priority**: High

---

## T-1: Implement Batch Image Fetching Method

**Effort**: 1.5h | **Dependencies**: None

- [ ] Add method overload signature in `src/database/noteOperations.ts` before line 478
  ```typescript
  async getNoteImages(noteIds: string[]): Promise<Map<string, NoteImage[]>>;
  async getNoteImages(noteId: string): Promise<NoteImage[]>;
  async getNoteImages(input: string | string[]): Promise<Map<string, NoteImage[]> | NoteImage[]>
  ```
- [ ] Implement runtime type checking to branch on array vs string input
- [ ] For array input: query with `.in('note_id', noteIds)`, group by note_id into Map
- [ ] For string input: call existing single-fetch logic (backward compatibility)
- [ ] Follow exact pattern from `getNotesCategories()` in `operations.ts:453-484`
- [ ] Add error handling with `handleDatabaseError()`
- [ ] Return empty Map for batch if error, empty array for single

**Test Cases**:
- [ ] Batch fetch with 5 noteIds returns Map with correct grouping
- [ ] Single noteId fetch returns array (backward compatibility)
- [ ] Empty array input returns empty Map
- [ ] Non-existent noteIds return Map with missing keys (not error)
- [ ] Database error returns empty Map/array gracefully

**Acceptance**:
- ✅ Method compiles with no TypeScript errors
- ✅ Batch fetch executes single query (check Supabase logs)
- ✅ Map keys match input noteIds
- ✅ Existing code using single noteId still works
- ✅ Error handling prevents crashes

---

## T-2: Update showNotesPage() to Use Batch Fetching

**Effort**: 1h | **Dependencies**: T-1

- [ ] Locate `showNotesPage()` at `src/bot/client.ts:751`
- [ ] Extract noteIds array from `result.notes` (line 775)
- [ ] Replace `Promise.all` + individual `getNoteImages()` calls (lines 779-789)
- [ ] Call batch method: `const imagesMap = await noteOps.getNoteImages(noteIds)`
- [ ] Map results: `notes.map(note => ({ ...note, images: imagesMap.get(note.note_id) || [] }))`
- [ ] Remove Promise.all wrapper
- [ ] Add timing log: `console.log('Image fetch time:', Date.now() - start, 'ms')`

**Acceptance**:
- ✅ Query count reduced from 5 individual queries to 1 batch query
- ✅ Notes display with correct images
- ✅ Empty image arrays handled gracefully
- ✅ Timing logged to console

---

## T-3: Move Callback Query Answers Before Operations

**Effort**: 1h | **Dependencies**: None

- [ ] Update callback handler at `src/bot/client.ts:273-510`
- [ ] For each handler (notes_page, links_page, search_page, etc.):
  - Move `ctx.answerCallbackQuery()` to immediately after validation (before show*Page() call)
  - Add loading indicator: `ctx.answerCallbackQuery('⏳ Loading...')` for long operations
- [ ] Handle 9 callback types:
  - `notes_page_`, `links_page_`, `search_page_`
  - `notes_search_`, `links_only_page_`, `links_only_search_`
  - `category_page_`, `archived_page_`, `archived_search_`
  - `detail:`, `back:notes:`
- [ ] Keep error handler's answerCallbackQuery as fallback (line 505)
- [ ] Add timing log before answer: `console.log('Answering callback at', Date.now())`

**Acceptance**:
- ✅ All callback queries answered within 100ms
- ✅ No "query is too old" errors in PM2 logs
- ✅ Loading indicator shows for users
- ✅ Error handler still answers on failure

---

## T-4: Add Message Content Comparison

**Effort**: 0.5h | **Dependencies**: None

- [ ] Create helper function `hashContent(text, replyMarkup)` returning string hash
  ```typescript
  function hashContent(text: string, markup: any): string {
    return JSON.stringify({ text, markup });
  }
  ```
- [ ] Before each `editMessageText()` call in show*Page() methods:
  - Store current content hash before operation
  - Generate new content hash after formatting
  - Compare hashes: `if (oldHash === newHash) return;`
- [ ] Apply to key methods:
  - `showNotesPage()` (line 751)
  - `showLinksPage()`
  - `showSearchResults()`
  - `showNoteDetail()`

**Acceptance**:
- ✅ No "message is not modified" errors in PM2 logs
- ✅ Redundant edits skipped (log "Content unchanged, skipping edit")
- ✅ Changed content still edits message correctly

---

## T-5: Add Comprehensive Performance Logging

**Effort**: 0.5h | **Dependencies**: T-1, T-2

- [ ] Add timing wrapper in callback handler (line 274):
  ```typescript
  const startTime = Date.now();
  console.log('[Callback]', data, 'started at', new Date().toISOString());
  ```
- [ ] Log after database operations:
  ```typescript
  console.log('[DB] getNotesWithPagination:', duration1, 'ms');
  console.log('[DB] getNoteImages:', duration2, 'ms');
  console.log('[DB] getNotesCategories:', duration3, 'ms');
  ```
- [ ] Log total operation time at end:
  ```typescript
  console.log('[Callback]', data, 'completed in', Date.now() - startTime, 'ms');
  ```
- [ ] Add context to error logs (noteIds, page, operation name)

**Acceptance**:
- ✅ All database queries logged with timing
- ✅ Total operation time visible in PM2 logs
- ✅ Easy to grep for performance issues
- ✅ Error logs include debugging context

---

## T-6: Update Similar Methods (Links, Search, Categories)

**Effort**: 1h | **Dependencies**: T-2

- [ ] Apply batch image fetching to `showLinksPage()` if it fetches images
- [ ] Apply batch image fetching to `showSearchResults()` for note results
- [ ] Apply batch image fetching to `showNotesByCategory()`
- [ ] Apply batch image fetching to `showArchivedNotesPage()`
- [ ] Apply batch image fetching to `showNoteDetail()` (single note, use string overload)
- [ ] Ensure all methods follow same optimized pattern

**Acceptance**:
- ✅ All pagination views use batch fetching
- ✅ Consistent performance across all list types
- ✅ No N+1 queries remain in codebase

---

## T-7: Improve Error Handling & Timeout Detection

**Effort**: 0.5h | **Dependencies**: T-3

- [ ] Update error handler at line 502-509
- [ ] Detect timeout-specific errors:
  ```typescript
  if (error.message?.includes('query is too old')) {
    console.error('[Timeout] Callback query expired:', error);
    return; // Don't try to answer again
  }
  ```
- [ ] Prevent double-answering expired callbacks
- [ ] Add context logging (userId, operation, timestamp)
- [ ] Log stack trace for non-timeout errors

**Acceptance**:
- ✅ Timeout errors logged distinctly
- ✅ No cascading error attempts
- ✅ Helpful debugging information in logs
- ✅ Non-timeout errors still get proper handling

---

## T-8: Testing & Validation

**Effort**: 1h | **Dependencies**: T-1, T-2, T-3, T-4, T-5, T-6, T-7

- [ ] Build and deploy: `pnpm build && pm2 restart telepocket`
- [ ] Monitor PM2 logs: `pm2 logs telepocket --lines 100`
- [ ] Test pagination through 600+ notes (multiple pages)
- [ ] Verify timing logs show <500ms total operations
- [ ] Verify callback answered in <100ms
- [ ] Click same page button twice (test idempotent edits)
- [ ] Test all pagination types: notes, links, search, categories, archived
- [ ] Monitor for 1 hour, check for timeout errors
- [ ] Verify query count reduced (check logs)

**Test Scenarios**:
- [ ] Navigate pages 1 → 2 → 3 → 2 (back) → 1
- [ ] Click current page button (should skip edit)
- [ ] Search with keyword, paginate results
- [ ] Filter by category, paginate results
- [ ] View archived notes, paginate
- [ ] Click note detail, return to list

**Acceptance**:
- ✅ Zero timeout errors in 1-hour test
- ✅ Zero "message is not modified" errors
- ✅ All pagination flows work correctly
- ✅ Timing logs show performance improvement
- ✅ User experience feels instant

---

## Final Verification (MVP)

**Functional**:
- [ ] Batch image fetching method works for arrays and single strings
- [ ] All callback queries answered within 100ms
- [ ] Message edits skipped when content unchanged
- [ ] All pagination handlers updated
- [ ] Error handling prevents cascades

**Performance**:
- [ ] Query count: 7 → 3 per page load (verified in logs)
- [ ] Callback answer time: <100ms (verified in logs)
- [ ] Total operation time: <500ms (verified in logs)
- [ ] Zero timeout errors (24-hour monitoring)
- [ ] Zero redundant edit errors (24-hour monitoring)

**Logging**:
- [ ] Database query timing visible
- [ ] Total operation timing visible
- [ ] Callback handling logged with timestamps
- [ ] Error context includes noteIds, page, operation

**Code Quality**:
- [ ] TypeScript compiles with no errors
- [ ] Method overloading works correctly
- [ ] Follows existing codebase patterns
- [ ] Backward compatibility maintained

---

## Robust Product Tasks

**T-9: Query Result Caching** (+2h)
- Implement in-memory Map cache with 5-minute TTL
- Cache key: userId + page + view type
- Invalidate on new note creation
- Monitor hit rate via logs

**T-10: Connection Pool Monitoring** (+1h)
- Track Supabase client metrics
- Log slow queries (>200ms)
- Alert on connection errors

**T-11: Retry Logic** (+1h)
- Exponential backoff for transient failures
- Max 3 retries with 100ms, 200ms, 400ms delays
- Log retry attempts

---

## Advanced Product Tasks

**T-12: Redis Caching Layer** (+4h)
- Integrate ioredis client
- Cache paginated results with smart invalidation
- Set TTL based on data volatility

**T-13: Performance Monitoring** (+2h)
- Integrate with Supabase Performance Insights API
- Track p50/p95/p99 latencies
- Dashboard for query performance

**T-14: Predictive Prefetching** (+2h)
- Analyze user navigation patterns
- Prefetch likely next pages
- Warm cache proactively

---

**Total MVP Tasks**: T-1 through T-8 | **Effort**: 4-6 hours

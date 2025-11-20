# Callback Query Timeout Fix - Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Batch Fetch Pattern** | Method overloading (`string \| string[]`) | Matches TypeScript best practices, maintains backward compatibility, single method name simplifies API |
| **Callback Timing** | Answer immediately, then process | Grammy.js best practice: acknowledge within 10s, queue long operations, prevents timeout errors |
| **Content Comparison** | JSON stringify + hash comparison | Lightweight, catches all changes (text + markup), prevents "message is not modified" errors |
| **Error Handling** | Try-catch with timeout detection | Graceful degradation, specific error messages for timeout vs other failures, prevents error cascades |
| **Logging Strategy** | console.log with timing metrics | Simple debugging, integrates with PM2 logs, zero dependencies, easy to grep for performance analysis |
| **Migration Strategy** | Backward compatible overload | Existing code continues working, gradual migration possible, zero breaking changes |

## Codebase Integration Strategy

**Database Layer**: `src/database/noteOperations.ts`
- Add method overload before existing `getNoteImages(noteId: string)` at line 478
- Follow exact pattern from `getNotesCategories()` in `operations.ts:453-484`
- Return `Map<string, NoteImage[]>` for batch, `NoteImage[]` for single
- Reuse existing indexes: `idx_note_images_note_id` (line 18 in migration)

**Bot Layer**: `src/bot/client.ts`
- Update callback handler starting at line 273
- Move `ctx.answerCallbackQuery()` calls before `show*Page()` operations
- Update `showNotesPage()` at line 751 to use batch image fetching
- Add content comparison before `editMessageText()` calls
- Apply pattern to all 9 callback handlers: notes_page, links_page, search_page, etc.

**Logging Integration**:
- Add timing logs after database operations
- Follow existing console.error pattern (line 503: "Callback query error:")
- Include operation name, duration, noteIds for debugging

**Error Handling Pattern**:
- Keep existing try-catch structure (lines 502-509)
- Add timeout detection for answerCallbackQuery failures
- Prevent double-answering callback queries

## Technical Approach

**Existing Patterns to Follow**:
1. **Batch Fetching**: Study `getNotesCategories()` in `src/database/operations.ts:453-484` for Map-based grouping pattern
2. **Method Overloading**: TypeScript union types `string | string[]` with runtime type checking
3. **Error Handling**: Follow pattern from `handleDatabaseError()` in `src/utils/errorHandler.ts`
4. **Grammy.js Callbacks**: Current handlers at `src/bot/client.ts:273-510` show structure to modify

**Component Composition**:
- `NoteOperations.getNoteImages()` → returns Map or Array based on input type
- `TelegramClient.showNotesPage()` → calls batch fetch, maps results to notes
- Callback handlers → answer immediately, then call show methods
- Error handlers → catch timeout errors specifically, log context

**Data Flow**:
```
Button Click → Callback Handler
  ↓
1. ctx.answerCallbackQuery() [<100ms]
  ↓
2. Batch Database Queries [<500ms]
   - getNotesWithPagination(userId, page, 5)
   - getNoteImages([id1, id2, id3, id4, id5])  ← NEW
   - getNotesCategories([id1, id2, id3, id4, id5])
  ↓
3. Map Results to Notes [<10ms]
   - notes.map(n => ({ ...n, images: imagesMap.get(n.id) }))
  ↓
4. Generate Message Content [<10ms]
  ↓
5. Compare with Current Content [<5ms]
  ↓
6. editMessageText() if changed [<100ms]
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Breaking existing code** | Method overloading maintains backward compatibility, single noteId calls still work |
| **Map lookup performance** | JavaScript Map O(1) lookup, negligible overhead for 5 items, tested in getNotesCategories() |
| **Database index missing** | `idx_note_images_note_id` already exists (migration 20251103131515), verified in schema |
| **Callback answer race condition** | Move answerCallbackQuery() to top of handler, before any async operations |
| **Content hash collision** | Use JSON.stringify for deterministic serialization, extremely low collision probability |
| **Migration disruption** | Zero database changes needed, pure application-layer optimization |

## Integration Points

**Database Operations**: `src/database/noteOperations.ts:478`
**Callback Handlers**: `src/bot/client.ts:273-510`
**Display Methods**: `src/bot/client.ts:751` (showNotesPage), similar patterns for other views
**Error Handling**: `src/utils/errorHandler.ts` (follow existing patterns)
**PM2 Logs**: `/Users/ding/.pm2/logs/telepocket-error.log` (verify timeout errors eliminated)

## Success Criteria

**Technical**:
- Query count reduced from 7 to 3 per page load (measured via logs)
- Callback query answered in <100ms (measured via timestamps)
- Zero "query is too old" errors in PM2 logs (24-hour monitoring)
- Zero "message is not modified" errors in PM2 logs

**User**:
- Pagination feels instant (<500ms perceived latency)
- No "loading forever" states from timeout errors
- Smooth navigation through 600+ note collection

**Business**:
- Bot reliability increases (zero timeouts)
- User engagement remains high (no frustration from lag)
- Infrastructure costs unchanged (query optimization, not scaling)

## Robust Product (+4h)

Query result caching with 5-minute TTL using in-memory Map, connection pool health monitoring via Supabase client metrics, automatic retry logic for transient failures with exponential backoff, metrics dashboard tracking p50/p95/p99 query latencies.

## Advanced Product (+8h)

Redis caching layer for frequently accessed pages with smart invalidation, database query analytics integrated with Supabase Performance Insights API, predictive prefetching for likely next pages based on user patterns, real-time performance monitoring with Slack/Telegram alerts for degradation.

---

**Total MVP Effort**: 4-6 hours | **Dependencies**: None

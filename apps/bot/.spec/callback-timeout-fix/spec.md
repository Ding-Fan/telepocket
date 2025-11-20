# Callback Query Timeout Fix & N+1 Query Elimination

## Problem & Solution

**Problem**: Telegram bot experiences severe lag (3-5+ seconds) when users navigate paginated lists. Callback queries timeout after 10 seconds, causing error cascades. Current implementation makes 7 database queries per page load (1 for notes, 1 for categories, 5 individual queries for images = N+1 problem).

**Solution**: (1) Answer callback queries immediately before database operations, (2) implement batch image fetching to reduce queries from 7→3 per page, (3) prevent redundant message edits when content hasn't changed, (4) add comprehensive performance logging.

**Returns**: Sub-second response times, zero timeout errors, 57% reduction in database calls.

## Current Architecture (Broken)

**Callback Handler Flow**:
```
Button Click
  ↓
Database Operations (3-5 seconds)
  ├─ getNotesWithPagination()     [Query 1]
  ├─ getNotesCategories([ids])    [Query 2] ✅ Batch
  └─ For each note (5 notes):
      └─ getNoteImages(noteId)    [Query 3-7] ❌ N+1 Problem
  ↓
ctx.answerCallbackQuery()         ❌ TOO LATE! (Already timed out)
  ↓
Telegram Timeout Error (10s limit exceeded)
```

**Image Fetching Pattern (N+1)**:
```typescript
// src/bot/client.ts:779-789
const notesWithImages = await Promise.all(
  result.notes.map(async (note) => {
    const images = await noteOps.getNoteImages(note.note_id);  // ❌ 1 query per note
    ...
  })
);
```

## Target Architecture (Fixed)

**Optimized Callback Handler Flow**:
```
Button Click
  ↓
ctx.answerCallbackQuery()         ✅ Immediate (<100ms)
  ↓
Database Operations (optimized)
  ├─ getNotesWithPagination()     [Query 1]
  ├─ getNotesCategories([ids])    [Query 2] ✅ Batch
  └─ getNoteImages([ids])          [Query 3] ✅ Batch (NEW)
  ↓
Check if message content changed  ✅ Idempotent
  ↓
editMessageText() only if needed
```

**Batch Image Fetching Pattern**:
```typescript
// Fetch all images in single query
const noteIds = result.notes.map(n => n.note_id);
const imagesMap = await noteOps.getNoteImages(noteIds);  // ✅ Single query

const notesWithImages = result.notes.map(note => ({
  ...note,
  images: imagesMap.get(note.note_id) || []
}));
```

## New API Method

```typescript
interface NoteImage {
  id: string;
  note_id: string;
  cloudflare_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  created_at: string;
  updated_at: string;
}

class NoteOperations {
  // NEW: Batch fetch images for multiple notes
  async getNoteImages(noteIds: string[]): Promise<Map<string, NoteImage[]>>;

  // DEPRECATED: Single note image fetch (keep for backward compatibility)
  async getNoteImages(noteId: string): Promise<NoteImage[]>;
}
```

## Core Flow

```
User clicks pagination button
  ↓
Answer callback query immediately (show loading indicator)
  ↓
Fetch data with batch queries (3 queries total)
  ↓
Check if message content changed (hash comparison)
  ↓
Edit message only if content differs
  ↓
Log timing metrics (query duration, total duration)
```

## User Stories

**US-1: Fast Pagination Response**
User clicks "Next Page" button on notes list. Bot immediately acknowledges with loading indicator (<100ms), then updates message with new page content within 500ms. No timeout errors occur even with 600+ notes.

**US-2: Efficient Image Loading**
User navigates to page with 5 notes, each having 2-3 images. Bot fetches all images in single database query instead of 5 separate queries, reducing load time from 3 seconds to <500ms.

**US-3: Idempotent Navigation**
User accidentally clicks same page button twice. Bot detects content hasn't changed and skips redundant message edit, preventing "message is not modified" errors.

## MVP Scope

**Included**:
- Batch image fetching method `getNoteImages(noteIds[])`
- Immediate callback query answering in all handlers
- Message content comparison before edits
- Performance timing logs (query duration, total duration)
- Error handling with timeout detection
- Update all pagination handlers: notes_page, links_page, search_page, category_page, archived_page
- Backward compatibility for single noteId calls

**NOT Included** (Future):
- Query result caching → 🔧 Robust
- Connection pool monitoring → 🔧 Robust
- Redis caching layer → 🚀 Advanced
- Database query analytics dashboard → 🚀 Advanced

## Database Schema

**Existing Tables** (no changes needed):
- `z_note_images` - Has `idx_note_images_note_id` index (already optimized for batch queries)
- `z_note_categories` - Has `idx_note_categories_note_id` index (already optimized)

**Query Pattern**:
```sql
-- Before (N+1): 5 queries
SELECT * FROM z_note_images WHERE note_id = 'uuid1';
SELECT * FROM z_note_images WHERE note_id = 'uuid2';
SELECT * FROM z_note_images WHERE note_id = 'uuid3';
SELECT * FROM z_note_images WHERE note_id = 'uuid4';
SELECT * FROM z_note_images WHERE note_id = 'uuid5';

-- After (Batch): 1 query
SELECT * FROM z_note_images
WHERE note_id IN ('uuid1', 'uuid2', 'uuid3', 'uuid4', 'uuid5')
ORDER BY created_at ASC;
```

## Acceptance Criteria (MVP)

**Functional**:
- [ ] Batch image fetching returns Map<noteId, NoteImage[]>
- [ ] All callback handlers answer within 100ms
- [ ] Message edits only occur when content changes
- [ ] Backward compatibility for single noteId maintained
- [ ] Zero callback query timeout errors in logs
- [ ] All pagination flows work: notes, links, search, categories, archived

**Performance**:
- [ ] Query count reduced from 7 to 3 per page load
- [ ] Page load time under 500ms for typical dataset
- [ ] Callback answer time under 100ms
- [ ] No "query is too old" errors in PM2 logs
- [ ] No "message is not modified" errors in PM2 logs

**Logging**:
- [ ] Database query timing logged (ms)
- [ ] Total operation timing logged (ms)
- [ ] Callback query handling logged with timestamps
- [ ] Error logs include context (noteIds, page number, operation)

**Code Quality**:
- [ ] TypeScript types properly defined
- [ ] Error handling prevents cascading failures
- [ ] Method signature supports both array and single string
- [ ] Follows existing pattern from getNotesCategories()

## Future Tiers

**🔧 Robust** (+4h): Query result caching with TTL (5 min), connection pool health monitoring, automatic retry logic for transient failures, metrics dashboard for query performance tracking.

**🚀 Advanced** (+8h): Redis caching layer for frequently accessed pages, database query analytics with Supabase Performance Insights integration, predictive prefetching for likely next pages, real-time performance monitoring alerts.

---

**Status**: Ready for Implementation | **MVP Effort**: 4-6 hours

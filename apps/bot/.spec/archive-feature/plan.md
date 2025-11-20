# Archive Feature Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Status Storage** | TEXT column with enum values | Flexible for future states (trash, pinned), indexed for fast queries, human-readable in database |
| **Status Values** | 'active', 'archived' | Clear semantic meaning, follows existing is_marked pattern, allows future expansion to 'deleted' |
| **Query Filtering** | Add WHERE status = 'active' to existing RPCs | Minimal disruption to existing code, leverages existing optimized functions, maintains single source of truth |
| **Command Pattern** | `/archived` mirrors `/notes` structure | Consistent UX, reuses existing pagination/search patterns, easy for users to learn |
| **Button Placement** | Archive replaces delete in active notes | Two-step safety: archive first, then delete if needed, prevents accidental permanent deletion |
| **Index Strategy** | Composite index (status, telegram_user_id) | Optimizes most common queries (filter by status + user), supports both active and archived views efficiently |

## Codebase Integration Strategy

**Database Layer**: `supabase/migrations/`
- New migration: `add_status_to_notes.sql`
- Add status column with default 'active'
- Create composite index for performance
- Backfill existing notes to 'active' status

**Operations Layer**: `src/database/noteOperations.ts`
- Add archiveNote() and unarchiveNote() methods
- Add getArchivedNotesWithPagination() method
- Add searchArchivedNotesWithPagination() method
- Follow existing method patterns (validation, error handling)

**Bot Commands**: `src/bot/client.ts`
- Add `/archived` command handler (mirror `/notes` logic)
- Add callback handlers for archived pagination
- Update showNoteDetail() to conditionally show archive/unarchive button
- Add showArchivedNotesPage() and showArchivedNoteSearchResults()

**Database Functions**: Create new RPCs or modify existing
- `get_archived_notes_with_pagination` (similar to existing)
- `search_archived_notes_fuzzy_optimized` (similar to existing)
- Update existing RPCs to filter WHERE status = 'active'

## Technical Approach

**Existing Patterns to Follow**:
1. **Pagination**: Study `showNotesPage()` in `src/bot/client.ts:644` for pagination structure
2. **Search**: Study `showNoteSearchResults()` in `src/bot/client.ts:892` for search pattern
3. **Database Operations**: Study `getNotesWithPagination()` in `src/database/noteOperations.ts:133` for query structure
4. **Callback Handlers**: Study callback_query handler in `src/bot/client.ts:224` for navigation pattern
5. **Button Layout**: Study `showNoteDetail()` in `src/bot/client.ts:1255` for action button rows

**Migration Strategy**:
- Create migration with proper rollback documentation
- Add status column with default 'active' (non-breaking)
- Backfill existing notes to 'active' status
- Create composite index for performance
- Use Supabase skill to apply migration

**Query Update Flow**:
1. Identify all database functions that query z_notes
2. Add `WHERE status = 'active'` to each query
3. Create parallel functions for archived notes
4. Update noteOperations.ts to use correct queries

**UI Button Logic**:
```typescript
// In showNoteDetail()
if (note.status === 'active') {
  // Show: Back, Archive, Mark
} else if (note.status === 'archived') {
  // Show: Back, Unarchive, Delete
}
```

**Command Handler Pattern**:
```typescript
// /archived command (mirror /notes structure)
if (args[1] === 'search') {
  await showArchivedNoteSearchResults(ctx, userId, keyword, page);
} else if (!isNaN(parseInt(args[1]))) {
  await showArchivedNotesPage(ctx, userId, page);
} else {
  await showArchivedNotesPage(ctx, userId, 1);
}
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Breaking existing queries** | Test all existing commands after migration; add WHERE status = 'active' to all z_notes queries systematically |
| **Performance degradation** | Create composite index (status, telegram_user_id); validate index usage with EXPLAIN ANALYZE |
| **Data migration failure** | Write rollback script; test on development branch; backfill in transaction with error handling |
| **Callback data overflow** | Follow existing pattern using encoded strings; validate length limits (64 bytes for Telegram) |

## Integration Points

**Database Functions**: `supabase/migrations/`
- Modify: All existing RPCs that query z_notes
- Create: `get_archived_notes_with_pagination`
- Create: `search_archived_notes_fuzzy_optimized`

**Note Operations**: `src/database/noteOperations.ts`
- Modify: `getNoteById()` to include status
- Add: `archiveNote()`, `unarchiveNote()`
- Add: `getArchivedNotesWithPagination()`
- Add: `searchArchivedNotesWithPagination()`

**Bot Client**: `src/bot/client.ts`
- Add: `/archived` command handler (line ~165)
- Add: Archived pagination callbacks (line ~340)
- Modify: `showNoteDetail()` button logic (line ~1283)
- Add: `showArchivedNotesPage()` method
- Add: `showArchivedNoteSearchResults()` method

**Help Text**: `src/constants/helpMessages.ts`
- Add documentation for `/archived` command

## Success Criteria

**Technical**:
- All existing tests pass after migration
- Archived notes don't appear in `/notes` or `/notes search`
- Archive/unarchive operations complete in <500ms
- Composite index used for all status queries

**User**:
- Users can archive notes from detail view
- Users can view archived notes via `/archived`
- Users can search archived notes
- Users can unarchive or delete archived notes

**Business**:
- Zero data loss during migration
- No downtime during deployment
- Feature ready for production use

## Robust Product (+1 day)

Bulk archive operations (checkbox selection in list view), archive confirmation dialog (prevent accidents), archive stats in `/notes` header ("5 notes, 2 archived"), keyboard shortcuts for quick archive.

## Advanced Product (+2 days)

Auto-archive notes older than configurable days, trash status for soft-delete (30-day retention), search across active+archived with filter toggle, archive history timeline, export archived notes to JSON/CSV.

---

**Total MVP Effort**: 16-24 hours (2-3 days) | **Dependencies**: Supabase skill for migration

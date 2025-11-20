# Archive Feature Implementation Tasks

**Status**: Not Started | **MVP Effort**: 18 hours | **Priority**: Medium

---

## T-1: Database Migration Setup

**Effort**: 2h | **Dependencies**: None

- [ ] Use Supabase skill to create migration file
  ```bash
  # Skill will execute:
  supabase migration new add_status_to_notes
  ```
- [ ] Write migration SQL with rollback documentation
  ```sql
  -- Add status column
  ALTER TABLE z_notes ADD COLUMN status TEXT DEFAULT 'active';

  -- Create composite index
  CREATE INDEX idx_notes_status ON z_notes(status, telegram_user_id);

  -- Backfill existing notes
  UPDATE z_notes SET status = 'active' WHERE status IS NULL;

  -- Rollback: ALTER TABLE z_notes DROP COLUMN status; DROP INDEX idx_notes_status;
  ```
- [ ] Test migration on local Supabase instance
- [ ] Verify index created with EXPLAIN ANALYZE

**Acceptance**:
- ✅ Migration file created with proper rollback instructions
- ✅ Status column added with default 'active'
- ✅ Composite index improves query performance
- ✅ All existing notes have status = 'active'

---

## T-2: Update Database Functions (Active Notes Filter)

**Effort**: 3h | **Dependencies**: T-1

- [ ] Update `get_notes_with_pagination` RPC
  - Add `WHERE status = 'active'` to query
- [ ] Update `search_notes_fuzzy_optimized` RPC
  - Add `AND status = 'active'` to WHERE clause
- [ ] Test that existing `/notes` command excludes archived
- [ ] Test that existing `/notes search` excludes archived

**Test Cases**:
- [ ] Create test note, archive it manually in DB, verify hidden from `/notes`
- [ ] Search returns only active notes
- [ ] Pagination works correctly with filtered results

**Acceptance**:
- ✅ Active notes queries exclude archived notes
- ✅ Existing commands work without modification
- ✅ No performance regression (validate with EXPLAIN ANALYZE)

---

## T-3: Create Archived Notes Database Functions

**Effort**: 2h | **Dependencies**: T-2

- [ ] Create `get_archived_notes_with_pagination` RPC
  - Copy structure from `get_notes_with_pagination`
  - Change WHERE to `status = 'archived'`
- [ ] Create `search_archived_notes_fuzzy_optimized` RPC
  - Copy structure from `search_notes_fuzzy_optimized`
  - Change WHERE to `status = 'archived'`
- [ ] Test both functions return correct results

**Acceptance**:
- ✅ Archived pagination function returns archived notes only
- ✅ Archived search function returns fuzzy-matched archived notes
- ✅ Functions use composite index efficiently

---

## T-4: Add Archive Operations to noteOperations.ts

**Effort**: 2h | **Dependencies**: T-3

- [ ] Add `archiveNote()` method
  ```typescript
  async archiveNote(noteId: string, userId: number): Promise<boolean>
  ```
- [ ] Add `unarchiveNote()` method
  ```typescript
  async unarchiveNote(noteId: string, userId: number): Promise<boolean>
  ```
- [ ] Add `getArchivedNotesWithPagination()` method
- [ ] Add `searchArchivedNotesWithPagination()` method
- [ ] Include user authorization validation
- [ ] Include error handling

**Acceptance**:
- ✅ archiveNote() updates status to 'archived' with user check
- ✅ unarchiveNote() updates status to 'active' with user check
- ✅ Archived pagination returns correct results
- ✅ Archived search returns fuzzy-matched results
- ✅ All methods handle errors gracefully

---

## T-5: Update getNoteById to Include Status

**Effort**: 1h | **Dependencies**: T-4

- [ ] Modify `getNoteById()` in noteOperations.ts
  - Add `status` to SELECT query
  - Update NoteSearchResult interface to include status (optional field)
- [ ] Update formatNoteDetailView() to accept status
- [ ] Test note detail view shows correct status

**Acceptance**:
- ✅ getNoteById returns status field
- ✅ Type definitions updated
- ✅ No breaking changes to existing calls

---

## T-6: Add /archived Command Handler

**Effort**: 3h | **Dependencies**: T-5

- [ ] Add `/archived` command handler in `client.ts` (line ~165)
  ```typescript
  this.bot.command('archived', async (ctx) => {
    // Parse args: /archived, /archived <page>, /archived search <keyword>
  });
  ```
- [ ] Parse command arguments (page number or search)
- [ ] Call `showArchivedNotesPage()` or `showArchivedNoteSearchResults()`
- [ ] Add authorization check

**Acceptance**:
- ✅ `/archived` shows first page of archived notes
- ✅ `/archived <page>` shows specific page
- ✅ `/archived search <keyword>` searches archived notes
- ✅ Unauthorized users rejected

---

## T-7: Implement showArchivedNotesPage Method

**Effort**: 2h | **Dependencies**: T-6

- [ ] Create `showArchivedNotesPage()` method (mirror `showNotesPage()`)
- [ ] Fetch archived notes with `noteOps.getArchivedNotesWithPagination()`
- [ ] Format message header: "📦 Archived Notes"
- [ ] Create emoji number buttons for detail view
- [ ] Add pagination buttons (Previous/Next)
- [ ] Handle empty results with helpful message

**Acceptance**:
- ✅ Archived notes displayed with pagination
- ✅ Emoji number buttons navigate to detail view
- ✅ Pagination works correctly
- ✅ Empty state shows helpful message

---

## T-8: Implement showArchivedNoteSearchResults Method

**Effort**: 2h | **Dependencies**: T-7

- [ ] Create `showArchivedNoteSearchResults()` method (mirror `showNoteSearchResults()`)
- [ ] Fetch results with `noteOps.searchArchivedNotesWithPagination()`
- [ ] Format message header: "🔍 Search Results (Archived)"
- [ ] Add relevance scores to results
- [ ] Add pagination with encoded keyword
- [ ] Handle no results with helpful message

**Acceptance**:
- ✅ Archived search returns fuzzy-matched results
- ✅ Relevance scores displayed
- ✅ Pagination preserves search keyword
- ✅ No results handled gracefully

---

## T-9: Add Callback Handlers for Archived Navigation

**Effort**: 1h | **Dependencies**: T-8

- [ ] Add `archived_page_` callback handler (line ~340)
- [ ] Add `archived_search_` callback handler
- [ ] Add `archived_page_info` handler (page indicator)
- [ ] Test pagination navigation works

**Acceptance**:
- ✅ Archived pagination buttons work
- ✅ Archived search pagination works
- ✅ Page indicator shows correctly

---

## T-10: Update Note Detail View Button Logic

**Effort**: 2h | **Dependencies**: T-9

- [ ] Modify `showNoteDetail()` method (line ~1255)
- [ ] Add conditional button logic based on note.status
  ```typescript
  if (note.status === 'archived') {
    // Show: Unarchive, Delete
  } else {
    // Show: Archive, Mark
  }
  ```
- [ ] Update button text and callback_data
- [ ] Test both active and archived detail views

**Acceptance**:
- ✅ Active notes show Archive button (not Delete)
- ✅ Archived notes show Unarchive and Delete buttons
- ✅ Mark button only appears for active notes
- ✅ Callback data correctly identifies operation

---

## T-11: Implement Archive/Unarchive/Delete Handlers

**Effort**: 2h | **Dependencies**: T-10

- [ ] Add `archive:` callback handler
  - Call `noteOps.archiveNote()`
  - Show success message
  - Return to notes list
- [ ] Add `unarchive:` callback handler
  - Call `noteOps.unarchiveNote()`
  - Show success message
  - Return to archived notes list
- [ ] Update `delete:` handler to work with archived notes only
- [ ] Add validation to prevent deleting active notes

**Acceptance**:
- ✅ Archive button archives note and returns to list
- ✅ Unarchive button restores note to active
- ✅ Delete button works only on archived notes
- ✅ Success feedback shows for each operation

---

## T-12: Update Help Messages

**Effort**: 0.5h | **Dependencies**: T-11

- [ ] Add `/archived` to help text in `helpMessages.ts`
- [ ] Document usage patterns:
  - `/archived` - list archived notes
  - `/archived <page>` - specific page
  - `/archived search <keyword>` - search
- [ ] Update `/help` command output

**Acceptance**:
- ✅ Help text includes `/archived` command
- ✅ Usage examples clear and accurate
- ✅ Help command displays updated text

---

## Final Verification (MVP)

**Functional**:
- [ ] Archived notes excluded from `/notes`
- [ ] Archived notes excluded from `/notes search`
- [ ] `/archived` command lists archived notes
- [ ] `/archived search` searches archived notes
- [ ] Archive button works in active note detail
- [ ] Unarchive button works in archived note detail
- [ ] Delete button only appears for archived notes
- [ ] All pagination works correctly

**UI/UX**:
- [ ] Archive button uses 📦 emoji
- [ ] Unarchive button uses 📤 emoji
- [ ] Success messages show for archive/unarchive/delete
- [ ] Page indicators show correct counts
- [ ] Empty states show helpful messages

**Data Integrity**:
- [ ] Archived notes retain all data (links, images, categories)
- [ ] User authorization enforced for all operations
- [ ] Invalid note IDs handled gracefully
- [ ] No data loss during archive/unarchive

**Performance**:
- [ ] Queries use composite index efficiently
- [ ] No performance regression in existing commands
- [ ] Archive/unarchive operations complete in <500ms

---

## Robust Product Tasks

**T-13: Bulk Archive Operations** (+4h)
- Checkbox selection in list view
- Multi-select with "Archive Selected" button
- Batch status update query

**T-14: Archive Confirmation Dialog** (+2h)
- Confirmation dialog before archive (prevent accidents)
- "Don't ask again" preference option

**T-15: Archive Stats** (+2h)
- Show archive count in `/notes` header
- Add "View Archived" quick link

---

## Advanced Product Tasks

**T-16: Auto-Archive Feature** (+6h)
- Configuration: days until auto-archive
- Cron job to auto-archive old notes
- Notification before auto-archive

**T-17: Trash Status** (+8h)
- Add 'deleted' status (soft delete)
- 30-day retention before permanent deletion
- `/trash` command for recovery

**T-18: Unified Search** (+4h)
- Search across active + archived with filter toggle
- Filter buttons: [All] [Active] [Archived]
- Show status badge in search results

---

**Total MVP Tasks**: T-1 through T-12 | **Effort**: 18 hours

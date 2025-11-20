# Archive Feature Specification

## Problem & Solution

**Problem**: Users need to hide notes from active view without permanently deleting them. Deleted notes are gone forever with no way to recover.

**Solution**: Add archive functionality with dedicated status state and separate command for viewing archived notes. Archived notes are hidden from regular commands but accessible via `/archived`.

**Returns**: Archived notes remain in database with `status = 'archived'`, preserving all data (links, images, categories).

## Core Flow

```
Active note detail view
  ↓
Click "Archive" button
  ↓
Note status → 'archived'
  ↓
Return to notes list (archived note hidden)

Archived note access
  ↓
/archived command
  ↓
View archived notes (with search)
  ↓
Click note detail
  ↓
"Unarchive" and "Delete" buttons available
```

## User Stories

**US-1: Archive Active Note**
User views note detail and clicks "Archive" button. Note status changes to 'archived' and disappears from `/notes` and search results. User returns to notes list page.

**US-2: View Archived Notes**
User runs `/archived` command to see list of archived notes with pagination. Search functionality works same as `/notes search`. Click emoji number to view detail.

**US-3: Manage Archived Note**
User views archived note detail. Two action buttons available: "Unarchive" (restore to active) and "Delete" (permanent removal). Unarchive returns note to active status.

## MVP Scope

**Included**:
- Database migration: Add `status` column (TEXT) with values: 'active', 'archived'
- Filter active notes: Update all note queries to exclude archived
- Archive button in detail view (replaces delete button for active notes)
- `/archived` command: List archived notes with pagination
- `/archived search <keyword>`: Search archived notes
- Archived note detail view: Show "Unarchive" and "Delete" buttons
- Archive/unarchive operations in noteOperations.ts

**NOT Included** (Future):
- Bulk archive operations → 🔧 Robust
- Auto-archive based on age → 🚀 Advanced
- Trash/deleted status (soft delete) → 🚀 Advanced

## Database Schema

**Migration**: Add status column to z_notes

```sql
ALTER TABLE z_notes
  ADD COLUMN status TEXT DEFAULT 'active';

CREATE INDEX idx_notes_status
  ON z_notes(status, telegram_user_id);

-- Backfill existing notes
UPDATE z_notes
  SET status = 'active'
  WHERE status IS NULL;
```

**Status Values**:
- `'active'`: Normal notes (shown in `/notes`)
- `'archived'`: Hidden notes (shown only in `/archived`)

## Component API

```typescript
interface NoteStatus {
  status: 'active' | 'archived';
}

// Archive operation
async archiveNote(
  noteId: string,
  userId: number
): Promise<boolean>;

// Unarchive operation
async unarchiveNote(
  noteId: string,
  userId: number
): Promise<boolean>;

// Get archived notes
async getArchivedNotesWithPagination(
  userId: number,
  page: number,
  limit: number
): Promise<NotesResult>;

// Search archived notes
async searchArchivedNotesWithPagination(
  userId: number,
  keyword: string,
  page: number,
  limit: number
): Promise<NotesSearchResult>;
```

## Command Usage

```
/archived
→ List archived notes (page 1, 5 per page)

/archived <page>
→ Go to specific page of archived notes

/archived search <keyword>
→ Search archived notes with fuzzy matching
```

## UI Changes

**Active Note Detail View**:
- **Before**: [⬅️ Back] [🗑️ Delete] [⭐ Mark]
- **After**: [⬅️ Back] [📦 Archive] [⭐ Mark]

**Archived Note Detail View**:
- **Buttons**: [⬅️ Back] [📤 Unarchive] [🗑️ Delete]

**Note**: Delete button only appears for archived notes (two-step safety).

## Acceptance Criteria (MVP)

**Functional**:
- [x] Status column added to z_notes with 'active'/'archived' values
- [x] Archived notes excluded from `/notes` command
- [x] Archived notes excluded from `/notes search`
- [x] Archive button replaces delete in active note detail
- [x] `/archived` command shows archived notes with pagination
- [x] `/archived search` supports fuzzy search on archived notes
- [x] Archived note detail shows unarchive and delete buttons
- [x] Archive operation updates status to 'archived'
- [x] Unarchive operation updates status to 'active'
- [x] Delete operation works only on archived notes

**UI/UX**:
- [x] Archive button uses 📦 emoji
- [x] Unarchive button uses 📤 emoji
- [x] Archived list header shows "📦 Archived Notes"
- [x] Callback query feedback shows success messages
- [x] Page navigation works for archived notes

**Data Integrity**:
- [x] Archived notes retain all links, images, categories
- [x] User can only archive/unarchive their own notes
- [x] Invalid note IDs return proper error messages

## Future Tiers

**🔧 Robust** (+1 day): Bulk operations (archive multiple notes at once via checkbox selection), archive confirmation dialog to prevent accidents, archive stats in `/notes` header ("X archived").

**🚀 Advanced** (+2 days): Auto-archive notes older than N days (configurable), trash status for soft-delete (30-day retention before permanent deletion), archive/unarchive from list view without entering detail, search across both active and archived notes with filter toggle.

---

## Implementation Notes

**Status**: ✅ **IMPLEMENTED** | **Date**: 2025-11-06 | **Actual Effort**: ~3 hours

**Migrations Deployed**:
1. `20251105155331_add_status_to_notes.sql` - Added status column with index
2. `20251105155457_update_functions_filter_active_notes.sql` - Updated existing functions
3. `20251105155539_create_archived_notes_functions.sql` - Created archived note functions

**Code Changes**:
- `src/database/noteOperations.ts`: Added archiveNote(), unarchiveNote(), getArchivedNotesWithPagination(), searchArchivedNotesWithPagination()
- `src/bot/client.ts`: Added /archived command, showArchivedNotesPage(), showArchivedNoteSearchResults(), conditional button logic, archive/unarchive handlers
- `src/constants/helpMessages.ts`: Updated help text with archive commands

**Deployment**:
- Built with TypeScript compiler (zero errors)
- Deployed with PM2 using stop → start pattern
- Process running: telepocket (PID 98983, online, production mode)

**Testing Recommendations**:
1. Create test note → Archive → Verify hidden from /notes
2. Run /archived → Should show archived note
3. Test /archived search <keyword>
4. Unarchive note → Verify restored to /notes
5. Archive + Delete → Verify permanent removal

All acceptance criteria met ✅

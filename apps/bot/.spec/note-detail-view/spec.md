# Note Detail View Specification

## Problem & Solution

**Problem**: Users cannot view full note details, delete individual notes, or mark notes for organization from the notes list. All actions require manual database queries or lack quick access.

**Solution**: Use emoji number indexing (1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣) in /notes list → Single row of emoji buttons for quick access → Click emoji button to view full note detail → Provides action buttons (Back, Delete, Mark) for note management.

**Returns**: Interactive detail view with full note content, associated links/images, and management actions accessible via inline keyboard.

## Component API

```typescript
// Callback Query Data Format
interface NoteDetailCallback {
  action: 'detail' | 'back' | 'delete' | 'mark';
  noteId: string;
  page?: number; // For back navigation
}

// Inline Keyboard Buttons
showNoteDetail(noteId: string): InlineKeyboard;
// Buttons: [Back] [Delete] [Mark ⭐] or [Unmark]
```

## Core Flow

```
User views /notes list (page 1-N)
  ↓
Sees notes with emoji indexes:
  1️⃣ Note content... 📷 2 • 🔗 3
  2️⃣ Note content... 📷 1 • 🔗 2
  3️⃣ Note content... 🔗 1

Inline buttons: [1️⃣] [2️⃣] [3️⃣]
  ↓
Click [3️⃣] button
  ↓
Bot shows full note #3 content (edit message)
  - Full text (no truncation)
  - All images with URLs
  - All links with metadata
  - Inline keyboard: [Back] [Delete] [Mark ⭐]
  ↓
User actions:
  - Back → Return to notes list (same page)
  - Delete → Confirm → Delete note → Return to list
  - Mark → Toggle marked status → Update button label
```

## User Stories

**US-1: View Full Note Details**
User sees truncated note in /notes list with emoji number (2️⃣). Clicks [2️⃣] button. Bot shows full note content with all images and links. User reads complete note.

**US-2: Delete Note from Detail View**
User opens note detail, realizes it's no longer needed. Clicks "Delete" button. Bot asks "Are you sure?" with [Yes] [No] buttons. User confirms. Note deleted from database. Bot returns to notes list.

**US-3: Mark Important Note**
User opens note detail for important reference. Clicks "Mark ⭐" button. Note marked as important in database. Button label changes to "Unmark". User returns to list, marked note shows ⭐ indicator.

**US-4: Quick Navigation**
User browsing page 3 of notes. Opens detail for note #12. After reviewing, clicks "Back". Bot returns to page 3 of notes list (same position).

**US-5: Tag Note with Category** *(Added)*
User opens note detail. Sees category buttons: [📋 Todo] [💡 Idea] [📝 Blog] [📺 YouTube] [📚 Reference]. Clicks [💡 Idea]. Bot confirms "✅ Tagged as 💡 Idea". Detail view refreshes with [💡 Idea] button hidden. User returns to list, note shows: 2️⃣ 💡 content...

## MVP Scope

**Included**:
- Emoji number indexing (1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣) for each note in /notes list
- Single row of emoji buttons for quick detail access
- Compact note display (80 chars + count indicators)
- Dynamic button generation (only for notes on current page)
- Dedicated detail view with full content
- Display all images (no truncation)
- Display all links with metadata (no truncation)
- Back button → Returns to original page
- Delete button → Confirmation dialog → Delete note
- Mark button → Toggle marked status (boolean field)
- Button label changes: "Mark ⭐" ↔ "Unmark"
- Database: Add `is_marked` boolean to z_notes table

**Included (Added During Implementation)**:
- ✅ Manual category tagging in detail view (all 5 categories)
- ✅ Auto-refresh detail view after category selection
- ✅ Smart category hiding (confirmed categories don't re-appear)

**NOT Included** (Future):
- Edit note content → 🔧 Robust
- Share note via URL → 🔧 Robust
- Mark indicator in list view (⭐) → 🔧 Robust
- Filter by marked notes → 🔧 Robust
- Multi-category support per note → 🔧 Robust
- Copy note to clipboard → 🚀 Advanced
- Note version history → 🚀 Advanced
- Nested note threads → 🚀 Advanced

## Database Schema

```sql
-- Add is_marked column to z_notes table
ALTER TABLE z_notes ADD COLUMN is_marked BOOLEAN DEFAULT FALSE;

-- Index for filtering marked notes (future feature)
CREATE INDEX idx_notes_is_marked ON z_notes(is_marked) WHERE is_marked = TRUE;
```

## Acceptance Criteria (MVP)

**Functional**:
- [x] Emoji numbers (1️⃣ 2️⃣ 3️⃣ etc.) appear on each note in /notes list
- [x] Single row of emoji buttons for quick access
- [x] Only shows buttons for notes on current page (dynamic)
- [x] Clicking emoji button opens detail view
- [x] Detail view shows complete note text (no truncation)
- [x] Detail view shows all images with URLs
- [x] Detail view shows all links with full metadata
- [x] Back button returns to original notes list page
- [x] Delete button shows confirmation dialog
- [x] Confirming delete removes note from database (CASCADE to images/links)
- [x] Mark button toggles is_marked boolean field
- [x] Button label updates: "Mark ⭐" ↔ "Unmark"

**UI/UX**:
- [x] Notes list shows emoji numbers with compact format (80 chars)
- [x] Count indicators for images/links (📷 2 • 🔗 3)
- [x] Single row of emoji-only buttons [1️⃣] [2️⃣] [3️⃣]
- [x] Detail view edits existing message
- [x] Inline keyboard with 3 buttons: [Back] [Delete] [Mark]
- [x] Delete confirmation has [Yes] [No] buttons
- [x] After delete, bot returns to notes list
- [x] After mark toggle, detail view updates button label
- [x] Navigation maintains current page context

**Database**:
- [x] is_marked column added to z_notes table
- [x] Default value: FALSE
- [x] Index created for marked notes
- [x] Cascade delete works (note → images → links → categories)

**Error Handling**:
- [x] Handle note not found (deleted by another process)
- [x] Handle invalid noteId in callback data
- [x] Handle database errors gracefully
- [x] User-friendly error messages

## Implementation Notes

**Callback Query Data Format**:
```typescript
// Detail button
`detail:${noteId}:${currentPage}`

// Back button
`back:notes:${page}`

// Delete button (first click)
`confirm_delete:${noteId}:${page}`

// Delete confirmation (second click)
`delete:${noteId}:${page}`

// Mark toggle button
`mark:${noteId}:${currentPage}`
```

**Inline Keyboard Layout**:
```
Notes List View:
[1️⃣] [2️⃣] [3️⃣] [4️⃣] [5️⃣]  (only for notes on page)
[⬅️ Previous] [📄 1/3] [Next ➡️]

Detail View:
[⬅️ Back] [🗑️ Delete] [⭐ Mark]

Delete Confirmation:
[✅ Yes, Delete] [❌ No, Cancel]
```

**Display Format** (Notes List):
```
📝 Your Notes (Page 1/3)
📊 Total: 12 notes

1️⃣ 💡 Note content here (80 chars max)...
   📷 2 • 🔗 3

2️⃣ 📝 Another note content...
   📷 1 • 🔗 2

3️⃣ 📺 Third note...
   🔗 1

[1️⃣] [2️⃣] [3️⃣]
[⬅️ Previous] [📄 1/3] [Next ➡️]
```

**Display Format** (Detail View):
```
📝 Note Details

{full_note_content}

📷 Images:
• {cloudflare_url_1}
• {cloudflare_url_2}

🔗 Links:
1. [Title](url)
   Description truncated to 150 chars...

[⬅️ Back] [🗑️ Delete] [⭐ Mark]
[📋 Todo] [💡 Idea] [📝 Blog]
[📺 YouTube] [📚 Reference]
```

**Note**: Category buttons hide once confirmed. If note already tagged with "💡 Idea", that button won't show.

## Future Tiers

**🔧 Robust** (+8h): Mark indicator in list view (⭐ emoji), filter command /notes marked, edit note content inline, share note via unique URL.

**🚀 Advanced** (+16h): Note tags/categories with autocomplete, copy to clipboard button, note version history with diff view, nested note threads (parent-child relationships).

---

**Status**: ✅ Completed | **Actual Effort**: ~6 hours | **Deployed**: 2025-11-05

## Implementation Summary

**Files Modified**:
- `supabase/migrations/20251105113323_add_is_marked_to_notes.sql` - Database schema
- `src/database/noteOperations.ts` - CRUD operations (getNoteById, deleteNote, toggleNoteMark)
- `src/utils/linkFormatter.ts` - Compact formatting with emoji support
- `src/bot/client.ts` - UI rendering, callback handlers, category button display
- `src/constants/noteCategories.ts` - Category definitions (ALL_CATEGORIES array)

**Key Features Delivered**:
- ✅ Emoji number indexing (1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣) for visual consistency
- ✅ Single row of emoji buttons - compact and intuitive
- ✅ Dynamic button generation - only for notes on current page
- ✅ Full detail view with all content, images, and links
- ✅ Delete confirmation workflow
- ✅ Mark/Unmark toggle with button label updates
- ✅ Proper navigation context preservation
- ✅ **Manual category tagging** - All 5 category buttons in detail view
- ✅ **Smart category display** - Hide already confirmed categories
- ✅ **Auto-refresh on tag** - Detail view updates after category selection

**UX Improvements Over Original Spec**:
- Changed from separate button rows to single row of emoji buttons
- Reduced content preview from 150 to 80 characters for better scannability
- Added emoji number indexing for clearer visual mapping
- Kept category indicators (💡 📝 📺) for at-a-glance context
- **Added manual category selection** - All categories available in detail view (no AI required)
- **3-button row layout** - Categories displayed in clean 3-per-row format

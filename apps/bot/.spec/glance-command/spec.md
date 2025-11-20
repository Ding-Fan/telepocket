# Glance Command Specification

## Problem & Solution

**Problem**: When users save many notes in specific categories (e.g., Japanese notes), they must paginate through multiple pages to see notes across all categories, making quick overview difficult.

**Solution**: `/glance` command provides a quick snapshot showing 2 most recent notes from each category, sorted by category's most recently updated note, with compact navigation to full note details.

**Returns**: Formatted message with note previews across all categories, inline buttons for detail navigation.

## Command Interface

```typescript
// Command usage
/glance  // Show brief view of all categories

// Callback data formats
detail:{noteId}:glance        // View note detail from glance view
back_to_glance                // Return to glance view from detail
```

## Usage Example

```typescript
// User sends command
/glance

// Bot displays:
// 📋 Quick Glance
//
// 🇯🇵 Japanese (2/45)
// 1. useCallback hook - Nov 14 - Explains when to use useCal...
// 2. React memo - Nov 13 - How React.memo prevents unnece...
//
// 💡 Idea (2/12)
// 3. Dark mode toggle - Nov 12 - Add theme switcher to sett...
// 4. i18n library - Nov 10 - Explore next-intl for transl...
//
// [1] [2] [3] [4] [5] [6]
```

## Core Flow

```
User sends /glance
  ↓
Fetch 2 most recent notes per category (ordered by created_at)
  ↓
Filter: only user-confirmed categories shown
  ↓
Sort categories by most recently created note
  ↓
Format and display with compact number buttons
  ↓
User clicks number → Show detail view with "← Glance" button
  ↓
User clicks "← Glance" → Return to glance view
```

**Important Note**: Only notes with **user-confirmed categories** appear in glance view. Notes must have a confirmed category (clicked category button after saving) to be included.

## User Stories

**US-1: Quick Overview**
User sends `/glance` and sees 2 recent notes from each category (with confirmed categories) without pagination. Categories are sorted by most recently created note, allowing quick scan of all saved content.

**US-2: Detail Navigation**
User clicks number button on glance view to see full note detail with all links, images, and metadata. Detail view includes "← Glance" button for easy return.

**US-3: Categories with No Confirmed Notes**
Categories that have 0 user-confirmed notes show "(No notes)" in glance view. This helps users understand which categories need more content or categorization.

## MVP Scope

**Included**:
- `/glance` command showing 2 notes per category (user-confirmed only)
- All 6 categories displayed (todo, idea, blog, youtube, reference, japanese)
- Categories sorted by most recently created note
- Display: number, title, created_at (labeled as date), 30-char content preview
- Compact number button grid for detail navigation
- Detail view integration with "← Glance" back button
- Empty categories show "(No notes)" message

**NOT Included** (Future):
- Filter options (marked only, active only) → 🔧 Robust
- Customizable notes-per-category count → 🚀 Advanced
- Custom category order preferences → 🚀 Advanced

## Database Query

**Function**: `get_notes_glance_view`

**Parameters**:
- `telegram_user_id_param`: User ID
- `notes_per_category`: Number (default: 2)

**Response**:
```typescript
interface GlanceNote {
  note_id: string;
  category: NoteCategory;
  content: string;
  updated_at: string;  // Aliased from created_at (z_notes has no updated_at column)
  created_at: string;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  row_number: number;  // 1 or 2 (per category)
  category_total: number;  // Total user-confirmed notes in category
  category_max_updated: string;  // MAX(created_at) for sorting categories
}
```

**Important**: The function filters for `user_confirmed = true` in `z_note_categories`, so only notes with confirmed categories appear.

## Display Format

**Header**: `📋 Quick Glance`

**Per Category**:
```
{emoji} {Category Name}
{number}. {title} - {date} - {content preview}...
```

**Content Preview**:
- Truncate at 30 characters
- Add "..." if truncated
- Show updated_at in "MMM DD" format

**Button Layout**:
- Compact grid: [1] [2] [3] [4] [5] [6] ... up to 12 notes max (2 per 6 categories)
- Single row if ≤6 buttons, two rows if >6 buttons

## Acceptance Criteria (MVP)

**Functional**:
- [x] `/glance` command fetches 2 most recent notes per category (user-confirmed only)
- [x] Categories sorted by most recently created note (MAX(created_at) DESC)
- [x] All 6 categories displayed even if empty (0 confirmed notes)
- [x] Content preview truncated at exactly 30 characters with "..."
- [x] Number buttons (1, 2, 3...) trigger detail view with note_id
- [x] Detail view shows "← Glance" button that returns to glance view

**UI/UX**:
- [x] Clear category headers with emoji and label
- [x] Created_at displayed in compact "Nov 14" format
- [x] Compact button layout (single or double row based on count)
- [x] Empty categories show "(No notes)" message

**Data**:
- [x] Query uses window functions for efficient 2-per-category fetch
- [x] Only user-confirmed categories shown (nc.user_confirmed = true)
- [x] Categories sorted by MAX(created_at) within category
- [x] Notes within category sorted by created_at DESC
- [x] Function uses created_at (z_notes has no updated_at column)

## Future Tiers

**🔧 Robust** (+4-6h): Add filter options - show only marked notes, exclude empty categories, filter by date range (last 7 days, last 30 days). Adds `/glance marked`, `/glance active`, `/glance 7d` command variants.

**🚀 Advanced** (+8-10h): User preferences for glance view - customizable notes-per-category (1-5), custom category order, hide specific categories, pin favorite categories to top. Requires z_user_preferences table and settings command.

---

**Status**: ✅ Implemented (Nov 14, 2025) | **Actual Effort**: 1 day

## Implementation Notes

**Migrations**:
- `20251114140300_create_glance_view_function.sql` - Initial implementation
- `20251114143248_fix_glance_view_use_created_at.sql` - Fixed to use created_at (z_notes has no updated_at)

**Key Learnings**:
- z_notes table only has `created_at`, not `updated_at` - function needed adjustment
- Only shows notes with user-confirmed categories (nc.user_confirmed = true)
- Categories without confirmed notes display "(No notes)" message
- Users must click category buttons after saving notes for them to appear in glance view

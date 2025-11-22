# Glance Priority Stream Specification

## Problem & Solution

**Problem**: Important notes (marked or frequently viewed TODOs) get buried in category-based glance view, making it hard to see what needs attention first.

**Solution**: Add priority stream section at top of glance view showing 3 most important notes (marked notes + high-impression TODOs), followed by remaining notes grouped by category. Web app provides pin toggle UI.

**Returns**: Structured glance view with priority section + category sections, pin toggle for marking notes as important.

## Component API

```typescript
interface PriorityNote {
  note_id: string;
  category: NoteCategory;
  content: string;
  updated_at: string;
  created_at: string;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  is_marked: boolean;
  impression_count: number;
}

interface GlancePriorityStreamData {
  priority_notes: PriorityNote[];
  category_notes: GlanceNote[];
}

interface PinToggleProps {
  noteId: string;
  isMarked: boolean;
  onToggle: () => void;
}
```

## Usage Example

```typescript
import { GlanceSection } from '@/components/notes/GlanceSection';
import { toggleNotePin } from '@/actions/notes';

// Types imported from shared package
import { GlanceNote, PriorityNote } from '@telepocket/shared';

<GlanceSection userId={userId} onNoteClick={handleClick} />

// Priority section appears at top
// Each note card shows pin toggle button
// Pin toggle updates is_marked status via server action
// Changes revalidate automatically
```

## Core Flow

```
User views glance page
  ↓
Fetch priority notes (marked + high-impression TODOs)
  ↓
Fetch remaining category notes (excluding priority notes)
  ↓
Display: Priority section (3 notes) + Category sections (9 notes)
  ↓
User clicks pin toggle on note card
  ↓
Server action updates is_marked status
  ↓
Revalidate glance view
```

## User Stories

**US-1: Priority Notes Display**
User sees 3 most important notes at top of glance view: marked notes appear first (sorted by impression_count DESC), followed by high-impression TODO notes to fill remaining slots. If no marked notes exist, most viewed TODO is auto-promoted.

**US-2: Pin Toggle (Web Only)**
User clicks pin icon on note card in web app to toggle is_marked status. Pin icon shows filled state for marked notes, outline for unmarked. Change reflects immediately in priority section position.

**US-3: Category Notes Exclude Priority**
Notes shown in priority section are excluded from category sections, maintaining total of ~12 notes (3 priority + up to 9 from categories at 2 per category max).

## MVP Scope

**Included**:
- Priority section showing 3 notes (marked + high-impression TODOs)
- Database function `get_notes_priority_stream` returning priority + category notes
- Web pin toggle button on GlanceCard component
- Server action `toggleNotePin(noteId, userId)` updating is_marked
- ~~Bot glance view updated to show priority section~~ **REMOVED: Glance is web-only feature**
- Auto-promotion: if no marked notes, select most viewed TODO
- Exclude priority notes from category sections
- Shared package imports (`@telepocket/shared`) for types and utilities

**NOT Included** (Future):
- Telegram bot /glance command → **REMOVED ENTIRELY** (web-only feature)
- Pin toggle in Telegram bot → 🔧 Robust
- Customizable priority count (user setting for 3/5/10 notes) → 🚀 Advanced
- Priority sorting options (by date, category, custom order) → 🚀 Advanced

## Database Query

**New Function**: `get_notes_priority_stream`

**Parameters**:
- `telegram_user_id_param`: User ID
- `priority_limit`: Number (default: 3)
- `notes_per_category`: Number (default: 2)

**Response**:
```typescript
// Priority notes (marked + high-impression TODOs)
interface PriorityNote {
  note_id: string;
  category: string;
  content: string;
  updated_at: string;
  created_at: string;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  is_marked: boolean;
  impression_count: number;
  section: 'priority'; // Always 'priority'
}

// Category notes (remaining notes, excluding priority)
interface CategoryNote {
  note_id: string;
  category: string;
  content: string;
  updated_at: string;
  created_at: string;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  is_marked: boolean;
  row_number: number;
  category_total: number;
  section: 'category'; // Always 'category'
}
```

**Query Logic**:
1. **Priority CTE**: Select marked notes (is_marked = true) + TODO notes with impression_count >= category avg, sorted by is_marked DESC, impression_count DESC, updated_at DESC, limit 3
2. **Category CTE**: Select 2 notes per category (excluding notes in priority), sorted by category_max_updated DESC
3. **Union**: Combine with section discriminator

## Display Format

**Priority Section**:
```
📌 Priority Notes
1. [Pin Icon] Dark mode feature - Nov 20 - Critical TODO item...
2. [Pin Icon] Login bug fix - Nov 19 - High priority bug...
3. useCallback guide - Nov 18 - Most viewed TODO note...
```

**Category Sections** (same as current):
```
🇯🇵 Japanese
4. React memo - Nov 14 - Prevents unnecessary...
5. useState hook - Nov 13 - State management...

💡 Idea
6. i18n library - Nov 12 - Explore next-intl...
...
```

## Pin Toggle UI

**Web App** (Implemented):
- Pin icon button overlaid on top-right of GlanceCard
- Filled pin (📍) for marked notes
- Outline pin (📌) for unmarked notes
- Hover: slight scale animation (scale 1.1)
- Click: server action → revalidate
- Loading spinner during toggle

**Bot** (Not Implemented):
- ~~Glance command removed entirely - web-only feature~~
- Future Robust tier could add pin toggle in note detail view

## Acceptance Criteria (MVP)

**Functional**:
- [x] Priority section shows max 3 notes (marked + high-impression TODOs)
- [x] Marked notes appear first in priority (sorted by impression_count DESC)
- [x] If no marked notes, most viewed TODO auto-promoted to priority
- [x] Priority notes excluded from category sections
- [x] Pin toggle updates is_marked in database
- [x] Glance view revalidates after pin toggle
- [x] Total notes remains ~12 (3 priority + 9 category max)

**UI/UX**:
- [x] Priority section has distinct header "📌 Priority Notes"
- [x] Pin icon shows correct state (filled/outline)
- [x] Pin toggle provides visual feedback on hover
- [x] Priority cards visually distinct from category cards (cyan border glow)
- [x] Empty priority section auto-promotes most viewed TODO

**Database**:
- [x] `get_notes_priority_stream` returns correct priority + category split
- [x] Query excludes priority notes from category results
- [x] Function executes in <500ms for 1000+ notes
- [x] Server action `toggleNotePin` updates is_marked atomically

## Future Tiers

**🔧 Robust** (+6-8h): Add pin toggle to Telegram bot inline keyboard, sync pin status across platforms, add "📌 Pinned" badge in bot detail view, support bulk pin/unpin actions.

**🚀 Advanced** (+12-15h): User preferences for priority count (3/5/10 notes), custom priority sorting (by category, date, manual order), priority section filters (show only TODOs, only marked), drag-and-drop reordering in web app.

---

**Status**: ✅ Implemented (Nov 22, 2025) | **Actual Effort**: 1 day

## Implementation Notes

**Architecture Decisions**:
- **Web-only feature**: Removed Telegram bot `/glance` command to keep feature exclusive to web app
- **Shared package imports**: Refactored to use `@telepocket/shared` for types (GlanceNote, PriorityNote, StreamNote, etc.)
- **Single database query**: Uses UNION with section discriminator for efficient data fetching

**Files Modified**:
- Database: `apps/bot/supabase/migrations/20251122020318_create_glance_priority_stream_function.sql`
- Web components: GlanceSection.tsx, GlanceCard.tsx, PinToggleButton.tsx (new)
- Web hooks: useGlanceData.ts
- Web actions: toggleNotePin() server action
- Web types: Updated to import from @telepocket/shared
- Bot: Removed glance command and views

**Deployment**:
- Database migration deployed via `supabase db push`
- Bot rebuilt and deployed via PM2 (stop → start pattern)
- Web app rebuilt and deployed via PM2

**Key Learnings**:
- PM2 deployments require stop → start for code changes (not just restart)
- Always check log timestamps before debugging PM2 processes
- Shared package imports improve type consistency across monorepo

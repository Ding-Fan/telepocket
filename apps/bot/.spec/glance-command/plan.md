# Glance Command Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database Query** | PostgreSQL window function with PARTITION BY category | Efficient single-query fetch of 2 notes per category, leveraging existing RPC pattern used in `get_notes_with_pagination` |
| **Category Sorting** | MAX(created_at) per category with window function | Single query returns category ordering metadata, avoids N+1 queries. Uses created_at since z_notes has no updated_at column |
| **Category Filter** | Only user-confirmed categories (nc.user_confirmed = true) | Shows notes user explicitly categorized, ensures data quality |
| **Button Navigation** | Callback data format `detail:{noteId}:glance` | Consistent with existing `detail:{noteId}:{page}` pattern, adds context for back navigation |
| **Date Formatting** | `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })` | Compact "Nov 14" format saves space, matches Telegram message UI conventions |
| **Empty Categories** | Always display all 6 categories | User awareness of category structure, encourages content diversity |

## Codebase Integration Strategy

**Command Location**: `src/bot/client.ts`
- Add `/glance` command handler in `setupCommands()` method
- Follow existing pattern from `/notes` and `/archived` commands
- Place handler before `message:photo` handler

**Database Function**: `supabase/migrations/`
- Create new migration: `create_glance_view_function.sql`
- Function: `get_notes_glance_view(telegram_user_id_param, notes_per_category)`
- Returns JSONB with note data + category metadata

**Note Operations**: `src/database/noteOperations.ts`
- Add method: `getNotesGlanceView(userId, notesPerCategory = 2)`
- Follow existing RPC call pattern from `getNotesWithPagination`

**Callback Handling**: `src/bot/client.ts`
- Extend existing `callback_query` handler
- Add `detail:*:glance` pattern matcher
- Add `back_to_glance` handler

## Technical Approach

**Existing Patterns to Follow**:
1. **Database RPC**: Study `get_notes_with_pagination` in migrations for window function pattern
2. **Command Handler**: Study `/notes` command in `client.ts:119-167` for argument parsing and routing
3. **Display Formatting**: Study `formatNoteForDisplay` in `linkFormatter.ts` for content truncation
4. **Callback Pattern**: Study `detail:${note.note_id}:${result.currentPage}` in `client.ts:850` for button data format

**Component Composition**:
- Database function builds category-grouped result set with window functions
- NoteOperations wrapper calls RPC and transforms response
- Bot command handler formats display with category headers
- Callback handlers route between glance view ↔ detail view

**Glance View Flow**:
1. User sends `/glance` → `setupCommands()` routes to `showGlanceView()`
2. `showGlanceView()` calls `noteOps.getNotesGlanceView(userId, 2)`
3. Database returns max 12 notes (2 per 6 categories) + category metadata
4. Format message with category sections, truncate content to 30 chars
5. Build inline keyboard with number buttons [1] [2] [3]...
6. User clicks number → `detail:{noteId}:glance` callback
7. Show detail view with `← Glance` button (`back_to_glance` callback)
8. User clicks back → Call `showGlanceView()` again

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Empty result set** | Handle gracefully with "No notes yet" message, encourage user to save notes |
| **Long category names overflow** | Use emoji + short labels from `CATEGORY_LABELS` constant, already max 10 chars |
| **Content truncation cuts mid-word** | Use simple 30-char substring + "...", acceptable for preview UX |
| **Many notes = many buttons** | Max 12 buttons (2×6 categories), two-row layout keeps UI compact |

## Integration Points

**Database**: `supabase/migrations/`
- New migration file for `get_notes_glance_view` function

**Note Operations**: `src/database/noteOperations.ts`
- New method `getNotesGlanceView()`

**Bot Client**: `src/bot/client.ts`
- Command handler in `setupCommands()`
- View method `showGlanceView()`
- Callback handlers for `detail:*:glance` and `back_to_glance`

**Utilities**: `src/utils/linkFormatter.ts`
- Reuse existing `escapeMarkdownV2` and `formatNoteForDisplay`

## Success Criteria

**Technical**:
- Single database query fetches all glance data (no N+1 queries)
- Response time <500ms for glance view (efficient window function)
- Callback data <64 bytes (Telegram limit)

**User**:
- Glance view loads in <1 second
- User can scan all categories without scrolling/pagination
- One-click navigation to full note detail and back

**Business**:
- Reduces friction for browsing saved notes
- Encourages category awareness and organization
- Improves UX for users with >20 saved notes

## Robust Product (+4-6h)

Filter options with command variants: `/glance marked` (only marked notes), `/glance active` (exclude archived), `/glance 7d` (last 7 days only). Requires query parameter additions and argument parsing in command handler.

## Advanced Product (+8-10h)

User preference system for glance customization: notes-per-category count (1-5), custom category order, hide/show specific categories, pin favorites. Requires new `z_user_preferences` table, settings command UI, preference storage/retrieval logic.

---

**Total MVP Effort**: 8-12 hours (1-2 days) | **Actual Effort**: ~8 hours (1 day) | **Dependencies**: None

## Implementation Status: ✅ Completed

**Deployed**: Nov 14, 2025

**Migrations Applied**:
1. `20251114140300_create_glance_view_function.sql` - Initial function (had bug)
2. `20251114143248_fix_glance_view_use_created_at.sql` - Fixed function to use created_at

**Files Modified**:
- `src/database/noteOperations.ts` - Added GlanceNote interface and getNotesGlanceView method
- `src/bot/client.ts` - Added showGlanceView method, /glance command, callback handlers
- `src/constants/helpMessages.ts` - Added /glance to help documentation
- `ecosystem.config.js` - No changes needed (deployed via PM2 stop → start)

**Key Implementation Details**:
- Database function uses `created_at` throughout (z_notes has no updated_at column)
- Filters for `nc.user_confirmed = true` to show only categorized notes
- Empty categories display "(No notes)" instead of being hidden
- Back navigation uses "← Glance" button with `back_to_glance` callback
- Detail view accepts both numeric page and "glance" as returnPage parameter

**Testing**:
- TypeScript compilation: ✅ No errors
- PM2 deployment: ✅ Successfully restarted with stop → start pattern
- Database query: ✅ Returns expected results for confirmed categories
- Currently showing: 2 todo notes, 1 japanese note, 1 idea note (from 5 confirmed out of 608 total notes)

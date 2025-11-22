# Glance Priority Stream Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Priority Selection** | Marked notes + high-impression TODOs | Combines user-defined importance (marked) with data-driven signals (impression count) for balanced priority |
| **Database Function** | Single RPC with UNION query | One database call returns both priority and category notes with section discriminator, reducing round trips |
| **Pin Toggle Location** | Web app only (MVP) | Most users manage notes via web, bot toggle adds complexity without immediate value (deferred to Robust tier) |
| **Priority Count** | Fixed 3 notes | Manageable number that fits above-fold, extensible to user preference in Advanced tier |
| **Auto-Promotion** | Most viewed TODO if no marked | Ensures priority section always shows relevant content, leverages existing impression tracking |
| **Section Exclusion** | Priority notes removed from categories | Prevents duplicate display, maintains ~12 note total for consistent UX |

## Codebase Integration Strategy

**Database Migration**: `apps/bot/supabase/migrations/`
- New function: `get_notes_priority_stream(telegram_user_id_param, priority_limit, notes_per_category)`
- Uses existing columns: `is_marked`, `impression_count`, `updated_at`
- Returns union of priority + category CTEs with section discriminator

**Web Component Updates**: `apps/web/components/notes/`
- Modify `GlanceSection.tsx`: Add priority section rendering above categories
- Modify `GlanceCard.tsx`: Add pin toggle button overlay (top-right corner)
- New component: `PinToggleButton.tsx` (reusable pin icon with hover/click states)

**Server Actions**: `apps/web/actions/notes.ts`
- New action: `toggleNotePin(noteId: string, userId: number)` calling `toggleNoteMark` RPC
- Revalidates `/` path after toggle

**Bot View Updates**: `apps/bot/src/bot/views/glance.ts`
- Parse `section` field from query results
- Render "📌 Priority Notes" header for priority section
- Exclude priority notes from category map grouping

**Hook Updates**: `apps/web/hooks/useGlanceData.ts`
- Change RPC call from `get_notes_glance_view` to `get_notes_priority_stream`
- Split notes by section: `priority_notes` and `category_notes`
- Return typed `{ priorityNotes, categoryNotes, loading, error }`

## Technical Approach

**Existing Patterns to Follow**:
1. **Database Functions**: Study `get_notes_glance_view` (apps/bot/supabase/migrations/20251114140300_create_glance_view_function.sql) for CTE patterns
2. **Server Actions**: Study `archiveNote` in apps/web/actions/notes.ts for revalidation pattern
3. **Bot Toggle**: Study `toggleNoteMark` in apps/bot/src/database/noteOperations.ts for is_marked update logic
4. **Component Composition**: Study GlanceCard.tsx for card overlay patterns (badges already use absolute positioning)

**Priority Selection Algorithm**:
```typescript
// SQL logic in get_notes_priority_stream
WITH priority_notes AS (
  SELECT notes with is_marked = true
  UNION ALL
  SELECT TODO notes with impression_count >= category avg WHERE NOT in marked_notes
  ORDER BY is_marked DESC, impression_count DESC, updated_at DESC
  LIMIT 3
)
// If count < 3 and no marked, auto-select most viewed TODO
```

**Pin Toggle Flow**:
1. User clicks pin icon on GlanceCard
2. Call server action: `toggleNotePin(noteId, userId)`
3. Server action calls Supabase RPC: `toggleNoteMark` (already exists in bot DB operations)
4. Revalidate path: `/`
5. GlanceSection re-fetches with updated priorities

**Section Discriminator Pattern**:
- Priority CTE: `SELECT *, 'priority' as section`
- Category CTE: `SELECT *, 'category' as section WHERE note_id NOT IN (priority_notes)`
- Client splits by section field for rendering

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Priority section empty** | Auto-promote most viewed TODO if no marked notes, ensures 3 notes always shown |
| **Performance degradation** | Use window functions + CTEs in single query, test with 1000+ notes, add composite index on (is_marked, impression_count, category) if needed |
| **Bot/Web sync delay** | Both use same database function, changes reflect immediately on next fetch (no caching layer) |
| **Pin toggle race condition** | Use atomic `toggleNoteMark` RPC with row-level locking (already implemented in bot) |

## Integration Points

**Database**: `apps/bot/supabase/migrations/`
- Migration: `YYYYMMDD_create_glance_priority_stream_function.sql`
- Depends on: `is_marked`, `impression_count` columns (already exist)

**Web App**: `apps/web/`
- Components: `components/notes/GlanceSection.tsx`, `components/notes/GlanceCard.tsx`
- Actions: `actions/notes.ts`
- Hooks: `hooks/useGlanceData.ts`
- Types: `constants/categories.ts` (add `PriorityNote` interface)

**Bot**: `apps/bot/src/bot/views/glance.ts`
- Display logic only (no command changes)
- Uses same database function as web

**Shared Database Operations**: `apps/bot/src/database/noteOperations.ts`
- Reuse existing `toggleNoteMark(noteId, userId)` method
- Web server action calls bot's Supabase instance (shared database)

## Success Criteria

**Technical**:
- Database query executes in <500ms for 1000+ notes
- Pin toggle responds within 300ms (server action + revalidation)
- No N+1 queries (single RPC call for all data)
- Type safety enforced across web and bot

**User**:
- Priority notes visible above-fold without scrolling
- Pin toggle intuitive (filled icon = marked)
- Immediate feedback on pin state change
- No duplicate notes between priority and category sections

**Business**:
- Important notes surface automatically (high-impression TODOs)
- User can manually promote any note via pin toggle
- Existing glance UX preserved for category browsing

## Robust Product (+6-8h)

Add pin toggle to Telegram bot inline keyboard, sync status across platforms, "📌 Pinned" badge in detail view, bulk pin/unpin actions, priority section collapsed/expanded state.

## Advanced Product (+12-15h)

User preferences for priority count (3/5/10), custom sorting (category/date/manual), priority filters (TODOs only/marked only), drag-and-drop reordering in web, priority analytics (view trends, notification for neglected priorities).

---

**Total MVP Effort**: 24-32 hours (3-4 days) | **Dependencies**: None (uses existing columns and patterns)

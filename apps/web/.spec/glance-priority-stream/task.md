# Glance Priority Stream Implementation Tasks

**Status**: Not Started | **MVP Effort**: 24-32 hours | **Priority**: High

---

## T-1: Database Function - get_notes_priority_stream

**Effort**: 4h | **Dependencies**: None

- [ ] Create migration file `apps/bot/supabase/migrations/YYYYMMDD_create_glance_priority_stream_function.sql`
- [ ] Write SQL function signature:
  ```sql
  CREATE OR REPLACE FUNCTION get_notes_priority_stream(
    telegram_user_id_param BIGINT,
    priority_limit INT DEFAULT 3,
    notes_per_category INT DEFAULT 2
  )
  RETURNS TABLE (
    note_id UUID,
    category TEXT,
    content TEXT,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    telegram_message_id BIGINT,
    link_count BIGINT,
    image_count BIGINT,
    is_marked BOOLEAN,
    impression_count INT,
    row_number BIGINT,
    category_total BIGINT,
    section TEXT
  )
  ```
- [ ] Implement priority CTE:
  ```sql
  priority_notes AS (
    SELECT n.*, nc.category, 'priority' as section
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    WHERE n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
      AND (
        n.is_marked = true
        OR (nc.category = 'todo' AND n.impression_count >= avg_impression_for_category)
      )
    ORDER BY n.is_marked DESC, n.impression_count DESC, n.updated_at DESC
    LIMIT priority_limit
  )
  ```
- [ ] Implement category CTE (exclude priority notes):
  ```sql
  category_notes AS (
    SELECT ... 'category' as section
    FROM z_notes n
    WHERE n.id NOT IN (SELECT note_id FROM priority_notes)
    -- Rest same as get_notes_glance_view
  )
  ```
- [ ] Add auto-promotion logic: if no marked notes, ensure at least 1 TODO with highest impression_count
- [ ] Add rollback instructions in comment
- [ ] Test with SQL: verify priority notes excluded from category results
- [ ] Deploy migration: `supabase db push`

**Acceptance**:
- ✅ Function returns 3 priority notes (marked + high-impression TODOs)
- ✅ Priority notes marked with section = 'priority'
- ✅ Category notes exclude priority note IDs
- ✅ Auto-promotion works when no marked notes exist
- ✅ Query executes in <500ms for 1000+ notes

---

## T-2: Type Definitions - PriorityNote Interface

**Effort**: 1h | **Dependencies**: None

- [ ] Add interface to `apps/web/constants/categories.ts`:
  ```typescript
  export interface PriorityNote {
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
    section: 'priority';
  }

  export interface CategoryNoteExtended extends GlanceNote {
    is_marked?: boolean;
    section: 'category';
  }
  ```
- [ ] Update `GlanceNote` interface to include `is_marked` field (optional for backward compatibility)
- [ ] Export union type: `export type StreamNote = PriorityNote | CategoryNoteExtended;`

**Acceptance**:
- ✅ TypeScript compiles without errors
- ✅ Interfaces match database function return columns

---

## T-3: Hook Update - useGlanceData

**Effort**: 2h | **Dependencies**: T-1, T-2

- [ ] Modify `apps/web/hooks/useGlanceData.ts`
- [ ] Change RPC call from `get_notes_glance_view` to `get_notes_priority_stream`
- [ ] Update return type:
  ```typescript
  interface UseGlanceDataReturn {
    priorityNotes: PriorityNote[];
    categoryNotes: GlanceNote[];
    loading: boolean;
    error: string | null;
  }
  ```
- [ ] Split results by section field:
  ```typescript
  const priorityNotes = (data || []).filter(n => n.section === 'priority');
  const categoryNotes = (data || []).filter(n => n.section === 'category');
  ```
- [ ] Handle empty priority section (should not happen due to auto-promotion)
- [ ] Update error handling to show descriptive messages

**Acceptance**:
- ✅ Hook returns separate arrays for priority and category notes
- ✅ No TypeScript errors on section filtering
- ✅ Empty results handled gracefully

---

## T-4: Server Action - toggleNotePin

**Effort**: 2h | **Dependencies**: None (uses existing DB operation)

- [ ] Add server action to `apps/web/actions/notes.ts`:
  ```typescript
  export async function toggleNotePin(
    noteId: string,
    userId: number
  ): Promise<{ success: boolean; isMarked?: boolean; error?: string }>
  ```
- [ ] Call Supabase RPC `toggle_note_mark` (reuse bot's existing function)
- [ ] Return new `is_marked` status for optimistic UI update
- [ ] Revalidate path: `revalidatePath('/')`
- [ ] Add error handling and logging
- [ ] Validate userId matches note owner (security check)

**Acceptance**:
- ✅ Server action toggles `is_marked` in database
- ✅ Returns new mark status
- ✅ Revalidates home page after toggle
- ✅ Unauthorized users cannot toggle others' notes

---

## T-5: Component - PinToggleButton

**Effort**: 3h | **Dependencies**: T-4

- [ ] Create `apps/web/components/notes/PinToggleButton.tsx`
- [ ] Props: `noteId: string`, `isMarked: boolean`, `onToggle: () => void`
- [ ] Render filled pin icon (📍) if marked, outline pin (📌) if not
- [ ] Position absolute top-right corner with padding
- [ ] Add hover state: scale(1.1) transform
- [ ] Add click handler calling onToggle prop
- [ ] Show loading spinner during server action
- [ ] Add Tailwind classes for glass effect background
- [ ] Make accessible: aria-label "Pin note" / "Unpin note"

**Acceptance**:
- ✅ Pin icon shows correct state (filled/outline)
- ✅ Hover provides visual feedback
- ✅ Click triggers server action
- ✅ Loading state prevents double-clicks
- ✅ Accessible to screen readers

---

## T-6: Component Update - GlanceCard

**Effort**: 2h | **Dependencies**: T-5

- [ ] Modify `apps/web/components/notes/GlanceCard.tsx`
- [ ] Add props: `isMarked?: boolean`, `onPinToggle?: () => void`
- [ ] Import PinToggleButton component
- [ ] Render PinToggleButton in top-right corner (absolute positioned)
- [ ] Only show pin toggle if `onPinToggle` prop provided
- [ ] Add subtle border highlight for marked cards (cyan glow)
- [ ] Update z-index layers to ensure pin button above card content
- [ ] Test card layout doesn't break with pin button

**Acceptance**:
- ✅ Pin toggle renders on card without layout shift
- ✅ Marked cards have visual distinction
- ✅ Pin button only shows when callback provided
- ✅ Card remains clickable (detail view)

---

## T-7: Component Update - GlanceSection

**Effort**: 4h | **Dependencies**: T-3, T-6

- [ ] Modify `apps/web/components/notes/GlanceSection.tsx`
- [ ] Update hook call: `const { priorityNotes, categoryNotes, loading, error } = useGlanceData(userId)`
- [ ] Add pin toggle handler:
  ```typescript
  const handlePinToggle = async (noteId: string) => {
    await toggleNotePin(noteId, userId);
    // Optimistic update or refetch
  };
  ```
- [ ] Render priority section before categories:
  ```tsx
  {priorityNotes.length > 0 && (
    <div className="mb-8">
      <h3>📌 Priority Notes</h3>
      <div className="grid md:grid-cols-3 gap-4">
        {priorityNotes.map(note => (
          <GlanceCard
            note={note}
            isMarked={note.is_marked}
            onPinToggle={() => handlePinToggle(note.note_id)}
          />
        ))}
      </div>
    </div>
  )}
  ```
- [ ] Update category rendering to use `categoryNotes` array
- [ ] Add loading state for pin toggle (disable buttons during action)
- [ ] Add error toast if pin toggle fails
- [ ] Test responsive layout for priority section

**Acceptance**:
- ✅ Priority section renders above categories
- ✅ Pin toggle works on all note cards
- ✅ Loading state prevents race conditions
- ✅ Errors shown to user via toast
- ✅ Layout responsive on mobile/tablet/desktop

---

## T-8: Bot View Update - glance.ts

**Effort**: 3h | **Dependencies**: T-1

- [ ] Modify `apps/bot/src/bot/views/glance.ts`
- [ ] Change RPC call from `get_notes_glance_view` to `get_notes_priority_stream`
- [ ] Split results by section field:
  ```typescript
  const priorityNotes = notes.filter(n => n.section === 'priority');
  const categoryNotes = notes.filter(n => n.section === 'category');
  ```
- [ ] Build priority section message:
  ```typescript
  if (priorityNotes.length > 0) {
    message += '📌 *Priority Notes*\n\n';
    priorityNotes.forEach(note => {
      const markedIcon = note.is_marked ? '📍' : '';
      message += `${globalIndex}. ${markedIcon} ${title} - ${date} - ${preview}\n`;
      globalIndex++;
    });
    message += '\n';
  }
  ```
- [ ] Update category map to exclude priority notes (already filtered by section)
- [ ] Update button data to include all notes (priority + category)
- [ ] Test message formatting with MarkdownV2 escaping

**Acceptance**:
- ✅ Bot shows priority section with "📌 Priority Notes" header
- ✅ Marked notes show 📍 icon
- ✅ Button numbers map correctly to all notes
- ✅ MarkdownV2 escaping works correctly

---

## T-9: Database Operations Update (Bot)

**Effort**: 1h | **Dependencies**: T-1

- [ ] Add method to `apps/bot/src/database/noteOperations.ts`:
  ```typescript
  async getNotesGlancePriorityStream(
    userId: number,
    priorityLimit: number = 3,
    notesPerCategory: number = 2
  ): Promise<StreamNote[]>
  ```
- [ ] Call RPC `get_notes_priority_stream` with parameters
- [ ] Validate authorized user
- [ ] Handle errors with `handleDatabaseError`
- [ ] Return typed array (uses union type `StreamNote`)

**Acceptance**:
- ✅ Method returns correctly typed notes
- ✅ Error handling logs failures
- ✅ Authorized user validation works

---

## T-10: Integration Testing

**Effort**: 3h | **Dependencies**: T-1 through T-9

- [ ] Test priority selection algorithm:
  - [ ] Mark 3 notes, verify they appear in priority
  - [ ] Mark 1 note, verify 2 high-impression TODOs fill remaining slots
  - [ ] Mark 0 notes, verify most viewed TODO auto-promoted
- [ ] Test pin toggle flow:
  - [ ] Web: Click pin, verify database updated
  - [ ] Web: Verify glance view re-renders with new priorities
  - [ ] Bot: Verify same notes shown after web toggle
- [ ] Test section exclusion:
  - [ ] Verify priority notes not duplicated in categories
  - [ ] Verify total note count ~12 (3 priority + 9 category)
- [ ] Test edge cases:
  - [ ] User with 0 notes
  - [ ] User with only 1 category
  - [ ] User with all notes marked
- [ ] Performance test:
  - [ ] Measure query time with 1000+ notes
  - [ ] Verify <500ms execution time

**Acceptance**:
- ✅ Priority selection works correctly in all scenarios
- ✅ Pin toggle updates both web and bot views
- ✅ No duplicate notes between sections
- ✅ Edge cases handled gracefully
- ✅ Performance meets targets

---

## T-11: Documentation Update

**Effort**: 1h | **Dependencies**: T-10

- [ ] Update existing glance spec (`apps/web/.spec/glance-section/spec.md`) with migration note
- [ ] Add comment to `get_notes_glance_view` SQL function: "DEPRECATED: Use get_notes_priority_stream"
- [ ] Update bot CLAUDE.md if it references glance view behavior
- [ ] Add JSDoc comments to new functions and components

**Acceptance**:
- ✅ Specs updated with migration info
- ✅ Deprecated function marked clearly
- ✅ JSDoc comments added

---

## Final Verification (MVP)

**Functional**:
- [ ] Priority section shows 3 most important notes
- [ ] Marked notes appear first in priority
- [ ] Auto-promotion works when no marked notes
- [ ] Pin toggle updates database and UI
- [ ] Priority notes excluded from category sections
- [ ] Total notes ~12 (3 priority + 9 category)

**UI/UX**:
- [ ] Priority section visually distinct
- [ ] Pin icon shows correct state
- [ ] Pin toggle responsive on hover/click
- [ ] Marked cards have subtle highlight
- [ ] Layout responsive on all devices

**Integration**:
- [ ] Web and bot show same priority notes
- [ ] Pin toggle in web reflects in bot on next fetch
- [ ] Database query executes in <500ms
- [ ] No console errors in browser or server logs

**Performance**:
- [ ] Page load time <2s with 1000+ notes
- [ ] Pin toggle responds <300ms
- [ ] No N+1 queries or excessive re-renders

---

## Robust Product Tasks

**T-12: Bot Pin Toggle** (+3h)
- Add inline keyboard button "📌 Pin" / "📍 Unpin" in detail view
- Add callback handler for pin toggle
- Update bot views to show pin status

**T-13: Bulk Pin Actions** (+2h)
- Add "Pin All TODOs" action in web
- Add "Unpin All" action
- Batch update database operations

**T-14: Priority Analytics** (+3h)
- Track view trends for priority notes
- Add notification for neglected priorities
- Dashboard widget showing priority stats

---

## Advanced Product Tasks

**T-15: User Preferences** (+4h)
- Add z_user_preferences table
- Settings page for priority count (3/5/10)
- Custom sorting options (category/date/manual)

**T-16: Drag-and-Drop Reordering** (+6h)
- Add drag-and-drop library (react-beautiful-dnd)
- Manual priority order saved to database
- Sync order across web and bot

**T-17: Priority Filters** (+2h)
- Filter: Show only TODOs in priority
- Filter: Show only marked notes
- Filter toggle in UI

---

**Total MVP Tasks**: T-1 through T-11 | **Effort**: 24-32 hours

# Glance Section Implementation Tasks

**Status**: ✅ Completed | **Actual Effort**: 16 hours (MVP + Note Detail) | **Completed**: Nov 19, 2025

---

## T-1: Project Structure Setup ✅

**Effort**: 1h | **Dependencies**: None | **Status**: Completed

- [x] Create `apps/web/components/notes/` directory
- [x] Create `GlanceSection.tsx` file with basic component shell
- [x] Create `GlanceCard.tsx` file with basic component shell
- [x] Create `apps/web/constants/categories.ts` for category constants
- [x] Export components from index file (optional)

**Acceptance**:
- ✅ Directory structure exists
- ✅ Files compile without errors
- ✅ Components render empty divs successfully

---

## T-2: ✅ Category Constants & Types

**Effort**: 1h | **Dependencies**: T-1

- [x] Define `NoteCategory` type in `constants/categories.ts`
  ```typescript
  export type NoteCategory = 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese';
  ```
- [x] Add `CATEGORY_EMOJI` mapping
- [x] Add `CATEGORY_LABELS` mapping
- [x] Add `ALL_CATEGORIES` array
- [x] Define `GlanceNote` interface (copy from bot's interface)

**Acceptance**:
- ✅ All category constants properly typed
- ✅ GlanceNote interface matches bot's database return type

---

## T-3: ✅ GlanceCard Component

**Effort**: 2h | **Dependencies**: T-2

- [x] Accept `GlanceCardProps` (note, onClick)
- [x] Render card with bg-glass styling
- [x] Display content preview (first 30 chars with ellipsis)
- [x] Format date as "MMM DD" using `toLocaleDateString`
- [x] Add link_count badge (if > 0)
- [x] Add image_count badge (if > 0)
- [x] Add hover state animation
- [x] Apply ocean theme colors

**Test Cases**:
- [x] Card renders with all data fields
- [x] Truncation works for long content
- [x] Badges show conditionally
- [x] Hover animation works

**Acceptance**:
- ✅ Card displays all required info
- ✅ Styling matches ocean theme
- ✅ Hover states work smoothly

---

## T-4: ✅ Supabase Integration Hook

**Effort**: 2h | **Dependencies**: T-2

- [x] Create custom hook `useGlanceData(userId: number)`
- [x] Import `createClient` from `utils/supabase/client.ts`
- [x] Set up state: `notes`, `loading`, `error`
- [x] Implement useEffect to fetch on mount
- [x] Call `supabase.rpc('get_notes_glance_view', { telegram_user_id_param, notes_per_category: 2 })`
- [x] Handle success: set notes state
- [x] Handle error: set error state with message
- [x] Handle loading: toggle loading state

**Test Cases**:
- [x] Hook fetches data on mount
- [x] Loading state toggles correctly
- [x] Error handling works

**Acceptance**:
- ✅ Hook returns `{ notes, loading, error }`
- ✅ Supabase RPC call succeeds
- ✅ Error handling is graceful

---

## T-5: ✅ GlanceSection Component - Data Fetching

**Effort**: 2h | **Dependencies**: T-4

- [x] Accept `GlanceSectionProps` (userId, onNoteClick)
- [x] Use `useGlanceData(userId)` hook
- [x] Implement loading state UI (simple "Loading..." text for MVP)
- [x] Implement error state UI ("Error loading glance view" message)
- [x] Group notes by category using reduce/Map
  ```typescript
  const notesByCategory = notes.reduce((map, note) => {
    const categoryNotes = map.get(note.category) || [];
    return map.set(note.category, [...categoryNotes, note]);
  }, new Map<NoteCategory, GlanceNote[]>());
  ```

**Acceptance**:
- ✅ Data fetching works
- ✅ Notes grouped by category
- ✅ Loading and error states display

---

## T-6: ✅ GlanceSection Component - Rendering

**Effort**: 3h | **Dependencies**: T-3, T-5

- [x] Loop through ALL_CATEGORIES (not just categories with notes)
- [x] Render category header with emoji + label
- [x] For each category:
  - [x] If notes exist: map to GlanceCard components
  - [x] If no notes: display "(No notes)" text
- [x] Apply grid layout (responsive)
- [x] Add section spacing and container styling
- [x] Apply staggered animations (animationDelay per category)
- [x] Add category section dividers/borders

**Acceptance**:
- ✅ All 6 categories display
- ✅ Empty states show for categories with no notes
- ✅ Layout is responsive
- ✅ Animations work smoothly

---

## T-7: ✅ Styling & Theme Integration

**Effort**: 1.5h | **Dependencies**: T-6

- [x] Apply ocean theme colors consistently
- [x] Use bg-glass for card backgrounds
- [x] Use gradient-accent for hover effects
- [x] Apply animate-slide-up to category sections
- [x] Ensure font-display for category headers
- [x] Ensure font-sans for note content
- [x] Test responsiveness (mobile/tablet/desktop)
- [x] Add subtle shadows and borders

**Acceptance**:
- ✅ Styling matches existing ocean theme
- ✅ Responsive on all breakpoints
- ✅ Animations are smooth

---

## T-8: ✅ Integration with Notes Page

**Effort**: 0.5h | **Dependencies**: T-7

- [x] Import GlanceSection in notes page
- [x] Pass userId from Telegram WebApp
- [x] Add section to page layout
- [x] Test in browser

**Acceptance**:
- ✅ Component renders on notes page
- ✅ Data loads successfully
- ✅ No console errors

---

## Final Verification (MVP) ✅

**Functional**:
- [x] Fetches glance data on mount
- [x] Displays all 6 categories
- [x] Shows up to 2 notes per category
- [x] Shows "(No notes)" for empty categories
- [x] Formats dates correctly
- [x] Truncates content to 30 chars
- [x] Displays badges conditionally
- [x] Handles loading state
- [x] Handles error state

**UI/UX**:
- [x] Follows ocean theme
- [x] Category headers show emoji + label
- [x] Cards have hover states
- [x] Responsive layout works
- [x] Consistent spacing
- [x] Smooth animations

**Integration**:
- [x] Supabase RPC call works
- [x] userId passed correctly
- [x] No TypeScript errors
- [x] No runtime errors

---

## Bonus: Note Detail View Tasks (Implemented)

**T-9: Note Detail Page Route** ✅ (+2h)
- [x] Create dynamic route `app/notes/[id]/page.tsx`
- [x] Add navigation from glance cards
- [x] Implement loading and error states

**T-10: Note Detail TypeScript Types** ✅ (+1h)
- [x] Define `NoteDetail` interface
- [x] Define `NoteLink` interface
- [x] Define `NoteImage` interface
- [x] Update `categories.ts` with new types

**T-11: Database RPC Function** ✅ (+3h)
- [x] Create `get_note_detail` RPC function
- [x] Fix column name issues (`nc.updated_at`)
- [x] Fix image column names (`telegram_file_id`, `cloudflare_url`)
- [x] Change to LEFT JOIN for uncategorized notes
- [x] Add JSON aggregation for links and images

**T-12: useNoteDetail Hook** ✅ (+1h)
- [x] Create custom hook for fetching single note
- [x] Call `get_note_detail` RPC
- [x] Handle loading, error, and success states
- [x] Add debug logging

**T-13: NoteDetail Component** ✅ (+2h)
- [x] Build full note display with ocean theme
- [x] Show category badge
- [x] Display full content
- [x] Show created/updated dates
- [x] Render links section with previews
- [x] Render images section with grid
- [x] Add back button navigation

**T-14: Debugging Tools** ✅ (+1h)
- [x] Integrate Eruda console for Telegram Web App
- [x] Add DebugConsole client component
- [x] Enhance error logging in hooks
- [x] Test debugging workflow

---

## Robust Product Tasks (Not Implemented Yet)

**T-10: Category Filtering** (+2h)
- Add filter toggle buttons
- Implement filter state logic
- Show/hide categories based on filter

**T-11: Loading Skeletons** (+2h)
- Create skeleton card component
- Replace loading text with skeletons
- Add shimmer animation

**T-12: Error Retry** (+1h)
- Add retry button to error state
- Implement retry logic

---

## Advanced Product Tasks

**T-13: Real-Time Updates** (+4h)
- Set up Supabase subscription
- Handle real-time note updates
- Update UI without page refresh

**T-14: Search Within Glance** (+3h)
- Add search input
- Filter displayed notes by keyword
- Highlight matches

**T-15: Drag-to-Reorder Categories** (+5h)
- Implement drag-and-drop library
- Save user preferences
- Restore custom order on mount

---

**Total MVP Tasks**: T-1 through T-8 | **Effort**: 12 hours

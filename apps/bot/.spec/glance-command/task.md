# Glance Command Implementation Tasks

**Status**: Not Started | **MVP Effort**: 8-12 hours | **Priority**: Medium

---

## T-1: Database Migration - Glance View Function

**Effort**: 2-3h | **Dependencies**: None

- [ ] Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_create_glance_view_function.sql`
- [ ] Write SQL function `get_notes_glance_view(telegram_user_id_param bigint, notes_per_category int DEFAULT 2)`
  ```sql
  -- Use window function with ROW_NUMBER() PARTITION BY category
  -- Join z_notes with z_note_categories (user_confirmed = true)
  -- Filter status = 'active'
  -- Return: note_id, category, content, updated_at, created_at,
  --         telegram_message_id, link_count, image_count,
  --         row_number, category_total, category_max_updated
  ```
- [ ] Add LEFT JOIN to count links and images per note
- [ ] Sort by category_max_updated DESC, then updated_at DESC within category
- [ ] Test migration locally with `supabase db push`

**Acceptance**:
- ✅ Function returns max 2 notes per category (6 categories = max 12 notes)
- ✅ Categories ordered by most recently updated note
- ✅ Empty categories return 0 rows (handled in application layer)
- ✅ Query executes in <100ms for datasets up to 10,000 notes

---

## T-2: Note Operations - Glance View Method

**Effort**: 1h | **Dependencies**: T-1

- [ ] Open `src/database/noteOperations.ts`
- [ ] Add method `getNotesGlanceView(userId: number, notesPerCategory: number = 2)`
- [ ] Call RPC function: `db.getClient().rpc('get_notes_glance_view', { telegram_user_id_param: userId, notes_per_category: notesPerCategory })`
- [ ] Transform response to TypeScript interface:
  ```typescript
  interface GlanceNote {
    note_id: string;
    category: NoteCategory;
    content: string;
    updated_at: string;
    created_at: string;
    telegram_message_id: number;
    link_count: number;
    image_count: number;
    row_number: number;
    category_total: number;
    category_max_updated: string;
  }
  ```
- [ ] Add error handling (console.error, return empty array on failure)

**Acceptance**:
- ✅ Method returns typed array of GlanceNote objects
- ✅ Error handling prevents crashes on database failures
- ✅ Method signature matches existing noteOps pattern

---

## T-3: Display Formatter - Glance View Message

**Effort**: 2h | **Dependencies**: T-2

- [ ] Open `src/bot/client.ts`
- [ ] Add private method `async showGlanceView(ctx: any, userId: number): Promise<void>`
- [ ] Fetch data: `const notes = await noteOps.getNotesGlanceView(userId, 2)`
- [ ] Group notes by category: `Map<NoteCategory, GlanceNote[]>`
- [ ] Build message string:
  ```typescript
  let message = '📋 *Quick Glance*\n\n';
  // Loop through ALL_CATEGORIES to ensure all 6 shown
  for (const category of ALL_CATEGORIES) {
    const categoryNotes = notesMap.get(category) || [];
    message += `${CATEGORY_EMOJI[category]} ${CATEGORY_LABELS[category]}\n`;
    if (categoryNotes.length === 0) {
      message += '  (No notes)\n\n';
    } else {
      categoryNotes.forEach((note, idx) => {
        const globalIndex = calculateGlobalIndex(note);
        const title = extractTitle(note.content, 30);
        const date = formatDate(note.updated_at); // "Nov 14"
        const preview = truncateContent(note.content, 30);
        message += `${globalIndex}. ${title} - ${date} - ${preview}...\n`;
      });
      message += '\n';
    }
  }
  ```
- [ ] Implement helper: `truncateContent(content: string, maxLength: number): string`
- [ ] Implement helper: `extractTitle(content: string, maxLength: number): string` (first line or first 30 chars)
- [ ] Implement helper: `formatDate(isoDate: string): string` using `toLocaleDateString()`

**Acceptance**:
- ✅ Message shows all 6 categories in order of most recently updated
- ✅ Content preview exactly 30 chars + "..." if truncated
- ✅ Date formatted as "Nov 14" (short month + day)
- ✅ Empty categories show "(No notes)" message

---

## T-4: Inline Keyboard - Number Buttons

**Effort**: 1h | **Dependencies**: T-3

- [ ] In `showGlanceView()`, build inline keyboard after message formatting
- [ ] Create button array with callback data `detail:{noteId}:glance`
  ```typescript
  const buttons = notes.map((note, index) => ({
    text: `${index + 1}`,
    callback_data: `detail:${note.note_id}:glance`
  }));
  ```
- [ ] Split buttons into rows (max 6 per row):
  ```typescript
  const keyboard = [];
  if (buttons.length <= 6) {
    keyboard.push(buttons);
  } else {
    keyboard.push(buttons.slice(0, 6));
    keyboard.push(buttons.slice(6));
  }
  ```
- [ ] Send message with inline keyboard: `ctx.reply(escapedMessage, { reply_markup: { inline_keyboard: keyboard }, parse_mode: 'MarkdownV2' })`

**Acceptance**:
- ✅ Buttons numbered sequentially (1, 2, 3...)
- ✅ Callback data format: `detail:{noteId}:glance`
- ✅ Layout: single row if ≤6 buttons, two rows if >6
- ✅ Clicking button triggers callback handler

---

## T-5: Command Handler - /glance Registration

**Effort**: 0.5h | **Dependencies**: T-3, T-4

- [ ] Open `src/bot/client.ts`, find `setupCommands()` method
- [ ] Add `/glance` command handler before `message:photo` handler:
  ```typescript
  this.bot.command('glance', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !this.isAuthorizedUser(userId)) {
      await ctx.reply('🚫 Unauthorized access. This bot is private.');
      return;
    }
    await this.showGlanceView(ctx, userId);
  });
  ```
- [ ] Update `/start` and `/help` messages to include `/glance` command description

**Acceptance**:
- ✅ `/glance` command triggers `showGlanceView()` method
- ✅ Unauthorized users receive error message
- ✅ Help text includes glance command documentation

---

## T-6: Callback Handler - Detail View from Glance

**Effort**: 1h | **Dependencies**: T-5

- [ ] Open `src/bot/client.ts`, find `callback_query` handler (around line 273)
- [ ] Add pattern matcher for `detail:*:glance`:
  ```typescript
  } else if (data?.startsWith('detail:') && data.includes(':glance')) {
    const parts = data.split(':');
    const noteId = parts[1];
    await ctx.answerCallbackQuery();
    await this.showNoteDetail(ctx, userId, noteId, 'glance');
  }
  ```
- [ ] Modify existing `showNoteDetail()` method to accept `returnContext` parameter:
  ```typescript
  async showNoteDetail(ctx: any, userId: number, noteId: string, returnContext: string | number)
  ```
- [ ] Update back button callback data based on `returnContext`:
  ```typescript
  const backButton = returnContext === 'glance'
    ? { text: '← Glance', callback_data: 'back_to_glance' }
    : { text: '← Back', callback_data: `notes_page_${returnContext}` };
  ```

**Acceptance**:
- ✅ Clicking number on glance view shows full note detail
- ✅ Detail view includes "← Glance" button when from glance context
- ✅ Detail view includes "← Back" button when from list context (existing)

---

## T-7: Callback Handler - Back to Glance

**Effort**: 0.5h | **Dependencies**: T-6

- [ ] In `callback_query` handler, add `back_to_glance` pattern:
  ```typescript
  } else if (data === 'back_to_glance') {
    await ctx.answerCallbackQuery();
    await this.showGlanceView(ctx, userId);
  }
  ```
- [ ] Ensure `showGlanceView()` supports both new message (`ctx.reply`) and edit message (`ctx.editMessageText`)
- [ ] Add conditional: if `ctx.callbackQuery` exists, use `editMessageText`, else use `reply`

**Acceptance**:
- ✅ "← Glance" button returns to glance view
- ✅ Message is edited (not new message sent) when returning
- ✅ Glance view refreshes with latest data on return

---

## T-8: Edge Cases & Error Handling

**Effort**: 1-2h | **Dependencies**: T-1 through T-7

- [ ] Handle no notes scenario: show encouraging message to save first note
- [ ] Handle database errors: catch and show user-friendly error message
- [ ] Handle long category chains: test with all 6 categories having 2 notes (12 total)
- [ ] Handle single note: ensure button grid works with 1 button
- [ ] Handle callback timeout: add 60s timeout for detail view navigation
- [ ] Test with various content types: emojis, special characters, URLs in content
- [ ] Test truncation: verify 30-char limit doesn't break markdown escaping

**Test Cases**:
- [ ] Zero notes total → "No notes yet" message
- [ ] One category with notes → Shows that category + 5 empty
- [ ] All categories populated → 12 buttons in 2 rows
- [ ] Content with special chars → Proper MarkdownV2 escaping
- [ ] Rapid button clicks → No duplicate messages or crashes

**Acceptance**:
- ✅ All edge cases handled gracefully
- ✅ No crashes on empty data or malformed content
- ✅ Clear error messages guide user actions

---

## Final Verification (MVP)

**Functional**:
- [ ] `/glance` command shows 2 notes per category
- [ ] Categories sorted by most recently updated note
- [ ] All 6 categories displayed (empty categories show "(No notes)")
- [ ] Content preview truncated at 30 chars with "..."
- [ ] Number buttons navigate to full note detail
- [ ] "← Glance" button returns to glance view
- [ ] Detail view shows all links, images, and metadata

**UI/UX**:
- [ ] Message loads in <1 second
- [ ] Button layout is compact (1-2 rows)
- [ ] Date format is readable ("Nov 14")
- [ ] Category headers clearly visible with emoji

**Integration**:
- [ ] Database migration applied successfully
- [ ] No conflicts with existing commands
- [ ] Callback handlers don't interfere with existing pagination
- [ ] Works on both new command and callback navigation

---

## Robust Product Tasks

**T-9: Filter Options** (+2h)
- Add command variants: `/glance marked`, `/glance active`, `/glance 7d`
- Extend database function with filter parameters
- Update command handler argument parsing

**T-10: Command Help Integration** (+1h)
- Add filter examples to help messages
- Update `/start` welcome with glance tips

---

## Advanced Product Tasks

**T-11: User Preferences Table** (+3h)
- Create migration for `z_user_preferences` table
- Add columns: notes_per_category, category_order, hidden_categories, pinned_categories
- Create CRUD operations in database layer

**T-12: Settings Command UI** (+4h)
- Add `/glance_settings` command
- Build interactive settings menu with inline keyboard
- Save/load user preferences

**T-13: Dynamic Glance View** (+2h)
- Read user preferences in `showGlanceView()`
- Apply custom notes-per-category count
- Apply custom category order and visibility

---

**Total MVP Tasks**: T-1 through T-8 | **Effort**: 8-12 hours

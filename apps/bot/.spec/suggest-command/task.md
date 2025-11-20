# Suggest Command Implementation Tasks

**Status**: Not Started | **MVP Effort**: 24-32 hours | **Priority**: Medium

**Dependency**: Impression tracking system must be implemented first (see separate spec)

---

## T-1: Database Function - get_suggestions_by_impression

**Effort**: 3h | **Dependencies**: Impression tracking columns (impression_count, last_shown_at) exist on z_notes

- [ ] Create migration file `supabase/migrations/YYYYMMDD_create_suggestions_function.sql`
- [ ] Write SQL function with parameters:
  ```sql
  CREATE OR REPLACE FUNCTION get_suggestions_by_impression(
    telegram_user_id_param BIGINT,
    days_back INT DEFAULT 7
  )
  ```
- [ ] Use CTE to calculate min_impression_count per category (window function)
- [ ] Filter: `created_at >= NOW() - INTERVAL '{days_back} days'`
- [ ] Filter: `status = 'active'` (exclude archived)
- [ ] Join with z_note_categories where `user_confirmed = true`
- [ ] Return columns: note_id, category, content, created_at, impression_count, last_shown_at, telegram_message_id, link_count, image_count, min_impression_count
- [ ] Add function comment with rollback instructions
- [ ] Test function with SQL: should return notes grouped by category with min counts

**Acceptance**:
- ✅ Function returns correct time-filtered notes (past 7 days)
- ✅ min_impression_count calculated correctly per category
- ✅ Archived notes excluded
- ✅ Query executes in <500ms for 1000+ notes

---

## T-2: Database Operations - getSuggestionsByImpression

**Effort**: 2h | **Dependencies**: T-1

- [ ] Add method to `src/database/noteOperations.ts`:
  ```typescript
  async getSuggestionsByImpression(
    userId: number,
    daysBack: number = 7
  ): Promise<SuggestionNote[]>
  ```
- [ ] Call RPC function `get_suggestions_by_impression`
- [ ] Validate authorized user (reuse validateAuthorizedUser)
- [ ] Handle database errors with handleDatabaseError
- [ ] Return typed array of SuggestionNote
- [ ] Add TypeScript interface in file header

**Acceptance**:
- ✅ Method returns correct notes for authorized user
- ✅ Error handling logs and returns empty array on failure
- ✅ Type safety enforced (no any types)

---

## T-3: Database Operations - incrementImpressions

**Effort**: 2h | **Dependencies**: T-2

- [ ] Add method to `src/database/noteOperations.ts`:
  ```typescript
  async incrementImpressions(noteIds: string[]): Promise<boolean>
  ```
- [ ] Update z_notes: `impression_count = impression_count + 1, last_shown_at = NOW()`
- [ ] Use `.in('id', noteIds)` for batch update
- [ ] Handle empty array gracefully (return true)
- [ ] Log errors with handleDatabaseError
- [ ] Return boolean success status

**Acceptance**:
- ✅ Batch update works for multiple note IDs
- ✅ impression_count increments correctly
- ✅ last_shown_at updated to current timestamp
- ✅ Empty array handled without errors

---

## T-4: Selection Service - suggestionSelector.ts

**Effort**: 4h | **Dependencies**: T-2

- [ ] Create file `src/services/suggestionSelector.ts`
- [ ] Implement `selectWeightedRandom(notes, categoryMinCounts)`:
  ```typescript
  export function selectWeightedRandom(
    notes: SuggestionNote[],
    categories: NoteCategory[]
  ): SuggestionNote[]
  ```
- [ ] Group notes by category
- [ ] For each category:
  - Find min_impression_count from first note in category
  - Filter least-shown: `impression_count === min_impression_count`
  - Generate random 0-1, if < 0.7 pick from least-shown, else pick from all
  - Use `Math.random()` for selection
- [ ] Return one note per category (or null if category empty)
- [ ] Export TypeScript interfaces
- [ ] Add JSDoc comments

**Test Cases**:
- [ ] Category with all notes having same impression_count → picks random
- [ ] Category with mixed counts → favors least-shown 70% of time
- [ ] Empty category → returns null
- [ ] Single note in category → returns that note

**Acceptance**:
- ✅ Weighted selection produces 70/30 distribution over 100 trials
- ✅ Handles edge cases (empty, single note, all same count)
- ✅ Pure function (no side effects)

---

## T-5: LLM Integration - scoreNoteRelevance

**Effort**: 3h | **Dependencies**: None (extends existing NoteClassifier)

- [ ] Add method to `src/services/noteClassifier.ts`:
  ```typescript
  async scoreNoteRelevance(content: string, query: string): Promise<number>
  ```
- [ ] Build prompt template:
  ```
  You are analyzing a note for relevance to a user query.

  User Query: "{query}"

  Note Content:
  """
  {content}
  """

  Score this note's relevance on a scale of 0-100.
  Return ONLY an integer score, nothing else.
  ```
- [ ] Call `this.callLLM(prompt)` (reuses Gemini/OpenRouter logic)
- [ ] Apply rate limiting (reuse `this.rateLimiter.waitForToken()`)
- [ ] Parse integer from response: `parseInt(response.trim(), 10)`
- [ ] Handle timeout (10 seconds): return 0 on failure
- [ ] Handle parse errors: return 0 if NaN

**Acceptance**:
- ✅ Returns integer score 0-100
- ✅ Rate limiting works (10 RPM for Gemini)
- ✅ Timeout handled gracefully (returns 0)
- ✅ Parse errors return 0

---

## T-6: Selection Service - selectByLLMScore

**Effort**: 3h | **Dependencies**: T-4, T-5

- [ ] Add function to `src/services/suggestionSelector.ts`:
  ```typescript
  export async function selectByLLMScore(
    notes: SuggestionNote[],
    query: string,
    classifier: NoteClassifier,
    categories: NoteCategory[]
  ): Promise<SuggestionNote[]>
  ```
- [ ] Group notes by category
- [ ] For each category:
  - Call `classifier.scoreNoteRelevance(note.content, query)` for each note
  - Handle API failures (skip note if score fails)
  - Track highest score and note
  - Return note with highest score
- [ ] Return one note per category
- [ ] Log LLM failures (console.error)

**Acceptance**:
- ✅ Returns highest-scoring note per category
- ✅ Handles API failures gracefully (skips failed notes)
- ✅ Works with rate limiting
- ✅ Falls back gracefully if all API calls fail

---

## T-7: Display Formatter - formatSuggestionsForDisplay

**Effort**: 3h | **Dependencies**: T-4

- [ ] Add function to `src/utils/linkFormatter.ts`:
  ```typescript
  export function formatSuggestionsForDisplay(
    notes: SuggestionNote[],
    query?: string
  ): { message: string; buttons: ButtonData[] }
  ```
- [ ] Header: `'💡 Weekly Suggestions'` (no query) or `'🔍 Suggestions: {query}'` (with query)
- [ ] Group by category (reuse ALL_CATEGORIES order)
- [ ] For each category:
  - Show emoji + label (CATEGORY_EMOJI, CATEGORY_LABELS)
  - Show note: `{index}. {preview} - {date}`
  - Preview: truncate content at 50 chars
  - Date: format as "Nov 14"
  - If no note: show "(No suggestions)"
- [ ] Build button data: `{ text: "{index}", callback_data: "detail:{noteId}:suggest" }`
- [ ] Return MarkdownV2-escaped message + button array

**Acceptance**:
- ✅ Message formatted correctly with escaping
- ✅ Buttons numbered sequentially (1, 2, 3...)
- ✅ Empty categories show "(No suggestions)"
- ✅ Query displayed in header when provided

---

## T-8: Command Handler - /suggest (no query)

**Effort**: 3h | **Dependencies**: T-2, T-3, T-4, T-7

- [ ] Add command to `src/bot/client.ts` after `/glance` command:
  ```typescript
  this.bot.command('suggest', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !this.isAuthorizedUser(userId)) {
      await ctx.reply('🚫 Unauthorized access. This bot is private.');
      return;
    }

    // Extract query if provided
    const text = ctx.message?.text || '';
    const query = text.replace('/suggest', '').trim();

    if (query) {
      await this.showSuggestViewWithQuery(ctx, userId, query);
    } else {
      await this.showSuggestView(ctx, userId);
    }
  });
  ```
- [ ] Implement `showSuggestView(ctx, userId)`:
  - Call `noteOps.getSuggestionsByImpression(userId, 7)`
  - Call `selectWeightedRandom(notes, ALL_CATEGORIES)`
  - Extract note IDs from selected notes
  - Call `noteOps.incrementImpressions(noteIds)`
  - Call `formatSuggestionsForDisplay(selectedNotes)`
  - Send message with inline keyboard
- [ ] Handle empty results: "No suggestions available. Try /notes to browse all notes."
- [ ] Add typing indicator: `ctx.replyWithChatAction('typing')`

**Acceptance**:
- ✅ Command executes without query parameter
- ✅ Suggestions shown in glance-style format
- ✅ impression_count incremented for shown notes
- ✅ Empty results handled gracefully

---

## T-9: Command Handler - /suggest <query>

**Effort**: 4h | **Dependencies**: T-2, T-3, T-6, T-7

- [ ] Implement `showSuggestViewWithQuery(ctx, userId, query)`:
  - Validate query length (max 500 chars)
  - Call `noteOps.getSuggestionsByImpression(userId, 7)`
  - Initialize `NoteClassifier` instance
  - Call `selectByLLMScore(notes, query, classifier, ALL_CATEGORIES)`
  - Extract note IDs from selected notes
  - Call `noteOps.incrementImpressions(noteIds)`
  - Call `formatSuggestionsForDisplay(selectedNotes, query)`
  - Send message with inline keyboard
- [ ] Show typing indicator during LLM processing
- [ ] Handle LLM quota exhaustion: fall back to weighted random
- [ ] Handle empty query: treat as non-query mode
- [ ] Handle long queries: truncate at 500 chars with warning

**Acceptance**:
- ✅ Query extracted correctly from command
- ✅ LLM scores notes for relevance
- ✅ Highest-scoring note per category selected
- ✅ Query shown in header
- ✅ Fallback to weighted random if LLM fails

---

## T-10: Callback Handlers - back_to_suggest

**Effort**: 2h | **Dependencies**: T-8

- [ ] Add callback handler to `src/bot/client.ts`:
  ```typescript
  } else if (data === 'back_to_suggest') {
    await ctx.answerCallbackQuery();
    await this.showSuggestView(ctx, userId);
  } else if (data?.startsWith('back_to_suggest_query:')) {
    const query = decodeURIComponent(data.replace('back_to_suggest_query:', ''));
    await ctx.answerCallbackQuery();
    await this.showSuggestViewWithQuery(ctx, userId, query);
  }
  ```
- [ ] Update detail view to detect `:suggest` suffix in callback data
- [ ] Generate appropriate back button:
  - No query: `{ text: '← Suggest', callback_data: 'back_to_suggest' }`
  - With query: `{ text: '← Suggest', callback_data: 'back_to_suggest_query:{query}' }`
- [ ] URL-encode query for callback data

**Acceptance**:
- ✅ Back button returns to suggestion list
- ✅ Query preserved in back navigation
- ✅ Callback answered immediately (no timeout)

---

## T-11: Error Handling & Edge Cases

**Effort**: 2h | **Dependencies**: T-8, T-9

- [ ] Handle impression_count column missing:
  - Detect on startup (check schema)
  - Show error message: "Suggestion feature requires database migration. Contact admin."
- [ ] Handle all categories empty (no notes in 7 days):
  - Show message: "No notes from past 7 days. Try /notes to browse all notes."
- [ ] Handle LLM API errors:
  - Log error with context (query, note count)
  - Fall back to weighted random
  - Show message: "LLM unavailable, using smart selection instead."
- [ ] Handle query parsing edge cases:
  - Empty query after trim → treat as non-query mode
  - Special characters in query → sanitize before LLM prompt
  - Very long query (>500 chars) → truncate with warning

**Acceptance**:
- ✅ Missing columns detected and handled gracefully
- ✅ Empty results show helpful message
- ✅ LLM failures don't crash command
- ✅ Edge cases logged for debugging

---

## T-12: Integration Testing

**Effort**: 3h | **Dependencies**: All above tasks

- [ ] Test `/suggest` with notes from past 7 days → shows suggestions
- [ ] Test `/suggest` with no notes in past 7 days → shows empty message
- [ ] Test `/suggest about AI` with relevant notes → shows AI-related suggestions
- [ ] Test weighted selection distribution (run 100 times, verify 70/30 split)
- [ ] Test LLM quota exhaustion → falls back gracefully
- [ ] Test impression_count increments correctly after suggestion shown
- [ ] Test back navigation from detail view → returns to suggestions
- [ ] Test query back navigation → preserves query parameter
- [ ] Test all 6 categories with mixed impression counts
- [ ] Test archived notes excluded from suggestions

**Acceptance**:
- ✅ All scenarios pass without errors
- ✅ Impression tracking works correctly
- ✅ LLM integration stable
- ✅ UI displays correctly

---

## Final Verification (MVP)

**Functional**:
- [ ] `/suggest` shows one note per category from past 7 days
- [ ] Weighted selection favors least-shown notes (70% probability)
- [ ] `/suggest <query>` uses LLM for semantic scoring
- [ ] impression_count incremented for shown notes
- [ ] last_shown_at updated to current timestamp
- [ ] Archived notes excluded
- [ ] Empty categories show "(No suggestions)"
- [ ] Detail view back button works correctly

**UI/UX**:
- [ ] Glance-style format with category headers
- [ ] Numbered buttons for detail navigation
- [ ] Content preview truncated at 50 characters
- [ ] Date shown in "Nov 14" format
- [ ] Query displayed in header when provided

**LLM Integration**:
- [ ] Rate limiting works (10 RPM for Gemini, 60 RPM for OpenRouter)
- [ ] Timeout handled (10 seconds)
- [ ] Falls back to weighted random if LLM fails
- [ ] Query parsing works correctly

**Database**:
- [ ] Function filters by time range (past 7 days)
- [ ] min_impression_count calculated correctly
- [ ] Impression updates are atomic
- [ ] Query performance <500ms for 1000+ notes

---

## Robust Product Tasks

**T-13: Configurable Time Range** (+4h)
- Add parameter parsing: `/suggest 7d`, `/suggest 30d`, `/suggest all`
- Update database function to accept variable days_back
- Validate time range (7/30/all only)

**T-14: Suggestion History Tracking** (+6h)
- Create z_note_suggestions table (note_id, suggested_at, query_used)
- Insert record on each suggestion
- Add analytics queries (most/least suggested)

**T-15: Consumed/Dismissed Tracking** (+4h)
- Add is_consumed boolean to z_notes
- Add "Not Interested" button to suggestions
- Exclude consumed notes from future suggestions

---

## Advanced Product Tasks

**T-16: Auto-Weekly Digest** (+8h)
- Set up cron job (PM2 or external scheduler)
- Send suggestions every Monday at 9am
- Add user preference for digest schedule

**T-17: Category Weight Preferences** (+6h)
- Create z_user_preferences table (category, weight)
- Adjust selection probability based on weights
- Add /preferences command for configuration

**T-18: Exclude Specific Notes** (+4h)
- Add exclude_from_suggestions boolean to z_notes
- Filter excluded notes in database function
- Add toggle in detail view

---

**Total MVP Tasks**: T-1 through T-12 | **Effort**: 24-32 hours (3-4 days)

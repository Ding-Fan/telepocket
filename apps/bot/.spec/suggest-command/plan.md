# Suggest Command Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Impression Tracking** | Separate feature dependency | Affects entire bot (search, pagination, glance), not just suggestions. Needs its own spec/migration/implementation. |
| **Selection Algorithm** | Weighted random (70/30 split) | Balances fairness (least-shown get priority) with serendipity (random discovery). Simple to implement, no ML needed. |
| **LLM Provider** | Reuse NoteClassifier service | Already integrated with Gemini/OpenRouter, rate limiting built-in. No new API client needed. |
| **Time Filter** | 7 days hardcoded (MVP) | Keeps suggestions fresh and relevant. Configurable range deferred to Robust tier. |
| **Query Parsing** | Simple string extraction | `/suggest <query>` → extract everything after "suggest". No complex NLP needed for MVP. |
| **Display Format** | Glance-style (reuse pattern) | Consistent with existing `/glance` command. Code reuse for formatting and button layout. |
| **Callback Data** | `detail:{noteId}:suggest` pattern | Matches existing callback structure. Back button knows return context. |

## Codebase Integration Strategy

**Command Location**: `src/bot/client.ts`
- Add command handler after `/glance` command (~line 330)
- Follow existing pattern: auth check → call handler method
- Handler method: `showSuggestView(ctx, userId, query?)`

**Database Layer**: `src/database/noteOperations.ts`
- New method: `getSuggestionsByImpression(userId, daysBack)`
- Returns notes with min_impression_count per category
- Reuse existing validation and error handling patterns

**Selection Logic**: New file `src/services/suggestionSelector.ts`
- `selectWeightedRandom(notes, categoryMinCounts)` - implements 70/30 algorithm
- `selectByLLMScore(notes, query, classifier)` - LLM-powered selection
- Pure functions, easy to test independently

**LLM Integration**: Reuse `src/services/noteClassifier.ts`
- Add new method: `scoreNoteRelevance(content, query)` → 0-100
- Reuse existing rate limiter and timeout logic
- No changes to constructor or provider setup

**Display Formatter**: Extend `src/utils/linkFormatter.ts`
- New function: `formatSuggestionsForDisplay(notes, query?)`
- Reuse glance formatting patterns (emoji, truncation, date)
- Returns message string + button data

## Technical Approach

**Existing Patterns to Follow**:
1. **Command Structure**: Study `showGlanceView()` in `src/bot/client.ts:1150` for glance-style display
2. **Database Functions**: Study `get_notes_glance_view` in migration `20251114140300` for window functions
3. **LLM Integration**: Study `NoteClassifier.suggestCategories()` in `src/services/noteClassifier.ts` for rate limiting
4. **Callback Handling**: Study `callback_query` handler in `src/bot/client.ts:355` for detail navigation

**Component Composition**:
- Command handler → Database fetch → Selection algorithm → LLM scoring (if query) → Display formatter → Send message
- Impression increment happens after display (update z_notes.impression_count, last_shown_at)

**Suggestion Flow** (without query):
```
/suggest command
  ↓
getSuggestionsByImpression(userId, 7)
  → Returns notes with min_impression_count per category
  ↓
For each category:
  - Filter notes where impression_count = min_impression_count (least-shown tier)
  - 70% chance: random from least-shown, 30% chance: random from all
  ↓
Increment impression_count for selected notes (batch update)
  ↓
formatSuggestionsForDisplay(selectedNotes)
  ↓
Send message with inline keyboard
```

**Suggestion Flow** (with query):
```
/suggest about AI
  ↓
Extract query: "about AI"
  ↓
getSuggestionsByImpression(userId, 7)
  → Returns all notes from past 7 days
  ↓
For each category:
  - Call classifier.scoreNoteRelevance(note.content, query)
  - Rate limit: 10 RPM (Gemini) or 60 RPM (OpenRouter)
  - Timeout: 10 seconds
  - Pick note with highest score
  ↓
Increment impression_count for selected notes
  ↓
formatSuggestionsForDisplay(selectedNotes, query)
  ↓
Send message with scores (optional)
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Dependency on impression tracking** | Document clearly as prerequisite. Fail gracefully if columns don't exist (check schema on startup). |
| **LLM API quota exhaustion** | Reuse existing rate limiter (10 RPM conservative). Show error message if quota exceeded, fall back to non-query mode. |
| **Empty suggestions (no notes in 7 days)** | Show message: "No suggestions available. Try /notes to browse all notes." Handle gracefully. |
| **Weighted selection bias** | Test with different impression_count distributions. Ensure 30% random prevents staleness. |
| **Query parsing edge cases** | Handle empty query, very long query (>500 chars), special characters. Sanitize input. |

## Integration Points

**Database Functions**: `supabase/migrations/2025XXXX_create_suggestions_function.sql`
- New function: `get_suggestions_by_impression(telegram_user_id_param, days_back)`
- Uses window functions to calculate min_impression_count per category

**Bot Commands**: `src/bot/client.ts`
- New command: `bot.command('suggest', async (ctx) => {...})`
- New callback handler: `back_to_suggest`, `back_to_suggest_query:{query}`

**Database Operations**: `src/database/noteOperations.ts`
- New method: `getSuggestionsByImpression(userId, daysBack): Promise<SuggestionNote[]>`
- New method: `incrementImpressions(noteIds: string[]): Promise<boolean>`

**Services**: `src/services/suggestionSelector.ts` (new file)
- Export: `selectWeightedRandom(notes, categoryMinCounts)`
- Export: `selectByLLMScore(notes, query, classifier)`

## Success Criteria

**Technical**:
- Database query executes in <500ms for 1000+ notes
- LLM scoring completes within rate limits (10 RPM)
- Weighted selection produces 70/30 distribution over 100 trials
- Impression updates are atomic (no race conditions)

**User**:
- User sees one suggestion per category from past week
- Least-shown notes appear more frequently than often-shown
- Query mode returns semantically relevant results
- Back navigation returns to correct context (suggest vs query)

**Business**:
- Increases note rediscovery (users view older saved content)
- Reduces note accumulation without consumption
- Provides personalized recommendations without manual curation

## Robust Product (+2 days)

Configurable time range (/suggest 7d, /suggest 30d, /suggest all), suggestion history tracking (z_note_suggestions table), consumed/dismissed notes (user marks "not interested"), analytics dashboard (most/least suggested notes).

## Advanced Product (+4-5 days)

Auto-weekly digest (cron job sends suggestions every Monday), category weight preferences (user adjusts probability), exclude specific notes, personalized ML recommendations (train on user patterns), multi-query support (/suggest "AI OR machine learning"), export suggestion history to JSON/CSV.

---

**Total MVP Effort**: 24-32 hours (3-4 days) | **Dependencies**: Impression tracking system (impression_count, last_shown_at columns + increment logic everywhere)

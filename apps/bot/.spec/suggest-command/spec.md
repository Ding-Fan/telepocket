# Suggest Command Specification

## Problem & Solution

**Problem**: Users save many notes but struggle to rediscover valuable content. Notes accumulate without a system for surfacing relevant items at the right time. No way to get personalized recommendations based on what hasn't been seen recently.

**Solution**: `/suggest` command provides smart weekly recommendations - one note per category from past 7 days. Uses weighted selection (70% least-shown, 30% random) based on impression tracking. Optional query parameter enables LLM semantic search (e.g., `/suggest about AI`, `/suggest help me get a job`).

**Returns**: Glance-style display with one suggestion per category, numbered detail buttons, excludes archived notes.

## Command Interface

```typescript
// Command usage
/suggest                           // Smart selection from past 7 days
/suggest <query>                   // LLM-powered semantic search
/suggest about AI                  // Example: find AI-related notes
/suggest help me get a job         // Example: find career-related notes

// Callback data formats
detail:{noteId}:suggest            // View note detail from suggestions
back_to_suggest                    // Return to suggestions from detail
back_to_suggest_query:{query}      // Return to query suggestions
```

## Core Flow

### Without Query (Smart Selection)

```
User sends /suggest
  ↓
Fetch notes from past 7 days per category (status=active, user_confirmed=true)
  ↓
For each category:
  - Filter least-shown notes (MIN impression_count)
  - 70% probability: Pick random from least-shown
  - 30% probability: Pick random from all
  ↓
Increment impression_count, update last_shown_at
  ↓
Display glance-style with category grouping + numbered buttons
  ↓
User clicks number → Show detail with "← Suggest" button
```

### With Query (LLM Semantic Search)

```
User sends /suggest about AI
  ↓
Extract query: "about AI"
  ↓
Fetch notes from past 7 days per category (status=active)
  ↓
For each category:
  - Call LLM with prompt: "Score relevance to query: {query}"
  - Get score 0-100 per note
  - Pick highest scoring note
  ↓
Increment impression_count, update last_shown_at
  ↓
Display with relevance scores + query context
  ↓
User clicks number → Show detail with "← Suggest" button
```

## User Stories

**US-1: Weekly Discovery Without Query**
User sends `/suggest` every Monday. Bot shows one note per category from past week, favoring least-seen notes. User discovers forgotten blog post they saved, clicks button to read full content with links.

**US-2: Semantic Query Search**
User sends `/suggest something to help me get a job`. LLM analyzes all notes from past 7 days, scores each for career relevance. Bot shows highest-scoring note per category. User finds relevant blog post about resume writing and YouTube video about interview prep.

**US-3: Impression-Based Fairness**
User frequently views Todo category but ignores Japanese notes. Suggestion algorithm ensures Japanese notes with `impression_count=0` get shown with 70% probability, preventing always-shown notes from dominating suggestions.

## MVP Scope

**Included**:
- `/suggest` command (no query) - weighted selection from past 7 days
- `/suggest <query>` command - LLM semantic scoring
- Weighted selection: 70% least-shown (MIN impression_count), 30% random
- Time filter: past 7 days only (both modes)
- Category-based selection: one per category
- Glance-style display format
- Numbered detail buttons (1, 2, 3...)
- Detail view with "← Suggest" back button
- LLM provider: Google Gemini or OpenRouter (configurable)
- Increment impression_count when shown
- Update last_shown_at timestamp
- Exclude archived notes (status='archived')
- Show empty categories as "(No suggestions)"
- Rate limiting: reuse existing NoteClassifier rate limiter

**NOT Included** (Future):
- Configurable time range (/suggest 30d) → 🔧 Robust
- Track consumed/dismissed suggestions → 🔧 Robust
- Suggestion history table → 🔧 Robust
- Auto-weekly digest (scheduled) → 🚀 Advanced
- Category preferences (weight adjustment) → 🚀 Advanced
- Exclude specific notes from suggestions → 🚀 Advanced
- Personalized ML recommendations → 🚀 Advanced

## Database Schema

**Required Dependency** (separate feature): Impression tracking columns on z_notes

```sql
-- Impression tracking (DEPENDENCY - must exist before suggest command)
ALTER TABLE z_notes
  ADD COLUMN impression_count INT DEFAULT 0,
  ADD COLUMN last_shown_at TIMESTAMPTZ;

CREATE INDEX idx_notes_impression_count ON z_notes(impression_count);
CREATE INDEX idx_notes_last_shown ON z_notes(last_shown_at);
```

**New Function**: `get_suggestions_by_impression`

```sql
CREATE OR REPLACE FUNCTION get_suggestions_by_impression(
  telegram_user_id_param BIGINT,
  days_back INT DEFAULT 7
)
RETURNS TABLE (
  note_id UUID,
  category TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  impression_count INT,
  last_shown_at TIMESTAMPTZ,
  telegram_message_id BIGINT,
  link_count BIGINT,
  image_count BIGINT,
  min_impression_count INT
)
LANGUAGE plpgsql;
```

**Response Structure**:
```typescript
interface SuggestionNote {
  note_id: string;
  category: NoteCategory;
  content: string;
  created_at: string;
  impression_count: number;
  last_shown_at: string | null;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  min_impression_count: number; // MIN within category for weighted selection
}
```

## LLM Integration

**Provider**: Google Gemini 2.5 Flash or OpenRouter (configurable via environment)

**Prompt Template** (for query mode):
```
You are analyzing a note for relevance to a user query.

User Query: "{query}"

Note Content:
"""
{note_content}
"""

Score this note's relevance to the query on a scale of 0-100:
- 0-20: Completely irrelevant
- 21-40: Tangentially related
- 41-60: Somewhat relevant
- 61-80: Quite relevant
- 81-100: Highly relevant

Return ONLY an integer score (0-100), nothing else.
```

**Rate Limiting**: Reuse existing `NoteClassifier` rate limiter (10 RPM for Gemini, 60 RPM for OpenRouter)

**Timeout**: 10 seconds per API call

## Acceptance Criteria (MVP)

**Functional**:
- [ ] `/suggest` fetches notes from past 7 days only (created_at >= NOW() - INTERVAL '7 days')
- [ ] One suggestion per category (max 6 notes total)
- [ ] Weighted selection: 70% from least-shown, 30% from all
- [ ] `/suggest <query>` extracts query text and calls LLM
- [ ] LLM scores each note 0-100 for relevance
- [ ] Highest-scoring note per category selected
- [ ] impression_count incremented for shown notes
- [ ] last_shown_at updated with current timestamp
- [ ] Archived notes excluded (status != 'archived')
- [ ] Empty categories show "(No suggestions)"
- [ ] Detail view shows "← Suggest" back button
- [ ] Query mode shows "← Suggest: {query}" back button

**UI/UX**:
- [ ] Glance-style format with category headers
- [ ] Numbered buttons (1, 2, 3...) for detail navigation
- [ ] Category emoji + label displayed
- [ ] Content preview truncated at 50 characters
- [ ] Created date shown in "Nov 14" format
- [ ] Query mode shows relevance scores (optional)

**LLM Integration**:
- [ ] Rate limiting works (no quota exhaustion)
- [ ] Timeout handled gracefully (skip note if API fails)
- [ ] Falls back to non-query mode if all API calls fail
- [ ] Query parsing removes "/suggest" prefix
- [ ] Empty query treated as non-query mode

**Database**:
- [ ] Function filters by time range (past 7 days)
- [ ] Function returns min_impression_count per category
- [ ] Impression update is atomic (no race conditions)
- [ ] Performance: query executes <500ms for 1000+ notes

## Future Tiers

**🔧 Robust** (+2 days): Configurable time range (/suggest 7d, /suggest 30d, /suggest all), track suggestion history (z_note_suggestions table with suggested_at, query_used), consumed/dismissed tracking (user can mark "not interested"), suggestion analytics (most/least suggested notes).

**🚀 Advanced** (+4-5 days): Auto-weekly digest (scheduled job sends suggestions every Monday), category weight preferences (user adjusts probability per category), exclude specific notes from suggestions, personalized ML recommendations (train on user's consumption patterns), multi-query mode (/suggest "AI OR machine learning"), export suggestion history.

---

**Status**: Ready for Implementation | **MVP Effort**: 3-4 days | **Dependencies**: Impression tracking system (impression_count, last_shown_at columns + increment logic)

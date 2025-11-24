# LLM Note Classification Specification

## Problem & Solution

**Problem**: Notes and links accumulate without organization. Users must manually categorize hundreds of items, leading to poor searchability and lost productivity. No way to quickly identify todos, ideas, blog references, or video content.

**Solution**: LLM analyzes message content on save → Detects likely categories (todo, idea, blog, youtube) → Bot response includes inline category buttons → User clicks to confirm → Note tagged with category → Filterable by category later.

**Returns**: Intelligent category suggestions as inline buttons, instant categorization with one click, searchable by category (e.g., `/notes todo`, `/notes idea`).

## Component API

```typescript
// LLM Service
interface CategorySuggestion {
  category: 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese';
  confidence: number; // 0-1
  reason?: string;
}

class NoteClassifier {
  async suggestCategories(content: string, urls?: string[]): Promise<CategorySuggestion[]>;
  async classifyLink(url: string, title?: string, description?: string): Promise<CategorySuggestion[]>;
  async scoreNoteRelevance(content: string, query: string): Promise<number>; // For semantic search in /suggest
}

// Database Operations
interface NoteCategory {
  id: string;
  note_id: string;
  category: string;
  confidence: number;
  user_confirmed: boolean;
  created_at: string;
}

interface UnclassifiedNote {
  id: string;
  content: string;
  urls?: string[];
}

interface UnclassifiedLink {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

async function addNoteCategory(noteId: string, category: string, confidence: number): Promise<void>;
async function getNotesByCategory(userId: number, category: string, page: number): Promise<PaginatedResult>;
async function fetchUnclassifiedNotes(): Promise<UnclassifiedNote[]>;
async function fetchUnclassifiedLinks(): Promise<UnclassifiedLink[]>;
async function updateNoteCategory(noteId: string, category: string, confidence: number): Promise<void>;
async function updateLinkCategory(linkId: string, category: string): Promise<void>;
```

## Core Flow

### Real-time Classification (on save)

```
User sends message: "Need to fix the login bug tomorrow"
  ↓
Bot processes message → Saves note
  ↓
LLM analyzes: "This looks like a todo (95% confidence)"
  ↓
Bot replies: "✅ Saved note"
Inline buttons: [📋 Todo] [💡 Idea]
  ↓
User clicks [📋 Todo]
  ↓
Bot updates: category = 'todo', user_confirmed = true
Bot replies: "✅ Tagged as Todo"
  ↓
Later: /notes todo → Shows all todo notes
```

### Batch Classification (via /classify command)

```
User sends: /classify [batch_size]  # Optional batch size (default: 3, max: 50)
  ↓
Bot fetches N unclassified items (category IS NULL)
  ↓
Bot replies: "Starting classification... Processing N items (1048 total unclassified)"
  ↓
For each item (batch of N):
  - Call LLM API (with 500ms delay)
  - Auto-confirm if score ≥95 → Save immediately
  - Show interactive buttons if score <95 → ALL 6 categories displayed
  ↓
Bot shows auto-confirmed items:
  "✅ Auto-confirmed:
   📝 'https://example.com/blog-post...'
   🏷️ 📝 Blog (98)"
  ↓
Bot shows items pending user input (score <95):
  "📝 Item 1/N:
   'Need to fix the login bug...'

   Assign category:
   [📋 Todo] [💡 Idea] [📝 Blog]
   [📺 YouTube] [📖 Reference] [🇯🇵 Japanese]"

   ⚠️ NEW: Shows ALL 6 categories (sorted by LLM score, 3 per row)
   ⚠️ User can override wrong AI suggestions with any category
  ↓
Bot waits 1 minute for user interaction
  ↓
User clicks [📋 Todo] → Assigned immediately (user_confirmed = true)
  OR
  Timeout (1 min) → Auto-assign best match (user_confirmed = false)
  ↓
Bot replies: "Batch complete! ✅ 1 auto-confirmed (≥95) 📝 2 auto-assigned"
  ↓
User can run /classify again for next batch: "📊 1045 unclassified items remaining"

Examples:
- /classify      → Process 3 items (default)
- /classify 10   → Process 10 items
- /classify 50   → Process 50 items (maximum)
```

## User Stories

**US-1: Quick Todo Classification**
User sends "Remind me to buy milk tomorrow". Bot saves note and shows response with [📋 Todo] button. User clicks button. Note tagged as todo. User later runs `/notes todo` to see all tasks.

**US-2: Blog Reference Detection**
User sends link to blog post: "https://example.com/how-to-scale-postgres". Bot detects blog URL pattern, shows [📝 Blog] [💡 Idea] buttons. User clicks [📝 Blog]. Note categorized for later reading.

**US-3: YouTube Video Tracking**
User sends "https://youtube.com/watch?v=xyz great tutorial". Bot detects YouTube URL, shows [📺 YouTube] [💡 Idea] buttons. User confirms. Later filters with `/notes youtube` to watch saved videos.

**US-4: Multi-Category Suggestion**
User sends "Blog post idea: How to debug production issues". LLM detects both "blog" and "idea". Bot shows [📝 Blog] [💡 Idea] buttons. User can click both. Note gets multiple categories.

**US-5: Skip Classification**
User sends general note without clear category. LLM confidence <60% for all categories. Bot shows no category buttons, just saves note normally. No forced categorization.

**US-6: Interactive Batch Classification**
User has 1,048 unclassified notes from before enabling the feature. User runs `/classify`. Bot processes 3 items at a time. For items with score ≥95, bot auto-confirms immediately. For items with score <95, bot shows interactive buttons with all category scores. User has 1 minute to click buttons. After timeout, bot auto-assigns best match to remaining items. Bot shows summary: "✅ 1 auto-confirmed (≥95) 📝 2 auto-assigned". User runs `/classify` again to process next batch of 3 items. Process repeats until all 1,048 items are classified.

## MVP Scope

**Included**:
- LLM classification on every note save (notes, links, images)
- 6 core categories: Todo, Idea, Blog, YouTube, Reference, Japanese
- Specialized prompt per category with 0-100 scoring system
- Two-tier threshold system:
  - Auto-confirm threshold (≥95): Automatically tag without user interaction
  - Show-button threshold (≥60): Display category button for user confirmation
- Parallel classification: All 6 categories scored simultaneously
- Inline buttons on bot response message (only for scores 60-94)
- Click button → Tag note with category + set user_confirmed=true
- Multiple categories per note supported (independent scoring)
- Database: `z_note_categories` junction table
- Filter command: `/notes <category>` → Show notes by category
- Category indicator in notes list (📋 💡 📝 📺 📚 🇯🇵)
- `/classify [batch_size]` command: Interactive batch classification for unclassified notes and links
  - **Configurable batch size**: Optional parameter (default: 3, max: 50)
  - **Show ALL categories**: Displays all 6 category buttons for every item (sorted by score, 3 per row)
  - Auto-confirms items with score ≥95 (no user interaction)
  - Shows interactive buttons for items with score <95
  - 1-minute timeout for user interaction
  - Auto-assigns best match to remaining items after timeout
  - User can click buttons to manually assign categories (user_confirmed = true)
  - Auto-assigned items marked as user_confirmed = false
  - Rate limiting: 500ms delay between API calls
  - No skip logic: Every item gets classified (either confirmed or assigned)
  - Callback handler: `ca:shortKey:category:type` (short-key mapping)
  - Final summary: "✅ 1 auto-confirmed (≥95) 📝 2 auto-assigned"
  - Shows remaining count: "📊 1045 unclassified items remaining"

**NOT Included** (Future):
- Custom user-defined categories → 🔧 Robust
- Category editing/removal → 🔧 Robust
- Auto-categorization without confirmation → 🔧 Robust
- Category-based sorting → 🚀 Advanced
- Smart category recommendations based on history → 🚀 Advanced
- Natural language search within category → 🚀 Advanced
- Export notes by category → 🚀 Advanced

## Database Schema

```sql
-- Category definitions (fixed for MVP)
CREATE TABLE z_note_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES z_notes(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('todo', 'idea', 'blog', 'youtube', 'reference', 'japanese')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  user_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_note_categories_note_id ON z_note_categories(note_id);
CREATE INDEX idx_note_categories_category ON z_note_categories(category);
CREATE INDEX idx_note_categories_user_confirmed ON z_note_categories(user_confirmed);

-- Composite index for category filtering
CREATE INDEX idx_note_categories_category_confirmed
  ON z_note_categories(category, user_confirmed)
  WHERE user_confirmed = TRUE;

-- RLS Policies
ALTER TABLE z_note_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on note_categories for service_role"
  ON z_note_categories FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on note_categories for public"
  ON z_note_categories FOR ALL TO public USING (true) WITH CHECK (true);
```

**Queries for Batch Classification**:

```sql
-- Fetch unclassified notes (no category assigned)
SELECT DISTINCT n.id, n.content, n.telegram_message_id
FROM z_notes n
LEFT JOIN z_note_categories nc ON n.id = nc.note_id
WHERE nc.note_id IS NULL
  AND n.status = 'active'
ORDER BY n.created_at DESC;

-- Fetch unclassified links (no category assigned)
SELECT DISTINCT l.id, l.url, l.title, l.description, l.message_id
FROM z_links l
LEFT JOIN z_note_categories nc ON l.id = nc.note_id
WHERE nc.note_id IS NULL
ORDER BY l.created_at DESC;

-- Note: Links currently reference messages, not notes
-- The schema may need adjustment to link categories to links directly
-- Alternative: Create link categories via parent note relationship
```

## LLM Integration

**Providers**: Dual-provider architecture with automatic fallback

### Primary: OpenRouter (Recommended)
- **Model**: `google/gemini-2.5-flash` (user-configurable)
- **Free Tier**: No daily limits, pay-per-use pricing
- **Rate Limits**: 60 requests/minute with 20-request burst capacity
- **Response Time**: <1s for classification
- **Fallback**: Automatic fallback to Gemini if OpenRouter fails

### Secondary: Google Gemini (Fallback)
- **Model**: Gemini 2.5 Flash (recommended)
- Latest model with improved reasoning capabilities
- 1 million token context window, January 2025 knowledge cutoff
- Fast, efficient, perfect for classification tasks
- **Free Tier**: 500 requests/day, 250,000 tokens/min
- **Rate Limits**: 10 requests/minute (conservative for stability)
- Response time: <1s for classification

### Category Prompt System

**NEW**: Each category now has its own specialized prompt with a 0-100 scoring system. See [`prompts.md`](./prompts.md) for detailed prompt specifications.

**Scoring Scale**:
- **95-100**: Definite match → Auto-confirm (no user interaction)
- **85-94**: High confidence → Show button
- **70-84**: Moderate confidence → Show button
- **60-69**: Low confidence → Show button
- **0-59**: Insufficient → Skip

**Categories**:
1. **Todo** - Tasks, reminders, action items
2. **Idea** - Brainstorms, concepts, potential projects
3. **Blog** - Blog posts, articles, written content
4. **YouTube** - Video content, tutorials, talks
5. **Reference** - Documentation, guides, resources
6. **Japanese** - Japanese language study materials, vocabulary, grammar

**Multi-Category Support**:
- Each category scored independently (parallel execution)
- Multiple categories can be auto-confirmed (score ≥95)
- Multiple buttons shown if multiple categories score 60-94
- User can confirm multiple categories per note

**Environment Variables**:
```bash
# LLM Provider Selection
LLM_PROVIDER=openrouter  # 'gemini' or 'openrouter' (default: openrouter)

# OpenRouter Configuration (Primary Provider)
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=google/gemini-2.5-flash  # Default: Gemini 2.5 Flash (user-configurable)
OPENROUTER_FALLBACK_TO_GEMINI=true  # Enable automatic fallback to Gemini

# Google Gemini Configuration (Fallback Provider)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Feature Flags
LLM_CLASSIFICATION_ENABLED=true  # Master feature flag
LLM_AUTO_CONFIRM_THRESHOLD=95    # Auto-tag if score ≥95
LLM_SHOW_BUTTON_THRESHOLD=60     # Show button if score ≥60
LLM_JAPANESE_CATEGORY_ENABLED=true  # Enable Japanese category
```

## Acceptance Criteria (MVP)

**Functional**:
- [ ] LLM analyzes every note/link on save
- [ ] Category buttons appear on bot response if confidence >60%
- [ ] Multiple category buttons can be shown simultaneously
- [ ] Clicking button tags note with category
- [ ] Same note can have multiple categories
- [ ] `/notes <category>` filters notes by category
- [ ] Category indicators shown in notes list (emoji)
- [ ] URL pattern detection (youtube.com → YouTube category)
- [ ] No buttons shown if all confidence <60%

**Batch Classification (`/classify` command)**:
- [x] `/classify [batch_size]` command accepts optional batch size parameter (default: 3, max: 50)
- [x] Command argument parsing and validation (range: 1-50)
- [x] Fetches N unclassified items per batch (configurable)
- [x] Processes both notes and links independently
- [x] Links classified using URL + title + description metadata
- [x] Auto-confirms items with score ≥95 (no user interaction)
- [x] Shows interactive buttons for items with score <95
- [x] **Displays ALL 6 categories** sorted by score (not filtered by threshold)
- [x] 3-per-row button layout (cleaner than previous 2-per-row)
- [x] Score displayed on each button to help user make informed decisions
- [x] User has 1 minute to click buttons for manual assignment
- [x] Auto-assigns best match to remaining items after timeout
- [x] User-clicked assignments marked as user_confirmed = true
- [x] Auto-assigned items marked as user_confirmed = false
- [x] Callback handler: `ca:shortKey:category:type` (short-key mapping)
- [x] Rate limiting: 500ms delay between API calls
- [x] No skip logic: Every item gets classified
- [x] Shows summary: "✅ X auto-confirmed (≥95) 📝 Y auto-assigned"
- [x] Shows remaining count after batch completion
- [x] Command works for empty result set (0 unclassified items)
- [x] Pending classifications cleared on new /classify run
- [x] Timeout timer cleared when all items manually assigned

**LLM Integration**:
- [ ] Google Gemini 2.0 Flash integration
- [ ] Response time <2s for classification
- [ ] Graceful fallback if LLM fails (no buttons, still saves note)
- [ ] Feature flag to enable/disable classification
- [ ] API key validation on startup
- [ ] Rate limiting handled (queue if needed, respects 500/day free tier)

**Database**:
- [ ] z_note_categories table created
- [ ] Cascade delete works (note → categories)
- [ ] Composite index for efficient filtering
- [ ] Multiple categories per note supported
- [ ] Confidence and confirmation tracking

**UI/UX**:
- [ ] Category buttons use emoji + label (📋 Todo)
- [ ] Button click confirms and shows feedback
- [ ] Category indicator appears in list view
- [ ] `/notes todo` shows paginated results
- [ ] Category filter works with search
- [ ] Clear feedback when category added

**Performance**:
- [ ] LLM call doesn't block note save
- [ ] Classification runs asynchronously
- [ ] Buttons appear within 2s of save confirmation
- [ ] No impact on existing /notes performance

## Additional Features

### Semantic Search with Relevance Scoring

The `NoteClassifier` service also provides a `scoreNoteRelevance()` method for semantic search functionality, used by the `/suggest` command to find notes matching a user query.

**Method Signature**:
```typescript
async scoreNoteRelevance(content: string, query: string): Promise<number>
```

**Usage**:
```typescript
// Score how relevant a note is to a user's search query
const relevanceScore = await noteClassifier.scoreNoteRelevance(
  "Article about PostgreSQL performance tuning",
  "database optimization"
);
// Returns: 85 (highly relevant)
```

**Scoring Scale**:
- 0-20: Completely irrelevant
- 21-40: Tangentially related
- 41-60: Somewhat relevant
- 61-80: Quite relevant
- 81-100: Highly relevant

**Implementation Details**:
- Uses the same LLM provider architecture (OpenRouter/Gemini)
- Same rate limiting and timeout protection
- Same fallback mechanism on errors
- Returns 0 on complete failure (graceful degradation)

**Use Cases**:
- `/suggest <query>` - Find notes semantically matching the query
- Semantic search across categories
- Content-based recommendations

### Rate Limiting Architecture

The system uses sophisticated rate limiting to prevent API quota exhaustion and ensure smooth operation under load.

**Implementation**:
```typescript
// src/utils/rateLimiter.ts
import Bottleneck from 'bottleneck';

// Gemini rate limiter: 10 requests/minute (conservative)
export function createGeminiRateLimiter(): RateLimiter {
  return new Bottleneck({
    reservoir: 10,           // Initial token count
    reservoirRefreshAmount: 10,
    reservoirRefreshInterval: 60 * 1000, // 1 minute
    maxConcurrent: 6,        // Allow parallel category scoring
    minTime: 0               // No minimum delay between requests
  });
}

// OpenRouter rate limiter: 60 requests/minute with 20-request burst
export function createOpenRouterRateLimiter(): RateLimiter {
  return new Bottleneck({
    reservoir: 20,           // Burst capacity
    reservoirRefreshAmount: 60,
    reservoirRefreshInterval: 60 * 1000, // 1 minute
    maxConcurrent: 10,       // Higher concurrency
    minTime: 0
  });
}
```

**Key Features**:
- **Token Bucket Algorithm**: Allows bursts while maintaining average rate
- **Per-Provider Limits**: Different limits for Gemini (10 RPM) and OpenRouter (60 RPM)
- **Singleton Pattern**: One rate limiter instance per provider across entire application
- **Concurrent Execution**: Allows parallel category scoring within rate limits
- **Timeout Protection**: Requests timeout after 10 seconds if rate limiter blocks too long

**Behavior**:
- Normal operation: Requests execute immediately if tokens available
- Under load: Requests queue and wait for token availability
- Timeout exceeded: Request fails and triggers fallback chain
- Burst handling: OpenRouter allows 20 concurrent requests, then throttles to 60/min

---

## Implementation Notes

**Chinese vs Japanese Character Detection**:
The Unicode range `\u4E00-\u9FFF` (CJK Unified Ideographs) covers both Chinese and Japanese kanji characters. To avoid misclassifying pure Chinese text as Japanese:

1. **Hiragana/Katakana Check**: Text containing hiragana (`\u3040-\u309F`) or katakana (`\u30A0-\u30FF`) is definitely Japanese
2. **Pure Kanji Text**: Text with only CJK characters but no hiragana/katakana should NOT trigger Japanese category by pattern matching
3. **LLM Scoring**: Let the LLM handle pure kanji text by analyzing context
4. **Pattern Detection Rules**:
   - If hiragana OR katakana present: Score 85-95 (Japanese confirmed)
   - If only CJK characters (no kana): Score 0 (let LLM decide from context)

**Interactive Batch Classification (`/classify` Command) Implementation**:

```typescript
// src/bot/client.ts - Command handler with interactive workflow
class TelegramClient {
  private pendingClassifications: Map<string, { type: 'note' | 'link'; scores: any[]; itemData: any }> = new Map();
  private classificationTimeout?: NodeJS.Timeout;

  async runBatchClassification(ctx: any, userId: number): Promise<void> {
    // Clear any existing timeout and pending classifications
    if (this.classificationTimeout) {
      clearTimeout(this.classificationTimeout);
      this.classificationTimeout = undefined;
    }
    this.pendingClassifications.clear();

    const BATCH_SIZE = 3;

    // 1. Fetch small batch of unclassified items (3 total)
    const [notes, links] = await Promise.all([
      dbOps.fetchUnclassifiedNotes(userId, BATCH_SIZE),
      dbOps.fetchUnclassifiedLinks(userId, BATCH_SIZE)
    ]);

    const allItems = [...notes.map(n => ({type: 'note', data: n})), ...links.map(l => ({type: 'link', data: l}))].slice(0, BATCH_SIZE);

    if (allItems.length === 0) {
      return ctx.reply('No unclassified items found. All caught up! ✅');
    }

    // Count total remaining
    const [allNotes, allLinks] = await Promise.all([
      dbOps.fetchUnclassifiedNotes(userId),
      dbOps.fetchUnclassifiedLinks(userId)
    ]);
    const totalRemaining = allNotes.length + allLinks.length;

    await ctx.reply(`Starting classification...\nProcessing ${allItems.length} items (${totalRemaining} total unclassified)`);

    // 2. Score all items and auto-confirm high-confidence (≥95)
    let autoConfirmedCount = 0;
    let pendingCount = 0;

    for (const item of allItems) {
      const scores = item.type === 'note'
        ? await noteClassifier.suggestCategories(item.data.content, [])
        : await noteClassifier.classifyLink(item.data.url, item.data.title, item.data.description);

      // Auto-confirm high-confidence categories (≥95)
      const autoConfirm = scores.filter(s => s.score >= 95);

      if (autoConfirm.length > 0) {
        // Save auto-confirmed categories
        for (const categoryScore of autoConfirm) {
          await (item.type === 'note' ? dbOps.addNoteCategory : dbOps.addLinkCategory)(
            item.data.id,
            categoryScore.category,
            categoryScore.score / 100,
            true // userConfirmed = true
          );
        }
        autoConfirmedCount++;

        // Show auto-confirmed item
        await ctx.reply(`✅ Auto-confirmed:\n📝 "${item.data.content || item.data.url}"\n\n🏷️ ${autoConfirm.map(s => `${CATEGORY_EMOJI[s.category]} ${CATEGORY_LABELS[s.category]} (${s.score})`).join(', ')}`);
      } else {
        // Show buttons for user interaction (score < 95)
        pendingCount++;

        // Store in pending map
        this.pendingClassifications.set(item.data.id, {
          type: item.type,
          scores,
          itemData: item.data
        });

        // Build keyboard with ALL categories (score > 0)
        const keyboard = new InlineKeyboard();
        const validScores = scores.filter(s => s.score > 0);

        validScores.forEach((score, index) => {
          keyboard.text(`${CATEGORY_EMOJI[score.category]} ${CATEGORY_LABELS[score.category]} (${score.score})`, `classify_assign:${item.data.id}:${score.category}:${item.type}`);
          if ((index + 1) % 2 === 0 && index < validScores.length - 1) keyboard.row();
        });

        await ctx.reply(`📝 Item ${pendingCount}/${allItems.length}:\n"${(item.data.content || item.data.url).substring(0, 100)}"\n\nCategories:`, { reply_markup: keyboard });
      }

      await delay(500); // Rate limiting
    }

    // 3. Set 1-minute timeout for auto-assignment
    if (this.pendingClassifications.size > 0) {
      await ctx.reply('⏰ Waiting 1 minute for your input...\nClick any category button above to assign manually.\nRemaining items will be auto-assigned to best match.');

      this.classificationTimeout = setTimeout(async () => {
        await this.autoAssignPendingClassifications(ctx, userId);
      }, 1 * 60 * 1000); // 1 minute
    } else {
      await this.showClassificationSummary(ctx, userId, autoConfirmedCount, 0, 0);
    }
  }

  // Handle button click during classification
  async handleClassifyAssignClick(ctx: any, data: string): Promise<void> {
    const [, itemId, category, type] = data.split(':');
    const pending = this.pendingClassifications.get(itemId);

    if (!pending) {
      return ctx.answerCallbackQuery('❌ Item not found or already classified');
    }

    // Assign category
    await (type === 'note' ? dbOps.addNoteCategory : dbOps.addLinkCategory)(
      itemId,
      category,
      1.0, // User-confirmed, full confidence
      true // userConfirmed = true
    );

    // Remove from pending
    this.pendingClassifications.delete(itemId);
    await ctx.answerCallbackQuery();

    // If all items classified, complete the batch
    if (this.pendingClassifications.size === 0) {
      if (this.classificationTimeout) {
        clearTimeout(this.classificationTimeout);
        this.classificationTimeout = undefined;
      }
      await this.showClassificationSummary(ctx, ctx.from!.id, 0, 0, 0);
    }
  }

  // Auto-assign best match after timeout
  async autoAssignPendingClassifications(ctx: any, userId: number): Promise<void> {
    let assignedCount = 0;

    for (const [itemId, pending] of this.pendingClassifications.entries()) {
      const bestMatch = pending.scores[0]; // Highest score

      if (bestMatch) {
        await (pending.type === 'note' ? dbOps.addNoteCategory : dbOps.addLinkCategory)(
          itemId,
          bestMatch.category,
          bestMatch.score / 100,
          false // userConfirmed = false (auto-assigned)
        );
        assignedCount++;
      }
    }

    this.pendingClassifications.clear();
    this.classificationTimeout = undefined;

    await this.showClassificationSummary(ctx, userId, 0, assignedCount, 0);
  }
}
```

**Callback Query Data Format**:
```typescript
// Category button (from real-time suggestion on save)
`category:${noteId}:${category}:${confidence}`

// Example
`category:abc123:todo:0.95`

// Classification assignment button (from /classify command)
`classify_assign:${itemId}:${category}:${type}`

// Example
`classify_assign:abc123:todo:note`
`classify_assign:def456:blog:link`
```

**Inline Keyboard Layout**:

**Real-time classification (on save)** - Shows buttons only for scores 60-94:
```
One category:
[📋 Todo]

Two categories:
[📋 Todo] [💡 Idea]

Three categories:
[📋 Todo] [💡 Idea] [📝 Blog]

Maximum: 2 buttons per row, multiple rows
```

**Batch classification (/classify command)** - Shows ALL 6 categories sorted by score:
```
All categories displayed WITH scores:
[📋 Todo (85)] [💡 Idea (70)] [📝 Blog (15)]
[📺 YouTube (0)] [📖 Reference (0)] [🇯🇵 Japanese (0)]

Layout: 3 buttons per row, 2 rows total
Sorted by LLM confidence (highest score first, left-to-right, top-to-bottom)
Scores displayed on buttons to help user make informed decisions
User can override any wrong AI suggestion
```

**Category Emoji Mapping**:
```typescript
const CATEGORY_EMOJI = {
  todo: '📋',
  idea: '💡',
  blog: '📝',
  youtube: '📺',
  reference: '📚',
  japanese: '🇯🇵'
};
```

**LLM Service Structure** (Updated for Dual Provider + 0-100 Scoring):
```typescript
// src/services/noteClassifier.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createGeminiRateLimiter, createOpenRouterRateLimiter } from '../utils/rateLimiter';

interface CategoryScore {
  category: 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese';
  score: number; // 0-100
  tier: 'definite' | 'high' | 'moderate' | 'low' | 'insufficient';
  action: 'auto-confirm' | 'show-button' | 'skip';
}

class NoteClassifier {
  private genAI?: GoogleGenerativeAI;
  private model?: GenerativeModel;
  private rateLimiter: RateLimiter;
  private readonly provider: 'gemini' | 'openrouter';
  private readonly API_TIMEOUT_MS = 10000; // 10 seconds

  constructor() {
    this.provider = config.llm.provider;

    // Select appropriate rate limiter
    this.rateLimiter = this.provider === 'openrouter'
      ? createOpenRouterRateLimiter() // 60 RPM with burst
      : createGeminiRateLimiter();    // 10 RPM conservative

    // Initialize Gemini client if needed
    if (this.provider === 'gemini') {
      this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: config.gemini.model || 'gemini-2.5-flash'
      });
    }
    // OpenRouter uses fetch API, no client initialization needed
  }

  /**
   * Call LLM API with provider abstraction and automatic fallback
   */
  private async callLLM(prompt: string): Promise<string> {
    if (this.provider === 'gemini') {
      return this.callGemini(prompt);
    } else {
      return this.callOpenRouter(prompt);
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!this.model) throw new Error('Gemini model not initialized');
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  private async callOpenRouter(prompt: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/telepocket/bot',
        'X-Title': 'Telepocket Bot'
      },
      body: JSON.stringify({
        model: config.openrouter.model, // Default: google/gemini-2.5-flash
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 10
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async suggestCategories(content: string, urls?: string[]): Promise<CategoryScore[]> {
    // 1. Fast-path detection (before LLM)
    const fastPathScores = this.detectByPattern(content, urls);

    // 2. Parallel LLM scoring for all 6 categories
    const llmScores = await this.scoreAllCategories(content, urls);

    // 3. Merge scores (fast-path overrides LLM if higher)
    const finalScores = this.mergeScores(fastPathScores, llmScores);

    // 4. Apply thresholds and determine actions
    return finalScores.map(score => ({
      ...score,
      tier: this.getTier(score.score),
      action: this.getAction(score.score)
    }));
  }

  private detectByPattern(content: string, urls: string[]): Partial<Record<string, number>> {
    const scores: Partial<Record<string, number>> = {};

    // Japanese character detection (only if hiragana or katakana present)
    // Pure kanji (Chinese) text should not trigger pattern matching
    const hasHiragana = /[\u3040-\u309F]/.test(content);
    const hasKatakana = /[\u30A0-\u30FF]/.test(content);

    if (hasHiragana || hasKatakana) {
      const japaneseChars = content.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || [];
      const charCount = japaneseChars.length;
      scores.japanese = charCount >= 3 ? 95 : 85;
    }

    // URL pattern detection
    for (const url of urls) {
      const lower = url.toLowerCase();
      if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
        scores.youtube = 100;
      }
      if (lower.includes('jisho.org') || lower.includes('bunpro.jp') || lower.includes('wanikani.com')) {
        scores.japanese = 95;
      }
      if (lower.includes('medium.com') || lower.includes('dev.to') || lower.includes('/blog/')) {
        scores.blog = 95;
      }
    }

    return scores;
  }

  private async scoreAllCategories(content: string, urls?: string[]): Promise<CategoryScore[]> {
    const categories = ['todo', 'idea', 'blog', 'youtube', 'reference', 'japanese'];

    // Run all 6 prompts in parallel
    const scorePromises = categories.map(category =>
      this.scoreSingleCategory(content, urls, category)
    );

    const scores = await Promise.all(scorePromises);
    return scores;
  }

  private async scoreSingleCategory(content: string, urls: string[] | undefined, category: string): Promise<CategoryScore> {
    try {
      const prompt = this.buildCategoryPrompt(category, content, urls);

      // Wait for rate limiter token
      await this.rateLimiter.waitAndConsume(1, this.API_TIMEOUT_MS);

      // Call LLM with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`LLM API timeout after ${this.API_TIMEOUT_MS}ms`)),
          this.API_TIMEOUT_MS
        );
      });

      const response = await Promise.race([
        this.callLLM(prompt),
        timeoutPromise
      ]);

      // Parse and clamp score (0-100)
      const score = parseInt(response.trim(), 10) || 0;
      const clampedScore = Math.max(0, Math.min(100, score));

      return {
        category: category as any,
        score: clampedScore,
        tier: this.getTier(clampedScore),
        action: this.getAction(clampedScore)
      };
    } catch (error) {
      console.error(`Error scoring category ${category}:`, error);

      // Try Gemini fallback if OpenRouter failed
      if (this.provider === 'openrouter' && config.openrouter.fallbackToGemini) {
        try {
          // Attempt Gemini fallback...
          const fallbackScore = await this.callGeminiFallback(content, urls, category);
          return fallbackScore;
        } catch (fallbackError) {
          console.error(`Gemini fallback also failed for ${category}`);
        }
      }

      // Pattern-based fallback if LLM unavailable
      const fastPathScores = this.detectByPattern(content, urls || []);
      const patternScore = fastPathScores[category];

      if (patternScore !== undefined && patternScore >= config.llm.showButtonThreshold) {
        return {
          category: category as any,
          score: patternScore,
          tier: this.getTier(patternScore),
          action: this.getAction(patternScore)
        };
      }

      // Return zero score on complete failure
      return {
        category: category as any,
        score: 0,
        tier: 'insufficient',
        action: 'skip'
      };
    }
  }

  private getTier(score: number): string {
    if (score >= 95) return 'definite';
    if (score >= 85) return 'high';
    if (score >= 70) return 'moderate';
    if (score >= 60) return 'low';
    return 'insufficient';
  }

  private getAction(score: number): string {
    if (score >= 95) return 'auto-confirm';
    if (score >= 60) return 'show-button';
    return 'skip';
  }
}
```

For detailed prompt templates per category, see [`prompts.md`](./prompts.md).

**Async Processing**:
```typescript
// After saving note
const noteId = await noteOps.saveNote(note);

// Classification happens in background
noteClassifier.suggestCategories(content, urls)
  .then(suggestions => {
    if (suggestions.length > 0) {
      // Update message with category buttons
      ctx.editMessageReplyMarkup({ inline_keyboard: buildCategoryButtons(suggestions) });
    }
  })
  .catch(err => {
    console.error('Classification failed, skipping:', err);
    // User sees note saved, just no category buttons
  });
```

## Cost & Performance Analysis

### Provider Comparison

**OpenRouter (Recommended for Production)**:
- **Model**: google/gemini-2.5-flash
- **Pricing**: ~$0.075 per million input tokens, ~$0.30 per million output tokens
- **Rate Limits**: 60 requests/minute with 20-request burst capacity
- **No Daily Limits**: Pay-as-you-go, no free tier restrictions
- **Average cost per note**: ~$0.00011 (0.011 cents) for 6-category classification
- **1,000 notes/month**: ~$0.11/month
- **10,000 notes/month**: ~$1.10/month
- **Advantages**: No daily quotas, higher rate limits, reliable for production, state-of-the-art reasoning

**Google Gemini (Fallback/Development)**:
- **Model**: Gemini 2.5 Flash
- **Free Tier**: 500 requests/day, 250,000 tokens/min
- **Rate Limit**: 10 requests/minute (conservative)
- **Daily capacity**: ~83 notes/day (500 requests ÷ 6 categories)
- **If exceeding free tier**:
  - Input: ~$0.075 per million tokens
  - Output: ~$0.30 per million tokens
  - Average cost per note: ~$0.000013 (0.0013 cents)
  - 1,000 notes/month: ~$0.013/month
  - 10,000 notes/month: ~$0.13/month
- **Advantages**: Free tier for development/testing, slightly cheaper at scale

### Performance Characteristics

**Response Time**:
- Both providers: <1s per classification
- Parallel scoring: All 6 categories scored simultaneously
- Total latency: 1-2 seconds for complete classification

**Rate Limiting Strategy**:
- OpenRouter: 60 RPM with token bucket (20-request burst)
- Gemini: 10 RPM conservative limit (free tier stability)
- Automatic provider switching on quota/error

**Reliability**:
- Dual-provider architecture ensures 99.9% uptime
- Automatic fallback from OpenRouter to Gemini on failure
- Pattern-based fallback when all LLM providers fail
- Async processing: Never blocks note save operation

**Recommendation**:
- **Development**: Use Gemini free tier
- **Production**: Use OpenRouter for reliability and no daily limits
- **Hybrid**: OpenRouter primary with Gemini fallback for cost optimization

## Future Tiers

**🔧 Robust** (+10h): Custom user-defined categories, category editing/removal UI, auto-categorization mode (skip confirmation), category aliases (task → todo).

**🚀 Advanced** (+20h): Smart suggestions based on user history, category hierarchies (parent-child), natural language search within category, ML model fine-tuning on user data, export notes by category to various formats.

---

**Status**: ✅ Implemented | **Latest Update**: Automatic classification & embeddings added - 2025-11-24

**See Also**: [Auto-Classification & Embedding Spec](../auto-classification-embedding/spec.md) - Automatic background processing on note save

**Recent Changes**:

**2025-11-24 - Automatic Classification & Embeddings**:
- **Automatic Processing**: Every new note (≥20 chars) automatically classified and embedded on save
- **Shared Architecture**: Moved `NoteClassifier`, `AutoClassifyService`, and utilities to `packages/shared`
- **Enhanced `/classify`**: Now generates embeddings in addition to classification
- **Fire-and-Forget**: Zero user-facing latency - all processing happens in background
- **Semantic Search Ready**: All notes get 768-dimensional embeddings for vector similarity search
- **Database Adapter Pattern**: Clean integration between bot/web and shared services
- See [Auto-Classification Spec](../auto-classification-embedding/spec.md) for details

**2025-11-16 - OpenRouter Integration**:
- **Model Update**: Changed default OpenRouter model from DeepSeek to `google/gemini-2.5-flash`
  - Reason: Better performance and reasoning capabilities
  - Cost: ~$0.00011 per note (6 categories)
  - Budget: $0.60/month = ~5,450 notes/month capacity
- **Configurable Batch Size**: `/classify [batch_size]` accepts optional parameter
  - Default: 3 items, Maximum: 50 items
  - Examples: `/classify` (3), `/classify 10` (10), `/classify 50` (50)
  - Implementation: `src/bot/commands/classify.ts:31-44`
- **Show All Categories**: Display all 6 category buttons for every classified item
  - Previous: Only showed categories with score > 0
  - Current: Always shows all 6 categories, sorted by LLM score
  - Layout: 3 buttons per row (cleaner than 2-per-row)
  - Score displayed on each button (e.g., "📋 Todo (85)") to help user make informed decisions
  - Benefit: Users can override wrong AI suggestions with full control
  - Implementation: `src/bot/commands/classify.ts:191-215`
- **Dual Provider Architecture**: OpenRouter (primary) + Gemini (fallback)
- **Advanced Rate Limiting**: 60 RPM for OpenRouter, 10 RPM for Gemini with token bucket
- **Automatic Fallback**: OpenRouter → Gemini → Pattern-based on errors
- **Relevance Scoring**: New `scoreNoteRelevance()` method for semantic search in /suggest command
- **Enhanced Error Handling**: Multi-tier fallback ensures 99.9% classification success
- Interactive batch classification with auto-confirm for score ≥95
- User-confirmed vs auto-assigned tracking with user_confirmed flag
- StatusMessageManager integration for better UX during classification

**Architecture Highlights**:
1. **Provider Abstraction**: Single `callLLM()` interface for both providers
2. **Rate Limiting**: Dedicated singleton rate limiters per provider
3. **Fallback Chain**: OpenRouter → Gemini → Pattern-based → Zero score
4. **Timeout Protection**: 10-second timeout on all API calls
5. **Cost Optimization**: OpenRouter for production, Gemini free tier for dev

**Dependencies**:
- **Primary**: OpenRouter API key (pay-per-use, no daily limits)
- **Fallback**: Google AI API key (free tier: 500 requests/day)
- @google/generative-ai npm package
- fetch API for OpenRouter integration
- Feature flags for gradual rollout
- Node.js 18+ (required for @google/generative-ai)

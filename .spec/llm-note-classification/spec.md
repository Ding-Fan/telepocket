# LLM Note Classification Specification

## Problem & Solution

**Problem**: Notes and links accumulate without organization. Users must manually categorize hundreds of items, leading to poor searchability and lost productivity. No way to quickly identify todos, ideas, blog references, or video content.

**Solution**: LLM analyzes message content on save → Detects likely categories (todo, idea, blog, youtube) → Bot response includes inline category buttons → User clicks to confirm → Note tagged with category → Filterable by category later.

**Returns**: Intelligent category suggestions as inline buttons, instant categorization with one click, searchable by category (e.g., `/notes todo`, `/notes idea`).

## Component API

```typescript
// LLM Service
interface CategorySuggestion {
  category: 'todo' | 'idea' | 'blog' | 'youtube' | 'reference';
  confidence: number; // 0-1
  reason?: string;
}

class NoteClassifier {
  async suggestCategories(content: string, urls?: string[]): Promise<CategorySuggestion[]>;
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

async function addNoteCategory(noteId: string, category: string, confidence: number): Promise<void>;
async function getNotesByCategory(userId: number, category: string, page: number): Promise<PaginatedResult>;
```

## Core Flow

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

**NOT Included** (Future):
- Custom user-defined categories → 🔧 Robust
- Bulk re-classification → 🔧 Robust
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

## LLM Integration

**Provider**: Google Gemini (Free Tier)

**Model**: Gemini 2.0 Flash (recommended) or Gemini 2.5 Flash
- Fast, efficient, perfect for classification tasks
- Free tier: 500 requests/day, 250,000 tokens/min
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
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
GEMINI_MODEL=gemini-2.0-flash  # or gemini-2.5-flash
LLM_CLASSIFICATION_ENABLED=true  # Feature flag
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

## Implementation Notes

**Chinese vs Japanese Character Detection**:
The Unicode range `\u4E00-\u9FFF` (CJK Unified Ideographs) covers both Chinese and Japanese kanji characters. To avoid misclassifying pure Chinese text as Japanese:

1. **Hiragana/Katakana Check**: Text containing hiragana (`\u3040-\u309F`) or katakana (`\u30A0-\u30FF`) is definitely Japanese
2. **Pure Kanji Text**: Text with only CJK characters but no hiragana/katakana should NOT trigger Japanese category by pattern matching
3. **LLM Scoring**: Let the LLM handle pure kanji text by analyzing context
4. **Pattern Detection Rules**:
   - If hiragana OR katakana present: Score 85-95 (Japanese confirmed)
   - If only CJK characters (no kana): Score 0 (let LLM decide from context)

**Callback Query Data Format**:
```typescript
// Category button (from suggestion)
`category:${noteId}:${category}:${confidence}`

// Example
`category:abc123:todo:0.95`
```

**Inline Keyboard Layout** (Variable):
```
One category:
[📋 Todo]

Two categories:
[📋 Todo] [💡 Idea]

Three categories:
[📋 Todo] [💡 Idea] [📝 Blog]

Maximum: 3 buttons per row, 2 rows max
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

**LLM Service Structure** (Updated for 0-100 Scoring):
```typescript
// src/services/noteClassifier.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

interface CategoryScore {
  category: 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese';
  score: number; // 0-100
  tier: 'definite' | 'high' | 'moderate' | 'low' | 'insufficient';
  action: 'auto-confirm' | 'show-button' | 'skip';
}

class NoteClassifier {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.gemini.model || 'gemini-2.0-flash'
    });
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
    const prompt = this.buildCategoryPrompt(category, content, urls);
    const result = await this.model.generateContent(prompt);
    const response = result.response.text();

    // Parse integer score (0-100)
    const score = parseInt(response.trim(), 10) || 0;

    return {
      category: category as any,
      score,
      tier: this.getTier(score),
      action: this.getAction(score)
    };
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

**Google Gemini Free Tier** (2025):
- **Free limits**: 500 requests/day, 250,000 tokens/min
- **Cost**: $0 for personal use under free tier limits
- **Daily capacity**: ~500 notes/day (more than enough for personal bot)

**If exceeding free tier** (Gemini 2.0 Flash paid):
- Input: ~$0.075 per million tokens
- Output: ~$0.30 per million tokens
- Average note: ~100 tokens input, ~20 tokens output
- Cost per classification: ~$0.000013 (0.0013 cents)
- 1,000 notes/month: ~$0.013/month
- 10,000 notes/month: ~$0.13/month

**Performance**:
- LLM response time: <1s (Gemini 2.0 Flash is fast)
- Async processing: Doesn't block note save
- Fallback: Graceful if LLM unavailable or quota exceeded
- Free tier is sufficient for personal bot usage

## Future Tiers

**🔧 Robust** (+12h): Custom user-defined categories, category editing/removal UI, bulk re-classification, auto-categorization mode (skip confirmation), category aliases (task → todo).

**🚀 Advanced** (+20h): Smart suggestions based on user history, category hierarchies (parent-child), natural language search within category, ML model fine-tuning on user data, export notes by category to various formats.

---

**Status**: 📝 Draft | **Estimated Effort**: ~16 hours (MVP)

**Dependencies**:
- Google AI API key (free tier: 500 requests/day, 250k tokens/min)
- @google/generative-ai npm package
- Feature flag for gradual rollout
- Node.js 18+ (required for @google/generative-ai)

# Automatic Note Classification & Embedding Specification

## Problem & Solution

**Problem**: Users must manually run `/classify` to categorize notes and embeddings are never generated, limiting semantic search capabilities. Old notes lack embeddings for vector similarity search. Classification is a manual, two-step process.

**Solution**: Auto-classify and embed every new note on save → LLM scores all categories in background → Auto-confirms categories with score ≥95 → Generates 768-dimensional embedding for semantic search → All operations fire-and-forget (zero user-facing delay) → User gets instant "✅ Saved" feedback while AI processes in background.

**Returns**: Fully classified notes with embeddings for semantic search, zero latency impact on save operation, backfill capability via `/classify` command.

## Component API

```typescript
// Auto-Classification Service (Shared Package)
interface AutoClassifyConfig {
  classifier: NoteClassifierConfig;
  embeddingApiKey: string;
  minContentLength?: number; // Default: 20 characters
}

interface AutoClassifyNoteData {
  noteId: string;
  content: string;
  urls: string[];
}

interface AutoClassifyResult {
  noteId: string;
  autoConfirmedCategories: Array<{ category: NoteCategory; score: number }>;
  suggestedCategories: Array<{ category: NoteCategory; score: number }>;
  embedding: number[] | null;
  error?: string;
}

interface DatabaseAdapter {
  addNoteCategory(
    noteId: string,
    category: NoteCategory,
    confidence: number,
    userConfirmed: boolean
  ): Promise<boolean>;
  updateNoteEmbedding(noteId: string, embedding: number[]): Promise<boolean>;
}

class AutoClassifyService {
  constructor(config: AutoClassifyConfig);
  async processNote(note: AutoClassifyNoteData, db: DatabaseAdapter): Promise<AutoClassifyResult>;
}

// Embedding Service (Shared Package)
interface NoteData {
  content: string;
  links?: { title?: string; url: string }[];
}

class EmbeddingService {
  constructor(apiKey: string);
  async generateEmbedding(text: string): Promise<number[]>; // 768 dimensions
  prepareNoteText(note: NoteData): string; // Combines content + link titles
}
```

## Core Flow

### Automatic Classification on Note Save

```
User sends: "Need to fix the login bug tomorrow"
  ↓
Bot processes → Saves note to z_notes table
  ↓
Bot replies immediately: "✅ Saved 0 links"
User sees instant feedback (no delay)
  ↓
[Background Processing Starts - Fire & Forget]
  ↓
AutoClassifyService.processNote() called with note data
  ↓
Parallel execution:
  1. NoteClassifier scores all 6 categories
  2. EmbeddingService generates 768-dim vector
  ↓
Classification results:
  - Score ≥95: Auto-confirm (user_confirmed=true)
  - Score 60-94: Store as suggestion (user_confirmed=false)
  - Score <60: Skip
  ↓
Database updates:
  - INSERT INTO z_note_categories (categories ≥60)
  - UPDATE z_notes SET embedding = vector
  ↓
[Background Processing Complete]
User can now:
  - Filter by auto-confirmed categories
  - Search semantically via embedding
```

### Batch Classification with Embeddings (`/classify` command)

```
User sends: /classify 10
  ↓
Bot fetches 10 unclassified notes
  ↓
For each note:
  1. LLM scores all 6 categories (parallel)
  2. Generate embedding in background (fire-and-forget)
  ↓
If score ≥95:
  - Auto-confirm category
  - Save embedding
  - Show: "✅ Auto-confirmed: [categories]"
  ↓
If score <95:
  - Show interactive buttons (ALL 6 categories)
  - User clicks category → Save embedding
  - OR timeout (1 min) → Auto-assign + save embedding
  ↓
Summary: "✅ 3 auto-confirmed, 📝 7 auto-assigned, 📊 1000 remaining"
```

## User Stories

**US-1: Automatic Classification on Save**
User sends "Read this blog post later: https://example.com/post". Bot saves note instantly. Behind the scenes, LLM detects "blog" with 98% confidence, auto-confirms category. User can immediately filter with `/notes blog` without manual classification.

**US-2: Semantic Search Enabled**
User sends "PostgreSQL performance optimization tips". Bot saves note and generates embedding. Later, user searches "database tuning" using semantic search. Embedding similarity finds the PostgreSQL note even though keywords don't match exactly.

**US-3: Skip Trivial Content**
User sends "ok". Bot saves note but skips classification/embedding (< 20 characters). No wasted API calls on meaningless messages.

**US-4: Batch Backfill Old Notes**
User has 1,000 old notes without categories or embeddings. User runs `/classify 50`. Bot processes 50 notes: classifies + generates embeddings for all. User repeats until all notes have embeddings for semantic search.

**US-5: Multi-Category Auto-Confirmation**
User sends "Tutorial video about React hooks: https://youtube.com/watch?v=xyz". Bot auto-confirms both "YouTube" (100% - URL pattern) and "Reference" (96% - tutorial keyword). Note tagged with both categories automatically.

## MVP Scope

**Included**:
- **Shared Package Architecture**:
  - `AutoClassifyService` in `packages/shared/src/`
  - `NoteClassifier` moved to shared (config-based)
  - `EmbeddingService` already in shared
  - `RateLimiter` utilities in shared
  - Category prompts in shared
  - Database adapter pattern for bot/web integration

- **Automatic Processing**:
  - Triggers on every note save (≥20 characters)
  - Fire-and-forget background execution
  - Zero user-facing delay
  - Silent error handling (logged, not shown)
  - Parallel classification + embedding generation

- **Classification Rules**:
  - Auto-confirm: score ≥95 → `user_confirmed=true`
  - Suggestions: score 60-94 → `user_confirmed=false`
  - Skip: score <60 → Not saved
  - Multiple categories supported (independent scoring)

- **Embedding Generation**:
  - Google Gemini `text-embedding-004` model
  - 768-dimensional vectors
  - Stored in `z_notes.embedding` column (pgvector)
  - IVFFlat index for fast similarity search
  - Rate limiting: 60ms minimum delay between calls
  - Combines note content + link titles

- **Enhanced `/classify` Command**:
  - Now generates embeddings in addition to classification
  - All 3 workflows generate embeddings:
    - Auto-confirmed notes (score ≥95)
    - Manually confirmed notes (user clicks button)
    - Auto-assigned notes (timeout)
  - Background embedding generation (fire-and-forget)
  - Skips notes < 20 characters
  - Only generates embeddings for notes (not links)

- **Database Schema**:
  - `z_notes.embedding` column: `vector(768)`
  - IVFFlat index: `z_notes_embedding_idx`
  - pgvector extension required
  - Supports cosine similarity search

**NOT Included** (Future):
- Real-time classification UI feedback → 🔧 Robust
- Embedding visualization → 🚀 Advanced
- Custom embedding models → 🚀 Advanced
- Batch embedding updates → 🚀 Advanced
- Embedding quality metrics → 🚀 Advanced

## Database Schema

```sql
-- Embedding column (already exists from semantic search feature)
ALTER TABLE z_notes ADD COLUMN IF NOT EXISTS embedding vector(768);

-- IVFFlat index for fast similarity search
CREATE INDEX IF NOT EXISTS z_notes_embedding_idx
  ON z_notes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Semantic search function
CREATE OR REPLACE FUNCTION search_notes_semantic(
  query_embedding vector(768),
  user_id bigint,
  match_threshold float DEFAULT 0.7,
  page_size int DEFAULT 20
) RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  created_at timestamptz
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    z_notes.id,
    z_notes.content,
    1 - (z_notes.embedding <=> query_embedding) as similarity,
    z_notes.created_at
  FROM z_notes
  WHERE z_notes.telegram_user_id = user_id
  AND z_notes.status = 'active'
  AND 1 - (z_notes.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC, z_notes.created_at DESC
  LIMIT page_size;
END;
$$;
```

## Integration Points

### Bot Integration (`apps/bot`)

```typescript
// src/services/autoClassifyAdapter.ts
import { AutoClassifyService, AutoClassifyConfig, DatabaseAdapter } from '@telepocket/shared';

class BotDatabaseAdapter implements DatabaseAdapter {
  async addNoteCategory(...): Promise<boolean> {
    return dbOps.addNoteCategory(...);
  }

  async updateNoteEmbedding(noteId: string, embedding: number[]): Promise<boolean> {
    const { error } = await db.getClient()
      .from('z_notes')
      .update({ embedding: `[${embedding.join(',')}]` })
      .eq('id', noteId);
    return !error;
  }
}

export function createAutoClassifyService(): AutoClassifyService {
  return new AutoClassifyService({
    classifier: {
      provider: config.llm.provider,
      classificationEnabled: config.llm.classificationEnabled,
      autoConfirmThreshold: config.llm.autoConfirmThreshold,
      showButtonThreshold: config.llm.showButtonThreshold,
      // ... other config
    },
    embeddingApiKey: config.gemini.apiKey,
    minContentLength: 20
  });
}

export async function processNoteInBackground(
  noteId: string,
  content: string,
  urls: string[]
): Promise<void> {
  const service = createAutoClassifyService();
  const adapter = getDatabaseAdapter();

  service.processNote({ noteId, content, urls }, adapter)
    .catch(err => console.error('Auto-classification failed:', err));
}

// src/bot/handlers.ts
import { processNoteInBackground } from '../services/autoClassifyAdapter';

// After saving note
if (newResult.success && newResult.noteId) {
  processNoteInBackground(newResult.noteId, messageText, urls).catch(err => {
    console.error('Auto-classification failed:', err);
  });
}
```

### Enhanced `/classify` Command

```typescript
// src/bot/commands/classify.ts
import { EmbeddingService } from '@telepocket/shared';

const embeddingService = new EmbeddingService(config.gemini.apiKey);

async function generateEmbeddingInBackground(noteId: string, content: string): Promise<void> {
  try {
    if (content.trim().length < 20) return;

    const noteData = { content, links: [] };
    const text = embeddingService.prepareNoteText(noteData);
    const embedding = await embeddingService.generateEmbedding(text);

    await db.getClient()
      .from('z_notes')
      .update({ embedding: `[${embedding.join(',')}]` })
      .eq('id', noteId);

    console.log(`[Classify] Generated embedding for note ${noteId}`);
  } catch (error) {
    console.error(`Error generating embedding for note ${noteId}:`, error);
  }
}

// Call after auto-confirmation
if (wasAutoConfirmed && item.type === 'note') {
  generateEmbeddingInBackground(item.data.id, item.data.content);
}

// Call after manual confirmation
if (type === 'note' && pending.itemData?.content) {
  generateEmbeddingInBackground(itemId, pending.itemData.content);
}

// Call after auto-assignment
if (success && pending.type === 'note' && pending.itemData?.content) {
  generateEmbeddingInBackground(itemId, pending.itemData.content);
}
```

## Performance & Cost Analysis

### Classification Performance
- **Response Time**: <1s for LLM classification (parallel execution)
- **Embedding Generation**: ~200ms per note
- **Total Background Time**: ~1.2s per note
- **User-Facing Latency**: 0ms (fire-and-forget)
- **Rate Limiting**: Respects both LLM and embedding API limits

### Embedding Costs
- **Model**: Google Gemini `text-embedding-004`
- **Free Tier**: 1,500 requests/day (15,000 embeddings with batching)
- **Paid Tier**: $0.00025 per 1,000 embeddings
- **Average Usage**:
  - 100 notes/day → Free
  - 1,000 notes/day → Free
  - 10,000 notes/day → $2.50/month
- **Storage**: 768 floats × 4 bytes = 3KB per embedding

### Total Cost per Note
- **Classification**: ~$0.00011 (OpenRouter)
- **Embedding**: ~$0.00000025 (Gemini, if over free tier)
- **Total**: ~$0.00011 per note
- **1,000 notes/month**: ~$0.11/month
- **10,000 notes/month**: ~$1.10/month

## Acceptance Criteria (MVP)

**Functional**:
- [x] Auto-classification triggers on every note save (≥20 chars)
- [x] Embedding generated for every note save (≥20 chars)
- [x] Fire-and-forget execution (zero user delay)
- [x] Silent error handling (logged, not shown to user)
- [x] Auto-confirm categories with score ≥95
- [x] Store suggestions with score 60-94
- [x] Skip categories with score <60
- [x] `/classify` command generates embeddings
- [x] Embeddings generated for auto-confirmed notes
- [x] Embeddings generated for manually confirmed notes
- [x] Embeddings generated for auto-assigned notes

**Shared Architecture**:
- [x] `AutoClassifyService` in `packages/shared`
- [x] `NoteClassifier` moved to `packages/shared`
- [x] `EmbeddingService` already in `packages/shared`
- [x] Rate limiting utilities in shared
- [x] Category prompts in shared
- [x] Database adapter pattern implemented
- [x] Exports from `packages/shared/src/index.ts`

**Database**:
- [x] `z_notes.embedding` column exists
- [x] IVFFlat index created for vector similarity
- [x] Semantic search function available
- [x] pgvector extension enabled

**Performance**:
- [x] No user-facing latency on note save
- [x] Background processing completes in <2s
- [x] Rate limiting respected for all APIs
- [x] Graceful degradation on API failures
- [x] No impact on existing save performance

**Integration**:
- [x] Bot calls `processNoteInBackground()` after save
- [x] `/classify` command enhanced with embeddings
- [x] Web app can use same shared services (future)
- [x] Database adapter bridges bot and shared code

## Architecture Highlights

**1. Shared Package Design**:
- All business logic in `@telepocket/shared`
- Bot and web apps use same services
- Database adapter pattern for flexibility
- Configuration-based initialization

**2. Fire-and-Forget Pattern**:
- No await on background processing
- User sees instant feedback
- Errors logged silently
- Classification/embedding happen async

**3. Multi-Tier Error Handling**:
- LLM fallback chain (OpenRouter → Gemini → Pattern)
- Embedding failure doesn't block classification
- Classification failure doesn't block save
- All failures logged for debugging

**4. Rate Limiting**:
- Token bucket algorithm for LLM (40 RPM Gemini, 50 RPM OpenRouter)
- Embedding service rate limiting (60ms delay)
- Prevents quota exhaustion
- Graceful degradation under load

**5. Database Optimization**:
- IVFFlat index for fast vector search
- pgvector for efficient storage
- Cosine similarity for semantic matching
- Configurable similarity thresholds

## Future Enhancements

**🔧 Robust** (+8h):
- Real-time classification feedback in bot UI
- Batch embedding regeneration command
- Embedding quality metrics and validation
- Manual embedding refresh per note

**🚀 Advanced** (+20h):
- Custom embedding models (OpenAI, Cohere)
- Multi-vector embeddings (content + metadata)
- Embedding visualization and clustering
- A/B testing different embedding models
- Embedding cache and deduplication
- Hybrid search (vector + BM25)

---

**Status**: ✅ Implemented | **Latest Update**: Auto-classification & embeddings - 2025-11-24

**Implementation Summary**:
- **Automatic Processing**: Every new note (≥20 chars) gets classified and embedded automatically
- **Shared Architecture**: All services moved to `packages/shared` for reusability
- **Enhanced `/classify`**: Now generates embeddings in addition to classification
- **Zero Latency**: Fire-and-forget pattern ensures instant user feedback
- **Semantic Search Ready**: All new notes have embeddings for vector similarity search
- **Backfill Support**: `/classify` command can add embeddings to old notes

**Key Files**:
- `packages/shared/src/autoClassifyService.ts` - Main orchestration service
- `packages/shared/src/noteClassifier.ts` - LLM classification (moved from bot)
- `packages/shared/src/embeddingService.ts` - Embedding generation
- `packages/shared/src/utils/rateLimiter.ts` - Rate limiting utilities
- `apps/bot/src/services/autoClassifyAdapter.ts` - Bot-specific adapter
- `apps/bot/src/bot/handlers.ts` - Auto-classification trigger
- `apps/bot/src/bot/commands/classify.ts` - Enhanced `/classify` command

**Dependencies**:
- `@google/generative-ai` - Gemini embeddings and classification
- `pgvector` PostgreSQL extension
- OpenRouter API (optional, for classification)
- Google AI API key (required for embeddings)

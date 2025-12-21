---
feature: "embedding-service"
status: "robust-complete"
created: "2025-12-12"
updated: "2025-12-12"
mvp_effort_hours: 24
mvp_effort_days: 3
robust_effort_hours: 4
robust_effort_days: 0.5
priority: "critical"
tags: ["embedding", "ai", "semantic-search", "shared-service", "batch-processing"]
scope: "package-specific"
package: "packages/shared"
current_tier: "robust"
---

# Embedding Service Specification

## TL;DR (30-Second Scan)

**Problem**: Notes need vector embeddings for semantic search and AI-powered classification
**Solution**: Shared service converting note text + link metadata into 768-dim vectors via Google Gemini API
**Status**: Robust Complete - **All bugs fixed, batch methods added**
**Effort**: MVP 3 days (docs) | +Robust 0.5 days | +Advanced 3 days
**Next Action**: Monitor production performance, consider Advanced tier enhancements

---

<details>
<summary>📋 Full Specification (click to expand)</summary>

## Problem & Solution

**Problem**: Notes containing rich metadata (YouTube descriptions, article summaries) need semantic understanding for natural language search and automatic classification. Manual keyword matching misses contextual meaning.

**Solution**: Reusable embedding service in shared package that converts note content + link metadata into 768-dimensional vectors using Google Gemini text-embedding-004. Handles rate limiting, error recovery, and batch processing.

**Returns**: `number[]` array (768 dimensions) suitable for pgvector storage and cosine similarity search.

## Component API

```typescript
// Core Interfaces
interface NoteData {
  content: string;
  links?: {
    title?: string;
    description?: string;  // ✅ Properly embedded (fixed)
    url: string;
  }[];
}

interface NoteWithId extends NoteData {
  id: number;
}

interface BatchEmbeddingResult {
  id: number;
  embedding?: number[];
  error?: string;
}

// Service Class
class EmbeddingService {
  constructor(apiKey: string);

  // Single embedding generation
  generateEmbedding(text: string): Promise<number[]>;

  // Batch processing (sequential, text only)
  generateEmbeddings(texts: string[]): Promise<number[][]>;

  // Text preparation (includes link descriptions)
  prepareNoteText(note: NoteData): string;

  // 🆕 Batch generate for note objects (no DB update)
  batchGenerateForNotes(notes: NoteWithId[]): Promise<BatchEmbeddingResult[]>;

  // 🆕 Batch generate + update database
  batchUpdateNoteEmbeddings(
    supabase: SupabaseClient,
    notes: NoteWithId[]
  ): Promise<{ successful: number; failed: number; results: BatchEmbeddingResult[] }>;
}
```

## Usage Example

```typescript
import { EmbeddingService } from '@telepocket/shared';

// Initialize service
const service = new EmbeddingService(process.env.GOOGLE_AI_API_KEY);

// ===== Single Note Embedding =====
const text = service.prepareNoteText({
  content: "Check out this video",
  links: [{
    title: "Tutorial Video",
    description: "Learn React hooks in 10 minutes",  // ✅ Properly included!
    url: "https://youtube.com/..."
  }]
});

const embedding = await service.generateEmbedding(text);
// Returns: [0.024, -0.013, 0.045, ...] (768 numbers)

await supabase
  .from('z_notes')
  .update({ embedding })
  .eq('id', noteId);

// ===== Batch Note Embedding (New!) =====
const notes = [
  { id: 1, content: "Note 1", links: [...] },
  { id: 2, content: "Note 2", links: [...] }
];

// Option 1: Generate only (no DB update)
const results = await service.batchGenerateForNotes(notes);
// Returns: [{ id: 1, embedding: [...] }, { id: 2, error: "..." }]

// Option 2: Generate + Update DB automatically
const { successful, failed, results } = await service.batchUpdateNoteEmbeddings(
  supabase,
  notes
);
// Returns: { successful: 1, failed: 1, results: [...] }
console.log(`Embedded ${successful} notes, ${failed} errors`);
```

## Core Flow

**Single Note:**
```
Note Created/Updated
  ↓
prepareNoteText() - Combine content + link metadata (title, description, url)
  ↓
generateEmbedding() - Call Gemini API (200-400ms)
  ↓ (enforces 60ms rate limit)
  ↓
Return 768-dim vector
  ↓
Store in z_notes.embedding (pgvector)
  ↓
Available for semantic search via cosine similarity
```

**Batch Notes (New!):**
```
Fetch notes without embeddings
  ↓
batchUpdateNoteEmbeddings() - Process in batches
  ↓ (for each note)
  ├─ prepareNoteText()
  ├─ generateEmbedding() (60ms delay between)
  ├─ Update database
  └─ Track success/error
  ↓
Return statistics { successful, failed, results }
```

## User Stories

**US-1: Bot Auto-Classification**
When bot receives message with link, it fetches metadata (title, description, og_image), saves to database, then calls EmbeddingService.prepareNoteText() to combine note content + link metadata. Service generates embedding and stores in z_notes.embedding column for future classification and search.

**US-2: Semantic Search Query**
When user searches "music tutorials", web app generates query embedding via EmbeddingService.generateEmbedding(). Database performs cosine similarity search against all note embeddings, returning semantically similar results ranked by relevance score (not just keyword matches).

**US-3: Backfill Existing Notes**
When developer runs backfill script, it fetches all notes without embeddings (embedding IS NULL), uses batchUpdateNoteEmbeddings() to process notes in batches of 20, generates embeddings with automatic rate limiting, and updates database. Progress logged per batch with success/error statistics.

**US-4: Batch Error Recovery (New!)**
When backfill encounters API errors for specific notes, batchUpdateNoteEmbeddings() continues processing remaining notes and returns detailed results showing which notes succeeded/failed. Developer can retry failed notes or investigate issues without re-processing successful embeddings.

## MVP Scope

**Included**:
- `EmbeddingService` class in packages/shared
- Google Gemini text-embedding-004 integration (free tier)
- Rate limiting (60ms delay, respects 1,500 req/min)
- Text preparation combining content + link metadata (title, description, url)
- Error handling with console logging
- Basic batch processing (sequential with rate limits)
- Text truncation (2,000 chars = ~500 tokens)
- Backfill script for re-embedding existing notes
- Integration examples (bot, web search)

**NOT Included** (Future):
- Batch API optimization → 🔧 Robust (or use Gemini Batch API)
- Query embedding cache → 🔧 Robust
- Field-specific weighting → 🔧 Robust
- Multi-model support → 🚀 Advanced
- Local embedding models → 🚀 Advanced
- Vector quantization → 🚀 Advanced

## Robust Scope (✅ Complete)

**Added**:
- ✅ Link description embedding (FIXED - was critical bug)
- ✅ Batch note processing methods (`batchGenerateForNotes`, `batchUpdateNoteEmbeddings`)
- ✅ Error resilient batch processing (continues on errors)
- ✅ Detailed batch results (success/failure tracking per note)
- ✅ Database-integrated batch updates
- ✅ Improved backfill script using batch methods

## API Integration

**Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`

**Request**:
```json
{
  "content": {
    "parts": [{
      "text": "Note content\nLinks: Title | Description | URL"
    }]
  }
}
```

**Response**:
```json
{
  "embedding": {
    "values": [0.024, -0.013, 0.045, ...]  // 768 dimensions
  }
}
```

**Rate Limits**:
- 1,500 requests/minute (free tier)
- 20,000 tokens per request
- 2,048 tokens max for embedding (~2,000 chars)
- No cost for text-embedding-004

**Error Handling**:
- API errors logged to console
- Throws error (caller handles graceful degradation)
- Rate limit enforced before each call

## Acceptance Criteria (MVP)

**Functional**:
- [x] EmbeddingService class exports all methods
- [x] generateEmbedding() returns 768-dim number array
- [x] prepareNoteText() combines content + links
- [x] **prepareNoteText() includes link descriptions** ✅ FIXED
- [x] Rate limiting enforces 60ms minimum delay
- [x] Text truncation at 2,000 characters
- [x] Error handling logs to console
- [x] Batch processing works sequentially

**Integration**:
- [x] Used by bot auto-classification service
- [x] Used by web semantic search
- [x] Backfill script processes all notes
- [x] Database stores embeddings in vector(768) column
- [x] No breaking changes to existing integrations

**Performance**:
- [x] Single embedding: 200-400ms (Gemini API latency)
- [x] Rate limit: 60ms delay between calls
- [x] Batch processing: Respects rate limits
- [x] Backfill: ~60 seconds per 1,000 notes
- [x] No API rate limit errors in production

**Error Handling**:
- [x] Invalid API key throws error on init
- [x] API failures logged and thrown
- [x] Empty text returns empty embedding
- [x] Null/undefined links handled gracefully

## Acceptance Criteria (Robust)

**Batch Processing**:
- [x] batchGenerateForNotes() accepts NoteWithId[]
- [x] Returns BatchEmbeddingResult[] with success/error per note
- [x] Continues processing on individual errors
- [x] batchUpdateNoteEmbeddings() accepts Supabase client
- [x] Updates database for successful embeddings
- [x] Returns statistics (successful, failed, results)
- [x] Backfill script uses batch methods
- [x] Processes 20 notes per batch

**Error Resilience**:
- [x] Batch processing continues after API errors
- [x] Detailed error messages per failed note
- [x] Success/failure tracked individually
- [x] Database updates only for successful embeddings
- [x] No data corruption on partial failures

**Testing**:
- [x] Backfill tested with 264 notes (140 processed)
- [x] 100% success rate on production backfill
- [x] No rate limit errors during batch processing
- [x] Proper progress logging and statistics

## Future Tiers

**🔧 Robust** (✅ Complete - 0.5 days):
- ✅ Link description embedding (was critical bug)
- ✅ Batch note processing methods
- ✅ Error resilient batch processing
- ✅ Database-integrated batch updates
- ✅ Improved backfill script

**🔧 Robust Extended** (+1.5 days remaining):
- Query embedding cache (in-memory Map, 60% fewer API calls)
- Field-specific weighting (title > description > url)
- Embedding regeneration command
- Increase max_input to 3,000 chars
- Batch API optimization (Gemini Batch API for 10x faster backfill)

**🚀 Advanced** (+3 days):
- Multi-model support (OpenAI, Cohere, local models)
- Local embedding models (no API latency/cost)
- Vector quantization (smaller storage, faster search)
- Embedding analytics (track generation times, cache hit rates)
- A/B testing different models

</details>

---

**Quick Links**: [dev-log.md](./dev-log.md) | [tasks.md](./tasks.md) | [backlog.md](./backlog.md)

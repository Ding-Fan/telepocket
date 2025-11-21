# Semantic Search Specification

## Problem & Solution

**Problem**: Current fuzzy search only matches keywords and typos. Users can't find notes using natural language like "latest todo", "make me happy", or "help find job". Semantic meaning is lost.

**Solution**: Hybrid search combining semantic (AI-powered meaning understanding) and fuzzy (typo-tolerant keywords). Uses pgvector embeddings to find contextually similar notes, weighted with fuzzy search (trigram + ILIKE) for best results.

**Returns**: Paginated search results ranked by combined relevance score (semantic 70% + fuzzy 30%), with search type indicators.

## Component API

```typescript
// Embedding Service (packages/shared)
interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  prepareNoteText(note: NoteData): string;
}

// Database Types
interface NoteWithEmbedding extends Note {
  embedding?: number[]; // 768-dimension vector
}

interface HybridSearchResult {
  note_id: string;
  note_content: string;
  category: NoteCategory;
  relevance_score: number; // 0-1 combined score
  search_type: 'semantic' | 'fuzzy' | 'semantic+fuzzy';
  links: NoteLink[];
  created_at: string;
  total_count: number;
}

// Server Action
async function searchNotesHybrid(
  userId: number,
  query: string,
  page: number,
  pageSize: number
): Promise<{ results: HybridSearchResult[]; totalCount: number }>;

async function embedNote(
  noteId: string,
  content: string,
  links: NoteLink[]
): Promise<void>;
```

## Usage Example

```typescript
// Search with natural language
const { results } = await searchNotesHybrid(
  userId,
  'latest things I need to do', // Natural language query
  1,
  20
);

// results[0].search_type = 'semantic+fuzzy'
// results[0].relevance_score = 0.82 (high match)
```

## Core Flow

```
User enters natural query: "make me happy"
  ↓
Convert query to embedding via Gemini API (200-400ms)
  ↓
PostgreSQL hybrid search function:
  - Semantic search: cosine similarity on embeddings (70% weight)
  - Fuzzy search: trigram similarity on text (30% weight) OR ILIKE substring match
  - Combine scores and rank results
  ↓
Return top results with relevance scores and type indicators
  ↓
Display results grouped by search type (semantic, fuzzy, both)
```

## User Stories

**US-1: Natural Language Todo Search**
User types "latest todo" in search bar. System generates embedding, finds notes semantically similar to "todo" or "task", ranks by recency + relevance. Returns notes tagged as todos even if they don't contain exact word "todo".

**US-2: Emotional Intent Search**
User types "make me happy". System finds entertainment, hobby, or inspiration notes by semantic meaning. Returns YouTube videos, funny articles, music notes ranked by contextual similarity to "happiness" concept.

**US-3: Career Development Search**
User types "help me find a job". System finds career development, learning resources, interview prep notes. Combines semantic understanding of "job search" with fuzzy matching for "job" keyword. Shows most relevant career notes first.

## MVP Scope

**Included**:
- pgvector extension enabled in Supabase
- Embedding column (vector(768)) added to z_notes table
- IVFFlat index for fast vector similarity search
- Gemini API integration (text-embedding-004, free tier)
- Embedding service in packages/shared (reusable for bot)
- Server actions: embedNote(), searchNotesHybrid()
- Database RPC: search_notes_semantic(), search_notes_hybrid()
- Enhanced search UI with natural language examples
- Result type indicators (semantic/fuzzy/both)
- Backfill script for 700 existing notes (~42 min)
- Auto-embed new notes on creation (async)

**NOT Included** (Future):
- Query embedding cache → 🔧 Robust
- Semantic-only search mode toggle → 🔧 Robust
- Batch embedding optimization → 🔧 Robust
- HNSW index for better performance → 🚀 Advanced
- Search analytics and query logging → 🚀 Advanced
- Advanced filters (date, category) → 🚀 Advanced

## API Integration

**Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`

**Request**:
```json
{
  "content": {
    "parts": [{ "text": "Note content + link metadata combined..." }]
  }
}
```

**Response**:
```json
{
  "embedding": {
    "values": [0.024, -0.013, 0.045, ...] // 768 dimensions
  }
}
```

**Rate Limits**:
- 1,500 requests/minute (free tier)
- 20,000 tokens per request
- 2,048 tokens used for embedding (rest truncated)
- No cost for text-embedding-004

## Database Schema Changes

```sql
-- Add embedding column
ALTER TABLE z_notes ADD COLUMN embedding vector(768);

-- Create IVFFlat index for vector similarity
CREATE INDEX z_notes_embedding_idx
  ON z_notes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

## Acceptance Criteria (MVP) ✅

**Functional**:
- [x] pgvector extension enabled and working
- [x] Embedding column added to z_notes with IVFFlat index
- [x] Gemini API integration returns 768-dim vectors
- [x] search_notes_hybrid RPC function works correctly
- [x] New notes auto-embed on creation (async, non-blocking via embedNoteAsync)
- [x] Natural language queries return relevant results (verified with test queries)
- [x] Relevance scores calculated correctly (70/30 weighted)
- [x] Results show search type (semantic/fuzzy/semantic+fuzzy)
- [x] Backfill script successfully embeds 679 notes
- [x] Error handling for API failures (graceful degradation)

**Performance**:
- [x] Search completes in <1s (including embedding generation)
- [x] Embedding generation: <400ms per query
- [x] Database vector search: <100ms for 679 notes
- [x] Backfill script respects rate limits (60ms between calls)

**UI/UX**:
- [x] Search page with natural language input (dedicated /search route)
- [x] Results show relevance scores (hover to see match percentage)
- [x] Search type indicators display correctly (badges on hover)
- [x] Natural language example hints provided in placeholder
- [x] Loading states during embedding generation
- [x] Error messages for failed searches

**Integration**:
- [x] Embedding service in packages/shared (reusable by bot)
- [x] Server actions follow existing pattern (actions/notes.ts)
- [x] New SearchContainer component with useNotesSearch hook
- [x] No breaking changes to existing search functionality

## Future Tiers

**🔧 Robust** (+2 days): Query embedding cache (in-memory Map), batch embedding optimization (process 10 notes at once), semantic-only search mode toggle, embedding regeneration command.

**🚀 Advanced** (+3 days): HNSW index for 10x faster search, advanced filters (date range, category, relevance threshold), search analytics (track popular queries, click-through rates), embedding model upgrade path (larger dimensions).

---

**Status**: ✅ **DEPLOYED TO PRODUCTION** (2025-11-21) | **MVP Effort**: 5-6 days | **Production URL**: https://telepocket.dokojob.tech/search

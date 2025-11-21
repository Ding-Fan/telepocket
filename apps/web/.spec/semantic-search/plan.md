# Semantic Search Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Vector Database** | pgvector in Supabase | Already using Supabase, no separate infrastructure, supports 768-dim vectors, free tier sufficient |
| **Embedding Provider** | Google Gemini text-embedding-004 | Completely free (1500 req/min), excellent quality, 768 dimensions, no credit card needed |
| **Search Strategy** | Hybrid (semantic 70% + fuzzy 30%) | Best of both worlds: meaning understanding + typo tolerance, Supabase docs recommend this approach |
| **Index Type** | IVFFlat (100 lists) | Fast enough for 700 notes, less memory than HNSW, Supabase default for <1M vectors |
| **Embedding Location** | packages/shared service | Reusable by bot later, follows monorepo pattern, single source of truth |
| **Caching Strategy** | None in MVP | Keep simple first, add query cache in Robust tier if needed for performance |
| **Backfill Approach** | One-time script with rate limiting | 700 notes × 60ms = 42 min runtime, respects free tier limits, idempotent |

## Codebase Integration Strategy

**Database Layer**: `apps/bot/supabase/migrations/`
- Enable pgvector extension (one-liner)
- Add embedding column to z_notes
- Create IVFFlat index for fast similarity search
- Create search_notes_semantic() RPC function
- Create search_notes_hybrid() RPC function (combines semantic + fuzzy)

**Shared Service**: `packages/shared/src/embeddingService.ts`
- Gemini API integration class
- prepareNoteText() to combine content + links
- generateEmbedding() for single text
- generateEmbeddings() for batch processing
- Rate limit handling (60ms delay between calls)

**Server Actions**: `apps/web/actions/notes.ts`
- embedNote() - Generate and save embedding for a note
- searchNotesHybrid() - Search with natural language query
- Follow existing pattern (confirmNoteCategory, archiveNote)

**Hook Updates**: `apps/web/hooks/useNotesSearch.ts`
- Change RPC call from search_notes_fuzzy_optimized to search_notes_hybrid
- Add search type indicator to results
- Keep existing debounce (300ms) and pagination logic
- Backward compatible (fuzzy still works via hybrid)

**Component Updates**: `apps/web/components/notes/NotesSearchBar.tsx`
- Add natural language hint text ("Try: latest todo, make me happy")
- Show search type badge on results (semantic/fuzzy/both)
- No UI changes needed (existing component works)

**Backfill Script**: `apps/bot/scripts/backfill-embeddings.ts`
- Standalone script to embed 700 existing notes
- Batch processing with rate limiting
- Progress logging and error handling
- Run once after migration

## Technical Approach

**Existing Patterns to Follow**:
1. **Database RPC Pattern**: Study `search_notes_fuzzy_optimized` (apps/bot/supabase/migrations/) for window function pagination
2. **Server Actions Pattern**: Study `confirmNoteCategory` in `actions/notes.ts` for error handling
3. **Hook Pattern**: Study `useNotesSearch.ts` for debounce + pagination + loading states
4. **Shared Package Pattern**: Follow `packages/shared/src/types.ts` for exporting reusable code

**Component Composition**:
- EmbeddingService handles all Gemini API calls (rate limiting, retries, error handling)
- Server actions call EmbeddingService, interact with Supabase RPC functions
- Hooks consume server actions, manage client state (loading, errors, pagination)
- Components use hooks, render results with search type indicators

**Hybrid Search Flow**:
```
User query: "latest todo"
  ↓
useNotesSearch hook (300ms debounce)
  ↓
searchNotesHybrid server action
  ↓
EmbeddingService.generateEmbedding(query) → [0.024, -0.013, ...]
  ↓
Supabase RPC: search_notes_hybrid(embedding, query_text)
  ↓
PostgreSQL parallel execution:
  - CTE 1: Semantic search (vector <=> operator, 70% weight)
  - CTE 2: Fuzzy search (similarity() + ILIKE, 30% weight)
  - Combine with GROUP BY, sum scores, rank results
  ↓
Return top 20 results with type indicators
  ↓
Hook updates state, component renders
```

**Embedding Flow**:
```
New note created (bot or web)
  ↓
embedNote server action (async, non-blocking)
  ↓
prepareNoteText(content + links) → "Note text plus link metadata..."
  ↓
EmbeddingService.generateEmbedding(text) → [768 floats]
  ↓
UPDATE z_notes SET embedding = $1 WHERE id = $2
  ↓
Index automatically updated by PostgreSQL
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Gemini API rate limits** | Implement 60ms delay between calls, handle 429 errors with exponential backoff, free tier 1500/min is 25x our usage |
| **Slow search (<1s requirement)** | Use IVFFlat index (approximate search), cache query embeddings in Robust tier, test with 700 notes first |
| **Embedding quality issues** | Use 768 dimensions (Gemini recommended), combine with fuzzy search for fallback, test with sample queries |
| **Backfill script failure** | Make idempotent (check if embedding exists), log progress, resume from last successful note |
| **Migration breaking existing search** | Keep fuzzy search as fallback in hybrid, test both modes, gradual rollout (web first) |
| **Storage costs** | 700 notes × 768 floats × 4 bytes = 2.1 MB (negligible), Supabase free tier = 500 MB database |

## Integration Points

**Database**: `apps/bot/supabase/migrations/`
- New migration file: `add_semantic_search_pgvector.sql`
- Existing tables: z_notes (add embedding column)
- New RPC functions: search_notes_semantic, search_notes_hybrid

**Shared Package**: `packages/shared/src/`
- New: embeddingService.ts (Gemini API integration)
- Update: types.ts (add EmbeddingService interface)
- Update: index.ts (export embeddingService)

**Web App**: `apps/web/`
- Update: actions/notes.ts (add embedNote, searchNotesHybrid)
- Update: hooks/useNotesSearch.ts (change RPC call)
- Optional: components/notes/NotesSearchBar.tsx (add hints)

**Bot**: `apps/bot/` (future)
- Import embeddingService from packages/shared
- Use same RPC functions for consistency

## Success Criteria

**Technical**:
- Search completes in <1s (embedding 400ms + DB 100ms + network 100ms)
- pgvector index created successfully (EXPLAIN shows index scan)
- Embeddings stored correctly (768 dimensions, not null after backfill)
- Hybrid search returns results from both semantic and fuzzy CTEs

**User**:
- Natural language queries work ("latest todo" finds todos)
- Relevance scores make sense (higher for better matches)
- Search type indicators help understand why result matched
- No breaking changes to existing search behavior

**Business**:
- Zero additional infrastructure costs (free tier)
- Backfill completes in <1 hour (acceptable one-time cost)
- Foundation for future AI features (recommendations, auto-categorization)
- Bot can reuse same embedding service (code sharing benefit)

## Robust Product (+2 days)

Query embedding cache (Map<string, number[]>), batch embedding API calls (10 notes at once), semantic-only search mode toggle, embedding regeneration command for model upgrades, retry logic with exponential backoff.

## Advanced Product (+3 days)

HNSW index for 10x faster search (optimized for >100K vectors), advanced filters (date range, category, relevance threshold sliders), search analytics dashboard (popular queries, CTR, zero-result queries), multi-model support (OpenAI, Cohere fallback), embedding dimension tuning experiments.

---

**Total MVP Effort**: 40-48 hours (5-6 days) | **Dependencies**: Supabase access, Gemini API key

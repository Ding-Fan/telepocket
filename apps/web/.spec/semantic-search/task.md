# Semantic Search Implementation Tasks

**Status**: Not Started | **MVP Effort**: 40-48h (5-6 days) | **Priority**: High

---

## T-1: Database Migration - Enable pgvector

**Effort**: 2h | **Dependencies**: None

- [ ] Create migration file: `supabase migration new add_semantic_search_pgvector`
- [ ] Enable pgvector extension
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] Add embedding column to z_notes
  ```sql
  ALTER TABLE z_notes ADD COLUMN embedding vector(768);
  ```
- [ ] Create IVFFlat index (100 lists for ~1000 vectors)
  ```sql
  CREATE INDEX z_notes_embedding_idx ON z_notes
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ```
- [ ] Test migration locally: `supabase db reset`
- [ ] Deploy to production: `supabase db push`

**Acceptance**:
- ✅ Extension enabled (SELECT * FROM pg_extension WHERE extname = 'vector')
- ✅ Column exists (\\d z_notes shows embedding vector(768))
- ✅ Index created (\\di shows z_notes_embedding_idx)

---

## T-2: Database RPC - Semantic Search Function

**Effort**: 3h | **Dependencies**: T-1

- [ ] Create search_notes_semantic() function in migration
  ```sql
  CREATE OR REPLACE FUNCTION search_notes_semantic(
    query_embedding vector(768),
    user_id bigint,
    match_threshold float DEFAULT 0.7,
    page_size int DEFAULT 20
  ) RETURNS TABLE (...) AS $$
  ```
- [ ] Implement cosine similarity search (1 - <=> operator)
- [ ] Filter by user_id and status = 'active'
- [ ] Apply similarity threshold (reject low-confidence matches)
- [ ] Add window function for total_count
- [ ] Order by similarity DESC, created_at DESC
- [ ] Test with sample embedding vector

**Acceptance**:
- ✅ Function created and callable via RPC
- ✅ Returns notes sorted by similarity
- ✅ total_count matches actual result count
- ✅ Threshold filtering works (0.7 min similarity)

---

## T-3: Database RPC - Hybrid Search Function

**Effort**: 4h | **Dependencies**: T-2

- [ ] Create search_notes_hybrid() function in migration
- [ ] Implement semantic CTE (70% weight)
  ```sql
  WITH semantic AS (
    SELECT id, content, (1 - (embedding <=> query_embedding)) * 0.7 as score,
           'semantic' as type
    FROM z_notes WHERE telegram_user_id = user_id ...
  )
  ```
  - [ ] Implement fuzzy CTE (30% weight)
    ```sql
    fuzzy AS (
      SELECT id, content, 
             CASE WHEN content ILIKE '%' || query_text || '%' THEN greatest(similarity(content, query_text), 0.2) * 0.3
             ELSE similarity(content, query_text) * 0.3 END as score,
             'fuzzy' as type
      FROM z_notes WHERE telegram_user_id = user_id ...
    )
    ```
- [ ] Combine with UNION ALL, GROUP BY, SUM(score)
- [ ] Add STRING_AGG for search_type ('semantic+fuzzy')
- [ ] Add pagination and total_count
- [ ] Test with both matching and non-matching queries

**Acceptance**:
- ✅ Hybrid search returns results from both CTEs
- ✅ Scores weighted correctly (70/30 split)
- ✅ search_type shows 'semantic', 'fuzzy', or 'semantic+fuzzy'
- ✅ Results ranked by combined score

---

## T-4: Shared Embedding Service

**Effort**: 5h | **Dependencies**: None (parallel with T-1)

- [ ] Create `packages/shared/src/embeddingService.ts`
- [ ] Install Gemini dependency: `pnpm add @google/generative-ai -w`
- [ ] Implement EmbeddingService class
  ```typescript
  export class EmbeddingService {
    private model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    async generateEmbedding(text: string): Promise<number[]> { ... }
    async generateEmbeddings(texts: string[]): Promise<number[][]> { ... }
    prepareNoteText(note): string { ... }
  }
  ```
- [ ] Add rate limiting (60ms delay between calls)
- [ ] Add error handling (retry with exponential backoff)
- [ ] Implement prepareNoteText() to combine content + links
- [ ] Truncate to 2000 chars (~500 tokens, well under 2048 limit)
- [ ] Export singleton instance

**Acceptance**:
- ✅ generateEmbedding() returns 768-dim array
- ✅ Rate limiting prevents API 429 errors
- ✅ prepareNoteText() combines content + link metadata
- ✅ Error handling logs failures and retries

---

## T-5: Server Actions - Embed Note

**Effort**: 3h | **Dependencies**: T-1, T-4

- [ ] Add embedNote() to `apps/web/actions/notes.ts`
  ```typescript
  export async function embedNote(
    noteId: string,
    content: string,
    links: NoteLink[]
  ): Promise<{ success: boolean; error?: string }>
  ```
- [ ] Import embeddingService from packages/shared
- [ ] Call prepareNoteText() to combine content + links
- [ ] Generate embedding with error handling
- [ ] Update z_notes.embedding via Supabase
- [ ] Add revalidatePath() for affected pages
- [ ] Test with sample note

**Acceptance**:
- ✅ Embedding generated and saved to database
- ✅ Error handling returns meaningful messages
- ✅ Non-blocking (doesn't slow down note creation)
- ✅ Works with notes that have no links

---

## T-6: Server Actions - Hybrid Search

**Effort**: 4h | **Dependencies**: T-3, T-4

- [ ] Add searchNotesHybrid() to `apps/web/actions/notes.ts`
  ```typescript
  export async function searchNotesHybrid(
    userId: number,
    query: string,
    page: number,
    pageSize: number
  ): Promise<{ results: HybridSearchResult[]; totalCount: number }>
  ```
- [ ] Generate query embedding via embeddingService
- [ ] Call search_notes_hybrid RPC function
- [ ] Map database results to HybridSearchResult type
- [ ] Add error handling with graceful degradation
- [ ] Test with various natural language queries

**Acceptance**:
- ✅ Natural language queries return relevant results
- ✅ Results include relevance_score and search_type
- ✅ Error handling falls back to empty results (not crash)
- ✅ Pagination works correctly

---

## T-7: Update Search Hook

**Effort**: 3h | **Dependencies**: T-6

- [ ] Update `apps/web/hooks/useNotesSearch.ts`
- [ ] Change RPC call from search_notes_fuzzy_optimized to searchNotesHybrid server action
- [ ] Update SearchNote interface to include search_type
- [ ] Keep existing debounce (300ms) and pagination logic
- [ ] Add loading state during embedding generation
- [ ] Test with minimum query length (2 chars)

**Acceptance**:
- ✅ Hook calls hybrid search correctly
- ✅ Debounce still works (300ms delay)
- ✅ Pagination logic unchanged
- ✅ Loading state shows during search

---

## T-8: Update Search UI (Optional Enhancement)

**Effort**: 2h | **Dependencies**: T-7

- [ ] Update `apps/web/components/notes/NotesSearchBar.tsx`
- [ ] Add natural language hint below search input
  ```tsx
  <p className="text-xs text-ocean-400">
    Try: "latest todo", "make me happy", "help find job"
  </p>
  ```
- [ ] Add search type badge to results (if not in NoteCard)
  ```tsx
  {result.search_type === 'semantic+fuzzy' && (
    <span className="badge">AI Match</span>
  )}
  ```
- [ ] Test UI with various queries

**Acceptance**:
- ✅ Hint text visible and helpful
- ✅ Search type badges display correctly
- ✅ UI responsive on mobile
- ✅ No accessibility regressions

---

## T-9: Backfill Script - Embed Existing Notes

**Effort**: 4h | **Dependencies**: T-4, T-5

- [ ] Create `apps/bot/scripts/backfill-embeddings.ts`
- [ ] Fetch notes without embeddings (embedding IS NULL)
- [ ] Process in batches of 50 with progress logging
- [ ] Call embeddingService.generateEmbedding() for each note
- [ ] Update z_notes.embedding via Supabase
- [ ] Add 60ms delay between API calls (rate limiting)
- [ ] Make idempotent (skip if embedding exists)
- [ ] Add error logging and continue on failure
- [ ] Test with 10 notes first, then full 700

**Script Structure**:
```typescript
async function backfillEmbeddings() {
  let offset = 0;
  const batchSize = 50;

  while (true) {
    const notes = await fetchNotesWithoutEmbeddings(offset, batchSize);
    if (notes.length === 0) break;

    for (const note of notes) {
      try {
        const embedding = await embeddingService.generateEmbedding(
          embeddingService.prepareNoteText(note)
        );
        await updateNoteEmbedding(note.id, embedding);
        await sleep(60); // Rate limit
      } catch (error) {
        console.error(`Failed: ${note.id}`, error);
      }
    }
    offset += batchSize;
  }
}
```

**Acceptance**:
- ✅ Script completes without errors
- ✅ All 700 notes have embeddings
- ✅ Rate limiting prevents API errors
- ✅ Progress logged every 10 notes
- ✅ Idempotent (can re-run safely)

---

## T-10: Integration Testing

**Effort**: 4h | **Dependencies**: T-1 through T-9

- [ ] Test natural language queries:
  - "latest todo" → finds recent todos
  - "make me happy" → finds entertainment
  - "help find job" → finds career notes
  - "something to read" → finds articles/blogs
- [ ] Test edge cases:
  - Empty query → no results
  - Very long query (>2048 tokens) → truncated
  - No matching results → empty array
  - API failure → graceful degradation to fuzzy
- [ ] Test performance:
  - Search <1s end-to-end
  - Embedding generation <400ms
  - Database query <100ms
- [ ] Test UI:
  - Search bar accepts input
  - Results render correctly
  - Pagination works
  - Loading states show

**Acceptance**:
- ✅ All test queries return expected results
- ✅ Edge cases handled gracefully
- ✅ Performance meets <1s requirement
- ✅ UI works on desktop and mobile

---

## T-11: Auto-Embed New Notes

**Effort**: 3h | **Dependencies**: T-5

- [ ] Find note creation flow in bot (apps/bot/src/bot/noteHandlers.ts)
- [ ] Add embedNote() call after note saved
- [ ] Make async/non-blocking (fire and forget)
- [ ] Add error logging (don't block note creation on failure)
- [ ] Test creating note with and without links
- [ ] Verify embedding saved correctly

**Implementation**:
```typescript
// After note created
const noteId = await saveNote(content);
if (links.length > 0) {
  await saveNoteLinks(noteId, links);
}

// Fire and forget embedding (async)
embedNote(noteId, content, links).catch(err =>
  console.error('Embedding failed:', err)
);
```

**Acceptance**:
- ✅ New notes auto-embed on creation
- ✅ Note creation not blocked by embedding
- ✅ Embedding failures logged but don't crash
- ✅ Works for notes with 0, 1, or multiple links

---

## T-12: Documentation & Deployment

**Effort**: 2h | **Dependencies**: T-1 through T-11

- [ ] Update apps/web/.env.local.example with GOOGLE_AI_API_KEY
- [ ] Add setup instructions to apps/web/README.md
- [ ] Document backfill script usage
- [ ] Deploy migration to production
- [ ] Run backfill script on production (42 min)
- [ ] Verify 700 notes have embeddings
- [ ] Monitor first 100 searches for issues
- [ ] Create rollback plan (drop column if needed)

**Acceptance**:
- ✅ Environment variable documented
- ✅ Migration deployed successfully
- ✅ Backfill completed (700/700 notes)
- ✅ Production searches working
- ✅ No errors in logs

---

## Final Verification (MVP)

**Functional**:
- [ ] pgvector extension enabled
- [ ] Embeddings stored in z_notes (768 dimensions)
- [ ] Hybrid search returns results
- [ ] Natural language queries work
- [ ] Search types indicated correctly
- [ ] New notes auto-embed
- [ ] Backfill script completed

**Performance**:
- [ ] Search <1s end-to-end
- [ ] Embedding API <400ms
- [ ] Database query <100ms
- [ ] Backfill respects rate limits

**Integration**:
- [ ] Embedding service in packages/shared
- [ ] Server actions follow existing patterns
- [ ] Hook integrates with existing UI
- [ ] No breaking changes to fuzzy search

---

## Robust Product Tasks

**T-13: Query Embedding Cache** (+4h)
- Implement in-memory Map<string, number[]> cache
- Add cache hit/miss logging
- Set reasonable TTL (1 hour)

**T-14: Batch Embedding Optimization** (+3h)
- Modify embedNote() to accept array of notes
- Process 10 notes per API call (Gemini supports batch)
- Update backfill script to use batch API

**T-15: Semantic-Only Search Mode** (+3h)
- Add toggle to search UI (semantic vs hybrid)
- Create search_notes_semantic_only RPC function
- Update hook to support both modes

**T-16: Embedding Regeneration Command** (+2h)
- CLI command to regenerate all embeddings
- Useful for model upgrades or dimension changes
- Progress bar and resumability

---

## Advanced Product Tasks

**T-17: HNSW Index Migration** (+6h)
- Replace IVFFlat with HNSW index
- Tune m and ef_construction parameters
- Benchmark performance improvement

**T-18: Advanced Filters UI** (+8h)
- Date range picker (last week, month, year)
- Category filter (checkboxes)
- Relevance threshold slider (0-100%)
- Combine filters with search

**T-19: Search Analytics** (+10h)
- Track queries to z_search_logs table
- Dashboard showing popular queries
- Zero-result query tracking
- Click-through rate calculation

**T-20: Multi-Model Support** (+6h)
- Add OpenAI embeddings as fallback
- Cohere embeddings option
- Model selection in admin UI
- A/B testing framework

---

**Total MVP Tasks**: T-1 through T-12 | **Effort**: 40-48 hours (5-6 days)

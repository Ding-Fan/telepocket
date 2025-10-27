# Fuzzy Search & Unified Note System Specification

## Problem & Solution

**Problem**: Current search uses exact LIKE matching (fails on typos). Bot rejects messages without links, preventing note-taking functionality.

**Solution**: PostgreSQL trigram fuzzy search with weighted relevance ranking. New `/note` command system saves notes independently, links optional.

**Returns**: Paginated search results sorted by relevance score, matching typo-tolerant queries across links and note content.

## Architecture Approach

**Command-Based Parallel System**:
- **OLD**: Regular messages → `handlers.ts` → z_messages/z_links (requires links)
- **NEW**: `/note` commands → `noteHandlers.ts` → z_notes/z_note_links (links optional)
- Both systems run independently, zero risk to existing functionality
- No data migration needed, users can choose which system to use

## Component API

```typescript
// Database function response type
interface SearchResult {
  id: string;
  message_id: string;
  url: string;
  title?: string;
  description?: string;
  og_image?: string;
  created_at: string;
  updated_at: string;
  message_content: string;
  relevance_score: number;  // 0.0 to 1.0
}

// Enhanced database operations
interface SearchLinksResponse {
  links: (Link & { message_content?: string; relevance_score?: number })[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  keyword: string;
}
```

## Usage Example

```typescript
// User command: /notes search reactt hooks
// (note typo in "reactt")

const result = await noteOps.searchNotesWithPagination(
  userId,
  'reactt hooks',  // fuzzy match finds "react hooks"
  page,
  limit
);

// Returns notes sorted by relevance_score
// Best matches first (content > title > url > description)
```

## Command Structure

```
/note <text>              # Save a note (links optional)
/notes [page]             # List all notes with pagination
/notes search <keyword>   # Fuzzy search notes
```

## Core Flow

```
User sends: /notes search keyword
  ↓
TelegramClient.showNoteSearchResults()
  ↓
noteOps.searchNotesWithPagination()
  ↓
PostgreSQL: search_notes_fuzzy() function
  - Calculate trigram similarity for each field
  - Weight scores: content×10, title×4, url×3, description×2
  - Filter by similarity threshold (0.4)
  - Sort by relevance_score DESC
  ↓
Return paginated results with relevance scores
  ↓
Display formatted results (note-first with bulleted links)
```

## User Stories

**US-1: Typo-Tolerant Search**
User types `/notes search reactt` (typo). System finds all notes containing "react" by calculating trigram similarity. Results show "React Hooks Tutorial", "React Documentation", etc., sorted by relevance.

**US-2: Save Notes Without Links**
User sends `/note Remember to review Redux patterns tomorrow`. Bot saves message as pure note (no links). Later, user searches `/notes search redux` and finds the note even though no link was present.

**US-3: Context-Aware Search**
User saved note with `/note Great tutorial for TypeScript beginners https://ts-tutorial.com`. Searching `/notes search typescript` finds the note because content is weighted highest in fuzzy search, even if link title doesn't mention TypeScript.

**US-4: Independent Systems**
User continues sending regular messages with links (saved to old system). Separately uses `/note` for note-taking (saved to new system). Both systems work independently without conflicts.

## MVP Scope

**Included**:
- PostgreSQL pg_trgm extension enabled
- GIN indexes on url, title, description, note content
- Database functions: `search_notes_fuzzy()`, `search_notes_fuzzy_count()`, `get_notes_with_pagination()`, `get_notes_count()`
- Weighted relevance scoring (content×10, title×4, url×3, description×2)
- Similarity threshold: 0.4 (40% match required)
- New commands: `/note`, `/notes`, `/notes search`
- Note handler accepts notes without links
- Message-first display format (note content + bulleted links)
- Old system unchanged (regular messages still work)

**NOT Included** (Future):
- Per-link annotations/notes → 🔧 Robust
- Search history or saved searches → 🔧 Robust
- AI semantic search (pgvector) → 🚀 Advanced
- Search filters (date, domain) → 🚀 Advanced

## Database Schema Changes

**No table structure changes required**

**Additions**:
- Extension: `pg_trgm`
- Indexes: GIN trigram indexes on searchable columns
- Functions: `search_links_fuzzy()`, `search_links_fuzzy_count()`
- Setting: `pg_trgm.similarity_threshold = 0.4`

## Acceptance Criteria (MVP)

**Functional**:
- [ ] `/note <text>` saves notes with optional links
- [ ] Fuzzy search finds results with typos (e.g., "reactt" → "react")
- [ ] Search covers: note content, url, title, description
- [ ] Results sorted by relevance score (best matches first)
- [ ] Pagination works correctly with fuzzy results
- [ ] `/notes` lists all notes (5 per page)
- [ ] `/notes search <keyword>` performs fuzzy search
- [ ] Empty search term handled gracefully
- [ ] No matches shows "No notes found" message
- [ ] Exact matches score higher than fuzzy matches
- [ ] Old system (regular messages) continues working unchanged

**Performance**:
- [ ] Search completes in <500ms for 1000 notes
- [ ] GIN indexes properly utilized (check EXPLAIN ANALYZE)
- [ ] No table scans for search queries

**UI/UX**:
- [ ] `/note`, `/notes` commands work as expected
- [ ] Note-first display format (content + bulleted links)
- [ ] Notes saved without links show success confirmation
- [ ] Search results show relevance scores
- [ ] Pagination buttons work correctly

**Backend**:
- [ ] `search_notes_fuzzy()` function returns correct schema
- [ ] Relevance scoring weights applied correctly (content×10, title×4, url×3, desc×2)
- [ ] Similarity threshold (0.4) enforced
- [ ] NULL values handled gracefully (COALESCE)
- [ ] JSONB aggregation works correctly

## Future Tiers

**🔧 Robust** (+2 days): Per-link annotation field (z_links.notes), search history tracking (z_search_history table), saved searches feature, similarity threshold adjustment UI.

**🚀 Advanced** (+3 days): AI semantic search with pgvector embeddings, hybrid ranking (trigram + vector scores), search filters (date range, domain, tag-based), advanced analytics dashboard.

---

**Status**: Ready for Implementation | **MVP Effort**: 3 days

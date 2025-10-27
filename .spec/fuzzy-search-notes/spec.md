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

## Security & Performance Hardening (Post-Implementation)

After MVP deployment, comprehensive code review identified and fixed critical and high-priority issues:

### Critical Fixes Implemented

**1. User Authorization Validation**
- Added `validateAuthorizedUser()` to all database operations
- Prevents unauthorized access even if RLS policies are permissive
- Guards against potential security misconfigurations

**2. Similarity Threshold Scope Fix**
- **Problem**: `ALTER DATABASE postgres SET pg_trgm.similarity_threshold = 0.4` affected entire database
- **Solution**: Changed to session-level `SET LOCAL` within each function
- **Impact**: Fuzzy search threshold isolated to specific queries only

**3. Input Validation System**
- Created `src/utils/validation.ts` with comprehensive validators
- Note content: Max 4000 characters
- Search keywords: Min 1, Max 100 characters
- Pagination: Enforced limits (1-50 items per page)
- Prevents malicious or invalid data from entering system

### High Priority Fixes Implemented

**4. Atomic Transaction Support**
- **Problem**: `saveNoteWithLinks()` could fail halfway, leaving orphaned notes
- **Solution**: Created `save_note_with_links_atomic()` PostgreSQL function
- **Impact**: Note + links saved in single transaction with automatic rollback on error

**5. Standardized Error Handling**
- Created `src/utils/errorHandler.ts` with context-aware error handlers
- All errors now logged with: userId, operation, timestamp, additional context
- User-friendly error messages (❌ prefix for clarity)
- Improved debugging and error tracking

**6. Query Optimization**
- **Problem**: Double database queries for pagination (count + data)
- **Solution**: Window functions `COUNT(*) OVER()` to return count with data
- **Impact**: 50% reduction in database queries for pagination

**7. Migration Workflow Correction**
- **Problem**: Initial migration file (20251027000000) didn't match database record (20251027112053)
- **Root Cause**: Manually pasted SQL instead of reading from file
- **Solution**: Rolled back, deleted wrong file, properly applied migration using file
- **Lesson Learned**: Always use migration files as source of truth
- **Final State**: File `20251027113455_*` matches database record exactly

### New Utility Modules

**`src/utils/validation.ts`**:
```typescript
validateAuthorizedUser(userId: number)    // Ensures authorized user
validateNoteContent(content: string)      // Max 4000 chars
validateSearchKeyword(keyword: string)    // 1-100 chars
validatePagination(page, limit)           // Valid page/limit
```

**`src/utils/errorHandler.ts`**:
```typescript
handleDatabaseError(error, context)       // Structured logging
handleValidationError(error, context)     // User-friendly messages
handleCommandError(error, context)        // General error handling
```

### Updated Database Functions

**Migration `20251027113455_fix_similarity_threshold_and_add_transaction_support`**:

1. **Session-Level Threshold**: Functions use `SET LOCAL pg_trgm.similarity_threshold = 0.4`
2. **Atomic Save**: `save_note_with_links_atomic()` - Single transaction for note+links
3. **Optimized Pagination**: `get_notes_with_pagination()` - Window function for count
4. **Optimized Search**: `search_notes_fuzzy_optimized()` - Window function for count

### Migration Best Practices Learned

**Proper Workflow**:
1. Create migration file using `supabase migration new` or MCP tool
2. Read the file and apply it (don't paste SQL manually)
3. Verify file timestamp matches database record
4. Commit the file that was actually applied

**Rollback Process** (No Built-in Support):
- Supabase doesn't have automatic rollback (as of 2025)
- Manual approach: Drop objects → Delete migration record → Create new file
- Better approach: Create forward "undo" migration
- Documentation: Updated `~/.claude/skills/supabase/SKILL.md` with rollback guidance

## Acceptance Criteria (MVP)

**Functional**:
- [x] `/note <text>` saves notes with optional links
- [x] Fuzzy search finds results with typos (e.g., "reactt" → "react")
- [x] Search covers: note content, url, title, description
- [x] Results sorted by relevance score (best matches first)
- [x] Pagination works correctly with fuzzy results
- [x] `/notes` lists all notes (5 per page)
- [x] `/notes search <keyword>` performs fuzzy search
- [x] Empty search term handled gracefully (validation error)
- [x] No matches shows "No notes found" message
- [x] Exact matches score higher than fuzzy matches
- [x] Old system (regular messages) continues working unchanged

**Performance**:
- [x] GIN indexes properly utilized (check EXPLAIN ANALYZE)
- [x] No table scans for search queries
- [x] Pagination optimized (single query with window functions)
- [ ] Search completes in <500ms for 1000 notes (requires performance testing)

**Security**:
- [x] User authorization validated in all database operations
- [x] Input validation prevents malicious/invalid data
- [x] Similarity threshold scoped to queries only (not database-wide)
- [x] RLS policies enabled on all tables
- [x] Atomic transactions prevent data inconsistency

**UI/UX**:
- [x] `/note`, `/notes` commands work as expected
- [x] Note-first display format (content + bulleted links)
- [x] Notes saved without links show success confirmation
- [x] Search results show relevance scores
- [x] Pagination buttons work correctly
- [x] User-friendly error messages with ❌ prefix

**Backend**:
- [x] `search_notes_fuzzy()` function returns correct schema
- [x] Relevance scoring weights applied correctly (content×10, title×4, url×3, desc×2)
- [x] Similarity threshold (0.4) enforced at session level
- [x] NULL values handled gracefully (COALESCE)
- [x] JSONB aggregation works correctly
- [x] `save_note_with_links_atomic()` provides transaction support
- [x] Error handling with context logging
- [x] Migration file matches database record

## Future Tiers

**🔧 Robust** (+2 days): Per-link annotation field (z_links.notes), search history tracking (z_search_history table), saved searches feature, similarity threshold adjustment UI.

**🚀 Advanced** (+3 days): AI semantic search with pgvector embeddings, hybrid ranking (trigram + vector scores), search filters (date range, domain, tag-based), advanced analytics dashboard.

---

**Status**: ✅ Production Ready with Security Hardening | **MVP Effort**: 3 days + 1 day security fixes

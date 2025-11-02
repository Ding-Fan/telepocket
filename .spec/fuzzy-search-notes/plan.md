# Fuzzy Search & Unified Note System Implementation Plan

**Status**: Phase 1 Complete - All Data Migrated | **Updated**: 2025-11-02

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Typo Tolerance Method** | PostgreSQL pg_trgm extension | Already in Supabase, no external APIs, handles 100 links/month easily, no AI costs |
| **Search Scope** | URL + title + description + message content | User requested note search, message context helps find links later |
| **Similarity Threshold** | 0.4 (40% match) | User chose "balanced" - catches typos without too many false positives |
| **Relevance Ranking** | Weighted scoring (content×10, title×4, url×3, desc×2) | Content most important for standalone notes, title for links |
| **Note Architecture** | Message-first with aggregated links | User chose Option A: paginate by messages (5 per page), links shown as array |
| **Migration Strategy** | **COMMAND-BASED PARALLEL SYSTEM** - Zero risk | New `/note` commands use z_notes/z_note_links, old messages use z_messages/z_links, both independent |
| **Display Format** | Note content + bulleted links below | Natural reading flow: message first, links as supporting detail |
| **Implementation Approach** | PostgreSQL functions with JSONB aggregation | Functions return notes with links as JSON array, pagination by notes not links |
| **Index Strategy** | GIN indexes per column | Faster than single concatenated tsvector, allows field-specific matching |

## Codebase Integration Strategy

### ✅ Completed: Database Layer

**Migrations**:
1. `supabase/migrations/20251025143242_fuzzy_search_notes_feature.sql` - Core feature
2. `supabase/migrations/20251025165457_add_public_policies_to_notes.sql` - RLS policy fix

**Database Objects**:
- ✅ Created tables: `z_notes`, `z_note_links`
- ✅ Created functions: `search_notes_fuzzy`, `search_notes_fuzzy_count`, `get_notes_with_pagination`, `get_notes_count`
- ✅ Enabled extension: `pg_trgm`
- ✅ Created indexes: 7 total (GIN trigram + standard)
- ✅ Fixed RLS policies: Added public role policies for anon key access

### ✅ Completed: Security & Performance Hardening (2025-10-27)

**Critical Fixes**:
1. **User Authorization** - `validateAuthorizedUser()` added to all database operations
2. **Similarity Threshold Fix** - Changed from database-wide to session-level (`SET LOCAL`)
3. **Input Validation** - Created `src/utils/validation.ts` with comprehensive validators

**High Priority Fixes**:
4. **Atomic Transactions** - `save_note_with_links_atomic()` PostgreSQL function
5. **Error Handling** - `src/utils/errorHandler.ts` with context logging
6. **Query Optimization** - Window functions reduce queries by 50%
7. **Migration Workflow** - Proper file-based migration (20251027113455)

**Migrations**:
3. `supabase/migrations/20251027113455_fix_similarity_threshold_and_add_transaction_support.sql` - Security & performance

### ✅ Completed: Historical Data Migration (2025-11-02)

**Migration Goal**: Migrate all historical data from old tables to unified note system

**Migration Results**:
- ✅ **Messages**: 312 migrated from z_messages → z_notes (66 → 378 total)
- ✅ **Links**: 455 migrated from z_links → z_note_links (58 → 513 total)
- ✅ **Data Integrity**: 100% verified (0 orphaned records)
- ✅ **Date Range**: June 14, 2025 → November 1, 2025 (complete history)
- ✅ **Safety**: Idempotent INSERT with NOT EXISTS deduplication

**Migration Details**:
- Migration file: `migrate_historical_data_to_notes_system`
- Approach: Two-step INSERT (notes first, then links with mapping)
- Rollback strategy: Original tables preserved, can delete by date if needed
- Verification: Multiple queries confirmed 0 orphaned records

**Phase 1 Complete**: All data now in new system, ready for Phase 2 (switch reads)

**Migrations**:
4. `supabase/migrations/[timestamp]_migrate_historical_data_to_notes_system.sql` - Historical data migration

**New Utility Modules**:
- `src/utils/validation.ts` - Input validation (note content, keywords, pagination)
- `src/utils/errorHandler.ts` - Standardized error handling with context

**Database Functions Updated**:
- `search_notes_fuzzy()` - Now uses `SET LOCAL` for threshold
- `search_notes_fuzzy_count()` - Session-level threshold
- `save_note_with_links_atomic()` - Atomic transaction support (NEW)
- `get_notes_with_pagination()` - Window function optimization
- `search_notes_fuzzy_optimized()` - Window function optimization (NEW)

**Migration Lessons Learned**:
- ❌ Wrong: Create file → ignore it → paste SQL manually → database record doesn't match file
- ✅ Right: Create file → read file → apply file → verify file matches database record
- Updated `~/.claude/skills/supabase/SKILL.md` with rollback documentation

### ✅ Completed: Full Application Layer (Command-Based Approach)

**Database Layer**: `src/database/`
- ✅ **NEW**: `noteOperations.ts` - Parallel to `operations.ts`
  - ✅ `saveNote()`, `saveNoteLinks()`, `saveNoteWithLinks()`
  - ✅ `searchNotesWithPagination()` → calls `rpc('search_notes_fuzzy')`
  - ✅ `getNotesWithPagination()` → calls `rpc('get_notes_with_pagination')`
- ✅ **NEW**: `connection.ts` - Add `Note`, `NoteLink` interfaces

**Bot Handler**: `src/bot/`
- ✅ **DEPLOYED**: `noteHandlers.ts` - Independent from `handlers.ts`
  - ✅ Exported `handleNoteCommand()` function for `/note` command
  - ✅ Extracts note content (removes `/note` prefix)
  - ✅ Use `noteOperations` for database calls
  - ✅ Message: "✅ Saved note" or "✅ Saved note with N links"

**Bot Client**: `src/bot/client.ts`
- ✅ **DEPLOYED**: Registered `/note` and `/notes` commands
- ✅ **DEPLOYED**: `/note` handler routes to `handleNoteCommand()`
- ✅ **DEPLOYED**: `/notes` handler with full parsing:
  - `/notes` → `showNotesPage(ctx, userId, 1)`
  - `/notes <page>` → `showNotesPage(ctx, userId, page)`
  - `/notes search <keyword>` → `showNoteSearchResults(ctx, userId, keyword, 1)`
- ✅ **DEPLOYED**: `showNotesPage()` method for `/notes` listing
- ✅ **DEPLOYED**: `showNoteSearchResults()` method for `/notes search`
- ✅ **DEPLOYED**: Updated help text with new commands
- ✅ `formatNoteForDisplay()` helper in `linkFormatter.ts`
  - ✅ Display: Note content → bulleted links below
  - ✅ Handle empty links array gracefully

**Command Processing Flow** (Both Systems Active):
- Old (unchanged): Regular message → check links → reject if none → save to z_messages
- New: `/note <text>` → extract links → always save to z_notes → confirm
- New: `/notes [page]` → list notes paginated
- New: `/notes search <keyword>` → fuzzy search notes with typo tolerance

**Deployment Status**:
- ✅ TypeScript compilation: Successful
- ✅ pm2 restart: Successful
- ✅ Bot status: Online and running in production

### ✅ Completed: Links-Only View & Search (Nov 2, 2025)

**Goal**: Provide dedicated `/links` command for viewing and searching individual links separately from notes.

**Database Layer**: `supabase/migrations/`
- ✅ **Migration**: `create_links_only_fuzzy_search`
- ✅ **Function**: `get_links_with_pagination()` - Returns individual links from z_note_links
  - Joins z_note_links with z_notes for user filtering
  - Returns link_id, note_id, url, title, description, og_image, timestamps
  - Window function for total_count
  - Pagination: 10 links per page
- ✅ **Function**: `search_links_fuzzy_optimized()` - Fuzzy search on link metadata only
  - Searches ONLY: title, URL, description (NOT note content)
  - Weighted scoring: title×4, url×3, description×2 (total 9)
  - Hybrid approach: ≤10 chars use LIKE, >10 chars use trigram
  - Normalized relevance score: 0.0 to 1.0
  - Window function for total_count

**Database Operations**: `src/database/noteOperations.ts`
- ✅ **Interface**: `LinkOnlyResult` - Type definition for individual links
- ✅ **Method**: `getLinksOnlyWithPagination()` - RPC call to `get_links_with_pagination`
  - Full validation (user auth, pagination)
  - Error handling with context
- ✅ **Method**: `searchLinksOnlyWithPagination()` - RPC call to `search_links_fuzzy_optimized`
  - Returns links with relevance scores
  - Keyword passed to additionalInfo for error context

**Bot Client**: `src/bot/client.ts`
- ✅ **Command**: `/links` registered with command parser
  - `/links` → `showLinksOnlyPage(ctx, userId, 1)`
  - `/links <page>` → `showLinksOnlyPage(ctx, userId, page)`
  - `/links search <keyword>` → `showLinksOnlySearchResults(ctx, userId, keyword, 1)`
- ✅ **Method**: `showLinksOnlyPage()` - Display individual links
  - 10 links per page
  - Format: numbered list with clickable URLs
  - Shows title (or URL if no title), description truncated to 100 chars
  - Pagination buttons: `links_only_page_` callback prefix
- ✅ **Method**: `showLinksOnlySearchResults()` - Display search results
  - Shows relevance score (0-100%)
  - Same formatting as listing
  - Pagination buttons: `links_only_search_` callback prefix
- ✅ **Callbacks**: Added pagination handlers for links-only views
  - `links_only_page_<N>` for listing pagination
  - `links_only_search_<N>_<keyword>` for search pagination
  - `links_only_page_info` and `links_only_search_info` for page indicators

**Search Fixes Applied**:
- ✅ Extended LIKE matching threshold from 3 to 10 characters
  - Migration: `extend_like_matching_to_10_chars`
  - Fixes search for medium-length keywords: job, python, interview, startup
  - All keyword lengths now work: 2 chars (ai), 3 chars (job), 9 chars (interview)

**Command Comparison**:
| Command | Data Source | Search Scope | Items Per Page |
|---------|-------------|--------------|----------------|
| `/notes` | z_notes + z_note_links | Note content + link metadata | 5 notes |
| `/notes search` | z_notes + z_note_links | Note content + link metadata | 5 notes |
| `/links` | z_note_links only | N/A (listing) | 10 links |
| `/links search` | z_note_links only | Link metadata ONLY | 10 links |

**Results**:
- ✅ 513 total links available in database
- ✅ `/links search job` returns 19 results
- ✅ `/links search interview` returns 7 results
- ✅ Individual links displayed with proper formatting
- ✅ Relevance scores normalized (0-100%)

### ✅ Completed: Performance & UX Improvements (Nov 2, 2025)

**Goal**: Optimize listing operations and improve user experience with loading indicators.

**Problems Identified**:
1. **Double Database Queries**: All listing commands (`/links`, `/notes`) made 2 queries:
   - Query 1: `getLinksOnlyWithPagination(userId, 1, 1)` - Get 1 item to check count
   - Query 2: `getLinksOnlyWithPagination(userId, page, 10)` - Get actual page
   - Impact: 100% query overhead, 50% slower than necessary
2. **No Loading Indicator**: Users saw blank screen during database queries
   - No visual feedback that bot received command
   - Poor perceived performance even when queries were fast

**Solutions Implemented**:

**Bot Client**: `src/bot/client.ts`
- ✅ **Removed wasteful count queries** in 4 methods:
  - `showLinksOnlyPage()` - Changed from 2 queries to 1
  - `showNotesPage()` - Changed from 2 queries to 1
  - Query pattern change:
    ```typescript
    // BEFORE (2 queries)
    const quickResult = await noteOps.getLinksOnlyWithPagination(userId, 1, 1);
    // ... validation ...
    const result = await noteOps.getLinksOnlyWithPagination(userId, page, 10);

    // AFTER (1 query)
    const result = await noteOps.getLinksOnlyWithPagination(userId, page, 10);
    ```
- ✅ **Added typing indicators** to all 4 methods:
  - `showLinksOnlyPage()` - Added `ctx.replyWithChatAction('typing')`
  - `showLinksOnlySearchResults()` - Added typing indicator
  - `showNotesPage()` - Added typing indicator
  - `showNoteSearchResults()` - Added typing indicator
- ✅ **Optimized page validation**:
  - Moved validation AFTER getting data (uses result.totalPages)
  - No extra query needed for bounds checking
  - Invalid pages redirect to page 1 only for initial commands (not callbacks)

**Performance Metrics**:
- **Database Queries**: Reduced from 2 → 1 (50% reduction)
- **Response Time**: Faster due to single query
- **User Feedback**: Immediate (typing indicator appears instantly)

**User Experience Improvement**:
```
BEFORE:
User sends /links
  → Blank screen
  → Wait (2 queries executing)
  → Results appear

AFTER:
User sends /links
  → "Bot is typing..." indicator
  → Quick results (1 query)
```

**Code Changes Summary**:
- 4 methods modified in `src/bot/client.ts`
- Lines changed: ~40 lines optimized
- No database schema changes needed
- No migration required

## Technical Approach

**Existing Patterns to Follow**:
1. **Database operations**: Study `getLinksWithPagination()` (operations.ts:72-137) for pagination pattern
2. **RPC calls**: Use Supabase `.rpc('function_name', params)` for PostgreSQL functions
3. **Error handling**: Follow try-catch pattern in all database operations
4. **Test structure**: Follow `tests/unit/database.operations.test.ts` for mocking Supabase client

**Component Composition**:
- Database function handles: similarity calculation, weighted scoring, threshold filtering
- TypeScript client handles: pagination state, result formatting, UI rendering
- Message handler handles: link extraction, message saving, user feedback

**Search Flow** (Command-Based):
```
User: /notes search keyword
  ↓
client.ts: parseCommand() → routes to showNoteSearchResults(ctx, userId, keyword, page)
  ↓
noteOperations.ts: searchNotesWithPagination(userId, keyword, page, limit)
  ↓
Supabase RPC: search_notes_fuzzy(telegram_user_id, keyword, page, limit)
  ↓
PostgreSQL:
  - Calculate trigram similarities across note + all its links
  - Apply weighted scores (content×10, title×4, url×3, desc×2)
  - Aggregate links into JSONB array per note
  - Filter by similarity threshold (0.4)
  - Sort by relevance_score DESC, created_at DESC
  ↓
noteOperations.ts: also calls search_notes_fuzzy_count()
  ↓
Return: {notes: [{note_id, note_content, links: [...], relevance_score}], totalCount, currentPage, totalPages, keyword}
  ↓
client.ts: Format with formatNoteForDisplay() (message + bulleted links), render pagination
```

**Note Saving Flow** (Command-Based):
```
User sends: /note <text>
  ↓
client.ts: routes to noteHandlers.handleNoteCommand(ctx)
  ↓
Extract links (if any): linkExtractor.extractAndValidateUrls()
  ↓
Save note: noteOps.saveNote() (ALWAYS - no link requirement)
  ↓
If links exist: fetch metadata → noteOps.saveNoteLinks()
  ↓
Confirm: "✅ Saved note" or "✅ Saved note with N links"
```

**List Notes Flow** (Command-Based):
```
User sends: /notes [page]
  ↓
client.ts: parseCommand() → routes to showNotesPage(ctx, userId, page)
  ↓
noteOperations.ts: getNotesWithPagination(userId, page, limit)
  ↓
Supabase RPC: get_notes_with_pagination(telegram_user_id, page, limit)
  ↓
Return paginated notes with aggregated links
  ↓
client.ts: Format and display with pagination buttons
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Supabase client doesn't support trigram operators** | Use PostgreSQL functions called via `.rpc()` - handles complex logic server-side |
| **Performance degradation with GIN indexes** | Test with 1000+ notes, monitor query plans with EXPLAIN ANALYZE, GIN is optimized for this |
| **False positives with 0.4 threshold** | Start with 0.4, easy to adjust later by updating database setting |
| **Breaking existing functionality** | Command-based approach - old system completely unchanged, zero risk |
| **Note spam without link requirement** | Authorized user only (already enforced), personal bot for single user |
| **Command confusion** | Clear command structure: `/note` to save, `/notes` to list, `/notes search` to search |

## Integration Points

### ✅ Completed

**Database**:
- ✅ Tables: `z_notes`, `z_note_links` (created, parallel to existing)
- ✅ Migrations:
  - `20251025143242_fuzzy_search_notes_feature.sql` (core feature)
  - `20251025165457_add_public_policies_to_notes.sql` (RLS policy fix)
- ✅ Functions: `search_notes_fuzzy()`, `search_notes_fuzzy_count()`, `get_notes_with_pagination()`, `get_notes_count()`
- ✅ Extension: `pg_trgm` enabled
- ✅ Indexes: 7 indexes created
- ✅ RLS Policies: Public role policies added for anon key access
- ✅ MCP: `.mcp.json` configured with project ref

### ✅ Completed: Migration Testing & Validation (Nov 2, 2025)

**Manual Testing**: All functionality verified
- ✅ `/note` with links working
- ✅ `/note` without links working
- ✅ `/notes` pagination working
- ✅ `/notes search` with fuzzy matching working
- ✅ Old system dual-write working (regular messages)
- ✅ Historical data accessible via `/notes` command

**Migration Validation**:
- ✅ All 378 notes accessible
- ✅ All 513 links preserved with metadata
- ✅ Complete date range accessible (June → November 2025)

### Next Steps: Phase 2 - Switch Primary Reads

**Goal**: Transition `/ls` command to read from new system

**Tasks**:
- [ ] Update `getLinksWithPagination()` to read from z_notes/z_note_links
- [ ] Update `searchLinksWithPagination()` to use fuzzy search functions
- [ ] Keep dual-write active for safety
- [ ] Test thoroughly in production
- [ ] Monitor for any discrepancies between old and new data
- [ ] Verify performance is acceptable

**Unit Testing**: `tests/unit/noteOperations.test.ts`
- [ ] Test RPC calls to `search_notes_fuzzy()`
- [ ] Test RPC calls to `get_notes_with_pagination()`
- [ ] Test pagination calculations
- [ ] Test error handling

**Performance Testing**:
- [ ] Test with larger datasets (100+ notes)
- [ ] Verify search completes in <500ms
- [ ] Check database query plans

## Success Criteria

**Technical**:
- pg_trgm extension enabled in Supabase
- 4 GIN indexes created and used by query planner
- Search queries complete <500ms for 1000 links
- Relevance scores calculated correctly (0.0 to 1.0)

**User**:
- Typos in search queries return relevant results
- Notes without links are saved and searchable
- Search results sorted by relevance (best first)
- Existing UI/UX unchanged

**Business**:
- No external API costs
- No schema migrations (backward compatible)
- Easy to adjust similarity threshold later
- Foundation for future AI semantic search

## Robust Product (+2 days)

Add `notes` column to `z_links` for per-link annotations, `z_search_history` table to track queries, saved searches feature with quick access buttons, similarity threshold adjustment in bot settings command.

## Advanced Product (+3 days)

Implement pgvector semantic search with OpenAI embeddings, hybrid ranking combining trigram + vector scores, advanced filters (date range, domain whitelist, custom tags), search analytics dashboard showing popular queries and click-through rates.

---

**Total Effort (Phase 1 Complete)**:
- MVP Development: 24 hours (3 days)
- Security Hardening: 8 hours (1 day)
- Historical Data Migration: 4 hours (0.5 day)
- **Total**: 36 hours (4.5 days)

**Dependencies**: Supabase access, PostgreSQL permissions

**Status**: ✅ Phase 1 Complete + Optimized - Production Ready (Nov 2, 2025)
- All historical data migrated (378 notes, 513 links)
- Fuzzy search working for all keyword lengths (2-10+ chars)
- Dedicated `/links` command for browsing individual links
- Performance optimized: 50% fewer queries, typing indicators on all commands
- Next: Phase 2-4 deprecation of old system

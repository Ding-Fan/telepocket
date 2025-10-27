# Fuzzy Search & Unified Note System Implementation Plan

**Status**: MVP Complete - Production Ready | **Updated**: 2025-10-26

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

### Next Steps: Testing & Validation

**Manual Testing**: Verify functionality in production
- [ ] Test `/note` with links
- [ ] Test `/note` without links
- [ ] Test `/notes` pagination
- [ ] Test `/notes search` with typos
- [ ] Verify old system still works (send message with links)
- [ ] Test fuzzy matching (e.g., "reactt" finds "react")

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

**Total MVP Effort**: 24 hours (3 days) | **Dependencies**: Supabase access, PostgreSQL permissions

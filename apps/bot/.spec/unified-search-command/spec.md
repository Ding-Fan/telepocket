# Unified Search Command Specification

## Problem & Solution

**Problem**: Users must remember two separate search commands (`/notes search` and `/links search`) and search each system independently, missing potentially relevant results from the other system.

**Solution**: Single `/search <keyword>` command that searches both notes and links simultaneously, merges results by relevance score, and displays them in a unified ranked list.

**Returns**: Mixed paginated results showing both notes (with content + links) and individual links, sorted by relevance score descending.

## Component API

```typescript
interface UnifiedSearchResult {
  type: 'note' | 'link';
  relevance_score: number;
  // For notes
  note_id?: string;
  note_content?: string;
  telegram_message_id?: number;
  created_at?: string;
  links?: Array<{
    id: string;
    url: string;
    title?: string;
    description?: string;
    og_image?: string;
  }>;
  // For links
  link_id?: string;
  url?: string;
  title?: string;
  description?: string;
  og_image?: string;
}

interface UnifiedSearchResponse {
  results: UnifiedSearchResult[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  keyword: string;
  noteCount: number;
  linkCount: number;
}
```

## Usage Example

```typescript
// User command: /search reactt
// (note typo in "reactt")

// Bot searches both systems in parallel
const [noteResults, linkResults] = await Promise.all([
  noteOps.searchNotesWithPagination(userId, 'reactt', 1, 100),
  noteOps.searchLinksOnlyWithPagination(userId, 'reactt', 1, 100)
]);

// Merge and sort by relevance
const merged = mergeSearchResults(noteResults, linkResults);
// Returns: React hooks tutorial (95%), React docs (88%), etc.
```

## Core Flow

```
User sends: /search <keyword>
  ↓
Validate keyword (1-100 chars)
  ↓
Show typing indicator
  ↓
Search BOTH systems in parallel:
  - noteOps.searchNotesWithPagination() → searches note content + link metadata
  - noteOps.searchLinksOnlyWithPagination() → searches link metadata only
  ↓
Merge results from both sources
  ↓
Sort by relevance_score DESC
  ↓
Paginate merged results (10 items per page)
  ↓
Display with type indicators:
  - 📝 Note results (content + links)
  - 🔗 Link-only results (metadata)
  ↓
Pagination buttons (Previous/Next)
```

## User Stories

**US-1: Unified Discovery**
User types `/search job interview`. Bot searches both note content and link metadata simultaneously, returning mixed results: note about "job preparation tips" (📝 95%), saved link to "Interview techniques" article (🔗 88%), note with job posting links (📝 82%), all ranked by relevance in one list.

**US-2: Simplified Command**
User forgets whether they saved content as a note or just a link. Instead of trying both `/notes search` and `/links search`, they use `/search typescript` and immediately see all relevant results from both systems, sorted by best match.

**US-3: Typo-Tolerant Mixed Search**
User searches `/search javascrpt` (typo). Fuzzy matching finds JavaScript notes and links from both systems, merged and ranked by relevance. User sees note content, individual links, and all matching items without caring about the underlying storage type.

## MVP Scope

**Included**:
- `/search <keyword>` command handler
- Parallel execution of note and link searches
- Client-side result merging and sorting
- Type differentiation (📝 notes vs 🔗 links)
- Relevance score display for all results
- Mixed pagination (10 items per page)
- Callback query handling for pagination
- Fuzzy matching (reuses existing DB functions)
- Typing indicator during search
- Empty state handling ("No results found")

**NOT Included** (Future):
- Search filters (type, date, category) → 🔧 Robust
- Result type toggle buttons → 🔧 Robust
- Search history tracking → 🔧 Robust
- Result grouping by type → 🚀 Advanced
- Export search results → 🚀 Advanced
- Saved search queries → 🚀 Advanced

## Database Functions

**Reuses Existing Functions**:
- `search_notes_fuzzy_optimized()` - Searches note content + link metadata
- `search_links_fuzzy_optimized()` - Searches link metadata only
- Both support hybrid search (≤10 chars use LIKE, >10 chars use trigram)
- Both return relevance_score (0-1, normalized to percentage)

**No New Migrations Required** - MVP reuses all existing infrastructure.

## Acceptance Criteria (MVP)

**Functional**:
- [ ] `/search <keyword>` searches both notes and links
- [ ] Results merged and sorted by relevance score (highest first)
- [ ] Both note and link results appear in same list
- [ ] Pagination works correctly for merged results (10 per page)
- [ ] Type indicators distinguish notes (📝) from links (🔗)
- [ ] Empty search term shows usage message
- [ ] No matches shows "No results found" message
- [ ] Fuzzy matching works (typos handled correctly)
- [ ] Parallel search executes without blocking

**UI/UX**:
- [ ] Typing indicator shows during search
- [ ] Note results display content preview + links
- [ ] Link results display title, URL, description
- [ ] Relevance scores shown as percentages
- [ ] Pagination buttons (Previous/Next) work correctly
- [ ] Page indicator shows current/total pages
- [ ] Results scannable at a glance
- [ ] MarkdownV2 formatting correct

**Performance**:
- [ ] Search completes in <1 second for typical queries
- [ ] Parallel execution faster than sequential
- [ ] No duplicate results between note/link searches
- [ ] Pagination handles large result sets efficiently

**Backend**:
- [ ] Keyword validation (1-100 chars)
- [ ] User authorization validated
- [ ] Error handling with user-friendly messages
- [ ] Callback data encoding handles special characters
- [ ] Page bounds validated correctly

## Future Tiers

**🔧 Robust** (+0.5 days): Search filters (type: notes/links/all, date range, category), result type toggle buttons, search history tracking (last 10 searches), keyboard shortcuts for common filters.

**🚀 Advanced** (+1 day): Result grouping UI (separate note/link sections), export search results (CSV/JSON), saved search queries with names, search result analytics dashboard.

---

**Status**: Ready for Implementation | **MVP Effort**: 1 day

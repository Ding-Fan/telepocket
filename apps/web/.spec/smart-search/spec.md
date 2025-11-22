# Smart Search Enhancement Specification

## Problem & Solution

**Problem**: Search page shows only empty search bar with "Type to start searching", providing no entry points for discovery or guidance on available filters/sorts.

**Solution**: Transform empty state into intelligent entry point with quick action chips, recent history, and natural language query parsing that auto-detects filters (categories, dates, content types) from user input.

**Returns**: Enhanced search experience with keyword-based filter detection, visual filter indicators, and URL-shareable search states.

## Component API

```typescript
interface SearchFilters {
  category?: NoteCategory;
  dateRange?: 'today' | 'week' | 'month' | 'recent';
  hasLinks?: boolean;
  hasImages?: boolean;
  isPinned?: boolean;
  sortBy?: 'relevance' | 'newest' | 'oldest' | 'most-viewed';
}

interface ParsedQuery {
  cleanQuery: string; // Query with keywords removed
  filters: SearchFilters;
  detectedKeywords: string[]; // Keywords that triggered filters
}

interface QuickAction {
  label: string;
  emoji: string;
  filters: SearchFilters;
}

interface SearchHistoryItem {
  query: string;
  filters: SearchFilters;
  timestamp: number;
}
```

## Usage Example

```typescript
import { SmartSearchBar } from '@/components/search/SmartSearchBar';
import { parseSearchQuery } from '@/utils/searchParser';

// User types: "recent pinned todos"
const parsed = parseSearchQuery("recent pinned todos");
// Returns: {
//   cleanQuery: "",
//   filters: { category: 'todo', dateRange: 'recent', isPinned: true },
//   detectedKeywords: ['recent', 'pinned', 'todos']
// }

<SmartSearchBar
  value={query}
  onChange={setQuery}
  filters={filters}
  onFiltersChange={setFilters}
  history={searchHistory}
  onHistorySelect={handleHistorySelect}
/>
```

## Core Flow

```
User lands on /search page
  ↓
Show empty state with 6 quick action chips + recent history (if exists)
  ↓
User clicks chip OR types query
  ↓
Parse query for keywords (categories, dates, "pinned", "links", "images")
  ↓
Extract filters → clean query → update URL params
  ↓
Display active filters as removable chips above results
  ↓
Execute hybrid search with filters + cleaned query
  ↓
Save query + filters to LocalStorage history (max 5)
```

## User Stories

**US-1: Empty State Discovery**
User lands on search page and sees 6 quick action chips (Recent Notes, Pinned, TODOs, Ideas, Has Links, Has Images) plus last 5 recent searches. Clicking a chip or history item executes search immediately.

**US-2: Natural Language Query Parsing**
User types "recent pinned todos" and system auto-detects category=todo, dateRange=recent, isPinned=true, showing these as removable filter chips above results. Query is cleaned and passed to hybrid search.

**US-3: Filter Management**
User sees active filters as chips above results (e.g., "Category: Todo 🅧", "Pinned 🅧"). Clicking X removes filter and re-runs search. URL updates to reflect current filter state for sharing.

## MVP Scope

**Included**:
- Keyword detection parser (categories, date ranges, "pinned", "has links", "has images")
- Empty state with 6 quick action chips
- Recent search history (LocalStorage, max 5 items)
- Active filter chips (removable, above results)
- URL parameter sync for shareable search states
- SmartSearchBar component with autocomplete hints
- Date range keywords: "today", "recent", "this week", "last week", "last month"
- Category keywords: "todo"/"todos", "idea"/"ideas", etc.
- Sort keywords: "newest", "oldest", "recent" (maps to newest)

**NOT Included** (Future):
- Command palette integration → 🔧 Robust
- Saved searches / bookmarked queries → 🔧 Robust
- Advanced date parsing ("last 30 days", specific dates) → 🔧 Robust
- ML-based query suggestions → 🚀 Advanced
- Search analytics and user patterns → 🚀 Advanced
- Custom filter preset creation → 🚀 Advanced
- Bulk actions on search results → 🚀 Advanced

## Keyword Detection Rules

**Category Detection** (case-insensitive):
- `todo|todos` → category: 'todo'
- `idea|ideas` → category: 'idea'
- `blog|blogs|article|articles` → category: 'blog'
- `youtube|video|videos` → category: 'youtube'
- `reference|references|doc|docs` → category: 'reference'
- `japanese|日本語` → category: 'japanese'

**Date Range Detection**:
- `today` → dateRange: 'today'
- `recent|latest` → dateRange: 'recent' (last 7 days)
- `this week|week` → dateRange: 'week'
- `last week` → dateRange: 'week' (previous 7 days)
- `this month|month` → dateRange: 'month'

**Content Type Detection**:
- `pinned|pin|marked` → isPinned: true
- `links?|has links?|with links?` → hasLinks: true
- `images?|has images?|with images?|photos?` → hasImages: true

**Sort Detection**:
- `newest|latest|recent` → sortBy: 'newest'
- `oldest` → sortBy: 'oldest'
- `most viewed|popular` → sortBy: 'most-viewed'
- Default: 'relevance' (semantic + fuzzy hybrid)

## Quick Action Chips

1. **Recent Notes** - `{ dateRange: 'recent' }` - 📅
2. **Pinned** - `{ isPinned: true }` - 📌
3. **TODOs** - `{ category: 'todo' }` - 📋
4. **Ideas** - `{ category: 'idea' }` - 💡
5. **Has Links** - `{ hasLinks: true }` - 🔗
6. **Has Images** - `{ hasImages: true }` - 🖼️

## Acceptance Criteria (MVP)

**Functional**:
- [ ] Parser detects all category keywords correctly
- [ ] Parser detects date range keywords correctly
- [ ] Parser detects content type keywords (pinned, links, images)
- [ ] Cleaned query removes detected keywords before search
- [ ] Quick action chips execute search immediately
- [ ] Recent history stores last 5 queries with filters
- [ ] Active filter chips appear above results
- [ ] Removing filter chip re-runs search without that filter
- [ ] URL params sync with current filter state
- [ ] Shareable URLs restore exact search state

**UI/UX**:
- [ ] Empty state shows 6 quick action chips
- [ ] Empty state shows recent history (if exists)
- [ ] Filter chips use consistent styling (removable X button)
- [ ] Active filters have visual distinction from quick actions
- [ ] Parser provides autocomplete hints while typing
- [ ] Smooth transitions when filters change
- [ ] Clear all filters button when multiple active

**Integration**:
- [ ] Uses existing `searchNotesHybrid` API
- [ ] Integrates with existing `useNotesSearch` hook
- [ ] Follows existing component patterns (GlanceCard styling)
- [ ] Uses `@telepocket/shared` for types
- [ ] LocalStorage operations have error handling
- [ ] URL state management preserves browser history

## Future Tiers

**🔧 Robust** (+2-3 days): Command palette integration (Cmd+K global search), saved searches with user naming, advanced date parsing ("last 30 days", "between Jan-Feb"), filter combination UI (AND/OR logic), search tips tooltip.

**🚀 Advanced** (+4-5 days): ML-based query suggestions from user history, search analytics dashboard, pattern detection (common searches), custom filter presets (save as "Work TODOs"), bulk actions (archive/mark all results), export search results.

---

**Status**: Ready for Implementation | **MVP Effort**: 3-4 days

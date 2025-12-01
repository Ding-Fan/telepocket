---
feature: "unified-tag-system"
status: "production"
created: "2024-11-24"
updated: "2024-12-01"
deployed: "2024-12-01"
mvp_effort_hours: 80
mvp_effort_days: 10
priority: "high"
tags: ["tags", "ai-classification", "database", "ui", "migration"]
scope: "monorepo-wide"
packages: ["apps/bot", "apps/web", "packages/shared"]
current_tier: "mvp"
phase_complete: ["phase-1", "phase-2", "phase-3-ui"]
phase_in_progress: []
---

# Unified Tag System Specification

## TL;DR (30-Second Scan)

**Problem**: Hardcoded categories with fixed prompts. Users can't create custom organizational tags.
**Solution**: Unified tag system where ALL tags are user-owned → LLM classifies ANY tag using custom prompts → Same metadata structure for all tags → Clean cutover from categories to tags.
**Status**: ✅ MVP Complete - Deployed to Production (2024-12-01)
**Effort**: MVP 10 days (80h) | +Robust 2 days (16h) | +Advanced 4 days (32h)
**Migration**: No data migration needed - old categories preserved, new notes use tags

---

<details>
<summary>📋 Implementation Status (click to expand)</summary>

### ✅ Completed (2024-12-01)

**Phase 1: Database Foundation**
- ✅ Migration: `20251124123352_create_unified_tag_system_v2.sql`
- ✅ Tables: `z_tags`, `z_note_tags` with proper indexes
- ✅ Tag initialization function: `ensure_user_starter_tags(user_id)`
- ✅ Starter tags auto-created on `/start` command: todo, idea, blog, youtube, reference, japanese
- ✅ Bot integration: `/start` command calls `initializeStarterTags()`
- ✅ Tag name validation: Regex pattern `^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$`
- ✅ Soft delete support: `is_archived` column
- ✅ RLS policies: Service role + public access (for bot operations)

**Phase 2: Auto-Tagging Integration**
- ✅ Migration: `20251201120828_enable_ai_for_starter_tags.sql` - Enabled AI for 6 starter tags
- ✅ AutoTagService integration into bot note save flow (`autoTagNoteAsync()`)
- ✅ Background tagging with `score_prompt` field
- ✅ TagClassifier service using `score_prompt` field
- ✅ Fixed: AutoTagService now filters by `is_ai_enabled = true`
- ✅ Category system deprecated - removed `classifyNoteAsync()`
- ✅ Removed category callback handlers
- ✅ Clean cutover: Old categories preserved (read-only), new notes use tags
- ✅ Deployed to production (bot + web)

**Phase 3: UI Implementation**
- ✅ Tags page: `/apps/web/app/tags/page.tsx`
- ✅ Server actions: `apps/web/actions/tags.ts`
  - `getUserTags()` - Fetch user's tags
  - `createTag()` - Create new tag with validation
  - `updateTag()` - Update existing tag
  - `archiveTag()` - Soft delete
  - `addTagToNote()` / `removeTagFromNote()` - Tag management
  - `confirmNoteTag()` - Confirm AI suggestions
- ✅ Components:
  - `TagList` - Display all tags with filter (All/AI/Manual)
  - `TagCard` - Individual tag display with edit/delete
  - `CreateTagModal` - Create new tag with AI config
  - `EditTagModal` - Edit existing tag
  - `CreateTagButton` - Trigger create modal
- ✅ UI polish: Modern design with improved typography, spacing, colors
- ✅ TypeScript types: `Tag`, `CreateTagInput`, `UpdateTagInput` in `@telepocket/shared`
- ✅ Navigation: AppLayout integration with back button (2025-11-26)
- ✅ Web: Deprecated `confirmNoteCategory()` server action

### 📋 Future Enhancements (Post-MVP)

**Phase 4: Tag Discovery & Search**
- ⏸️ Tag filter in notes list
- ⏸️ Tag autocomplete
- ⏸️ Popular tags widget
- ⏸️ Show tags in note detail view (web)

**Phase 5: Cleanup**
- ⏸️ Drop `z_note_categories` table (after backup)
- ⏸️ Remove unused category database functions
- ⏸️ Delete category type/constant files

### 🔄 Deviations from Original Design

1. **No is_system_tag field** - All tags are user-owned
2. **score_prompt instead of description** - Direct LLM prompt storage
3. **Starter tags per-user** - Created via `ensure_user_starter_tags()` not seeded globally
4. **No tag limits enforced yet** - Soft/hard limits (20/30) not implemented
5. **No similar tag detection** - pg_trgm similarity check not implemented
6. **Simplified RLS** - Public + service_role policies (no user-specific RLS)
7. **Added is_ai_enabled field** - Separates "has prompt" from "AI active" (allows pre-populated prompts with AI disabled by default)

</details>

---

<details>
<summary>🎯 Problem & Solution (click to expand)</summary>

## Problem & Solution

**Problem**: Current category system uses hardcoded categories with fixed prompts. Users cannot create custom organizational tags for personal use cases (work, urgent, projects, etc.). System treats "categories" as a special concept when they're fundamentally just predefined tags.

**Solution**: Unified tag system where ALL tags are user-owned (no system/custom distinction) → LLM can classify ANY tag using custom score prompts → Same metadata structure (confidence, user_confirmed) for all tags → Gradual migration from categories to tags without breaking changes.

**Returns**: Flexible tagging system with AI auto-suggestion for custom tags, user control over tag creation, unified architecture, smooth migration path.

**Key Change from Original Design**: Eliminated `is_system_tag` distinction. All tags are now user-owned, with 6 starter tags automatically created on first `/start` command.

**Important Design Update**: Added `is_ai_enabled` boolean field to separate "has AI prompt" from "AI is active". This allows starter tags to have pre-populated prompts while AI remains disabled by default (user opt-in).

</details>

---

<details>
<summary>💡 Key Insights (click to expand)</summary>

## Key Insights

### LLM Can Classify Custom Tags

**Previous assumption**: LLM can only classify hardcoded categories with specialized prompts.

**Reality**: LLM can score ANY tag dynamically:

```typescript
// Old approach (static)
CATEGORY_PROMPTS = {
  todo: "Score if this is a todo task...",
  idea: "Score if this is an idea..."
}

// New approach (dynamic)
async scoreTag(content: string, tagName: string, tagDescription?: string) {
  const prompt = `
    Does this note relate to the tag "${tagName}"?
    ${tagDescription ? `Tag meaning: ${tagDescription}` : ''}

    Note: "${content}"

    Score 0-100 for relevance.
  `;
  return await callLLM(prompt);
}

// Works for ANY tag!
scoreTag(content, "todo") // ✅ System tag
scoreTag(content, "work-project") // ✅ Custom tag
scoreTag(content, "urgent", "Time-sensitive items needing immediate attention") // ✅ With context
```

**This means**:
- ✅ LLM can auto-suggest custom tags just like system tags
- ✅ Users can train LLM by providing tag descriptions
- ✅ No need for hardcoded prompts per tag
- ✅ Unlimited extensibility

</details>

---

<details>
<summary>🏗️ Database Schema (click to expand)</summary>

## Database Schema

```sql
-- Tag definitions (all user-owned)
CREATE TABLE z_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  tag_name TEXT NOT NULL CHECK (tag_name ~ '^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$'),
  emoji TEXT CHECK (char_length(emoji) <= 10),
  score_prompt TEXT,  -- AI prompt text (can exist even if AI disabled)
  is_ai_enabled BOOLEAN DEFAULT FALSE NOT NULL,  -- Whether AI classification is active

  -- Ownership (every tag has an owner)
  created_by BIGINT NOT NULL,  -- telegram_user_id

  -- Soft delete
  is_archived BOOLEAN DEFAULT FALSE NOT NULL,

  -- AI classification thresholds
  auto_confirm_threshold INT DEFAULT 95 CHECK (auto_confirm_threshold BETWEEN 60 AND 100),
  suggest_threshold INT DEFAULT 60 CHECK (suggest_threshold BETWEEN 0 AND 99),

  -- Usage analytics
  usage_count INT DEFAULT 0 NOT NULL,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CHECK (auto_confirm_threshold > suggest_threshold),
  UNIQUE(created_by, tag_name)  -- User can't have duplicate tag names
);

-- Note-to-tag relationships (replaces z_note_categories)
CREATE TABLE z_note_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES z_notes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES z_tags(id) ON DELETE CASCADE,

  -- Classification metadata
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  user_confirmed BOOLEAN DEFAULT FALSE,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,  -- When user confirmed (if user_confirmed=true)

  UNIQUE(note_id, tag_id)
);

-- Indexes
CREATE INDEX idx_note_tags_note_id ON z_note_tags(note_id);
CREATE INDEX idx_note_tags_tag_id ON z_note_tags(tag_id);
CREATE INDEX idx_note_tags_confirmed ON z_note_tags(user_confirmed) WHERE user_confirmed = TRUE;
CREATE INDEX idx_tags_user ON z_tags(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_tags_name ON z_tags(tag_name);
CREATE INDEX idx_tags_archived ON z_tags(is_archived) WHERE is_archived = FALSE;
```

### RLS Policies

```sql
ALTER TABLE z_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE z_note_tags ENABLE ROW LEVEL SECURITY;

-- Standard policies for z_note_tags (similar to z_note_categories)
CREATE POLICY "Allow all operations on note_tags for service_role"
  ON z_note_tags FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on note_tags for public"
  ON z_note_tags FOR ALL TO public USING (true) WITH CHECK (true);
```

</details>

---

<details>
<summary>📐 TypeScript Interfaces (click to expand)</summary>

## TypeScript Interfaces

```typescript
// packages/shared/src/types.ts

export interface Tag {
  id: string;
  tag_name: string;
  emoji?: string;
  label?: string;
  description?: string;
  is_system_tag: boolean;
  created_by?: number;
  is_archived: boolean;
  llm_enabled: boolean;
  auto_confirm_threshold: number;
  suggest_threshold: number;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NoteTag {
  id: string;
  note_id: string;
  tag_id: string;
  confidence: number;
  user_confirmed: boolean;
  created_at: string;
  confirmed_at?: string;

  // Joined data
  tag?: Tag;
}

export interface TagScore {
  tag_id: string;
  tag_name: string;
  score: number;
  tier: 'definite' | 'high' | 'moderate' | 'low' | 'insufficient';
  action: 'auto-confirm' | 'suggest' | 'skip';
}

export interface CreateTagInput {
  tag_name: string;  // Must match: /^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$/
  emoji?: string;  // Max 10 chars
  label?: string;  // Max 50 chars
  description?: string;  // Max 500 chars
  llm_enabled?: boolean;  // Default: true
}

export interface TagLimitStatus {
  current_count: number;
  soft_limit: number;  // 20
  hard_limit: number;  // 30
  is_at_warning: boolean;  // current >= soft_limit
  is_at_limit: boolean;  // current >= hard_limit
  remaining: number;
}
```

</details>

---

<details>
<summary>🔄 Core Flow (click to expand)</summary>

## Core Flow

### Automatic Tagging on Note Save

```
User sends: "Need to fix login bug tomorrow for work project"
  ↓
Bot saves note → Returns instant "✅ Saved"
  ↓
[Background: AutoTagService.autoTagNote()]
  ↓
Get all tags for user:
  - System: todo, idea, blog, youtube, reference, japanese
  - Custom (user's): work, urgent, bug, project-alpha
  ↓
LLM scores all tags in parallel:
  - todo: 98 (auto-confirm)
  - work: 95 (auto-confirm)
  - bug: 92 (suggest)
  - urgent: 85 (suggest)
  - idea: 12 (skip)
  - blog: 5 (skip)
  ↓
Save to database:
  - INSERT z_note_tags: (noteId, 'todo', confidence=0.98, user_confirmed=TRUE)
  - INSERT z_note_tags: (noteId, 'work', confidence=0.95, user_confirmed=TRUE)
  - INSERT z_note_tags: (noteId, 'bug', confidence=0.92, user_confirmed=FALSE)
  - INSERT z_note_tags: (noteId, 'urgent', confidence=0.85, user_confirmed=FALSE)
  ↓
User can later:
  - View confirmed tags: [📋 Todo] [💼 Work]
  - View suggestions: [🐛 Bug (92)] [⚡ Urgent (85)]
  - Confirm, reject, or add more tags
```

### Manual Tag Creation

```
User viewing note detail page
  ↓
Sees current tags: [📋 Todo] [💡 Idea]
User has 18 custom tags (approaching soft limit)
  ↓
Clicks "Create Custom Tag"
  ↓
Modal appears:
  - Tag name: [work-project_____]
    ℹ️ Lowercase letters, numbers, hyphens, underscores (2-30 chars)
  - Emoji (optional): [💼___]
  - Description (optional): [Professional work items, meetings___]
    💡 Adding a description helps AI classify better
  - Enable AI suggestions: [✓] (checkbox)
  ⚠️ You have 18/20 tags (2 remaining before warning)
  ↓
User types "work-project"
  ↓
System checks for similar tags:
  - find_similar_tags(userId, 'work-project') returns:
    • 'work' (similarity 0.67)
    • 'project' (similarity 0.65)
  ↓
Warning shown:
  ⚠️ Similar tags found: "work", "project"
  Continue anyway? [Yes] [No]
  ↓
User confirms → Submits
  ↓
Server action: createTag()
  - Validate tag name format (regex check)
  - Check tag limit (18 < 30, OK)
  - Check duplicates (unique constraint)
  - INSERT INTO z_tags (tag_name='work-project', emoji='💼', ...)
  - Returns new tag ID
  ↓
Tag added to note:
  - INSERT INTO z_note_tags (note_id, tag_id, confidence=1.0, user_confirmed=TRUE)
  ↓
Tag now available:
  - For this note
  - For future notes (LLM can auto-suggest it)
  - In tag filter/search
```

</details>

---

<details>
<summary>📖 User Stories (click to expand)</summary>

## User Stories

**US-1: Custom Tag Creation**
User has work-related notes. Current categories don't fit. User creates custom tag "work" with emoji 💼 and description "Professional work items". LLM immediately starts auto-tagging work-related notes. User now has organized work notes.

**US-2: Project-Specific Tags**
User manages multiple projects. Creates tags "project-alpha" and "project-beta". Enables AI suggestions for both. LLM learns to detect project context from note content. User can filter notes by project.

**US-3: Priority Tags**
User wants urgency tracking. Creates tags "urgent", "important", "someday". Provides descriptions to help LLM classify. Future notes get auto-tagged based on urgency keywords. User can filter by priority.

**US-4: Tag Discovery**
User sends note "Meeting with client tomorrow about logo redesign". LLM auto-tags: "todo" (98%), "work" (95%), "meeting" (92%). User sees suggestions, confirms "meeting" tag. Realizes meetings should be tracked. Keeps using "meeting" tag.

**US-5: Tag Refinement**
User created tag "work" but realizes it's too broad. Creates specific tags "work-meeting", "work-deadline", "work-idea". Edits old notes to replace generic "work" with specific tags. Better organization emerges.

**US-6: Migration from Categories**
Existing user has 1,000 notes with categories (todo, idea, etc.). System automatically migrates to tags in background. User sees same tags, no disruption. Can now create custom tags. Seamless transition.

</details>

---

<details>
<summary>✅ MVP Scope (click to expand)</summary>

## MVP Scope

**Phase 1: Foundation (Week 1-2)** ✅ COMPLETE
- [x] Database schema: z_tags, z_note_tags with constraints
- [ ] Database: Tag limit enforcement trigger (soft 20, hard 30) - DEFERRED
- [ ] Database: Similar tag detection function (pg_trgm) - DEFERRED
- [x] Database: Soft delete support (is_archived column)
- [x] Database: Tag name validation (lowercase, alphanumeric + hyphens/underscores, 2-30 chars)
- [x] Migration: Auto-create 6 starter tags per user (via `ensure_user_starter_tags()`)
- [ ] Migration: Enable pg_trgm extension - DEFERRED
- [ ] TagClassifier: Dynamic tag scoring (packages/shared) - IN PROGRESS
- [ ] AutoTagService: Auto-tagging with custom tags (packages/shared) - IN PROGRESS
- [x] Server actions: createTag, addTagToNote, removeTagFromNote, archiveTag, updateTag, confirmTag
- [x] Update types in packages/shared (Tag, CreateTagInput, UpdateTagInput)
- [x] Tag initialization function: tagInitializer.ts (packages/shared)
- [ ] Tag validation utilities in shared (validateTagName, checkSimilarTags) - DEFERRED

**Phase 2: Auto-Tagging (Week 2-3)** 🚧 IN PROGRESS
- [ ] Integrate AutoTagService into note save flow
- [ ] Background tagging for new notes
- [ ] Dual-write: Write to both z_note_categories AND z_note_tags
- [ ] Bot: Auto-tag notes on Telegram message receive
- [ ] Web: Show both categories and tags during transition
- [ ] Update starter tags with score_prompts

**Phase 3: Manual Tag Management (Week 3-4)** ✅ COMPLETE (UI ahead of schedule)
- [x] UI: Tags management page (/tags)
- [x] UI: Tag creation modal with AI configuration
- [x] UI: Tag edit modal
- [x] UI: Tag list with filter (All/AI Tags/Manual Tags)
- [x] UI: Tag card with edit/delete actions
- [x] UI: Tag removal (archive functionality)
- [x] Server action: confirmTag (UPSERT pattern)
- [ ] UI: Tag selection in note detail page - PENDING
- [ ] UI: Tag suggestions (score 60-94) with confirm/reject - PENDING

**Phase 4: Tag Discovery & Search (Week 4-5)**
- [ ] UI: Tag filter in notes list
- [ ] UI: Tag autocomplete in search
- [ ] UI: Popular tags widget
- [ ] Server: Tag search/filter endpoints
- [ ] Analytics: Track tag usage

**Phase 5: Migration (Week 5-6)**
- [ ] Background job: Migrate z_note_categories → z_note_tags
- [ ] Verification: Ensure data integrity
- [ ] Switch: Read from z_note_tags instead of z_note_categories
- [ ] Deprecation: Stop writing to z_note_categories
- [ ] Cleanup: Drop z_note_categories table (after 30-day safety period)

**NOT Included** (Future Tiers):
- Tag editing (rename, merge, delete) → ✅ COMPLETE
- Tag management page (/tags) → ✅ COMPLETE
- Tag hierarchies (parent-child relationships) → 🚀 Advanced
- Tag analytics dashboard → 🚀 Advanced
- Team/shared tags → 🚀 Advanced
- Tag import/export → 🚀 Advanced

</details>

---

<details>
<summary>🚀 Migration Strategy (click to expand)</summary>

## Migration Strategy

### Dual-Write Period (2-4 weeks)

```typescript
// During transition: Write to BOTH systems
async function saveNoteWithTags(note: Note, content: string, urls: string[]) {
  // 1. Save note
  const noteId = await saveNote(note);

  // 2. Auto-tag (new system)
  const { autoConfirmed, suggested } = await autoTagService.autoTagNote(
    noteId, content, urls, note.telegram_user_id, db
  );

  // 3. ALSO write to old category system (for rollback safety)
  for (const tag of autoConfirmed) {
    // Map system tags to old categories
    if (isSystemTag(tag.tag_name)) {
      await dbOps.addNoteCategory(
        noteId,
        tag.tag_name as NoteCategory,
        tag.score / 100,
        true
      );
    }
  }

  return noteId;
}
```

### Background Migration

```sql
-- Migration script: Copy all category data to tags
INSERT INTO z_note_tags (note_id, tag_id, confidence, user_confirmed, created_at)
SELECT
  nc.note_id,
  t.id as tag_id,
  nc.confidence,
  nc.user_confirmed,
  nc.created_at
FROM z_note_categories nc
JOIN z_tags t ON t.tag_name = nc.category AND t.is_system_tag = TRUE
ON CONFLICT (note_id, tag_id) DO NOTHING;  -- Skip duplicates from dual-write

-- Verify migration
SELECT
  (SELECT COUNT(*) FROM z_note_categories) as old_count,
  (SELECT COUNT(*) FROM z_note_tags WHERE tag_id IN (SELECT id FROM z_tags WHERE is_system_tag = TRUE)) as new_count;
-- Should match!
```

### Rollback Plan

```typescript
// If issues arise, revert to categories
async function rollbackToCategories() {
  // 1. Stop writing to z_note_tags
  config.useTagSystem = false;

  // 2. Verify z_note_categories still has all data
  const categoryCount = await db.count('z_note_categories');
  const tagCount = await db.count('z_note_tags WHERE is_system_tag');

  if (categoryCount >= tagCount) {
    console.log('✅ Rollback safe: Category data intact');
  } else {
    console.error('⚠️ Data loss detected! Manual intervention needed');
  }

  // 3. Switch UI back to categories
  // z_note_categories table still exists, no data loss
}
```

</details>

---

<details>
<summary>⚡ Performance & Cost (click to expand)</summary>

## Performance & Cost

### Database Performance

**Queries:**
```sql
-- Get all tags for a note (optimized)
SELECT t.*, nt.confidence, nt.user_confirmed
FROM z_note_tags nt
JOIN z_tags t ON t.id = nt.tag_id
WHERE nt.note_id = $1;

-- Index: idx_note_tags_note_id
-- Expected: <5ms for 10 tags

-- Find notes by tag (optimized)
SELECT n.*
FROM z_notes n
JOIN z_note_tags nt ON nt.note_id = n.id
WHERE nt.tag_id = $1 AND nt.user_confirmed = TRUE
ORDER BY n.created_at DESC
LIMIT 20;

-- Index: idx_note_tags_tag_id + idx_note_tags_confirmed
-- Expected: <10ms for 1000 notes
```

### LLM Cost Analysis

**System tags only (current):**
- 6 tags × $0.00011 = $0.00066 per note

**System + custom tags (typical user):**
- User has 6 system + 10 custom = 16 tags total
- 16 tags × $0.00011 = $0.00176 per note
- 1,000 notes/month = **$1.76/month**

**Power user at soft limit (20 custom tags):**
- 6 system + 20 custom = 26 tags total
- 26 tags × $0.00011 = $0.00286 per note
- 1,000 notes/month = **$2.86/month**

**Power user at hard limit (30 custom tags):**
- 6 system + 30 custom = 36 tags total
- 36 tags × $0.00011 = $0.00396 per note
- 1,000 notes/month = **$3.96/month**

**Cost control mechanisms:**
- Soft limit at 20 tags (UI warning)
- Hard limit at 30 tags (database enforced)
- Only score tags with `llm_enabled=TRUE`
- User can disable AI for rarely-used tags
- User can archive unused tags
- Cache tag scores for similar content (future)

### Storage

**Per note with 5 tags:**
- z_note_tags: 5 rows × ~100 bytes = 500 bytes
- Negligible compared to note content

**100,000 notes:**
- Average 5 tags/note = 500,000 tag relationships
- ~50 MB total (very small)

</details>

---

<details>
<summary>🎯 Acceptance Criteria (click to expand)</summary>

## Acceptance Criteria

### Phase 1: Foundation
- [x] z_tags table created with proper indexes and constraints
- [x] z_note_tags table created with proper constraints
- [x] Tag name validation enforced at database level
- [ ] Tag limit trigger enforces 30 tag maximum per user - DEFERRED
- [ ] Similar tag detection function works (pg_trgm similarity) - DEFERRED
- [x] Soft delete (is_archived) implemented
- [x] 6 starter tags initialized per user
- [ ] TagClassifier can score any tag dynamically - IN PROGRESS
- [ ] AutoTagService works with both system and custom tags - IN PROGRESS
- [ ] Tag validation utilities (validateTagName, checkSimilarTags) - DEFERRED
- [ ] TagLimitStatus tracking and enforcement - DEFERRED

### Phase 2: Auto-Tagging
- [ ] New notes get auto-tagged on save
- [ ] Dual-write to both categories and tags
- [ ] No performance regression in save operation
- [ ] LLM scores custom tags same as system tags
- [ ] Background processing doesn't block user
- [ ] Error handling for LLM failures

### Phase 3: Manual Tag Management
- [x] Users can create custom tags
- [x] Tag creation validates unique names
- [x] Users can add tags to notes manually
- [x] Users can remove tags from notes
- [ ] Tag suggestions shown with scores - PENDING
- [ ] Confirmed vs suggested tags visually distinct - PENDING

### Phase 4: Tag Discovery
- [ ] Tag filter works in notes list
- [ ] Tag autocomplete in search
- [ ] Popular tags displayed
- [ ] Tag counts accurate
- [ ] Performance: Tag queries <100ms

### Phase 5: Migration
- [ ] All category data migrated to tags
- [ ] Data integrity verified (counts match)
- [ ] UI switched to tags
- [ ] No user-facing disruption
- [ ] Old table safely removed after verification period

</details>

---

## Future Tiers

**🔧 Robust** (+16h): Tag analytics dashboard showing usage over time, bulk tag operations (add/remove tag from multiple notes), tag merging to combine duplicates, enhanced tag editing features.

**🚀 Advanced** (+32h): Tag hierarchies with parent-child relationships, tag suggestions based on user history, tag synonyms with auto-merge, team/shared tags across organization, tag import/export (JSON, CSV), tag-based notifications, tag color customization, smart tag cleanup suggestions.

---

**Quick Links**: [dev-log.md](./dev-log.md) | [tasks.md](./tasks.md) | [backlog.md](./backlog.md)

**References**:
- [LLM Note Classification Spec](../../bot/.spec/llm-note-classification/spec.md)
- [Auto-Classification & Embedding Spec](../../bot/.spec/auto-classification-embedding/spec.md)
- [Tag System UX Best Practices](https://medium.com/geekculture/optimized-note-taking-9d663eec898c)
- [Tag Database Design](https://www.geeksforgeeks.org/dbms/how-to-design-a-database-for-tagging-service/)

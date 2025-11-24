# Unified Tag System Specification

## Problem & Solution

**Problem**: Current category system uses hardcoded categories with fixed prompts. Users cannot create custom organizational tags for personal use cases (work, urgent, projects, etc.). System treats "categories" as a special concept when they're fundamentally just predefined tags.

**Solution**: Unified tag system where both system-defined tags (todo, idea, blog, etc.) and user-defined tags (work, urgent, project-alpha, etc.) share the same infrastructure → LLM can classify ANY tag dynamically using flexible prompts → Same metadata structure (confidence, user_confirmed) for all tags → Gradual migration from categories to tags without breaking changes.

**Returns**: Flexible tagging system with AI auto-suggestion for both predefined and custom tags, user control over tag creation, unified architecture, smooth migration path.

## Design Decisions

**Tag Limits**: Soft limit of 20 tags per user (warning at 20, hard limit at 30) to control LLM costs while allowing flexibility for power users.

**Tag Descriptions**: Optional but recommended. UI shows hint: "Adding a description helps AI classify better".

**Tag Creation UI**: Modal in note detail page (Phase 3) - natural workflow where user creates tags while viewing notes. Dedicated tag management page comes later (Robust tier).

**Migration Timing**: Start Phase 1 immediately (non-breaking foundation), then gradual migration over 5-6 weeks.

**Tag Privacy**: Private tags only (MVP). Each user has their own custom tags. Team/shared tags deferred to Robust/Advanced tiers.

**Dual-Write Duration**: 4 weeks for safety, data consistency verification, and user testing before cutover.

**Tag Deletion**: Soft delete (archived) rather than hard delete - preserves historical data and allows rollback.

**Tag Name Validation**: Lowercase, alphanumeric + hyphens/underscores only, max 30 characters. Duplicate detection warns about similar names.

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

## Component API

### Server Actions (Example Implementation)

```typescript
// apps/web/actions/tags.ts

import { createClient } from '@/lib/supabase/server';

const TAG_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$/;

export async function createTag(input: CreateTagInput, userId: number) {
  // 1. Validate tag name format
  if (!TAG_NAME_REGEX.test(input.tag_name)) {
    return {
      success: false,
      error: 'Invalid tag name. Use lowercase letters, numbers, hyphens, underscores (2-30 chars)'
    };
  }

  const supabase = createClient();

  // 2. Check for similar tags (warning only, not blocking)
  const { data: similarTags } = await supabase.rpc('find_similar_tags', {
    user_id: userId,
    tag_name: input.tag_name
  });

  // 3. Check current tag count and limits
  const { data: tagCount } = await supabase
    .from('z_tags')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
    .eq('is_system_tag', false)
    .eq('is_archived', false);

  const currentCount = tagCount || 0;

  if (currentCount >= 30) {
    return {
      success: false,
      error: 'Tag limit reached. Maximum 30 custom tags allowed. Consider archiving unused tags.',
      limit_status: {
        current_count: currentCount,
        soft_limit: 20,
        hard_limit: 30,
        is_at_warning: true,
        is_at_limit: true,
        remaining: 0
      }
    };
  }

  // 4. Create tag
  const { data: newTag, error } = await supabase
    .from('z_tags')
    .insert({
      tag_name: input.tag_name,
      emoji: input.emoji,
      label: input.label || capitalizeFirst(input.tag_name),
      description: input.description,
      llm_enabled: input.llm_enabled ?? true,
      created_by: userId
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: error.message.includes('duplicate')
        ? 'Tag already exists'
        : 'Failed to create tag'
    };
  }

  return {
    success: true,
    tag: newTag,
    similar_tags: similarTags,
    limit_status: {
      current_count: currentCount + 1,
      soft_limit: 20,
      hard_limit: 30,
      is_at_warning: currentCount + 1 >= 20,
      is_at_limit: currentCount + 1 >= 30,
      remaining: 30 - (currentCount + 1)
    }
  };
}

export async function archiveTag(tagId: string, userId: number) {
  const supabase = createClient();

  const { error } = await supabase
    .from('z_tags')
    .update({ is_archived: true })
    .eq('id', tagId)
    .eq('created_by', userId)
    .eq('is_system_tag', false);

  return { success: !error, error: error?.message };
}
```

### Database Schema

```sql
-- Enable pg_trgm extension for similar tag detection
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tag definitions (system + user-created)
CREATE TABLE z_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT UNIQUE NOT NULL
    CHECK (tag_name ~ '^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$'),  -- Lowercase, alphanumeric + hyphens/underscores, 2-30 chars

  -- Display metadata
  emoji TEXT CHECK (char_length(emoji) <= 10),  -- '📋' for system tags, NULL or user-chosen for custom
  label TEXT CHECK (char_length(label) <= 50),  -- 'Todo' for system tags, capitalized tag_name for custom
  description TEXT CHECK (char_length(description) <= 500),  -- Optional: helps LLM classify better

  -- Tag type and ownership
  is_system_tag BOOLEAN DEFAULT FALSE,
  created_by BIGINT,  -- telegram_user_id, NULL for system tags
  is_archived BOOLEAN DEFAULT FALSE,  -- Soft delete

  -- LLM auto-classification settings
  llm_enabled BOOLEAN DEFAULT TRUE,
  auto_confirm_threshold INT DEFAULT 95 CHECK (auto_confirm_threshold BETWEEN 60 AND 100),
  suggest_threshold INT DEFAULT 60 CHECK (suggest_threshold BETWEEN 0 AND 99),

  -- Usage analytics
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (is_system_tag = TRUE OR created_by IS NOT NULL),  -- Custom tags must have owner
  CHECK (auto_confirm_threshold > suggest_threshold)  -- Auto-confirm must be higher than suggest
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
CREATE INDEX idx_tags_system ON z_tags(is_system_tag);
CREATE INDEX idx_tags_user ON z_tags(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_tags_name ON z_tags(tag_name);
CREATE INDEX idx_tags_archived ON z_tags(is_archived) WHERE is_archived = FALSE;

-- RLS Policies
ALTER TABLE z_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE z_note_tags ENABLE ROW LEVEL SECURITY;

-- Users can see system tags + their own custom tags (exclude archived)
CREATE POLICY "Users can view system and own tags"
  ON z_tags FOR SELECT
  USING (
    is_archived = FALSE AND
    (is_system_tag = TRUE OR created_by = current_setting('app.user_id')::bigint)
  );

-- Users can create their own tags (enforced by trigger for limits)
CREATE POLICY "Users can create own tags"
  ON z_tags FOR INSERT
  WITH CHECK (created_by = current_setting('app.user_id')::bigint);

-- Users can update their own tags (not system tags)
CREATE POLICY "Users can update own tags"
  ON z_tags FOR UPDATE
  USING (is_system_tag = FALSE AND created_by = current_setting('app.user_id')::bigint)
  WITH CHECK (is_system_tag = FALSE AND created_by = current_setting('app.user_id')::bigint);

-- Standard policies for z_note_tags (similar to z_note_categories)
CREATE POLICY "Allow all operations on note_tags for service_role"
  ON z_note_tags FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on note_tags for public"
  ON z_note_tags FOR ALL TO public USING (true) WITH CHECK (true);

-- Trigger: Enforce tag limits (soft 20, hard 30)
CREATE OR REPLACE FUNCTION check_user_tag_limit()
RETURNS TRIGGER AS $$
DECLARE
  tag_count INT;
BEGIN
  -- Only check for custom tags (not system tags)
  IF NEW.is_system_tag = FALSE THEN
    SELECT COUNT(*) INTO tag_count
    FROM z_tags
    WHERE created_by = NEW.created_by
      AND is_system_tag = FALSE
      AND is_archived = FALSE;

    -- Hard limit: 30 tags
    IF tag_count >= 30 THEN
      RAISE EXCEPTION 'Tag limit reached. Maximum 30 custom tags allowed. Consider archiving unused tags.';
    END IF;

    -- Soft limit warning is handled in application layer (UI shows warning at 20)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_tag_limit
  BEFORE INSERT ON z_tags
  FOR EACH ROW
  EXECUTE FUNCTION check_user_tag_limit();

-- Function: Check for similar tag names (duplicate detection)
CREATE OR REPLACE FUNCTION find_similar_tags(
  user_id BIGINT,
  tag_name TEXT
) RETURNS TABLE(similar_tag TEXT, similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    z_tags.tag_name,
    similarity(z_tags.tag_name, find_similar_tags.tag_name) as sim
  FROM z_tags
  WHERE z_tags.created_by = user_id
    AND z_tags.is_archived = FALSE
    AND z_tags.tag_name != find_similar_tags.tag_name
    AND similarity(z_tags.tag_name, find_similar_tags.tag_name) > 0.5
  ORDER BY sim DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- Seed system tags
INSERT INTO z_tags (tag_name, emoji, label, is_system_tag, llm_enabled) VALUES
  ('todo', '📋', 'Todo', TRUE, TRUE),
  ('idea', '💡', 'Idea', TRUE, TRUE),
  ('blog', '📝', 'Blog', TRUE, TRUE),
  ('youtube', '📺', 'YouTube', TRUE, TRUE),
  ('reference', '📚', 'Reference', TRUE, TRUE),
  ('japanese', '🇯🇵', 'Japanese', TRUE, TRUE);
```

### TypeScript Interfaces

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

### Tag Classifier Service

```typescript
// packages/shared/src/tagClassifier.ts

export class TagClassifier {
  private llmProvider: LLMProvider;
  private rateLimiter: RateLimiter;

  /**
   * Score a single tag against note content
   * Works for both system and custom tags
   */
  async scoreTag(
    content: string,
    tag: { name: string; description?: string },
    urls?: string[]
  ): Promise<number> {
    const prompt = this.buildDynamicPrompt(tag.name, tag.description, content, urls);

    await this.rateLimiter.waitAndConsume(1);

    const response = await this.llmProvider.call(prompt);
    const score = parseInt(response.trim(), 10) || 0;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score multiple tags in parallel
   */
  async scoreTags(
    content: string,
    tags: Array<{ id: string; name: string; description?: string; threshold: number }>,
    urls?: string[]
  ): Promise<TagScore[]> {
    const scorePromises = tags.map(async (tag) => {
      const score = await this.scoreTag(
        content,
        { name: tag.name, description: tag.description },
        urls
      );

      return {
        tag_id: tag.id,
        tag_name: tag.name,
        score,
        tier: this.getTier(score),
        action: this.getAction(score, tag.threshold)
      };
    });

    const scores = await Promise.all(scorePromises);
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Build dynamic prompt for any tag
   */
  private buildDynamicPrompt(
    tagName: string,
    tagDescription: string | undefined,
    content: string,
    urls?: string[]
  ): string {
    const urlSection = urls && urls.length > 0
      ? `URLs in note: ${urls.join(', ')}\n\n`
      : '';

    const descriptionSection = tagDescription
      ? `Tag "${tagName}" meaning: ${tagDescription}\n\n`
      : '';

    return `
You are analyzing if a note relates to the tag "${tagName}".

${descriptionSection}${urlSection}Note content:
"""
${content}
"""

Score 0-100 based on how well this note matches the tag "${tagName}":
- 95-100: Definitely matches (explicit mention or clear intent)
- 85-94: High relevance (strong thematic connection)
- 70-84: Moderate relevance (partial match)
- 60-69: Low relevance (tangential connection)
- 0-59: Not relevant (no meaningful connection)

Return ONLY an integer 0-100. No explanation.
    `.trim();
  }

  private getTier(score: number): TagScore['tier'] {
    if (score >= 95) return 'definite';
    if (score >= 85) return 'high';
    if (score >= 70) return 'moderate';
    if (score >= 60) return 'low';
    return 'insufficient';
  }

  private getAction(score: number, threshold: number): TagScore['action'] {
    if (score >= threshold) return 'auto-confirm';
    if (score >= 60) return 'suggest';
    return 'skip';
  }
}
```

### Auto-Tag Service

```typescript
// packages/shared/src/autoTagService.ts

export class AutoTagService {
  private tagClassifier: TagClassifier;

  /**
   * Automatically tag a note with relevant tags
   */
  async autoTagNote(
    noteId: string,
    content: string,
    urls: string[],
    userId: number,
    db: DatabaseAdapter
  ): Promise<{ autoConfirmed: TagScore[]; suggested: TagScore[] }> {
    // Skip trivial content
    if (content.trim().length < 20) {
      return { autoConfirmed: [], suggested: [] };
    }

    // 1. Get all LLM-enabled tags (system + user's custom tags)
    const tags = await this.getTagsForClassification(userId, db);

    // 2. Score all tags in parallel
    const scores = await this.tagClassifier.scoreTags(
      content,
      tags.map(t => ({
        id: t.id,
        name: t.tag_name,
        description: t.description,
        threshold: t.auto_confirm_threshold
      })),
      urls
    );

    // 3. Separate into auto-confirmed and suggested
    const autoConfirmed = scores.filter(s => s.action === 'auto-confirm');
    const suggested = scores.filter(s => s.action === 'suggest');

    // 4. Save auto-confirmed tags
    for (const score of autoConfirmed) {
      await db.addTagToNote(noteId, score.tag_id, {
        confidence: score.score / 100,
        user_confirmed: true
      });
    }

    // 5. Save suggested tags (user_confirmed=false)
    for (const score of suggested) {
      await db.addTagToNote(noteId, score.tag_id, {
        confidence: score.score / 100,
        user_confirmed: false
      });
    }

    return { autoConfirmed, suggested };
  }

  private async getTagsForClassification(
    userId: number,
    db: DatabaseAdapter
  ): Promise<Tag[]> {
    // Get system tags + user's custom tags where llm_enabled=true (exclude archived)
    return db.query(`
      SELECT * FROM z_tags
      WHERE llm_enabled = TRUE
      AND is_archived = FALSE
      AND (is_system_tag = TRUE OR created_by = $1)
      ORDER BY is_system_tag DESC, usage_count DESC
    `, [userId]);
  }
}
```

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

--- VALIDATION EXAMPLES ---

✅ Valid tag names:
  - "work"
  - "urgent"
  - "project-alpha"
  - "bug-fix"
  - "work_ideas"
  - "q1-2025"

❌ Invalid tag names:
  - "Work" (uppercase not allowed)
  - "work project" (spaces not allowed)
  - "work.idea" (dots not allowed)
  - "w" (too short, min 2 chars)
  - "this-is-a-very-long-tag-name-that-exceeds-limit" (too long, max 30)
  - "-work" (can't start with hyphen)
  - "work_" (can't end with underscore)
```

### Tag Management Page (Future)

```
User navigates to /tags
  ↓
Sees all their tags:

System Tags:
  [📋 Todo - 145 notes]
  [💡 Idea - 89 notes]
  [📝 Blog - 34 notes]
  ...

Custom Tags:
  [💼 Work - 67 notes] [Edit] [Delete]
  [⚡ Urgent - 23 notes] [Edit] [Delete]
  [🐛 Bug - 12 notes] [Edit] [Delete]

Actions:
  - Edit tag (name, emoji, description)
  - Delete tag (remove from all notes)
  - Merge tags (combine duplicates)
  - Enable/disable AI suggestions
```

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

## MVP Scope

**Phase 1: Foundation (Week 1-2)**
- [ ] Database schema: z_tags, z_note_tags with constraints
- [ ] Database: Tag limit enforcement trigger (soft 20, hard 30)
- [ ] Database: Similar tag detection function (pg_trgm)
- [ ] Database: Soft delete support (is_archived column)
- [ ] Database: Tag name validation (lowercase, alphanumeric + hyphens/underscores, 2-30 chars)
- [ ] Migration: Seed 6 system tags
- [ ] Migration: Enable pg_trgm extension
- [ ] TagClassifier: Dynamic tag scoring (packages/shared)
- [ ] AutoTagService: Auto-tagging with custom tags (packages/shared)
- [ ] Server actions: createTag, addTagToNote, removeTagFromNote, archiveTag
- [ ] Update types in packages/shared (Tag, NoteTag, TagScore, CreateTagInput, TagLimitStatus)
- [ ] Tag validation utilities in shared (validateTagName, checkSimilarTags)

**Phase 2: Auto-Tagging (Week 2-3)**
- [ ] Integrate AutoTagService into note save flow
- [ ] Background tagging for new notes
- [ ] Dual-write: Write to both z_note_categories AND z_note_tags
- [ ] Bot: Auto-tag notes on Telegram message receive
- [ ] Web: Show both categories and tags during transition

**Phase 3: Manual Tag Management (Week 3-4)**
- [ ] UI: Tag creation modal in note detail page
- [ ] UI: Tag selection (system + custom tags)
- [ ] UI: Tag suggestions (score 60-94) with confirm/reject
- [ ] UI: Tag removal
- [ ] Server action: confirmTag (UPSERT pattern)

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
- Tag management page (/tags) → 🔧 Robust
- Tag editing (rename, merge, delete) → 🔧 Robust
- Tag hierarchies (parent-child relationships) → 🚀 Advanced
- Tag analytics dashboard → 🚀 Advanced
- Team/shared tags → 🚀 Advanced
- Tag import/export → 🚀 Advanced

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

## Acceptance Criteria

### Phase 1: Foundation
- [ ] pg_trgm extension enabled
- [ ] z_tags table created with proper indexes and constraints
- [ ] z_note_tags table created with proper constraints
- [ ] Tag name validation enforced at database level
- [ ] Tag limit trigger enforces 30 tag maximum per user
- [ ] Similar tag detection function works (pg_trgm similarity)
- [ ] Soft delete (is_archived) implemented
- [ ] 6 system tags seeded successfully
- [ ] TagClassifier can score any tag dynamically
- [ ] AutoTagService works with both system and custom tags
- [ ] Tag validation utilities (validateTagName, checkSimilarTags)
- [ ] TagLimitStatus tracking and enforcement
- [ ] Unit tests for TagClassifier
- [ ] Unit tests for AutoTagService
- [ ] Unit tests for tag validation

### Phase 2: Auto-Tagging
- [ ] New notes get auto-tagged on save
- [ ] Dual-write to both categories and tags
- [ ] No performance regression in save operation
- [ ] LLM scores custom tags same as system tags
- [ ] Background processing doesn't block user
- [ ] Error handling for LLM failures

### Phase 3: Manual Tag Management
- [ ] Users can create custom tags
- [ ] Tag creation validates unique names
- [ ] Users can add tags to notes manually
- [ ] Users can remove tags from notes
- [ ] Tag suggestions shown with scores
- [ ] Confirmed vs suggested tags visually distinct

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

## Future Enhancements

**🔧 Robust** (+15h):
- Tag management page (/tags)
- Tag editing (rename, emoji, description)
- Tag merging (combine duplicates)
- Tag deletion (bulk remove from notes)
- Tag analytics (usage over time)
- Bulk tag operations (add/remove tag from multiple notes)

**🚀 Advanced** (+30h):
- Tag hierarchies (parent-child, e.g., "work" → "work-meeting", "work-deadline")
- Tag suggestions based on user history
- Tag synonyms (auto-merge similar tags)
- Tag import/export (JSON, CSV)
- Team tags (shared across organization)
- Tag-based notifications
- Tag color customization
- Smart tag cleanup (suggest merging low-usage tags)

---

**Status**: 📋 Planned | **Target**: Q1 2025

**Dependencies**:
- Current category system (z_note_categories)
- LLM classification infrastructure
- AutoClassifyService (packages/shared)
- Web UI components (note detail page)

**Success Metrics**:
- 80%+ users create at least 1 custom tag within first month
- Average 3-5 custom tags per user
- 90%+ tag classification accuracy (user confirms AI suggestions)
- Zero data loss during migration
- <100ms tag query performance

**Key Decisions**:
1. ✅ Tags are separate from categories (new tables z_tags, z_note_tags)
2. ✅ LLM can classify custom tags dynamically (no hardcoded prompts needed)
3. ✅ Gradual migration (dual-write → switch reads → deprecate over 4 weeks)
4. ✅ System tags remain predefined (can't be deleted or archived)
5. ✅ User tags are private (not shared between users in MVP)
6. ✅ Tag limits: Soft limit 20 (warning), hard limit 30 (database enforced)
7. ✅ Tag descriptions: Optional but recommended for better LLM classification
8. ✅ Tag deletion: Soft delete (archived) preserves data integrity
9. ✅ Tag validation: Lowercase alphanumeric + hyphens/underscores, 2-30 chars
10. ✅ Duplicate detection: pg_trgm similarity warns about similar tag names

**References**:
- [LLM Note Classification Spec](../../bot/.spec/llm-note-classification/spec.md)
- [Auto-Classification & Embedding Spec](../../bot/.spec/auto-classification-embedding/spec.md)
- [Tag System UX Best Practices](https://medium.com/geekculture/optimized-note-taking-9d663eec898c)
- [Tag Database Design](https://www.geeksforgeeks.org/dbms/how-to-design-a-database-for-tagging-service/)

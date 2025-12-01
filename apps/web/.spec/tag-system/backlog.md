# Unified Tag System Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

### Tag Limit Enforcement (Deferred from MVP)
**Priority**: Medium
**Effort**: 4h
**Description**: Implement soft limit (20 tags) with UI warning and hard limit (30 tags) with database trigger. Prevents LLM cost explosion while allowing power users flexibility.
**Rationale**: Deferred to focus on core functionality first. Can add later when user adoption shows need.

### Similar Tag Detection (Deferred from MVP)
**Priority**: Medium
**Effort**: 6h
**Description**: Use pg_trgm extension to detect similar tag names and warn users before creation (e.g., "work" vs "work-project" similarity 0.67).
**Rationale**: Helps prevent duplicate/redundant tags, but not critical for initial launch. Requires pg_trgm extension setup.

### Tag Validation Utilities
**Priority**: Low
**Effort**: 3h
**Description**: Shared validation utilities (`validateTagName`, `checkSimilarTags`) in packages/shared for consistency across bot and web.
**Rationale**: Currently validation happens at multiple levels (DB constraint, server action). Utilities would centralize logic.

---

## 💡 Feature Ideas

New features or enhancements to consider.

### Tag Import/Export
**Priority**: Low
**Effort**: 8h
**Description**: Allow users to export tags to JSON/CSV and import them back. Useful for backup, migration, or sharing tag definitions.
**Use Case**: Power users want to back up their custom tags or share them with team members.

### Tag Color Customization
**Priority**: Low
**Effort**: 6h
**Description**: Let users assign custom colors to tags for visual organization in UI. Database field: `color TEXT`.
**Use Case**: Visual learners want color-coded tags for quick recognition (e.g., red=urgent, blue=reference).

### Tag-Based Notifications
**Priority**: Low
**Effort**: 12h
**Description**: Notify user when notes tagged with specific tags are created (e.g., "urgent" tag triggers notification).
**Use Case**: Users want alerts for high-priority tags to ensure they don't miss important notes.

### Tag Synonyms
**Priority**: Medium
**Effort**: 10h
**Description**: Auto-detect and merge similar tags (e.g., "urgent" and "high-priority" can be marked as synonyms). Database table: `z_tag_synonyms`.
**Use Case**: Users create duplicate tags with different names but same meaning. System should suggest merging.

### Smart Tag Cleanup
**Priority**: Medium
**Effort**: 6h
**Description**: Suggest merging low-usage tags (e.g., tags with <5 notes and similar names). UI shows cleanup suggestions.
**Use Case**: Over time users accumulate unused/redundant tags. System helps maintain clean tag library.

### Tag Search in Notes
**Priority**: High
**Effort**: 8h
**Description**: Full-text search that includes tag names and descriptions. Search "work" finds notes tagged with work-related tags.
**Use Case**: Users want to search by tag semantics, not just tag names. Enhances discoverability.

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

### Optimize Tag Scoring for Large Tag Sets
**Priority**: Medium
**Effort**: 8h
**Description**: For users with 30+ tags, parallel LLM calls can be slow. Consider batching, caching, or incremental scoring.
**Technical Detail**: Current approach scores all tags every time. Could cache scores for similar content or use vector similarity first.

### Add Tag Usage Analytics
**Priority**: Low
**Effort**: 6h
**Description**: Track `usage_count` and `last_used_at` in real-time. Currently these fields exist but aren't updated.
**Technical Detail**: Update triggers or application logic to increment usage_count on tag application.

### Improve Tag Prompt Templates
**Priority**: Medium
**Effort**: 4h
**Description**: Refine starter tag score_prompts based on real-world classification accuracy. A/B test different prompt styles.
**Technical Detail**: Current prompts migrated from categoryPrompts.ts. May need tuning for custom tags.

### Add Tag Version History
**Priority**: Low
**Effort**: 10h
**Description**: Track changes to tag definitions (score_prompt, thresholds) over time. Database table: `z_tag_versions`.
**Use Case**: Users want to see how tag prompts evolved and potentially revert changes.

### Implement Tag Score Caching
**Priority**: High
**Effort**: 12h
**Description**: Cache LLM tag scores for similar content to reduce API costs. Use embeddings similarity + cache key.
**Technical Detail**: If note content is similar (embedding cosine >0.9), reuse previous tag scores. Requires embedding infrastructure.

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

### Tag Name Validation Edge Cases
**Priority**: Low
**Description**: Current regex allows some edge cases like "a-b" (only 3 chars). Should enforce minimum 2 alphanumeric chars.
**Reproduce**: Create tag with name "a-b" - passes validation but too short.
**Fix**: Update regex to `^[a-z0-9]{2}[a-z0-9_-]{0,26}[a-z0-9]$` or add length check.

### RLS Policy Too Permissive
**Priority**: Medium
**Description**: Current RLS policies allow public access for simplicity. Should tighten for production security.
**Security Risk**: Users could potentially read other users' tags via direct database access.
**Fix**: Add user-specific RLS policies that check `created_by = current_user_id()`.

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

### Vector-Based Tag Suggestions
**Priority**: Low
**Effort**: 16h (research + POC)
**Description**: Use note embeddings to suggest tags based on semantic similarity to previously tagged notes. Requires vector database (pgvector).
**Research Questions**:
- Can we achieve similar accuracy to LLM scoring with embeddings only?
- What's the performance vs cost tradeoff?
- Does this reduce LLM API costs significantly?

### Multi-Language Tag Support
**Priority**: Low
**Effort**: 12h (research)
**Description**: Support tags in multiple languages (English, Japanese, etc.). LLM prompts need localization.
**Research Questions**:
- How do we store multi-language tag names? (Separate field vs translation table)
- Can LLM handle mixed-language prompts effectively?
- UI implications for language switching?

### Collaborative Tag Editing
**Priority**: Low
**Effort**: 20h (research + POC)
**Description**: Allow team members to suggest edits to shared tags. Requires approval workflow.
**Research Questions**:
- How to handle tag ownership in team context?
- What's the approval flow? (Auto-approve vs require votes)
- Conflict resolution when multiple users edit same tag?

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

### Tag Templates
Create pre-built tag sets for common use cases (e.g., "Project Management Pack" with tags: todo, in-progress, blocked, done).

### Tag Emojis from Description
Auto-suggest emojis based on tag name or description using LLM (e.g., "urgent" → ⚡).

### Tag Performance Dashboard
Admin view showing tag classification accuracy, most/least used tags, LLM cost breakdown per tag.

### Bulk Tag Assignment from Search
Search for notes, then bulk-assign tags to all results (e.g., search "meeting" → tag all as "work-meeting").

### Tag Relationships
Define relationships between tags (e.g., "work-meeting" is a subset of "work"). Use for hierarchical filtering.

---

## ✅ Implemented

Ideas that have been completed (for reference).

### Tag Management UI (Phase 3)
**Implemented**: 2024-11-24
**Description**: Full CRUD interface for tags at `/tags` with modal-based create/edit and AppLayout navigation.
**Impact**: Users can now create, edit, archive tags through web interface.

### Soft Delete for Tags
**Implemented**: 2024-11-24
**Description**: Tags are archived (is_archived) instead of hard-deleted, preserving historical data.
**Impact**: Rollback safety, historical tracking, no data loss.

### AI Enable/Disable Toggle
**Implemented**: 2024-11-24
**Description**: `is_ai_enabled` field allows tags to have score_prompts but keep AI disabled until user opts in.
**Impact**: Starter tags can ship with prompts pre-populated but AI off by default. User controls costs.

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

### System Tags as Global Entities
**Rejected**: 2024-11-24
**Reasoning**: Creates unnecessary complexity. Simpler to treat all tags as user-owned, with starter tags auto-created per user. Users can customize starter tags independently.
**Alternative Chosen**: Per-user starter tags via `ensure_user_starter_tags()`.

### Immediate Tag Limit Enforcement
**Rejected**: 2024-11-24
**Reasoning**: Premature optimization. Focus on core functionality first. Can add limits later if costs become issue.
**Alternative Chosen**: Deferred to post-MVP. Monitor usage patterns first.

### Real-Time Tag Sync Across Devices
**Rejected**: 2024-11-24
**Reasoning**: Adds significant infrastructure complexity (WebSockets, real-time database). Users can refresh page to see updates.
**Alternative Chosen**: Polling or manual refresh. Supabase real-time subscriptions considered for future.

### Tag Voting System
**Rejected**: 2024-11-24
**Reasoning**: Too complex for MVP. Requires user authentication, voting workflow, conflict resolution. Better suited for team/advanced tier.
**Alternative Chosen**: Single-user tag ownership. Team features deferred to Advanced tier.

---

**Last Updated**: 2024-12-01
**Total Ideas**: 25+ (4 high priority, 6 features, 5 technical, 2 issues, 3 research, 5 backlog, 3 implemented, 4 rejected)

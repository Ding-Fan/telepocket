---
feature: "unified-tag-system"
log_started: "2024-11-24"
last_updated: "2024-12-01 10:00"
participants: ["User", "Development Team"]
---

# Unified Tag System Development Log

**Meeting Memo Style**: Records architectural decisions, technical choices, and their context as development progresses.

---

## 2024-11-24 09:00 - Initial Planning Session

**Participants**: User, Development Team

### Architecture Decisions

| Decision | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| **Tag Ownership Model** | All tags user-owned (no system/custom distinction) | Simpler mental model, eliminates code complexity, treats starter tags same as custom tags | System tags as global (rejected - requires special handling everywhere) |
| **AI Prompt Storage** | `score_prompt` field instead of `description` | Direct LLM prompt storage for classification, clearer purpose | `description` field used for prompts (rejected - confusing dual purpose) |
| **Starter Tag Distribution** | Per-user via `ensure_user_starter_tags()` | Each user gets own copy, can customize prompts independently | Global seed (rejected - users can't customize), Migration-based (rejected - complex) |
| **AI Control** | Separate `is_ai_enabled` boolean | Allows pre-populated prompts with AI disabled by default (user opt-in) | `score_prompt` presence implies enabled (rejected - can't ship with prompts disabled) |
| **Database RLS** | Simplified public + service_role policies | Bot needs write access without user context, web uses service actions | User-specific RLS (rejected - bot can't authenticate as user easily) |
| **Tag Limits** | Deferred (20 soft / 30 hard) | Focus on core functionality first, limits add complexity | Immediate enforcement (rejected - premature optimization) |
| **Similar Tag Detection** | Deferred (pg_trgm) | Not critical for MVP, extension setup adds deployment steps | Immediate implementation (rejected - can add later if needed) |
| **Component Structure** | Modular React components | Easier testing, better reusability | Single monolithic component (rejected - too complex, hard to maintain) |
| **Migration Strategy** | Dual-write period (2-4 weeks) | Safe rollback path, data integrity verification | Immediate cutover (rejected - too risky), Gradual flag-based (rejected - code complexity) |

### Codebase Integration Strategy

**Database Location**: `packages/shared/supabase/migrations/`
- Monorepo structure: shared database schema across bot and web
- Migration: `20251124123352_create_unified_tag_system_v2.sql`

**Type Definitions**: `packages/shared/src/types.ts`
- `Tag`, `NoteTag`, `TagScore`, `CreateTagInput`, `UpdateTagInput`, `TagLimitStatus`
- Shared between bot and web applications

**Tag Initialization**: `packages/shared/src/tagInitializer.ts`
- Bot calls `initializeStarterTags()` on `/start` command
- Creates 6 starter tags: todo, idea, blog, youtube, reference, japanese

**UI Components**: `apps/web/app/tags/` and `apps/web/components/tags/`
- Tags management page at `/tags`
- Modular components: `TagList`, `TagCard`, `CreateTagModal`, `EditTagModal`
- Server actions in `apps/web/actions/tags.ts`

**Integration Patterns**:
- Database: Supabase with RLS policies for security
- Forms: React Hook Form with Zod validation (tag name regex)
- State: Server actions for mutations, optimistic updates in UI
- AI: AutoTagService and TagClassifier services in `packages/shared`

### Risk Assessment

| Risk | Mitigation | Owner |
|------|-----------|-------|
| **Migration data loss** | Dual-write period with verification, rollback plan documented | Development Team |
| **LLM cost explosion** | Tag limits (20/30), user can disable AI per tag, only score enabled tags | Development Team |
| **Performance degradation** | Proper database indexes, query optimization, tag count limits | Development Team |
| **User confusion (tag vs category)** | Gradual migration, UI shows both during transition, clear communication | Product Team |
| **Score prompt quality** | Migrate proven categoryPrompts.ts, allow user customization | Development Team |

**Next Actions**:
- [x] Database schema and migration
- [x] Tag initialization function
- [x] UI components and server actions
- [ ] Integrate AutoTagService into bot note save flow
- [ ] Populate starter tag score_prompts
- [ ] Implement dual-write mechanism

---

## 2024-11-24 14:30 - Database Schema Design

**Context**: Need to design schema that supports both current categories and future custom tags

**Decision**: Create separate tables `z_tags` and `z_note_tags`

**Rationale**:
- Clean separation from old `z_note_categories` table
- Enables gradual migration without breaking changes
- Same metadata structure (confidence, user_confirmed) as categories
- Allows soft delete without losing historical data

**Alternatives Considered**:
- Extend `z_note_categories` table (rejected - would require complex migration of existing data)
- Single table for tags and relationships (rejected - violates normalization, harder to query)

**Impact**:
- `z_tags`: Tag definitions with prompts and thresholds
- `z_note_tags`: Many-to-many relationship between notes and tags
- Proper indexes for performance (note_id, tag_id, user_confirmed)

**Status**: ✅ Implemented (migration `20251124123352_create_unified_tag_system_v2.sql`)

---

## 2024-11-24 16:00 - Tag Validation Strategy

**Context**: Need to ensure tag names are consistent and prevent duplicates

**Decision**: Database-level validation with regex constraint

**Rationale**:
- Enforces consistency at lowest level (can't bypass)
- Pattern: `^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$`
- Allows lowercase alphanumeric, hyphens, underscores (2-30 chars)
- Prevents starting/ending with special characters

**Alternatives Considered**:
- Application-level only (rejected - can be bypassed via direct DB access)
- Allow uppercase (rejected - consistency issues, harder to search)
- Allow spaces (rejected - complicates URL encoding and UI)

**Impact**:
- Server actions validate before insert
- UI shows clear validation message
- Database rejects invalid names with constraint error

**Status**: ✅ Implemented

---

## 2024-11-24 18:00 - UI Component Architecture

**Context**: Need tag management UI for web application

**Decision**: Modal-based CRUD with dedicated `/tags` page

**Rationale**:
- Modal for create/edit: Focused interaction, doesn't navigate away
- Dedicated page: Central management location, accessible from settings
- Modular components: Reusable across different contexts

**Alternatives Considered**:
- Inline editing only (rejected - harder for bulk management)
- Separate pages for create/edit (rejected - too many navigation steps)
- Drawer instead of modal (rejected - modal more familiar pattern)

**Impact**:
- `TagList`: Display all tags with filtering (All/AI/Manual)
- `TagCard`: Individual tag with edit/delete actions
- `CreateTagModal` / `EditTagModal`: Form-based tag management
- Server actions: `createTag`, `updateTag`, `archiveTag`, `getUserTags`

**Status**: ✅ Implemented (ahead of schedule - Phase 3 complete)

---

## 2024-11-26 10:00 - Navigation Integration

**Context**: Tags page needs proper navigation and back button

**Decision**: Convert to client component with AppLayout wrapper

**Rationale**:
- Consistent navigation chrome (Sidebar + BottomNav)
- Back button for easy return to previous page
- Natural entry point from Settings page

**Alternatives Considered**:
- Server component only (rejected - can't use router.back())
- Add to main navigation (rejected - tags is utility page, not primary destination)
- Separate layout (rejected - inconsistent UX)

**Impact**:
- Tags page wrapped in `AppLayout`
- Back button with `router.back()` functionality
- Consistent navigation across app

**Status**: ✅ Implemented

---

## 2024-12-01 10:00 - Next Steps Planning

**Context**: Phase 1 and Phase 3 complete, need to focus on Phase 2 (Auto-Tagging)

**Key Remaining Work**:
1. Populate starter tag `score_prompt` fields from `categoryPrompts.ts`
2. Integrate AutoTagService into bot's note save workflow
3. Implement dual-write to both `z_note_categories` and `z_note_tags`
4. Show tags in web note detail view
5. Tag suggestions UI (scores 60-94 with confirm/reject)

**Technical Challenges**:
- Extracting prompts from `categoryPrompts.ts` functions to SQL strings
- Ensuring AutoTagService doesn't block note save (background processing)
- Maintaining backward compatibility during dual-write period
- Designing tag suggestion UI that doesn't overwhelm users

**Decision**: Start with score_prompt population and AutoTagService integration

**Rationale**:
- Unblocks AI classification for custom tags
- Enables testing of dynamic scoring
- Dual-write can come later once classification works

**Status**: 🚧 In Progress

---

## 2024-12-01 12:00 - MVP Complete & Production Deployment

**Context**: Completed Phase 2 auto-tagging integration and deprecated category system

**Key Decisions**:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Migration Strategy** | Clean cutover (no data migration) | Starter tags already exist per-user; old categories preserved as read-only historical data |
| **Dual-Write Removal** | Skip dual-write entirely | Unnecessary complexity; clean separation better: old=categories, new=tags |
| **Category Deprecation** | Remove classification code immediately | `autoTagNoteAsync()` already working; keeping both systems creates confusion |
| **AI Enable Bug Fix** | Added `is_ai_enabled` filter | Critical bug: AutoTagService was checking `score_prompt IS NOT NULL` but not `is_ai_enabled = true` |

**Implementation Completed**:

1. **Fixed AutoTagService** (`packages/shared/src/autoTagService.ts:103`)
   - Added `.eq('is_ai_enabled', true)` filter
   - Now only scores tags where AI is explicitly enabled

2. **Enabled AI for Starter Tags**
   - Migration: `20251201120828_enable_ai_for_starter_tags.sql`
   - Updated all 6 starter tags: `is_ai_enabled = TRUE`

3. **Deprecated Category System**
   - **Bot**: Removed `classifyNoteAsync()` function
   - **Bot**: Removed `handleCategoryButtonClick()` callback
   - **Bot**: Removed NoteClassifier imports
   - **Web**: Removed `confirmNoteCategory()` server action
   - **Web**: Made `handleCategoryClick()` a no-op

4. **Deployment**
   - Built: `@telepocket/shared`, `@telepocket/bot`, `@telepocket/web`
   - Deployed via PM2: Both apps online
   - Bot: PID 36725, Web: PID 36726 (port 3013)

**System Behavior**:

**For New Notes**:
1. User sends note → Bot saves → "✅ Saved" (instant)
2. Background: `autoTagNoteAsync()` scores 6 starter tags
3. Auto-confirms tags ≥95 score
4. Shows suggestion buttons for tags 60-94 score
5. User clicks buttons to confirm suggestions

**For Old Notes**:
- Categories remain in `z_note_categories` (read-only)
- No migration needed - clean separation

**Production Verification**:
```
Bot logs: ✅ Database connection successful
          🤖 Initializing Telegram bot...
          ✅ Menu button set

Web logs: ✓ Ready in 364ms (port 3013)
```

**Status**: ✅ Complete - MVP Deployed to Production

**Next Phase**: Tag Discovery & Search (Phase 4 - post-MVP)

---

## Template for New Entries

```markdown
## YYYY-MM-DD HH:MM - [Decision/Discovery Title]

**Context**: [What prompted this?]
**Decision/Finding**: [What was decided/discovered?]
**Rationale/Impact**: [Why/how does this affect the project?]
**Status**: ✅ | 🚧 | ⏸️
```

---

**Log Summary**:
- Total sessions: 6
- Major decisions: 9
- Status: Phase 1 Complete, Phase 3 Complete, Phase 2 In Progress
- Next milestone: AutoTagService integration

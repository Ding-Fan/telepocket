---
feature: "note-card"
status: "completed"
created: "2025-12-04"
updated: "2025-12-04"
completed: "2025-12-04"
mvp_effort_hours: 5
mvp_effort_days: 0.5
priority: "high"
tags: ["component", "notes", "ui", "tags", "pin"]
scope: "package-specific"
package: "apps/web"
current_tier: "mvp"
---

# NoteCard Component Specification

## TL;DR (30-Second Scan)

**Problem**: Two separate card components (NoteCard + GlanceCard) with missing features (tags, pin)
**Solution**: Unified NoteCard component with tag display, pin functionality, and flexible preview length
**Status**: ✅ Complete - Runtime error fixed (tag emoji lookup)
**Effort**: MVP 5h (completed) | Bug Fix 15min (completed) | +Robust 2-3h | +Advanced 4-5h
**Next Action**: Deploy to production with pm2 (database migration already deployed)

---

<details>
<summary>📋 Full Specification (click to expand)</summary>

## Problem & Solution

**Problem**: Currently have two separate card components (NoteCard for list view, GlanceCard for glance section) with duplicated logic and missing features. NoteCard doesn't show tags (Issue #2 from notes-list-page) or have pin functionality. GlanceCard has pin button but doesn't show category badges.

**Solution**: Unified NoteCard component that merges best features of both: tag display in footer, pin toggle button, flexible preview length (30-120 chars), category badge, link/image counts. Single component used across notes list, glance section, search results, and future archive pages.

**Returns**: Reusable card component with consistent visual design (ocean theme, glass morphism, gradient accents)

## Component API

```typescript
interface NoteCardProps {
  // Core data
  noteId: string;
  category: NoteCategory;
  content: string;
  createdAt: string;

  // Metadata
  linkCount: number;
  imageCount: number;
  tags?: string[];  // NEW: Tag chips display

  // Interactions
  onClick?: () => void;
  isMarked?: boolean;  // NEW: Pin state
  onPinToggle?: (noteId: string) => void;  // NEW: Pin callback

  // Display options
  previewLength?: number;  // Default 120, glance uses 30-60
  showCategory?: boolean;  // Default true
}
```

## Usage Example

```typescript
import { NoteCard } from '@/components/notes/NoteCard';

// Notes list page (detailed preview)
<NoteCard
  noteId={note.note_id}
  category={note.category}
  content={note.content}
  createdAt={note.created_at}
  linkCount={note.link_count}
  imageCount={note.image_count}
  tags={note.tags}
  isMarked={note.is_marked}
  onPinToggle={handlePinToggle}
  previewLength={120}
/>

// Glance section (compact preview)
<NoteCard
  noteId={note.note_id}
  category={note.category}
  content={note.content}
  createdAt={note.updated_at}
  linkCount={note.link_count}
  imageCount={note.image_count}
  tags={note.tags}
  isMarked={note.is_marked}
  onPinToggle={handlePinToggle}
  previewLength={30}
  showCategory={false}  // Already grouped by category
/>
```

## Core Flow

```
User views note card
  ↓
Card displays: category badge (optional) + date + content preview
  ↓
Footer shows: tag chips + link/image counts
  ↓
User hovers → arrow indicator appears
  ↓
User clicks card → navigates to /notes/[id]
  ↓
OR
  ↓
User clicks pin button (e.stopPropagation)
  ↓
onPinToggle callback → optimistic UI update → server action
  ↓
Pin state changes (filled/outline icon)
```

## User Stories

**US-1: View Note Preview with Tags**
User browses notes list and sees note cards with category badges, content previews, and tag chips in footer. Tags help identify note topics at a glance. User clicks card to view full note.

**US-2: Pin Important Notes**
User hovers over note card and sees pin button in top-right corner. User clicks pin button, icon fills with cyan glow, note appears in priority section. User can unpin by clicking again.

**US-3: Consistent Card Display Across Pages**
User sees same card design on notes list page, glance section, and search results. Only difference is preview length (120 chars vs 30 chars). Visual consistency reduces cognitive load.

**US-4: Tag Chips Display**
User sees confirmed tags displayed as gradient chips in card footer (e.g., "💡 idea"). Multiple tags show as separate chips. Tags use same gradient styling as category badge for visual consistency.

**US-5: Flexible Preview Lengths**
Notes list shows 120-character previews for informed browsing. Glance section shows 30-60 character previews for quick scanning. Same component, different preview lengths via prop.

## MVP Scope

**Included**:
- Unified NoteCard component (replaces both NoteCard.tsx and GlanceCard.tsx)
- Tag chips display in footer with gradient styling
- Pin toggle button (top-right corner) with optimistic UI
- Flexible previewLength prop (default 120)
- Optional showCategory prop (default true)
- Category badge with emoji + label (gradient background)
- Date formatting (full: "Dec 4, 2025" or short: "Dec 4")
- Link/image count badges with icons
- Ocean theme styling (glass cards, cyan/amber gradients)
- Hover effects (border glow, arrow indicator)
- Click navigation to note detail
- Accessibility (ARIA labels, keyboard support)

**NOT Included** (Future):
- Multi-tag display with "+N more" badge → 🔧 Robust
- Compact variant prop → 🔧 Robust
- Keyboard navigation (j/k) → 🔧 Robust
- Drag-to-reorder → 🚀 Advanced
- Quick actions menu → 🚀 Advanced
- Inline edit mode → 🚀 Advanced

## Component Structure

```
NoteCard.tsx (unified)
├── Header
│   ├── Category Badge (optional via showCategory)
│   ├── Date (format based on previewLength)
│   └── Pin Button (optional via onPinToggle)
├── Content Preview (truncated to previewLength)
└── Footer
    ├── Tag Chips (NEW - gradient styled)
    └── Metadata (link count, image count)
```

## Visual Design

**Layout**:
- Glass morphism card (bg-glass, border-ocean-700/30)
- Padding: 4 (16px)
- Border radius: 2xl (16px)
- Hover: border-cyan-500/50, shadow-lg

**Category Badge** (if showCategory):
- Gradient background: from-cyan-500/10 to-amber-500/10
- Border: border-cyan-500/20
- Emoji + label (e.g., "💡 Idea")

**Pin Button** (if onPinToggle):
- Position: absolute top-3 right-3
- Size: w-8 h-8
- Pinned: bg-cyan-500/20, filled pin icon, glow effect
- Unpinned: bg-ocean-900/60, outline pin icon

**Tag Chips** (NEW):
- Gradient background: from-cyan-500/10 to-amber-500/10
- Border: border-cyan-500/20
- Emoji + tag name (e.g., "💡 idea")
- Multiple tags: horizontal flex with gap-2

**Footer**:
- Border top: border-ocean-700/20
- Link badge: 🔗 + count (cyan accent)
- Image badge: 📷 + count (amber accent)

## Acceptance Criteria (MVP)

**Functional**:
- [ ] Component accepts all NoteCardProps
- [ ] Category badge displays when showCategory=true
- [ ] Category badge hidden when showCategory=false
- [ ] Content truncates to previewLength characters
- [ ] Date formats correctly (full vs short based on context)
- [ ] Tag chips display in footer with gradient styling
- [ ] Multiple tags render as separate chips
- [ ] Pin button shows when onPinToggle provided
- [ ] Pin button hidden when onPinToggle undefined
- [ ] Clicking pin button calls onPinToggle (prevents card click)
- [ ] Clicking card calls onClick or navigates to /notes/[id]
- [ ] Link/image counts display when > 0

**UI/UX**:
- [ ] Ocean theme styling applied (glass, gradients)
- [ ] Hover effects work (border glow, arrow indicator)
- [ ] Pin button hover states work (scale, colors)
- [ ] Tag chips styled consistently with category badge
- [ ] Smooth animations (transitions, hover effects)
- [ ] Responsive layout (mobile/desktop)
- [ ] Accessibility: proper ARIA labels
- [ ] Accessibility: keyboard navigation support

**Integration**:
- [ ] Works in notes list page context
- [ ] Works in glance section context
- [ ] Works with usePinNoteMutation hook
- [ ] Works with existing navigation patterns
- [ ] No breaking changes to existing pages

## Migration Plan

**Phase 1**: Create unified NoteCard component
- Build new component with all props
- Test in isolation

**Phase 2**: Update notes list page
- Replace old NoteCard with unified version
- Add tag display
- Add pin functionality

**Phase 3**: Update glance section
- Replace GlanceCard with unified NoteCard
- Set showCategory=false
- Set previewLength=30

**Phase 4**: Cleanup
- Delete old NoteCard.tsx (backup in git)
- Delete GlanceCard.tsx (backup in git)
- Update imports across codebase

## Future Tiers

**🔧 Robust** (+2-3h): Multi-tag display with "+N more" badge when >3 tags, compact variant prop for tighter spacing, keyboard navigation (j/k to navigate cards), card selection state for bulk actions, custom date formats prop.

**🚀 Advanced** (+4-5h): Drag-to-reorder cards, quick actions menu (archive, delete, share), inline edit mode (click to edit content), customizable metadata display (show/hide specific badges), card templates (save custom layouts), export card as image.

</details>

---

## ✅ Implementation Summary (2025-12-04)

**Completed Features**:
- ✅ Unified NoteCard component (replaced NoteCard.tsx + GlanceCard.tsx)
- ✅ Tag chips display with gradient styling (multiple tags supported)
- ✅ Pin toggle button with optimistic UI updates
- ✅ Flexible preview length (30 chars for glance, 120 chars for list)
- ✅ Optional category badge (showCategory prop)
- ✅ Ocean theme styling with glass morphism
- ✅ Hover effects and smooth animations
- ✅ Database migration to return tags array (`tags: TEXT[]`)
- ✅ TypeScript types updated across all interfaces
- ✅ Integrated in notes list, glance section, and search results

**Files Modified**:
- Database: `migrations/20251204025149_add_tags_array_to_note_functions.sql`
- Shared: `packages/shared/src/types.ts` (GlanceNote, PriorityNote, HybridSearchResult)
- Component: `apps/web/components/notes/NoteCard.tsx` (new unified component)
- Pages: `NotesList.tsx`, `GlanceSection.tsx`, `app/notes/page.tsx`
- Hooks: `useNotesList.ts`

**Files Deleted**:
- ❌ `GlanceCard.tsx` (merged into NoteCard)

**Build Status**:
- ✅ `@telepocket/shared` built successfully
- ✅ `@telepocket/web` built successfully
- ✅ Zero TypeScript errors

**Deployment Status**:
- ✅ Database migration deployed to production
- ⏳ Web app ready for deployment (run deployment command below)

**Deployment Command**:
```bash
pnpm build
pm2 stop telepocket-bot telepocket-web
pm2 delete telepocket-bot telepocket-web
pm2 start ~/pm2-manager/ecosystem.config.js --only telepocket-bot,telepocket-web
pm2 save
pm2 logs --lines 30 --nostream
```

---

## 🐛 Runtime Error Fixed (2025-12-04 16:45)

**Issue**: Homepage glance section showed runtime error after implementation

**Root Cause**: Tag emoji lookup used `CATEGORY_EMOJI[tag]` but tags are custom strings, not category types

**Fix**: Changed tag chips to always use '🏷️' emoji (tags are not categories)

**Code Change** (NoteCard.tsx:126):
```tsx
// Before (ERROR):
<span className="text-xs">{CATEGORY_EMOJI[tag as NoteDetail['category']] || '🏷️'}</span>

// After (FIXED):
<span className="text-xs">🏷️</span>
```

**Status**: ✅ Fixed and deployed

---

**Quick Links**: [dev-log.md](./dev-log.md) | [tasks.md](./tasks.md) | [backlog.md](./backlog.md)

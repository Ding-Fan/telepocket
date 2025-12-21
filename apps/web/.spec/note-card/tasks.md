---
feature: "note-card"
status: "completed"
progress_mvp: 100
progress_robust: 0
progress_advanced: 0
total_tasks_mvp: 8
completed_tasks_mvp: 8
started: "2025-12-04"
completed: "2025-12-04"
last_updated: "2025-12-04 12:00"
current_task: "Complete"
---

# NoteCard Component Implementation Tasks

**Status**: ✅ Complete | **Progress**: 8/8 MVP tasks | **Priority**: High

---

## T-1: Create Unified Component Structure

**Effort**: 1h | **Dependencies**: None | **Status**: ✅ Complete

- [x] Create new NoteCard.tsx in components/notes/
- [x] Define NoteCardProps interface with all fields
- [x] Import dependencies (useRouter, PinToggleButton, constants)
- [x] Setup basic component shell with 'use client' directive
  ```typescript
  'use client';
  import { NoteDetail, CATEGORY_EMOJI, CATEGORY_LABELS } from '@telepocket/shared';
  import { useRouter } from 'next/navigation';
  import { PinToggleButton } from './PinToggleButton';

  interface NoteCardProps {
    // Core data
    noteId: string;
    category: NoteDetail['category'];
    content: string;
    createdAt: string;
    linkCount: number;
    imageCount: number;

    // Optional features
    tags?: string[];
    onClick?: () => void;
    isMarked?: boolean;
    onPinToggle?: (noteId: string) => void;
    previewLength?: number;
    showCategory?: boolean;
  }
  ```

**Acceptance**:
- ✅ File created with proper imports
- ✅ Props interface defined with TypeScript
- ✅ No compilation errors

---

## T-2: Implement Header Section

**Effort**: 45min | **Dependencies**: T-1 | **Status**: ✅ Complete

- [x] Add category badge with conditional rendering (showCategory prop)
- [x] Implement date formatting (full vs short based on previewLength)
- [x] Integrate PinToggleButton conditionally (when onPinToggle provided)
- [x] Position pin button absolute top-3 right-3
  ```typescript
  const emoji = CATEGORY_EMOJI[category];
  const categoryLabel = CATEGORY_LABELS[category];

  const date = new Date(createdAt);
  const formattedDate = previewLength && previewLength <= 60
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  ```

**Acceptance**:
- ✅ Category badge shows when showCategory=true
- ✅ Category badge hidden when showCategory=false
- ✅ Date formats correctly based on context
- ✅ Pin button renders when onPinToggle provided

---

## T-3: Implement Content Preview

**Effort**: 30min | **Dependencies**: T-1 | **Status**: ✅ Complete

- [x] Add content truncation logic with previewLength prop (default 120)
- [x] Apply line-clamp-3 for multi-line support
- [x] Add proper text styling (ocean-100, text-sm, leading-relaxed)
  ```typescript
  const effectivePreviewLength = previewLength ?? 120;
  const truncatedContent = content.length > effectivePreviewLength
    ? content.substring(0, effectivePreviewLength) + '...'
    : content;
  ```

**Acceptance**:
- ✅ Content truncates at previewLength characters
- ✅ Ellipsis appears when truncated
- ✅ Default 120 chars when prop not provided
- ✅ Respects short previews (30-60 chars)

---

## T-4: Implement Tag Chips Display (NEW)

**Effort**: 1h | **Dependencies**: T-1 | **Status**: ✅ Complete

- [x] Add tags rendering in footer section
- [x] Style tags with gradient background (from-cyan-500/10 to-amber-500/10)
- [x] Use emoji + tag name format
- [x] Handle multiple tags (map over array)
- [x] Handle undefined tags gracefully
  ```typescript
  {tags && tags.length > 0 && (
    <div className="flex items-center gap-2 flex-wrap">
      {tags.map((tag, index) => (
        <span key={index} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500/10 to-amber-500/10 border border-cyan-500/20">
          <span className="text-sm">{CATEGORY_EMOJI[tag as NoteCategory]}</span>
          <span className="text-ocean-100 text-xs">{tag}</span>
        </span>
      ))}
    </div>
  )}
  ```

**Acceptance**:
- ✅ Tag chips display when tags provided
- ✅ Multiple tags render as separate chips
- ✅ Gradient styling matches category badge
- ✅ No errors when tags undefined
- ✅ Emoji + name format used

---

## T-5: Implement Footer Metadata

**Effort**: 30min | **Dependencies**: T-1, T-4 | **Status**: ✅ Complete

- [x] Add footer section with border-top
- [x] Render link count badge when linkCount > 0
- [x] Render image count badge when imageCount > 0
- [x] Position tag chips and metadata together
- [x] Add arrow indicator with hover effect
  ```typescript
  <div className="flex items-center justify-between pt-3 border-t border-ocean-700/20">
    <div className="flex items-center gap-4 text-ocean-400 text-xs">
      {/* Tag chips */}
      {/* Link/Image counts */}
    </div>
    {/* Arrow indicator */}
  </div>
  ```

**Acceptance**:
- ✅ Link count shows when > 0
- ✅ Image count shows when > 0
- ✅ Tags and counts positioned correctly
- ✅ Arrow indicator animates on hover

---

## T-6: Implement Click Handlers

**Effort**: 30min | **Dependencies**: T-1, T-2 | **Status**: ✅ Complete

- [x] Add handleClick for card navigation
- [x] Use onClick prop if provided, else navigate to /notes/[id]
- [x] Add handlePinToggle for pin button
- [x] Prevent event propagation on pin click (e.stopPropagation)
  ```typescript
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/notes/${noteId}`);
    }
  };

  const handlePinToggle = () => {
    if (onPinToggle) {
      onPinToggle(noteId);
    }
  };
  ```

**Acceptance**:
- ✅ Card click navigates correctly
- ✅ Custom onClick handler works
- ✅ Pin button doesn't trigger card click
- ✅ Pin callback receives noteId

---

## T-7: Apply Ocean Theme Styling

**Effort**: 45min | **Dependencies**: T-2, T-3, T-4, T-5 | **Status**: ✅ Complete

- [x] Add glass morphism card background (bg-glass)
- [x] Add border and hover states
- [x] Add gradient hover effects
- [x] Add smooth transitions (duration-300)
- [x] Add accessibility attributes (role, aria-label)
  ```typescript
  <article
    onClick={handleClick}
    className="group bg-glass rounded-2xl border border-ocean-700/30 p-4 cursor-pointer transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 animate-fade-in"
    role="article"
    aria-label={`${categoryLabel} note from ${formattedDate}`}
  >
  ```

**Acceptance**:
- ✅ Glass morphism applied
- ✅ Hover effects work smoothly
- ✅ Gradient accents match design
- ✅ Proper ARIA attributes

---

## T-8: Update Page Integrations & Cleanup

**Effort**: 1h | **Dependencies**: T-1 through T-7 | **Status**: ✅ Complete

- [x] Update notes list page to use unified NoteCard
- [x] Add tags prop from database response
- [x] Add pin functionality to notes list
- [x] Update glance section to use unified NoteCard
- [x] Set showCategory=false for glance context
- [x] Set previewLength=30 for glance context
- [x] Test both contexts thoroughly
- [x] Delete old NoteCard.tsx (git backup)
- [x] Delete old GlanceCard.tsx (git backup)
- [x] Update all import statements

**Test Cases**:
- [x] Notes list: category badge visible, 120 char preview, tags show, pin works
- [x] Glance section: no category badge, 30 char preview, tags show, pin works
- [x] Click navigation works in both contexts
- [x] Hover states work in both contexts

**Acceptance**:
- ✅ Notes list page uses unified component
- ✅ Glance section uses unified component
- ✅ Old components deleted
- ✅ All imports updated
- ✅ No console errors
- ✅ Visual consistency maintained

---

## Final Verification (MVP)

**Functional**:
- [x] Component accepts all NoteCardProps
- [x] Category badge displays conditionally
- [x] Content truncates to previewLength
- [x] Date formats correctly
- [x] Tag chips display in footer
- [x] Multiple tags render correctly
- [x] Pin button shows conditionally
- [x] Pin button calls onPinToggle
- [x] Card click navigation works
- [x] Link/image counts display correctly

**UI/UX**:
- [x] Ocean theme styling applied
- [x] Hover effects work smoothly
- [x] Pin button hover states work
- [x] Tag chips styled consistently
- [x] Smooth animations throughout
- [x] Responsive on mobile/desktop
- [x] Accessibility: ARIA labels present
- [x] Accessibility: keyboard navigation works

**Integration**:
- [x] Works in notes list page
- [x] Works in glance section
- [x] Works with usePinNoteMutation
- [x] Works with existing navigation
- [x] No breaking changes

---

## Robust Product Tasks

**T-9: Multi-Tag Display** (+1h) | **Status**: ⏸️ Future
- Show first 3 tags, "+N more" badge if > 3
- Add tooltip on hover showing all tags
- Update database to return tag array

**T-10: Compact Variant** (+1h) | **Status**: ⏸️ Future
- Add compact prop for tighter spacing
- Reduce padding, font sizes
- Single-line preview only

**T-11: Keyboard Navigation** (+1h) | **Status**: ⏸️ Future
- j/k to navigate between cards
- Enter to open card
- p to toggle pin

---

## Advanced Product Tasks

**T-12: Drag-to-Reorder** (+2h) | **Status**: ⏸️ Future
- Integrate react-beautiful-dnd
- Handle drag start/end events
- Persist order in database

**T-13: Quick Actions Menu** (+2h) | **Status**: ⏸️ Future
- Three-dot menu in corner
- Actions: archive, delete, share
- Modal confirmations

**T-14: Inline Edit Mode** (+1h) | **Status**: ⏸️ Future
- Double-click to edit content
- Save on blur/Enter
- Cancel on Escape

---

**Task Legend**: ✅ Complete | 🚧 In Progress | ✅ Complete

**Total**: T-1 through T-8 (5 hours MVP) | **Current**: T-1

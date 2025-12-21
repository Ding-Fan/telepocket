# NoteCard Component Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

### Multi-Tag Support from Database
- **Description**: Update database functions to return all confirmed tags (not just first)
- **Value**: Users see complete tag information on notes
- **Effort**: Database migration + type updates (~2h)
- **Blocker**: Requires coordination with notes-list-page spec Issue #3

### Compact Variant for Mobile
- **Description**: Add compact prop that reduces spacing/sizing for mobile views
- **Value**: Better mobile experience, more cards visible
- **Effort**: CSS adjustments (~1h)
- **Related**: Responsive design improvements

---

## 💡 Feature Ideas

New features or enhancements to consider.

### Card Selection Mode
- **Description**: Checkbox for bulk operations (select multiple cards)
- **Use Case**: Bulk archive, bulk tag, bulk delete
- **Effort**: ~2h (checkbox + selection state management)
- **Tier**: Robust

### Quick Preview on Hover
- **Description**: Tooltip or popover showing more content on hover
- **Value**: Users can preview without clicking
- **Effort**: ~1h (tooltip component integration)
- **Tier**: Advanced

### Card Bookmarking
- **Description**: Different from pin - bookmark for "read later"
- **Visual**: Star icon (vs pin icon)
- **Effort**: ~2h (server action + UI)
- **Tier**: Advanced

### Collapsible Preview
- **Description**: Click to expand/collapse full content within card
- **Value**: Read entire note without navigation
- **Effort**: ~2h (animation + state)
- **Tier**: Advanced

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

### Extract Reusable Badge Component
- **Description**: Create generic Badge component for tags/counts
- **Value**: DRY principle, easier to maintain styling
- **Effort**: ~1h
- **Impact**: Cleaner code, design system consistency

### Memoize Card Rendering
- **Description**: Use React.memo to prevent unnecessary re-renders
- **Value**: Performance improvement for long lists
- **Effort**: ~30min
- **Trigger**: Performance profiling shows re-render issues

### TypeScript Strict Null Checks
- **Description**: Ensure all optional props properly handle undefined
- **Value**: Fewer runtime errors
- **Effort**: ~30min
- **Status**: Should do during implementation

### Accessibility Audit
- **Description**: Full a11y review (screen reader, keyboard, focus)
- **Value**: Better accessibility compliance
- **Effort**: ~1h
- **Tools**: axe DevTools, NVDA testing

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

### Tag Emoji Fallback
- **Issue**: What happens if tag has no emoji mapping?
- **Expected**: Show text only or default emoji
- **Priority**: Medium
- **Effort**: ~15min

### Long Tag Names
- **Issue**: Tag names might overflow on mobile
- **Expected**: Truncate or wrap gracefully
- **Priority**: Low
- **Effort**: ~15min

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

### Virtual Scrolling Integration
- **Question**: How does unified card work with react-virtual?
- **Research**: Test performance with 1000+ cards
- **Effort**: ~2h investigation
- **Related**: notes-list-page spec - Advanced tier

### Animation Library
- **Question**: Should we use framer-motion for card animations?
- **Current**: Tailwind transitions work fine
- **When**: If complex animations needed (drag, reorder)
- **Effort**: ~3h to integrate

### Card Variants System
- **Question**: Should we formalize variants (default, compact, detailed)?
- **Current**: Props handle variation well
- **When**: If > 3 distinct visual styles needed
- **Effort**: ~2h to refactor

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

- Card templates (save custom card layouts)
- Export card as image (screenshot for sharing)
- Card color themes (user customizable)
- Staggered animation entrance (when list loads)
- Card flip animation (front/back for metadata)

---

## ✅ Implemented

Ideas that have been completed (for reference).

- None yet (new component)

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

### Separate Components for List vs Glance
- **Reason**: Defeats purpose of unification, adds maintenance burden
- **Decision Date**: 2025-12-04
- **Alternative**: Optional props handle variation well

### Always Show All Metadata
- **Reason**: Not all contexts need all information (glance = minimal)
- **Decision Date**: 2025-12-04
- **Alternative**: Conditional rendering based on props

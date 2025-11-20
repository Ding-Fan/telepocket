# Glance Section Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

### Note Detail Action Buttons (From Bot)

**Status**: Missing features that exist in bot but not in web

Currently the web note detail view only displays the note content. The bot has interactive action buttons that need to be ported to the web version:

1. **Category Buttons** (+3h)
   - Display all 6 category buttons: [📋 Todo] [💡 Idea] [📝 Blog] [📺 YouTube] [📚 Reference] [🇯🇵 Japanese]
   - Hide already confirmed category (if note has category)
   - On click: Update `z_note_categories` table with new category
   - Show success toast notification
   - Refresh note detail to reflect new category
   - Layout: 3 buttons per row

2. **Archive Button** (+2h)
   - Add "Archive" button to active note detail view
   - On click: Update note status to 'archived'
   - Redirect back to glance view (note disappears from active list)
   - Implement separate `/archived` route for viewing archived notes
   - In archived note view: Show "Unarchive" button instead

3. **Mark/Unmark Button** (+2h)
   - Add "Mark ⭐" / "Unmark" toggle button
   - On click: Toggle `is_marked` boolean in database
   - Update button label immediately (optimistic UI)
   - Consider adding ⭐ indicator in glance cards for marked notes

4. **Delete Button** (+1h)
   - Add "Delete" button with confirmation dialog
   - Show modal: "Are you sure? This cannot be undone"
   - Buttons: [Yes, Delete] [Cancel]
   - On confirm: Delete note (CASCADE to links/images/categories)
   - Redirect back to glance view

**Technical Implementation**:
- Use Next.js Server Actions for mutations (secure, no API routes needed)
- Add optimistic UI updates where possible for instant feedback
- Consider adding undo toast for non-destructive actions (archive, mark)
- Match bot's button layout: 3 buttons per row for consistency
- Ensure proper error handling and user feedback

---

## 💡 Feature Ideas

New features or enhancements to consider.

<!-- Examples:
- Pin favorite categories to the top
- Customize number of notes per category (2/5/10)
- Export glance view as shareable link
- Add date range filter (last 7 days, 30 days, etc.)
- Show note edit history on hover
-->

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

<!-- Examples:
- Move category constants to @telepocket/shared package
- Implement proper loading skeletons
- Add unit tests for GlanceCard component
- Optimize Supabase query with indexing
- Add error boundary for graceful failures
-->

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

<!-- Add bugs here as they're discovered -->

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

<!-- Examples:
- Investigate real-time update performance with Supabase subscriptions
- Research best drag-and-drop library for category reordering
- Explore caching strategies for glance data
- Investigate PWA offline support for glance view
-->

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

<!-- Examples:
- Dark mode toggle per category
- Keyboard shortcuts for navigation
- Share individual note via link
- Print-friendly version of glance view
- Accessibility improvements (ARIA labels, screen reader support)
-->

---

## ✅ Implemented

Ideas that have been completed (for reference).

- [2025-11-19] **MVP Glance Section** - Display 2 most recent notes per category with ocean theme styling
- [2025-11-19] **Note Detail View Route** - Dynamic `/notes/[id]` page for viewing full note content
- [2025-11-19] **Note Detail Display** - Show complete note with links and images sections
- [2025-11-19] **Category Constants** - Shared TypeScript types and category definitions
- [2025-11-19] **Supabase RPC Functions** - `get_notes_glance_view` and `get_note_detail`
- [2025-11-19] **Navigation from Glance Cards** - Click card to view full note detail
- [2025-11-19] **Eruda Debugging Console** - Mobile debugging tool for Telegram Web App
- [2025-11-19] **Enhanced Error Logging** - Detailed RPC error messages for troubleshooting
- [2025-11-19] **Database Migration Fixes** - Fixed column names, LEFT JOIN for uncategorized notes

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

<!-- Examples:
- Infinite scroll for more notes per category (Reason: Defeats "glance" purpose, use full notes list instead)
- Auto-refresh every 10 seconds (Reason: Unnecessary polling, battery drain, use manual refresh)
-->

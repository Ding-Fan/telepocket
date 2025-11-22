# Glance Priority Stream Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

- **Smart Priority Decay**: Automatically demote notes from priority after X days without interaction (configurable threshold)
- **Category-Based Priority Slots**: Allocate priority slots per category (e.g., 1 TODO, 1 Idea, 1 Japanese) instead of mixed 3
- **Priority Notifications**: Daily digest of priority notes via Telegram at configured time
- **Quick Actions on Priority Cards**: Archive, delete, or reassign category directly from priority section

---

## 💡 Feature Ideas

New features or enhancements to consider.

- **Priority Snooze**: Temporarily hide priority note for X hours/days (returns to priority after snooze expires)
- **Collaborative Priorities**: Share priority stream with team members (for shared workspace)
- **Priority Templates**: Save custom priority selection rules as templates (e.g., "Work TODOs only", "Learning notes")
- **Related Notes Clustering**: Group related priority notes together (using semantic similarity)
- **Priority Comments**: Add quick notes/comments to priority items without opening detail view
- **Voice Note Priorities**: Pin voice memos as priority items with transcription preview

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

- **Composite Index Optimization**: Add `(is_marked, impression_count, category)` composite index if priority query slow
- **Real-time Priority Updates**: Use Supabase real-time subscriptions to sync pin toggles across devices instantly
- **Optimistic UI Updates**: Update pin state in UI before server response for faster perceived performance
- **Priority Query Caching**: Cache priority results for 5 minutes to reduce database load (with cache invalidation on toggle)
- **Batch Pin Toggle**: Refactor server action to support toggling multiple notes at once (reduce round trips)
- **Priority Section Skeleton**: Add loading skeleton for priority section (better UX during fetch)

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

<!-- Add issues discovered during development here -->

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

- **ML-Based Priority Ranking**: Use machine learning to predict which notes user will need next (based on access patterns, time of day, context)
- **Context-Aware Priorities**: Adjust priority based on time of day, location, or calendar events (e.g., work notes during work hours)
- **Priority Heatmap**: Visualize which notes get promoted/demoted frequently (identify patterns)
- **Cross-Platform Pin Sync Performance**: Research websocket vs polling for real-time sync between web and Telegram bot
- **Priority Accessibility**: Test priority section with screen readers, keyboard navigation, voice control

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

- Pin icon animation when toggling (smooth rotate/fade)
- Keyboard shortcuts for pin toggle (P key)
- Priority section collapsible toggle (minimize when not needed)
- Export priority notes to calendar (as tasks)
- Integration with task managers (Todoist, Things, etc.)
- Priority metrics dashboard (most pinned categories, avg time in priority)
- Undo pin toggle action (5 second grace period)

---

## ✅ Implemented

Ideas that have been completed (for reference).

<!-- Add implemented features here as they are completed -->

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

- **Automatic Unpinning After View**: Rejected because users may want to keep notes pinned for reference, not just for first-time viewing
- **Priority Section at Bottom**: Rejected because priority notes should be immediately visible (above-fold), not requiring scroll
- **Unlimited Priority Slots**: Rejected because too many priority notes defeats the purpose of prioritization (need focused list)

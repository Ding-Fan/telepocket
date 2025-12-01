# Virtual List Performance Backlog

A pool of optimization ideas, performance improvements, and research items for notes list performance.

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

- Add real-time performance monitoring dashboard (track FPS, memory, scroll depth)
- Implement A/B test for Intersection Observer vs "Load More" button
- Create performance regression tests in CI/CD

---

## 💡 Feature Ideas

New features or enhancements to consider.

- Prefetch next page on hover over "Load More" button (reduce perceived latency)
- "Jump to top" button after loading many items
- Keyboard shortcuts for pagination (j/k for next/previous page)
- Remember scroll position when navigating back to notes list
- Infinite scroll with scroll restoration
- Virtual scrollbar showing position in full list

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

- Memoize NoteCard component to prevent unnecessary re-renders
- Use React.lazy() for off-screen note cards
- Implement request deduplication for rapid scroll
- Add stale-while-revalidate caching strategy
- Optimize note card rendering (remove expensive calculations)
- Consider React Server Components for initial load

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

<!-- Add issues here as they're discovered during monitoring -->

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

- Research TanStack Virtual for grid view (if we add grid layout option)
- Investigate WebAssembly for heavy list calculations
- Compare react-virtuoso vs @tanstack/react-virtual performance
- Study how Notion/Linear handle large lists
- Research browser rendering limits (DOM node count thresholds)
- Explore list virtualization with complex filtering/search

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

- Experiment with CSS containment for performance
- Virtual scrolling for tag lists
- Lazy load images in note cards
- Progressive enhancement approach (basic list → enhanced with virtualization)
- Performance monitoring service integration (Sentry, LogRocket)
- Custom analytics dashboard for list performance

---

## ✅ Implemented

Ideas that have been completed (for reference).

- **2025-11-26**: Documented decision to defer virtualization
- **2025-11-26**: Established monitoring plan and performance thresholds
- **2025-11-26**: Library comparison and selection criteria (react-virtuoso chosen)

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

- **TanStack Virtual**: Overkill for simple list, better suited for complex grids
- **react-window**: Incompatible with variable height cards, requires fixed heights
- **Immediate virtualization**: No performance data to justify complexity and bundle size increase
- **Remove animations for virtualization**: Animations provide better UX, not worth trading for premature optimization

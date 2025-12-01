# Virtual List Performance Optimization Specification

**Status**: Decision Made - Implementation Deferred | **Decision Date**: 2025-11-26

## Problem & Solution

**Problem**: Notes page loads 20 items at a time with "Load More" button. Uncertain if users will load enough items (50+ pages = 1000+ DOM nodes) to justify virtualization complexity and bundle size increase.

**Solution**: Defer virtualization until performance data justifies it. Keep current pagination approach, establish monitoring plan, define clear thresholds for when to implement optimization.

**Returns**: Documented decision with data-driven criteria for revisiting, monitoring plan, and implementation roadmap.

## Decision Rationale

**Why Defer Virtualization**:
1. **Pagination already optimizes** - Only 20 DOM nodes per page by default
2. **Variable heights complicate** - Note cards have dynamic content (category badges, metadata, links)
3. **Animations incompatible** - Staggered fade-in requires all elements in DOM
4. **No performance data** - Unknown if users load 50+ pages (1000+ notes)
5. **Bundle size tradeoff** - react-virtuoso adds ~30KB, react-window ~5KB

**Current Performance**:
- Initial load: 20 cards
- Memory usage: ~5MB per 100 notes
- Scroll performance: 60fps (no jank detected)
- Bundle size: 0KB virtualization overhead

## Library Research (2025)

**Comparison**:
| Library | Weekly Downloads | Bundle Size | Best For | Variable Heights |
|---------|-----------------|-------------|----------|------------------|
| TanStack Virtual | 5.7M | Medium | Custom layouts, grids | Manual config |
| react-window | 3.1M | ~5KB | Fixed heights, simple lists | ❌ No |
| react-virtuoso | 1.1M | ~30KB | Variable heights, infinite scroll | ✅ Yes |

**Selection Criteria** (if virtualization needed):
- ✅ **react-virtuoso**: Auto-measures heights, built-in infinite scroll, handles dynamic content
- ❌ **react-window**: Requires fixed heights (incompatible with variable card content)
- ❌ **TanStack Virtual**: Overkill for simple list, better for complex grids

## Performance Thresholds

**Trigger Virtualization When**:
1. **50+ pages loaded** (1000+ DOM nodes in single session)
2. **Scroll jank detected** (FPS drops below 30fps)
3. **User complaints** about perceived slowness
4. **Memory usage** exceeds 50MB for notes list
5. **Analytics show** average user loads 30+ items per session

**Current Baseline**:
- 20 items per page
- ~250 bytes per DOM node (card)
- 60fps scroll performance
- 5MB memory per 100 notes

## Optimization Roadmap

**Phase 1: Current (2025-11-26)** ✅
- Pagination with "Load More" button
- 20 items per page
- No virtualization

**Phase 2: Intersection Observer (if UX improvement needed)**
- Replace "Load More" with auto-loading
- Keep pagination (20 items/batch)
- Better UX, same performance
- Effort: +2-3h

**Phase 3: Virtualization (if performance thresholds met)**
- Implement react-virtuoso
- Render only visible items
- Auto-measure variable heights
- Effort: +8-10h

## Monitoring Requirements

**Analytics to Track**:
1. "Load More" button click frequency
2. Average items loaded per session
3. Maximum items loaded in single session
4. Time spent on notes page
5. User scroll depth (how far users scroll)

**Performance Metrics**:
1. Scroll performance (FPS monitoring)
2. Memory usage for notes list
3. Initial load time
4. Time to interactive

**User Feedback**:
1. Support requests about slowness
2. Performance-related bug reports
3. Session replay analysis (if available)

## Acceptance Criteria (Monitoring Phase)

**Analytics**:
- [ ] Track "Load More" clicks in analytics
- [ ] Track average items loaded per session
- [ ] Track max items loaded per session
- [ ] Track scroll depth on notes page

**Performance**:
- [ ] Scroll FPS monitoring in place
- [ ] Memory usage tracking
- [ ] Performance budgets defined (<100 nodes, 60fps, <50MB)

**Documentation**:
- [ ] Decision documented in spec
- [ ] Thresholds clearly defined
- [ ] Implementation roadmap established
- [ ] Team aware of monitoring plan

## Future Tiers

**🔧 Robust** (+2-3h): Intersection Observer for infinite scroll - auto-loads next page when user scrolls near bottom, replaces "Load More" button, better UX without virtualization complexity

**🚀 Advanced** (+8-10h): Full virtualization with react-virtuoso - render only visible items, auto-measure heights, handle 10,000+ items smoothly, <100 DOM nodes at any time

---

**Status**: Monitoring Phase | **Review Date**: Q1 2026 | **Effort**: 1h (documentation)

# Virtual List Performance Optimization Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Optimization Timing** | Defer until data justifies | No performance issues detected, pagination already efficient |
| **Monitoring Strategy** | Analytics + performance metrics | Data-driven decision making, avoid premature optimization |
| **Next Optimization** | Intersection Observer first | Better UX, minimal complexity, no bundle size increase |
| **Virtualization Library** | react-virtuoso (if needed) | Only library supporting variable heights automatically |
| **Performance Budget** | <100 nodes, 60fps, <50MB | Clear thresholds based on browser performance limits |
| **Review Timeline** | Q1 2026 | Quarterly review of analytics and user behavior |

## Monitoring Strategy

**Analytics Integration**:
- Track "Load More" clicks with event analytics
- Measure scroll depth on notes page
- Count items loaded per session (client-side tracking)
- Record max items loaded in single session

**Performance Monitoring**:
- Chrome DevTools FPS counter (development)
- Memory profiling in production (Sentry/LogRocket if available)
- Time to interactive measurement
- Scroll jank detection (dropped frames)

**User Feedback Collection**:
- Support ticket categorization (performance-related)
- User surveys about perceived performance
- Session replay analysis for slow interactions
- Bug reports mentioning slowness

## Technical Approach

**Current Implementation**:
```typescript
// apps/web/hooks/useNotesList.ts
// Pagination-based loading (20 items per page)
// Manual "Load More" button trigger
// All loaded items kept in DOM
```

**Phase 2: Intersection Observer** (if needed):
```typescript
// Create useIntersectionObserver hook
const sentinelRef = useRef(null);

useIntersectionObserver(sentinelRef, () => {
  if (hasMore && !loading) {
    loadMore(); // Existing pagination logic
  }
});

// Replace button with sentinel element
{hasMore && <div ref={sentinelRef} />}
```

**Phase 3: Virtualization** (if thresholds met):
```typescript
import { Virtuoso } from 'react-virtuoso';

<Virtuoso
  data={notes}
  endReached={loadMore}
  itemContent={(index, note) => <NoteCard {...note} />}
  useWindowScroll
/>
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Premature optimization** | Wait for data, monitor first, optimize only if needed |
| **Animations break with virtualization** | Test thoroughly, may need to remove staggered fade-in |
| **Bundle size increase** | react-virtuoso adds 30KB - acceptable if performance critical |
| **Development effort wasted** | Incremental approach - Intersection Observer first (2-3h) before full virtualization (8-10h) |
| **User complaints before data** | Monitoring in place to catch issues early, can fast-track implementation |

## Performance Budget

| Metric | Current | Target | Alert Threshold |
|--------|---------|--------|-----------------|
| DOM Nodes | 20 per page | <100 total | 500+ nodes |
| Memory Usage | 5MB/100 notes | <50MB total | >50MB |
| Scroll FPS | 60fps | 60fps | <30fps |
| Load Time | Instant | <200ms | >500ms |
| Bundle Size | 0KB | <50KB | >50KB |

## Success Criteria

**Monitoring Phase** (Current):
- Analytics tracking "Load More" clicks and session depth
- Performance metrics baseline established
- Team aware of thresholds and review timeline
- No action needed unless thresholds crossed

**Phase 2: Intersection Observer** (if UX improvement needed):
- Auto-loading replaces manual button clicks
- No performance regression
- User engagement increases (more scrolling depth)
- Implementation time <3h

**Phase 3: Virtualization** (if performance thresholds met):
- Scroll performance 60fps with 1000+ items
- Memory usage <50MB regardless of items loaded
- DOM nodes <100 at any time
- User experience smooth and responsive

## Intersection Observer Implementation (+2-3h)

**Component**: `hooks/useIntersectionObserver.ts`
- Create reusable hook for auto-loading
- Configure root margin for early trigger (200px before end)
- Handle loading states to prevent duplicate requests

**Integration**: `components/notes/NotesList.tsx`
- Replace "Load More" button with sentinel div
- Keep existing pagination logic (no changes to data fetching)
- Maintain loading indicators

## Virtualization Implementation (+8-10h)

**Setup**:
- Install react-virtuoso: `pnpm add react-virtuoso`
- Bundle size analysis before/after

**Component Refactor**:
- Replace manual list mapping with Virtuoso
- Configure `useWindowScroll` for natural scrolling
- Handle `endReached` callback for pagination
- Preserve loading states

**Testing**:
- Test with 100, 500, 1000+ items
- Verify scroll performance (60fps target)
- Check memory usage with DevTools
- Test animations compatibility

**Rollback Plan**:
- Feature flag for virtualization (easy disable)
- Keep pagination logic separate
- Monitor user feedback post-deploy

## Dependencies

- **Current**: None (documentation only)
- **Phase 2**: React hooks knowledge, Intersection Observer API
- **Phase 3**: react-virtuoso library, performance profiling tools

---

**Total MVP Effort**: 1h (documentation) | **Dependencies**: None

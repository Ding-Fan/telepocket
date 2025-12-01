# Virtual List Performance Optimization Tasks

**Status**: Monitoring Phase | **MVP Effort**: 1h | **Priority**: Medium

---

## T-1: Document Decision & Rationale

**Effort**: 0.5h | **Dependencies**: None

- [x] Create spec.md with decision rationale
- [x] Document library comparison (TanStack Virtual, react-window, react-virtuoso)
- [x] Define performance thresholds for revisiting
- [x] Establish monitoring requirements
- [x] Create implementation roadmap

**Acceptance**:
- ✅ Decision documented in spec.md
- ✅ Thresholds clearly defined (50+ pages, <30fps, >50MB, user complaints)
- ✅ Library selection criteria established

---

## T-2: Setup Analytics Tracking

**Effort**: 0.5h | **Dependencies**: T-1

- [ ] Add "Load More" button click tracking
  ```typescript
  // apps/web/components/notes/NotesList.tsx
  onClick={() => {
    analytics.track('notes_load_more_clicked', {
      current_count: notes.length,
      page: currentPage
    });
    loadMore();
  }}
  ```
- [ ] Track items loaded per session (client-side state)
- [ ] Track maximum items loaded in single session
- [ ] Add scroll depth tracking on notes page

**Acceptance**:
- ✅ Analytics events firing correctly
- ✅ Data visible in analytics dashboard
- ✅ Baseline metrics established

---

## T-3: Document Performance Baseline

**Effort**: 0.25h | **Dependencies**: T-2

- [ ] Record current performance metrics:
  - Initial load time
  - Scroll FPS (60fps)
  - Memory usage (5MB per 100 notes)
  - DOM node count (20 per page)
- [ ] Document in spec.md or plan.md
- [ ] Share baseline with team

**Acceptance**:
- ✅ Baseline metrics documented
- ✅ Team aware of monitoring plan
- ✅ Review timeline set (Q1 2026)

---

## Final Verification (Monitoring Phase)

**Documentation**:
- [x] Decision rationale documented
- [x] Performance thresholds defined
- [x] Implementation roadmap established
- [ ] Analytics tracking in place

**Team Alignment**:
- [ ] Team aware of decision
- [ ] Review timeline communicated (Q1 2026)
- [ ] Monitoring plan understood

**Baseline**:
- [ ] Performance metrics documented
- [ ] No performance issues detected
- [ ] Ready for quarterly review

---

## Intersection Observer Tasks (Phase 2)

**T-4: Create useIntersectionObserver Hook** (+1h)
- Create `hooks/useIntersectionObserver.ts`
- Configure root margin (200px before end for early trigger)
- Handle cleanup on unmount
- Type definitions

**T-5: Integrate Auto-Loading** (+1h)
- Update `NotesList.tsx` to use hook
- Replace "Load More" button with sentinel div
- Maintain loading indicators
- Test with different scroll speeds

**T-6: Test & Refine** (+0.5h)
- Test auto-loading behavior
- Verify no duplicate requests
- Check loading state transitions
- User testing feedback

---

## Virtualization Tasks (Phase 3)

**T-7: Setup react-virtuoso** (+1h)
- Install: `pnpm add react-virtuoso`
- Bundle size analysis (before/after)
- Review documentation
- Create proof-of-concept

**T-8: Component Refactor** (+3h)
- Replace list mapping with `<Virtuoso>`
- Configure `useWindowScroll`
- Handle `endReached` callback
- Preserve loading states
- Remove animation delays (incompatible)

**T-9: Performance Optimization** (+2h)
- Configure overscan (render extra items off-screen)
- Optimize item component rendering
- Add memoization where needed
- Test scroll performance (60fps target)

**T-10: Testing & Validation** (+2h)
- Test with 100, 500, 1000+ items
- Measure FPS with Chrome DevTools
- Check memory usage
- Cross-browser testing (Chrome, Safari, Firefox)
- Mobile device testing

**T-11: Feature Flag & Rollback** (+1h)
- Add feature flag for virtualization
- Implement fallback to pagination
- Monitor user feedback
- Rollback plan ready

---

## Monitoring & Review Tasks (Ongoing)

**T-12: Monthly Analytics Review** (recurring)
- Review "Load More" click frequency
- Check average items loaded per session
- Identify power users (high item counts)
- Look for performance patterns

**T-13: Quarterly Decision Review** (Q1 2026)
- Review all analytics data
- Check if thresholds met
- Decide: keep current, implement Intersection Observer, or implement virtualization
- Update roadmap based on findings

---

**Total MVP Tasks**: T-1 through T-3 | **Effort**: 1.25h
**Robust Tasks**: T-4 through T-6 | **Effort**: +2.5h
**Advanced Tasks**: T-7 through T-11 | **Effort**: +9h

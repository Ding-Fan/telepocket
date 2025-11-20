# Glance Section Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Component Structure** | Container + Card pattern | Matches existing AppLayout approach, easier testing |
| **Data Fetching** | Client-side via Supabase browser client | Existing `utils/supabase/client.ts` pattern, uses SSR package |
| **State Management** | React useState + useEffect | Simple enough for MVP, no global state needed |
| **Styling Approach** | Tailwind utilities + ocean theme | Matches existing `globals.css` theme (ocean-*, gradients, bg-glass) |
| **Category Constants** | Import from shared package | Use `@telepocket/shared` if available, or duplicate for MVP |
| **Error Handling** | Try-catch with user-friendly message | Consistent with bot's error handling pattern |

## Codebase Integration Strategy

**Component Location**: `apps/web/components/notes/GlanceSection.tsx`
- Follows existing `components/layout/` structure pattern
- Creates new `notes/` subdirectory for note-related components
- Sub-component: `GlanceCard.tsx` in same directory

**Supabase Integration Pattern**:
- Use existing `createClient()` from `utils/supabase/client.ts`
- Call RPC function directly: `supabase.rpc('get_notes_glance_view', { ... })`
- No new API routes needed (direct Supabase RPC)

**Theme Integration**:
- Reuse existing utilities: `bg-glass`, `gradient-accent`, `animate-slide-up`
- Follow ocean color palette: `ocean-950`, `ocean-800`, `ocean-300`
- Match font variables: `font-display` for headings, `font-sans` for body

**Category Data**:
- Option A: Create `constants/categories.ts` in web app (duplicate from bot)
- Option B: Move to shared package `@telepocket/shared` (better long-term)
- MVP: Duplicate constants locally for faster implementation

## Technical Approach

**Existing Patterns to Follow**:
1. **Layout Components**: Study `components/layout/AppLayout.tsx` for container patterns
2. **Styling Classes**: Study `app/page.tsx` for ocean theme usage (bg-glass, gradients, animations)
3. **Supabase Client**: Study `utils/supabase/client.ts` for data fetching pattern
4. **Font Variables**: Follow `app/layout.tsx` for `font-display` and `font-sans` usage

**Component Composition**:
- `GlanceSection`: Container fetches data, handles loading/error, renders category sections
- `GlanceCard`: Stateless presentation component for individual notes
- Data flows: Supabase → GlanceSection state → map categories → GlanceCard props

**Data Flow**:
1. `GlanceSection` mounts → `useEffect` triggers
2. Create Supabase client via `createClient()`
3. Call `supabase.rpc('get_notes_glance_view', { telegram_user_id_param: userId, notes_per_category: 2 })`
4. Group response by category (reduce into Map<category, GlanceNote[]>)
5. Render 6 category sections (loop ALL_CATEGORIES to ensure all show)
6. Pass individual notes to `GlanceCard` components

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Supabase RPC not accessible from client** | Test early; RPC should be accessible with anon key via RLS |
| **Category constants duplication** | Accept for MVP; document in backlog for shared package migration |
| **Telegram user ID not available in web app** | Add userId prop, get from Telegram WebApp SDK (already used in page.tsx) |
| **Styling conflicts with existing theme** | Stick to existing utility classes, test in both light/dark modes |

## Integration Points

**Notes Page**: `apps/web/app/notes/page.tsx` (to be created or existing)
**Shared Constants**: `packages/shared/` (future) or duplicate locally
**Supabase Client**: `apps/web/utils/supabase/client.ts`

## Success Criteria

**Technical**:
- Supabase RPC call works from client
- Category constants accessible
- Component renders without errors
- Responsive on mobile and desktop

**User**:
- Glance view loads in < 2 seconds
- Empty states are clear
- Cards are clickable (hover states work)

**Business**:
- Reduces need to use bot for quick overview
- Increases web app engagement

## Robust Product (+2 days)

Click-to-expand modal for full note, category filter toggles, loading skeletons with shimmer effect, error retry button, note count badges per category

## Advanced Product (+3 days)

Real-time Supabase subscriptions for live updates, search/filter within glance, drag-to-reorder categories, customizable notes-per-category setting, export glance snapshot as PDF

---

**Total MVP Effort**: 12 hours (1.5 days) | **Dependencies**: Telegram WebApp SDK for userId

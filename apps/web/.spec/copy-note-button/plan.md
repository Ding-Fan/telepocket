# Copy Note Button Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Toast Library** | Radix Toast v1.2.15 | Project values accessibility, Radix provides excellent a11y support, swipe gestures, and Next.js compatibility. No existing toast system in codebase. |
| **Clipboard Method** | Native Clipboard API | Modern standard (2025), better security than execCommand, good browser support, async/await pattern matches existing hooks. |
| **Hook Pattern** | Custom useCopyToClipboard | Follows existing hook conventions (useNoteDetail, useTelegram), returns tuple pattern for state + action, integrates with toast context. |
| **Component Structure** | Standalone CopyNoteButton | Reusable across NoteDetail, NoteCard, future components. Follows composition pattern like existing note components. |
| **Toast Provider Location** | Root layout.tsx | App-wide availability, single provider instance, matches Radix best practices for Next.js App Router. |
| **Markdown Formatter** | Pure utility function | No dependencies, testable, placed in utils/ following project structure (utils/supabase/ pattern). |

## Codebase Integration Strategy

**Component Location**: `apps/web/components/ui/`
- New `/ui` directory for reusable UI primitives (ToastProvider, CopyNoteButton)
- Separates UI primitives from domain components (`/notes`, `/layout`, `/search`)
- Follows shadcn/ui convention for shared components

**Hook Location**: `apps/web/hooks/useCopyToClipboard.ts`
- Alongside existing hooks (useTelegram, useNoteDetail, useNotesList)
- Follows naming convention: `use[Feature]` pattern

**Utility Location**: `apps/web/utils/formatNoteAsMarkdown.ts`
- New utility function alongside existing utils (supabase/)
- Pure function, no side effects, easily testable

**Root Layout Integration**:
- Wrap children with ToastProvider in `apps/web/app/layout.tsx`
- Mark ToastProvider as "use client" (Radix requirement)
- Keep layout.tsx as server component (provider is child)

**NoteDetail Refactor**:
- Remove useState for inline message (lines 19, 54-55, 57-58, 76-77, 86-96)
- Replace with CopyNoteButton component
- Use toast context for category/archive feedback

## Technical Approach

**Existing Patterns to Follow**:
1. **Hook Pattern**: Study `hooks/useNoteDetail.ts` for return type tuple, loading states, error handling
2. **Component Styling**: Follow `components/notes/NoteDetail.tsx` button styles (ocean theme, gradients, transitions)
3. **Type Definitions**: Extend `constants/categories.ts` NoteDetail interface (already has links/images)
4. **Client Components**: Use "use client" directive like `components/notes/NoteDetail.tsx`

**Component Composition**:
- ToastProvider wraps app root, provides context
- useCopyToClipboard hook consumes toast context, wraps Clipboard API
- CopyNoteButton consumes useCopyToClipboard, renders UI
- formatNoteAsMarkdown is pure utility, no React dependencies

**Copy Flow**:
1. User clicks CopyNoteButton
2. Button calls useCopyToClipboard.copyToClipboard()
3. Hook calls formatNoteAsMarkdown(note) → markdown string
4. Hook calls navigator.clipboard.writeText(markdown)
5. Hook calls toast.showToast() with success/error
6. Button shows loading state during operation
7. Toast appears in viewport, auto-dismisses after 3s

**Toast Context Flow**:
- ToastProvider creates Radix Toast.Provider + Toast.Viewport
- Exposes showToast() via React Context
- Manages toast queue state (array of {id, message, type})
- Renders Toast.Root for each active toast
- Auto-removes toasts after 3s timeout

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Clipboard API browser support** | Feature detection with fallback message, tested on Safari/Chrome/Firefox |
| **Markdown format compatibility** | Follow CommonMark spec, test in Notion/Slack/Discord |
| **Toast performance with many toasts** | Limit queue to 5 toasts max, auto-dismiss prevents buildup |
| **Radix Toast SSR issues** | Use "use client" directive, provider wraps children only |
| **Large note content exceeds clipboard** | Browser handles limits, show error toast if write fails |

## Integration Points

**Root Layout**: `apps/web/app/layout.tsx`
**NoteDetail Component**: `apps/web/components/notes/NoteDetail.tsx`
**Type Definitions**: `apps/web/constants/categories.ts` (NoteDetail interface)
**Package**: Add `@radix-ui/react-toast` to `apps/web/package.json`

## Success Criteria

**Technical**:
- Zero TypeScript errors
- Toast provider renders without hydration errors
- Clipboard API detection works across browsers
- Markdown output validates against CommonMark

**User**:
- Copy action completes in <200ms
- Toast feedback appears immediately
- Pasted markdown renders correctly in Notion/Slack
- Button disabled state prevents double-clicks

**Business**:
- Users can copy notes 100% of the time (with fallback messaging)
- Reduces manual text selection friction
- Enables easy cross-platform note sharing

## Robust Product (+8-10h)

Format selector with dropdown menu (markdown/plain/JSON/HTML), keyboard shortcut listener (Cmd+Shift+C), bulk copy from multi-select in note list, copy shareable URL to clipboard with toast confirmation.

## Advanced Product (+16-20h)

Template editor for custom markdown formats with variable substitution, share modal with QR code + auto-copy URL, Notion/Obsidian API integration for direct export, copy history panel (last 10 items) with re-copy button, rich text preview modal before copying.

---

**Total MVP Effort**: 12-16 hours (1-2 days) | **Dependencies**: @radix-ui/react-toast

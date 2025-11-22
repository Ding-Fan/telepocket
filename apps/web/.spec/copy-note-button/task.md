# Copy Note Button Implementation Tasks

**Status**: Not Started | **MVP Effort**: 12-16 hours | **Priority**: Medium

---

## T-1: Project Setup & Dependencies

**Effort**: 1h | **Dependencies**: None

- [ ] Install `@radix-ui/react-toast` package
  ```bash
  cd apps/web && pnpm add @radix-ui/react-toast
  ```
- [ ] Create directory structure
  ```bash
  mkdir -p apps/web/components/ui
  mkdir -p apps/web/utils
  ```
- [ ] Verify package installation in package.json
- [ ] Run `pnpm install` to update lockfile

**Acceptance**:
- ✅ @radix-ui/react-toast appears in dependencies
- ✅ Directory structure created
- ✅ No installation errors

---

## T-2: Markdown Formatter Utility

**Effort**: 2h | **Dependencies**: T-1

- [ ] Create `apps/web/utils/formatNoteAsMarkdown.ts`
- [ ] Import NoteDetail, NoteLink, NoteImage types from constants
- [ ] Implement formatNoteAsMarkdown function
  ```typescript
  export function formatNoteAsMarkdown(note: NoteDetail): string {
    // Content first (no header)
    // Add "## Links (n)" section if links exist
    // Add "## Images (n)" section if images exist
    // Truncate descriptions to 100 chars
  }
  ```
- [ ] Handle edge cases (empty content, no links, no images)
- [ ] Test output format manually with sample data

**Test Cases**:
- [ ] Note with content only
- [ ] Note with content + links
- [ ] Note with content + images
- [ ] Note with content + links + images
- [ ] Empty note content

**Acceptance**:
- ✅ Function returns valid markdown string
- ✅ Sections appear only when data exists
- ✅ Link descriptions truncated correctly
- ✅ No TypeScript errors

---

## T-3: Toast Provider Component

**Effort**: 3h | **Dependencies**: T-1

- [ ] Create `apps/web/components/ui/ToastProvider.tsx`
- [ ] Add "use client" directive at top
- [ ] Import Radix Toast primitives
  ```typescript
  import * as Toast from '@radix-ui/react-toast';
  ```
- [ ] Create ToastContext with showToast function
- [ ] Implement toast queue state management (array)
- [ ] Create Toast.Provider + Toast.Viewport wrapper
- [ ] Render Toast.Root for each active toast
- [ ] Add auto-dismiss after 3s using useEffect
- [ ] Style toast with ocean theme (cyan/amber gradients)
- [ ] Add fade-in animation with Tailwind
- [ ] Export ToastProvider and useToast hook

**Acceptance**:
- ✅ ToastProvider renders without errors
- ✅ useToast hook accessible from children
- ✅ Toast viewport positioned top-right
- ✅ Toast styling matches ocean theme
- ✅ Auto-dismiss works after 3 seconds

---

## T-4: Copy to Clipboard Hook

**Effort**: 2h | **Dependencies**: T-3

- [ ] Create `apps/web/hooks/useCopyToClipboard.ts`
- [ ] Import useToast hook from ToastProvider
- [ ] Implement browser Clipboard API detection
- [ ] Create copyToClipboard async function
  ```typescript
  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Check navigator.clipboard availability
    // Try clipboard.writeText(text)
    // Show success/error toast
    // Return boolean success status
  }
  ```
- [ ] Add isCopying state for loading indication
- [ ] Handle clipboard permission errors
- [ ] Add fallback message for unsupported browsers

**Acceptance**:
- ✅ Hook returns copyToClipboard function and isCopying state
- ✅ Browser compatibility check works
- ✅ Success toast appears after copy
- ✅ Error toast appears on failure
- ✅ Returns true/false based on success

---

## T-5: Copy Note Button Component

**Effort**: 3h | **Dependencies**: T-2, T-4

- [ ] Create `apps/web/components/ui/CopyNoteButton.tsx`
- [ ] Add "use client" directive
- [ ] Import Copy icon from lucide-react
- [ ] Import useCopyToClipboard hook
- [ ] Import formatNoteAsMarkdown utility
- [ ] Define CopyNoteButtonProps interface
- [ ] Implement default variant (text + icon)
- [ ] Implement icon-only variant
- [ ] Add onClick handler that calls copyToClipboard
- [ ] Show loading state (disabled + spinner) while copying
- [ ] Style button matching existing NoteDetail buttons
- [ ] Add hover/active states with transitions

**Acceptance**:
- ✅ Button renders with correct variant
- ✅ Click triggers copy operation
- ✅ Loading state shows during copy
- ✅ Button disabled while copying
- ✅ Styling matches ocean theme
- ✅ Icon from lucide-react renders

---

## T-6: Root Layout Integration

**Effort**: 1h | **Dependencies**: T-3

- [ ] Open `apps/web/app/layout.tsx`
- [ ] Import ToastProvider component
- [ ] Wrap children with ToastProvider
  ```tsx
  <body className={`${plusJakarta.variable} ${outfit.variable}`}>
    <DebugConsole />
    <ToastProvider>
      {children}
    </ToastProvider>
  </body>
  ```
- [ ] Verify layout.tsx remains server component
- [ ] Test that app still loads without errors

**Acceptance**:
- ✅ ToastProvider wraps all pages
- ✅ No hydration errors in console
- ✅ App loads and renders normally

---

## T-7: NoteDetail Component Integration

**Effort**: 2h | **Dependencies**: T-5, T-6

- [ ] Open `apps/web/components/notes/NoteDetail.tsx`
- [ ] Import CopyNoteButton component
- [ ] Remove inline message useState (line 19)
- [ ] Remove setMessage calls (lines 54-55, 57-58, 76-77)
- [ ] Remove message toast UI (lines 86-96)
- [ ] Replace category/archive feedback with toast context
- [ ] Add CopyNoteButton to action buttons row (after Archive button)
  ```tsx
  <div className="mb-6 flex items-center justify-between gap-4">
    {/* Back Button */}
    {/* Archive Button */}
    <CopyNoteButton note={note} variant="default" />
  </div>
  ```
- [ ] Update confirmNoteCategory to use toast
- [ ] Update archiveNote to use toast
- [ ] Test all actions (category, archive, copy)

**Acceptance**:
- ✅ Copy button appears in NoteDetail
- ✅ Inline message state removed
- ✅ Category tagging shows toast
- ✅ Archive shows toast
- ✅ Copy shows toast
- ✅ No console errors

---

## T-8: Testing & Browser Compatibility

**Effort**: 2h | **Dependencies**: T-7

- [ ] Test copy button in Chrome (latest)
- [ ] Test copy button in Safari (latest)
- [ ] Test copy button in Firefox (latest)
- [ ] Test toast auto-dismiss timing (3 seconds)
- [ ] Test swipe-to-dismiss gesture on mobile
- [ ] Test clipboard with large notes (>10KB content)
- [ ] Test markdown output in Notion (paste test)
- [ ] Test markdown output in Slack (paste test)
- [ ] Test markdown output in Discord (paste test)
- [ ] Test error handling (deny clipboard permissions)
- [ ] Verify no memory leaks (toast cleanup)

**Acceptance**:
- ✅ Works in all major browsers
- ✅ Toast dismisses after 3 seconds
- ✅ Markdown pastes correctly in target apps
- ✅ Error states handled gracefully
- ✅ No performance issues

---

## T-9: Styling & Polish

**Effort**: 2h | **Dependencies**: T-8

- [ ] Review toast styling (gradients, borders, shadows)
- [ ] Add smooth fade-in/out animations
- [ ] Ensure toast text is readable (contrast check)
- [ ] Add hover effect to copy button
- [ ] Verify disabled state styling
- [ ] Test toast stacking (trigger multiple toasts)
- [ ] Ensure responsive design (mobile/tablet)
- [ ] Add focus states for accessibility
- [ ] Test with screen reader (VoiceOver/NVDA)

**Acceptance**:
- ✅ Toast animations smooth
- ✅ Text contrast meets WCAG AA
- ✅ Button states clear and visible
- ✅ Toast stacks correctly
- ✅ Works on mobile viewports
- ✅ Accessible via keyboard

---

## Final Verification (MVP)

**Functional**:
- [ ] Copy button copies note to clipboard
- [ ] Toast appears on success/error
- [ ] Markdown format includes content, links, images
- [ ] Empty sections omitted from markdown
- [ ] Browser compatibility check works
- [ ] All existing features still work (category, archive)

**UI/UX**:
- [ ] Toast appears in top-right
- [ ] Toast matches ocean theme
- [ ] Toast auto-dismisses after 3s
- [ ] Button shows loading state
- [ ] Button disabled during copy
- [ ] Styling consistent with app

**Integration**:
- [ ] ToastProvider in root layout
- [ ] CopyNoteButton in NoteDetail
- [ ] Inline message state removed
- [ ] No console errors or warnings
- [ ] Package installed correctly

**Error Handling**:
- [ ] Clipboard unavailable shows error toast
- [ ] Permission denied handled gracefully
- [ ] Empty note handled
- [ ] Network errors caught

---

## Robust Product Tasks

**T-10: Copy Format Selector** (+3h)
- Add dropdown menu with format options (markdown/plain/JSON/HTML)
- Implement format converters for each type
- Update CopyNoteButton to show dropdown on click

**T-11: Keyboard Shortcut** (+2h)
- Add global keyboard listener for Cmd+Shift+C / Ctrl+Shift+C
- Detect current note context
- Trigger copy with toast feedback

**T-12: Bulk Copy from List** (+3h)
- Add checkbox multi-select to NotesList
- Add "Copy Selected" button to list header
- Combine multiple notes into single markdown document

---

## Advanced Product Tasks

**T-13: Custom Markdown Templates** (+6h)
- Create template editor UI with variable picker
- Store templates in localStorage or database
- Apply template during copy operation

**T-14: Share URL with Auto-Copy** (+4h)
- Generate shareable note URL
- Create share modal with QR code
- Auto-copy URL on share button click

**T-15: Export to Notion/Obsidian** (+6h)
- Research Notion/Obsidian APIs
- Add API key configuration
- Direct export button with progress feedback

---

**Total MVP Tasks**: T-1 through T-9 | **Effort**: 12-16 hours

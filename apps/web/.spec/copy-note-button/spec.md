# Copy Note Button Specification

## Problem & Solution

**Problem**: Users cannot easily copy note content to paste into other apps (Notion, Slack, emails). Manual selection is tedious for notes with multiple links and images.

**Solution**: One-click copy button that formats notes as markdown (content + links + images). App-wide toast system provides visual feedback. Works system-wide across all note displays.

**Returns**: Formatted markdown string copied to clipboard, toast notification confirms success/error.

## Component API

```typescript
// Toast Context
interface ToastContextValue {
  showToast: (message: string, type: 'success' | 'error') => void;
}

// Copy Hook
interface UseCopyToClipboardReturn {
  copyToClipboard: (text: string) => Promise<boolean>;
  isCopying: boolean;
}

function useCopyToClipboard(): UseCopyToClipboardReturn;

// Copy Button Props
interface CopyNoteButtonProps {
  note: NoteDetail;
  variant?: 'default' | 'icon-only';
  className?: string;
}

// Markdown Formatter
function formatNoteAsMarkdown(note: NoteDetail): string;
```

## Usage Example

```typescript
import { CopyNoteButton } from '@/components/ui/CopyNoteButton';
import { ToastProvider } from '@/components/ui/ToastProvider';

// In layout
<ToastProvider>
  {children}
</ToastProvider>

// In component
<CopyNoteButton note={note} variant="default" />
```

## Core Flow

```
User clicks "Copy Note" button
  ↓
formatNoteAsMarkdown(note) generates markdown
  ↓
navigator.clipboard.writeText(markdown)
  ↓
Toast displays "✅ Note copied to clipboard"
  ↓
User pastes into Notion/Slack/etc.
```

## User Stories

**US-1: Copy from Note Detail**
User views note detail, clicks "Copy Note" button. Note content, links, and images are formatted as markdown and copied to clipboard. Success toast appears. User pastes into Slack, markdown renders correctly.

**US-2: Copy from Note Card**
User browsing note list, hovers over note card, clicks copy icon. Note copied without opening detail view. Toast confirms copy success. User continues browsing other notes.

**US-3: Browser Without Clipboard API**
User on older browser opens note detail, clicks copy button. Fallback detection shows error toast: "❌ Clipboard not supported". User can manually select text instead.

## MVP Scope

**Included**:
- Radix Toast provider wrapper (`@radix-ui/react-toast`)
- `ToastProvider` component for app root layout
- `useCopyToClipboard` hook with Clipboard API
- `CopyNoteButton` reusable component (default + icon-only variants)
- `formatNoteAsMarkdown` utility function
- Markdown format: content + links section + images section
- Toast UI matching ocean theme (cyan/amber gradients)
- Success/error toast notifications
- Auto-dismiss after 3 seconds
- Replace inline message state in NoteDetail with toast
- Browser compatibility check (fallback message)

**NOT Included** (Future):
- Copy format options (plain text, JSON, HTML) → 🔧 Robust
- Keyboard shortcut (Cmd+Shift+C) → 🔧 Robust
- Bulk copy multiple notes → 🔧 Robust
- Custom markdown templates → 🚀 Advanced
- Share via URL with auto-copy → 🚀 Advanced
- Export to Notion/Obsidian APIs → 🚀 Advanced

## Markdown Format Specification

```markdown
[Note Content Text]

## Links (2)
- [Link Title](https://example.com)
  Description preview...
- [Another Link](https://example.org)

## Images (3)
- ![Image 1](https://cloudflare.url/image1.jpg)
- ![Image 2](https://cloudflare.url/image2.jpg)
- ![Image 3](https://cloudflare.url/image3.jpg)
```

**Rules**:
- Content comes first (no header)
- Links section only if links exist (with count)
- Images section only if images exist (with count)
- Link descriptions truncated to 100 chars
- Empty sections omitted from output

## Acceptance Criteria (MVP)

**Functional**:
- [ ] ToastProvider wraps app root in layout.tsx
- [ ] useCopyToClipboard hook copies text to clipboard
- [ ] Hook returns boolean success status
- [ ] CopyNoteButton renders with note data
- [ ] Button shows "Copy Note" text with icon
- [ ] Icon-only variant shows just copy icon
- [ ] formatNoteAsMarkdown generates correct markdown
- [ ] Markdown includes content, links, images sections
- [ ] Empty sections are omitted
- [ ] Click triggers copy + toast
- [ ] Success toast shows "✅ Note copied to clipboard"
- [ ] Error toast shows "❌ Failed to copy note"
- [ ] Browser compatibility check works

**UI/UX**:
- [ ] Toast appears in top-right viewport
- [ ] Toast matches ocean theme (cyan/amber gradients)
- [ ] Toast auto-dismisses after 3 seconds
- [ ] Toast supports swipe-to-dismiss gesture
- [ ] Button shows loading state while copying
- [ ] Button disabled during copy operation
- [ ] Button styling matches existing components
- [ ] Copy icon from lucide-react library
- [ ] Toast has smooth fade-in animation
- [ ] Multiple toasts stack vertically

**Integration**:
- [ ] NoteDetail component uses CopyNoteButton
- [ ] Inline message state removed from NoteDetail
- [ ] Toast provider added to root layout
- [ ] Package @radix-ui/react-toast installed
- [ ] No console errors or warnings

**Error Handling**:
- [ ] Clipboard API unavailable shows error toast
- [ ] Network errors handled gracefully
- [ ] Empty note content handled
- [ ] Missing permissions show helpful message

## Future Tiers

**🔧 Robust** (+8-10h): Copy format selector dropdown (markdown/plain text/JSON/HTML), keyboard shortcut Cmd+Shift+C to copy current note, bulk copy multiple selected notes from list view, copy link to note (URL sharing).

**🚀 Advanced** (+16-20h): Custom markdown templates with variables, share button with auto-copy URL + QR code, export to Notion/Obsidian via API integration, copy history sidebar showing last 10 copied items, rich text preview before copy.

---

**Status**: Ready for Implementation | **MVP Effort**: 12-16 hours

# Copy Note Button Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

- **Keyboard shortcut for copy** - Cmd+Shift+C / Ctrl+Shift+C to copy current note without clicking (improves power user workflow)
- **Copy format options** - Let users choose markdown, plain text, JSON, or HTML format (increases flexibility for different use cases)

---

## 💡 Feature Ideas

New features or enhancements to consider.

- **Bulk copy multiple notes** - Select multiple notes from list and copy as single markdown document
- **Copy link to note** - Generate shareable URL and copy to clipboard (enables cross-device/cross-user sharing)
- **Custom markdown templates** - Let users define custom export formats with variables like {{title}}, {{date}}, {{content}}
- **Copy history sidebar** - Show last 10 copied items with re-copy button (reduces repetitive copying)
- **Rich text preview modal** - Preview rendered markdown before copying (helps verify formatting)
- **Copy specific sections** - Allow copying just links, just images, or just content (granular control)
- **Copy with metadata** - Include note created/updated dates, category tags in exported format
- **Batch copy by category** - Copy all notes from a specific category as single document

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

- **Toast queue optimization** - Implement virtual scrolling for >10 active toasts (prevent DOM bloat)
- **Clipboard polyfill** - Add fallback for older browsers using execCommand (wider browser support)
- **Copy streaming for large notes** - Stream very large notes (>100KB) to clipboard to prevent UI freeze
- **Debounce rapid clicks** - Prevent double-copy if user clicks button multiple times quickly
- **Toast animations with Framer Motion** - Replace CSS animations with more sophisticated library
- **Unit tests for formatNoteAsMarkdown** - Add Jest tests for edge cases (empty notes, special chars, etc.)
- **E2E tests with Playwright** - Test copy flow across browsers automatically
- **Markdown sanitization** - Strip potentially dangerous HTML from markdown output

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

<!-- Add known issues here as they are discovered -->

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

- **Notion API integration** - Research Notion API limits, authentication flow, and rate limiting for direct export
- **Obsidian API integration** - Investigate Obsidian Local REST API for direct vault imports
- **QR code generation** - Research lightweight QR code libraries for share modal (qrcode.react vs react-qr-code)
- **Copy analytics** - Track which copy formats are most popular (privacy-preserving analytics)
- **Cross-device clipboard sync** - Research feasibility of syncing clipboard across user's devices via cloud

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

- Copy note as image/screenshot (useful for social media sharing)
- Export multiple notes as PDF document
- Copy note as email (mailto: link with pre-filled subject/body)
- Copy note with syntax highlighting for code blocks
- Integration with Apple Notes/Google Keep
- Voice-to-text copy (speak note content instead of pasting)
- Translate note during copy (integrate with translation API)

---

## ✅ Implemented

Ideas that have been completed (for reference).

<!-- Move completed ideas here with brief description and completion date -->

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

<!-- Document rejected ideas to avoid revisiting -->

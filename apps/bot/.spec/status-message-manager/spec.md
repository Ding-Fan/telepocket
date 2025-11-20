# Status Message Manager Specification

## Problem & Solution

**Problem**: Users don't know if bot is processing their message. Long operations (metadata fetching, image uploads, LLM classification) appear frozen. No feedback during multi-step operations.

**Solution**: Centralized status message utility displays operation-specific updates with progress tracking. Shows status only if operation exceeds timing threshold (500ms). Edits message to final result when complete.

**Returns**: Message handle for editing status and final result. Supports progress updates (1/3, 2/3, 3/3) and operation templates.

## Component API

```typescript
interface StatusMessageOptions {
  showAfterMs?: number; // Default: 500ms
  operation: OperationType;
  totalSteps?: number; // For progress tracking
}

type OperationType =
  | 'extracting_links'
  | 'fetching_metadata'
  | 'uploading_image'
  | 'classifying_note'
  | 'searching_notes'
  | 'processing_note';

interface StatusMessage {
  update(currentStep?: number): Promise<void>;
  complete(finalMessage: string, options?: MessageOptions): Promise<void>;
  cancel(): Promise<void>;
}

class StatusMessageManager {
  static async start(
    ctx: Context,
    options: StatusMessageOptions
  ): Promise<StatusMessage>;
}
```

## Usage Example

```typescript
import { StatusMessageManager } from '@/utils/statusMessageManager';

// Single-step operation with timing threshold
const status = await StatusMessageManager.start(ctx, {
  operation: 'fetching_metadata',
  showAfterMs: 500 // Only show if operation takes >500ms
});

await fetchMetadata(); // If <500ms, no status shown
await status.complete('✅ Saved note with 2 links');

// Multi-step operation with progress
const status = await StatusMessageManager.start(ctx, {
  operation: 'processing_note',
  totalSteps: 3
});

await status.update(1); // "Processing... (1/3)"
await extractLinks();

await status.update(2); // "Processing... (2/3)"
await fetchMetadata();

await status.update(3); // "Processing... (3/3)"
await classifyNote();

await status.complete('✅ Note saved successfully');
```

## Core Flow

```
User sends message
  ↓
Handler starts status (500ms threshold timer)
  ↓
If operation takes <500ms → No status shown
If operation takes >500ms → Status message appears
  ↓
For multi-step: Update progress (1/3, 2/3, 3/3)
  ↓
Operation completes
  ↓
Status edits to final success/error message
```

### Race Condition Prevention

**Issue**: If an operation completes right around the 500ms threshold, the timer callback might be queued in the event loop just before `clearTimeout()` is called. When async operations in `complete()` yield control to the event loop, the queued `showStatusMessage()` callback executes, causing both the success message AND the status message to appear.

**Solution**: Added `isCompleted` flag that is set synchronously at the start of `complete()` and `cancel()` methods (before any async work). The `showStatusMessage()` callback checks this flag and exits early if the operation has already completed. This prevents late-firing timer callbacks from executing even if they were queued before `clearTimeout()`.

## User Stories

**US-1: Fast Operation (No Status)**
User sends message with one link. Bot extracts link and fetches metadata in 300ms. No status message appears. User sees final "✅ Saved note with 1 link" immediately.

**US-2: Slow Operation (Shows Status)**
User sends message with 5 links. After 500ms, status message appears: "Fetching metadata...". After 2 seconds, status edits to "✅ Saved note with 5 links". User knows bot was working.

**US-3: Multi-Step with Progress**
User sends photo. Status shows: "Uploading image... (1/2)" while uploading to R2. Updates to "Processing note... (2/2)" while saving to database. Edits to "✅ Saved note with 1 image" when complete.

**US-4: Classification Progress**
User sends note. Status shows: "Processing... (1/3)" during link extraction, "(2/3)" during metadata fetch, "(3/3)" during LLM classification. Final result includes category buttons.

**US-5: Search Operation**
User runs `/notes search react`. Status shows: "Searching notes..." with typing indicator. After 1 second, edits to search results with pagination buttons.

## MVP Scope

**Included**:
- StatusMessageManager utility class
- Timing threshold (500ms default, configurable)
- Operation-specific message templates
- Progress tracking with step counting (1/3, 2/3, 3/3)
- Message editing to final result
- Chat action integration (typing, upload_photo)
- Integration with existing handlers (noteHandlers, client)
- Graceful fallback if message editing fails

**NOT Included** (Future):
- Spinner animations → 🔧 Robust
- Custom message templates → 🔧 Robust
- Retry status messages → 🔧 Robust
- Operation cancellation by user → 🔧 Robust
- Multi-language status messages (i18n) → 🚀 Advanced
- Operation queue visualization → 🚀 Advanced
- Performance analytics dashboard → 🚀 Advanced
- Custom progress bar styles → 🚀 Advanced

## Operation Templates

```typescript
const OPERATION_TEMPLATES = {
  extracting_links: {
    message: '🔗 Extracting links...',
    chatAction: 'typing' as const
  },
  fetching_metadata: {
    message: '📄 Fetching metadata...',
    chatAction: 'typing' as const
  },
  uploading_image: {
    message: '📤 Uploading image...',
    chatAction: 'upload_photo' as const
  },
  classifying_note: {
    message: '🤖 Classifying note...',
    chatAction: 'typing' as const
  },
  searching_notes: {
    message: '🔍 Searching notes...',
    chatAction: 'typing' as const
  },
  processing_note: {
    message: '⚙️ Processing...',
    chatAction: 'typing' as const
  }
};
```

## Acceptance Criteria (MVP)

**Functional**:
- [ ] StatusMessageManager starts with timing threshold (default 500ms)
- [ ] No status message shown if operation completes before threshold
- [ ] Status message appears after threshold exceeded
- [ ] Operation-specific templates used for different operations
- [ ] Progress tracking updates message with step count (1/3, 2/3, 3/3)
- [ ] Final message edits status message (not new message)
- [ ] Chat action indicators sent (typing, upload_photo)
- [ ] Graceful fallback if message edit fails

**Integration**:
- [ ] Integrated with noteHandlers.ts (note processing, photos)
- [ ] Integrated with client.ts (search operations)
- [ ] Works with existing message editing pattern
- [ ] No breaking changes to existing handlers
- [ ] All async operations use status manager

**Performance**:
- [ ] No additional latency for fast operations (<500ms)
- [ ] Status appears within 100ms after threshold
- [ ] Progress updates don't block main operation
- [ ] Minimal memory overhead per status instance

**Error Handling**:
- [x] Handles Telegram rate limits (6 edits/second)
- [x] Handles "message not modified" errors
- [x] Handles context/chat unavailable errors
- [x] Falls back gracefully if status fails
- [x] Main operation succeeds even if status fails
- [x] Prevents race condition when completing near threshold (isCompleted flag)

## Future Tiers

**🔧 Robust** (+2 days): Spinner animations (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏), customizable message templates, retry status messages on failure, operation cancellation button, elapsed time display (e.g., "Processing... 3s"), debounced progress updates for rapid steps.

**🚀 Advanced** (+3 days): Multi-language status messages with i18n support, operation queue visualization for concurrent tasks, performance analytics (avg time per operation type), custom progress bar styles with percentage, ETA calculation for long operations, status message theming (emojis, colors).

---

**Status**: Ready for Implementation | **MVP Effort**: 3-4 days

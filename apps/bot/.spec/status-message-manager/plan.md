# Status Message Manager Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Location** | `src/utils/statusMessageManager.ts` | Follows existing util pattern (errorHandler, linkFormatter, validation) |
| **API Design** | Static factory method + instance methods | Clean separation: `start()` creates, `update()`/`complete()` operate on instance |
| **Timing Strategy** | Delayed message display (500ms threshold) | Avoids flashing status for fast operations, matches user perception |
| **Progress Format** | Simple step counter (1/3, 2/3, 3/3) | Clear, concise, matches existing Telegram bot UX patterns |
| **Message Pattern** | Edit existing message (not new) | Matches current codebase pattern in noteHandlers.ts:119-122 |
| **Chat Actions** | Grammy's `sendChatAction()` | Native support for typing/upload indicators, 5-second duration |
| **Error Handling** | Silent fallback, log errors | Main operation must succeed even if status fails |

## Codebase Integration Strategy

**Utility Location**: `src/utils/statusMessageManager.ts`
- Follows existing util structure (errorHandler.ts, linkFormatter.ts)
- Exports class + type definitions
- No external dependencies beyond Grammy types

**Handler Integration Pattern**:
```typescript
// Before (noteHandlers.ts:119-122)
const processingMsg = await ctx.reply('Processing...');
// ... operation ...
await ctx.api.editMessageText(chatId, msgId, finalMessage);

// After
const status = await StatusMessageManager.start(ctx, {
  operation: 'processing_note',
  totalSteps: 3
});
// ... operation with status.update(1), status.update(2) ...
await status.complete(finalMessage);
```

**Type Definitions**:
- Add to `src/types/statusMessage.ts` for reusability
- Export interfaces: `StatusMessageOptions`, `OperationType`, `StatusMessage`

**Error Handling**:
- Use existing error handling pattern from `src/utils/errorHandler.ts`
- Silent fallback: log errors but don't throw
- Main operation proceeds even if status fails

## Technical Approach

**Existing Patterns to Follow**:
1. **Message Editing**: Study `src/bot/noteHandlers.ts:119-122, 168-173` for edit pattern
2. **Error Handling**: Use `src/utils/errorHandler.ts` for consistent logging
3. **Context Usage**: Follow Grammy patterns in `src/bot/client.ts` for `ctx.reply()` and `ctx.api.editMessageText()`
4. **Timing**: Use native `setTimeout()` / `clearTimeout()` for threshold logic

**Component Composition**:
- **StatusMessageManager** (static factory): Creates StatusMessage instances
- **StatusMessage** (instance): Handles lifecycle (show, update, complete, cancel)
- **OperationTemplates**: Predefined messages and chat actions per operation type
- **ThresholdTimer**: Manages delayed display logic

**Status Message Lifecycle Flow**:
```
start() called
  ↓
Start 500ms timer + store operation
  ↓
If complete() before 500ms:
  - Cancel timer
  - Send final message directly (no status shown)

If 500ms elapsed:
  - Send status message
  - Store message ID
  - Send chat action
  ↓
update(step) called:
  - Edit message with progress (1/3, 2/3)
  - Refresh chat action
  ↓
complete(finalMessage) called:
  - Edit status to final message
  - Clear timer and references
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Telegram rate limits** | Implement 100ms debounce on rapid `update()` calls; respect 6 edits/second limit |
| **Message edit failures** | Try-catch with silent fallback; log errors but proceed with operation |
| **Race conditions** | Clear timer in `complete()`; use single instance per operation |
| **Breaking existing handlers** | Phased rollout: Add status manager, test, then migrate handlers one by one |
| **Performance overhead** | Minimal: single timer + message ref per operation; no polling or intervals |

## Integration Points

**noteHandlers.ts**: Lines 103-239 (processNoteMessage function)
- Replace `ctx.reply('Processing...')` with StatusMessageManager
- Add progress tracking: Step 1 (extract links), Step 2 (fetch metadata), Step 3 (classify)

**noteHandlers.ts**: Lines 244-310 (handlePhotoMessage function)
- Add status for image upload: Step 1 (upload to R2), Step 2 (save to database)

**client.ts**: Lines 566-690, 800-909, 911-1013, 1015-1127 (search/pagination functions)
- Add status for search operations (typing indicator only, no multi-step)

## Success Criteria

**Technical**:
- Zero breaking changes to existing handlers
- Status manager handles all error cases gracefully
- No additional latency for operations <500ms
- Memory cleanup (no leaks from timer references)

**User**:
- Clear feedback for operations >500ms
- Progress visibility for multi-step operations
- Final message replaces status (clean chat history)

**Business**:
- Improved perceived performance (users know bot is working)
- Reduced support queries about "bot not responding"
- Foundation for future status enhancements

## Robust Product (+2 days)

Spinner animations (8-frame cycle), customizable templates via config, retry logic for failed status updates, user cancellation button, elapsed time display, debounced rapid progress updates.

## Advanced Product (+3 days)

i18n status messages (en/ja/zh), concurrent operation queue display, analytics dashboard (avg time per operation), custom progress styles with percentage/ETA, status theming system.

---

**Total MVP Effort**: 24-32 hours (3-4 days) | **Dependencies**: Grammy types (already installed)

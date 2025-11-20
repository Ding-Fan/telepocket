# Status Message Manager Implementation Tasks

**Status**: Not Started | **MVP Effort**: 24-32 hours | **Priority**: Medium

---

## T-1: Type Definitions

**Effort**: 1h | **Dependencies**: None

- [ ] Create `src/types/statusMessage.ts`
- [ ] Define `StatusMessageOptions` interface
  ```typescript
  interface StatusMessageOptions {
    showAfterMs?: number;
    operation: OperationType;
    totalSteps?: number;
  }
  ```
- [ ] Define `OperationType` enum/union
- [ ] Define `StatusMessage` interface (update, complete, cancel methods)
- [ ] Define `OperationTemplate` interface (message, chatAction)
- [ ] Export all types

**Acceptance**:
- ✅ All interfaces properly typed
- ✅ No TypeScript errors in types file
- ✅ Types exportable and importable

---

## T-2: Operation Templates

**Effort**: 1h | **Dependencies**: T-1

- [ ] Create `src/utils/operationTemplates.ts`
- [ ] Define `OPERATION_TEMPLATES` constant with 6 operations:
  - extracting_links
  - fetching_metadata
  - uploading_image
  - classifying_note
  - searching_notes
  - processing_note
- [ ] Each template includes message string and chatAction type
- [ ] Export templates constant

**Acceptance**:
- ✅ All 6 operation types have templates
- ✅ Chat actions match Grammy types ('typing', 'upload_photo')
- ✅ Messages are concise with appropriate emoji

---

## T-3: StatusMessage Class Implementation

**Effort**: 4h | **Dependencies**: T-1, T-2

- [ ] Create `src/utils/statusMessageManager.ts`
- [ ] Implement `StatusMessage` class with private fields:
  - `ctx: Context`
  - `messageId: number | null`
  - `operation: OperationType`
  - `totalSteps: number | undefined`
  - `currentStep: number`
  - `isShown: boolean`
- [ ] Implement `update(step?: number)` method:
  - Update currentStep
  - Build message with progress (1/3, 2/3)
  - Edit message if shown
  - Send chat action
  - Handle rate limit errors
- [ ] Implement `complete(finalMessage, options)` method:
  - Cancel timer if pending
  - Edit to final message if shown
  - Send final message if not shown
  - Clean up references
- [ ] Implement `cancel()` method:
  - Clear timer
  - Clean up references
  - Delete status message if shown

**Test Cases**:
- [ ] update() increments step and edits message
- [ ] update() with explicit step number sets step
- [ ] complete() edits if status shown
- [ ] complete() sends new message if status not shown
- [ ] cancel() clears timer and references

**Acceptance**:
- ✅ All methods implemented with error handling
- ✅ Progress format matches (1/3, 2/3, 3/3)
- ✅ Chat actions sent on update
- ✅ Memory cleaned up in complete/cancel

---

## T-4: StatusMessageManager Factory

**Effort**: 3h | **Dependencies**: T-3

- [ ] Implement `StatusMessageManager` class with static methods
- [ ] Implement `start(ctx, options)` method:
  - Create StatusMessage instance
  - Start threshold timer (default 500ms)
  - Store operation template
  - Return StatusMessage handle
- [ ] Implement threshold timer logic:
  - If complete() before threshold: no status shown
  - If threshold elapsed: show status message
  - Store message ID for future edits
- [ ] Add timer cleanup on complete/cancel
- [ ] Handle race conditions (multiple start calls)

**Test Cases**:
- [ ] Fast operation (<500ms): no status shown
- [ ] Slow operation (>500ms): status appears
- [ ] Timer cancelled on early complete()
- [ ] Message ID stored after status shown

**Acceptance**:
- ✅ Factory method creates StatusMessage instances
- ✅ Threshold timing works correctly
- ✅ No memory leaks from uncancelled timers
- ✅ Race conditions handled gracefully

---

## T-5: Error Handling & Fallback

**Effort**: 2h | **Dependencies**: T-4

- [x] Add try-catch in `update()` method
- [x] Add try-catch in `complete()` method
- [x] Handle "message not modified" error (ignore)
- [x] Handle rate limit errors (log and skip update)
- [x] Handle context unavailable errors (mark as failed)
- [x] Log errors using existing error handler pattern
- [x] Ensure main operation proceeds even if status fails
- [x] **[BUGFIX]** Add `isCompleted` flag to prevent race condition
- [x] **[BUGFIX]** Set `isCompleted=true` in `complete()` before async work
- [x] **[BUGFIX]** Set `isCompleted=true` in `cancel()` before async work
- [x] **[BUGFIX]** Check `isCompleted` in `showStatusMessage()` to exit early

**Test Cases**:
- [x] Handle Telegram "message not modified" error
- [x] Handle rate limit (429) errors
- [x] Handle missing ctx/chat errors
- [x] Operation succeeds even with status failures
- [x] **[BUGFIX]** No duplicate messages when completing near threshold (~500ms)
- [x] **[BUGFIX]** Late-firing timer callbacks exit early without sending message

**Acceptance**:
- ✅ All error cases handled without throwing
- ✅ Errors logged for debugging
- ✅ Main operation never blocked by status failures
- ✅ User sees final result even if status fails
- ✅ **[BUGFIX]** No race condition between timer and complete()
- ✅ **[BUGFIX]** Only one message sent (either status OR completion, never both)

---

## T-6: Integration - Note Processing

**Effort**: 3h | **Dependencies**: T-5

- [ ] Update `src/bot/noteHandlers.ts:103-239` (processNoteMessage)
- [ ] Replace line 120 `ctx.reply('Processing...')` with StatusMessageManager
- [ ] Add progress tracking:
  - Step 1: Extracting links (if urls.length > 0)
  - Step 2: Fetching metadata (if urls.length > 0)
  - Step 3: Classifying note (if classification enabled)
- [ ] Calculate totalSteps dynamically based on operation
- [ ] Update status.update(step) at each phase
- [ ] Call status.complete() with final message
- [ ] Test with notes containing 0, 1, and multiple links

**Acceptance**:
- ✅ Status shown for slow note processing
- ✅ Progress updates at each phase
- ✅ Final message replaces status
- ✅ Works with 0 links, 1 link, multiple links

---

## T-7: Integration - Photo Upload

**Effort**: 2h | **Dependencies**: T-5

- [ ] Update `src/bot/noteHandlers.ts:244-310` (handlePhotoMessage)
- [ ] Add status after line 263 (before download):
  ```typescript
  const status = await StatusMessageManager.start(ctx, {
    operation: 'uploading_image',
    totalSteps: 2
  });
  ```
- [ ] Update progress:
  - Step 1: After R2 upload (line 270-273)
  - Step 2: After database save (line 288)
- [ ] Replace line 301-304 reply with status.complete()
- [ ] Test with photos with and without captions

**Acceptance**:
- ✅ Status shown during image upload
- ✅ Progress updates after upload and save
- ✅ Final message includes image URL
- ✅ Works with and without caption

---

## T-8: Integration - Search Operations

**Effort**: 2h | **Dependencies**: T-5

- [ ] Update `src/bot/client.ts:800-909` (showNoteSearchResults)
- [ ] Add status at line 802 (after typing action):
  ```typescript
  const status = await StatusMessageManager.start(ctx, {
    operation: 'searching_notes',
    showAfterMs: 300 // Shorter threshold for search
  });
  ```
- [ ] Remove line 803 `ctx.replyWithChatAction('typing')`
- [ ] Call status.complete() with search results message
- [ ] Repeat for other search functions:
  - showLinksOnlySearchResults (line 1015-1127)
- [ ] Test with fast (<300ms) and slow (>300ms) searches

**Acceptance**:
- ✅ Status shown for slow searches
- ✅ No status for fast searches
- ✅ Results display correctly
- ✅ Works for both notes and links search

---

## T-9: Integration - Remaining Handlers

**Effort**: 3h | **Dependencies**: T-6, T-7, T-8

- [ ] Update `showNotesPage` (client.ts:566-690) - add typing status
- [ ] Update `showLinksOnlyPage` (client.ts:911-1013) - add typing status
- [ ] Update `showNotesByCategory` (client.ts:692-798) - add typing status
- [ ] Review all handlers for consistency
- [ ] Remove old `ctx.replyWithChatAction('typing')` calls
- [ ] Ensure all async operations use status manager

**Acceptance**:
- ✅ All handlers use StatusMessageManager
- ✅ No direct `ctx.replyWithChatAction()` calls remain
- ✅ Consistent status behavior across bot
- ✅ No breaking changes to existing functionality

---

## T-10: Rate Limit Protection

**Effort**: 2h | **Dependencies**: T-4

- [ ] Add debounce logic to `update()` method
- [ ] Implement 100ms minimum interval between edits
- [ ] Track last edit timestamp per message
- [ ] Skip updates if within debounce window
- [ ] Ensure final update always goes through
- [ ] Test with rapid update() calls (10+ per second)

**Test Cases**:
- [ ] Rapid updates (100ms apart): debounced
- [ ] Normal updates (1s apart): all go through
- [ ] Final update: always sent
- [ ] No rate limit errors from Telegram

**Acceptance**:
- ✅ Max 6-8 message edits per second
- ✅ Rapid updates debounced automatically
- ✅ Final message always displays
- ✅ No Telegram rate limit errors

---

## T-11: Unit Tests

**Effort**: 4h | **Dependencies**: T-10

- [ ] Create `tests/unit/utils/statusMessageManager.test.ts`
- [ ] Test timing threshold (fast vs slow operations)
- [ ] Test progress tracking (step counting)
- [ ] Test message editing flow
- [ ] Test error handling (rate limits, edit failures)
- [ ] Test cleanup (timer cancellation, memory)
- [ ] Mock Grammy context and API calls
- [ ] Achieve >80% code coverage

**Acceptance**:
- ✅ All core functionality covered by tests
- ✅ >80% code coverage
- ✅ Tests pass consistently
- ✅ Mock Grammy context properly

---

## T-12: Integration Tests

**Effort**: 3h | **Dependencies**: T-9, T-11

- [ ] Create `tests/integration/bot/statusMessages.test.ts`
- [ ] Test full note processing flow with status
- [ ] Test photo upload flow with status
- [ ] Test search operations with status
- [ ] Test error scenarios (network failures)
- [ ] Test concurrent operations
- [ ] Verify no memory leaks

**Acceptance**:
- ✅ End-to-end flows tested
- ✅ Status messages appear correctly
- ✅ Final messages replace status
- ✅ Error scenarios handled gracefully

---

## T-13: Documentation

**Effort**: 2h | **Dependencies**: T-12

- [ ] Add JSDoc comments to StatusMessageManager
- [ ] Add usage examples in comments
- [ ] Update CLAUDE.md with status manager patterns
- [ ] Document operation types and when to use each
- [ ] Add troubleshooting guide for common issues
- [ ] Document rate limit handling

**Acceptance**:
- ✅ All public methods documented
- ✅ Usage examples clear and accurate
- ✅ CLAUDE.md updated with patterns
- ✅ Troubleshooting guide complete

---

## Final Verification (MVP)

**Functional**:
- [ ] Status messages appear after 500ms threshold
- [ ] No status for fast operations (<500ms)
- [ ] Progress tracking works (1/3, 2/3, 3/3)
- [ ] Operation-specific templates used correctly
- [ ] Final message replaces status message
- [ ] Chat actions sent appropriately

**Integration**:
- [ ] All handlers use StatusMessageManager
- [ ] No breaking changes to existing flows
- [ ] Photo uploads show status
- [ ] Note processing shows progress
- [ ] Search operations show status

**Performance**:
- [ ] No latency added to fast operations
- [ ] Status appears within 100ms after threshold
- [ ] No memory leaks from timers
- [ ] Rate limits respected (no 429 errors)

**Error Handling**:
- [ ] Handles "message not modified" errors
- [ ] Handles rate limit errors gracefully
- [ ] Handles missing context/chat errors
- [ ] Main operations succeed even if status fails

---

## Robust Product Tasks

**T-14: Spinner Animations** (+4h)
- 8-frame spinner cycle (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
- Interval-based animation loop
- Stop animation on complete

**T-15: Custom Templates** (+3h)
- User-configurable message templates
- Template variables (step, total, elapsed time)
- Save preferences in config

**T-16: Retry Logic** (+2h)
- Automatic retry on edit failures
- Exponential backoff (1s, 2s, 4s)
- Max 3 retries before giving up

**T-17: Cancellation Button** (+3h)
- Inline button "❌ Cancel"
- Stop operation on button click
- Clean up resources

**T-18: Elapsed Time Display** (+2h)
- Track operation start time
- Update status with elapsed seconds
- Format as "3s", "1m 23s"

---

## Advanced Product Tasks

**T-19: i18n Status Messages** (+6h)
- Translate all operation templates
- Support en, ja, zh languages
- Use next-intl for translations

**T-20: Operation Queue** (+5h)
- Track concurrent operations
- Display "3 operations in progress"
- Show queue position

**T-21: Analytics Dashboard** (+4h)
- Track avg time per operation type
- Identify slow operations
- Export metrics to database

**T-22: Progress Bar Styles** (+3h)
- Visual progress bars (████░░░░)
- Percentage display (67%)
- ETA calculation

---

**Total MVP Tasks**: T-1 through T-13 | **Effort**: 32 hours (4 days)

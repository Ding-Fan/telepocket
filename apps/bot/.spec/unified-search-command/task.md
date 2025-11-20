# Unified Search Command Implementation Tasks

**Status**: Not Started | **MVP Effort**: 8 hours | **Priority**: Medium

---

## T-1: Add /search Command Handler

**Effort**: 1h | **Dependencies**: None

- [ ] Open `src/bot/client.ts`
- [ ] Locate `setupCommands()` method (around line 38)
- [ ] Add `/search` command handler after `/links` command (around line 260)
  ```typescript
  this.bot.command('search', async (ctx) => {
    const userId = ctx.from?.id;

    if (!userId || !this.isAuthorizedUser(userId)) {
      await ctx.reply('🚫 Unauthorized access. This bot is private.');
      return;
    }

    // Parse keyword from command
    const args = ctx.message?.text?.split(' ') || [];
    const keyword = args.slice(1).join(' ');

    if (!keyword) {
      await ctx.reply('Usage: /search <keyword>\n\nSearch both notes and links simultaneously.');
      return;
    }

    // Validate search keyword
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      const errorMessage = handleValidationError(validation.error!, {
        userId,
        operation: 'unifiedSearchCommand',
        timestamp: new Date().toISOString()
      });
      await ctx.reply(errorMessage);
      return;
    }

    await this.showUnifiedSearchResults(ctx, userId, keyword, 1);
  });
  ```
- [ ] Add import for `validateSearchKeyword` and `handleValidationError` if not already present

**Acceptance**:
- ✅ `/search` command registered in bot
- ✅ Authorization check works
- ✅ Keyword validation works
- ✅ Empty keyword shows usage message
- ✅ Calls `showUnifiedSearchResults()` with correct parameters

---

## T-2: Create Result Merging Utility

**Effort**: 1.5h | **Dependencies**: T-1

- [ ] Create `mergeSearchResults()` helper function in `client.ts` (add before `showUnifiedSearchResults()`)
  ```typescript
  private mergeSearchResults(
    noteResults: { notes: NoteSearchResult[]; totalCount: number },
    linkResults: { links: LinkOnlyResult[]; totalCount: number }
  ): UnifiedSearchResult[] {
    // Transform note results
    const notesUnified: UnifiedSearchResult[] = noteResults.notes.map(note => ({
      type: 'note' as const,
      relevance_score: note.relevance_score || 0,
      note_id: note.note_id,
      note_content: note.note_content,
      telegram_message_id: note.telegram_message_id,
      created_at: note.created_at,
      links: note.links
    }));

    // Transform link results
    const linksUnified: UnifiedSearchResult[] = linkResults.links.map(link => ({
      type: 'link' as const,
      relevance_score: link.relevance_score || 0,
      link_id: link.link_id,
      note_id: link.note_id,
      url: link.url,
      title: link.title,
      description: link.description,
      og_image: link.og_image,
      created_at: link.created_at
    }));

    // Merge and sort by relevance score descending
    const merged = [...notesUnified, ...linksUnified];
    merged.sort((a, b) => b.relevance_score - a.relevance_score);

    return merged;
  }
  ```
- [ ] Define `UnifiedSearchResult` type in `client.ts` (add at top of file)
  ```typescript
  interface UnifiedSearchResult {
    type: 'note' | 'link';
    relevance_score: number;
    note_id?: string;
    note_content?: string;
    telegram_message_id?: number;
    created_at?: string;
    links?: Array<{
      id: string;
      url: string;
      title?: string;
      description?: string;
      og_image?: string;
    }>;
    link_id?: string;
    url?: string;
    title?: string;
    description?: string;
    og_image?: string;
  }
  ```

**Acceptance**:
- ✅ `mergeSearchResults()` correctly transforms note results
- ✅ `mergeSearchResults()` correctly transforms link results
- ✅ Results sorted by relevance_score descending
- ✅ Type field distinguishes notes from links

---

## T-3: Implement showUnifiedSearchResults Method

**Effort**: 2.5h | **Dependencies**: T-2

- [ ] Add `showUnifiedSearchResults()` method in TelegramClient class (after `showLinksOnlySearchResults()`)
- [ ] Start with status message (typing indicator)
  ```typescript
  const status = await StatusMessageManager.start(ctx, {
    operation: 'searching_notes',
    showAfterMs: 300
  });
  ```
- [ ] Execute parallel searches
  ```typescript
  const [noteResults, linkResults] = await Promise.all([
    noteOps.searchNotesWithPagination(userId, keyword, 1, 100),
    noteOps.searchLinksOnlyWithPagination(userId, keyword, 1, 100)
  ]);
  ```
- [ ] Merge results using `mergeSearchResults()`
- [ ] Handle empty results case
  ```typescript
  if (mergedResults.length === 0) {
    await status.complete(`🔍 No results found matching "${keyword}".\n\nTry a different search term.`);
    return;
  }
  ```
- [ ] Implement client-side pagination (10 items per page)
  ```typescript
  const itemsPerPage = 10;
  const totalPages = Math.ceil(mergedResults.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageResults = mergedResults.slice(startIndex, endIndex);
  ```
- [ ] Build header message
  ```typescript
  const escapedKeyword = escapeMarkdownV2(keyword);
  const noteCount = noteResults.totalCount;
  const linkCount = linkResults.totalCount;
  const totalCount = mergedResults.length;

  let message = `🔍 *Search Results for "${escapedKeyword}"* \\(Page ${page}/${totalPages}\\)\n`;
  message += `📊 Found: ${totalCount} results (${noteCount} notes, ${linkCount} links)\n\n`;
  ```
- [ ] Format results based on type (note vs link)
- [ ] Create pagination keyboard
- [ ] Complete status message with results

**Acceptance**:
- ✅ Parallel search executes correctly
- ✅ Results merged and paginated
- ✅ Empty results handled gracefully
- ✅ Header shows counts correctly
- ✅ Status message pattern followed

---

## T-4: Implement Result Formatting

**Effort**: 1.5h | **Dependencies**: T-3

- [ ] Add result formatting loop in `showUnifiedSearchResults()`
  ```typescript
  pageResults.forEach((result, index) => {
    const resultNumber = startIndex + index + 1;

    if (result.type === 'note') {
      // Format note result
      message += `📝 *${resultNumber}\\.* `;
      message += formatNoteForDisplay({
        note_id: result.note_id!,
        note_content: result.note_content!,
        telegram_message_id: result.telegram_message_id!,
        created_at: result.created_at!,
        links: result.links || [],
        relevance_score: result.relevance_score
      }, {
        maxContentLength: 100,
        maxDescriptionLength: 60,
        showRelevanceScore: true
      });
    } else {
      // Format link result
      message += `🔗 *${resultNumber}\\.* `;
      const escapedTitle = result.title
        ? escapeMarkdownV2(result.title)
        : escapeMarkdownV2(result.url!);
      const escapedUrl = escapeMarkdownV2(result.url!);
      message += `[${escapedTitle}](${escapedUrl})`;

      // Add relevance score
      const percentage = Math.round(result.relevance_score * 100);
      message += ` ${escapeMarkdownV2(`(${percentage}%)`)}`;
      message += '\n';

      // Show URL
      message += `   🔗 ${escapeMarkdownV2(result.url!)}\n`;

      // Add description if available
      if (result.description) {
        const truncatedDesc = result.description.length > 80
          ? result.description.substring(0, 80) + '...'
          : result.description;
        message += `   ${escapeMarkdownV2(truncatedDesc)}\n`;
      }

      message += '\n';
    }
  });
  ```
- [ ] Test formatting with mixed note/link results
- [ ] Verify MarkdownV2 escaping works correctly

**Acceptance**:
- ✅ Note results show 📝 icon + content preview + links
- ✅ Link results show 🔗 icon + title + URL + description
- ✅ Relevance scores displayed as percentages
- ✅ MarkdownV2 formatting correct
- ✅ Results visually distinguishable

---

## T-5: Add Pagination Controls

**Effort**: 1h | **Dependencies**: T-4

- [ ] Create pagination keyboard in `showUnifiedSearchResults()`
  ```typescript
  const keyboard = [];
  const buttons = [];
  const encodedKeyword = encodeURIComponent(keyword);

  // Previous button (only if not on first page)
  if (page > 1) {
    buttons.push({
      text: '⬅️ Previous',
      callback_data: `unified_search_${page - 1}_${encodedKeyword}`
    });
  }

  // Page indicator
  buttons.push({
    text: `🔍 ${page}/${totalPages}`,
    callback_data: `unified_search_info`
  });

  // Next button (only if not on last page)
  if (page < totalPages) {
    buttons.push({
      text: 'Next ➡️',
      callback_data: `unified_search_${page + 1}_${encodedKeyword}`
    });
  }

  if (buttons.length > 1) {
    keyboard.push(buttons);
  }
  ```
- [ ] Send message with keyboard
  ```typescript
  const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

  await status.complete(message, {
    parse_mode: 'MarkdownV2',
    reply_markup: replyMarkup
  });
  ```

**Acceptance**:
- ✅ Previous button only shows when not on first page
- ✅ Next button only shows when not on last page
- ✅ Page indicator always shows
- ✅ Callback data encodes keyword correctly
- ✅ Single-page results show no navigation buttons

---

## T-6: Add Callback Query Handler

**Effort**: 0.5h | **Dependencies**: T-5

- [ ] Open callback_query handler in `client.ts` (around line 286)
- [ ] Add new callback pattern after existing search handlers (around line 400)
  ```typescript
  if (data?.startsWith('unified_search_')) {
    const parts = data.replace('unified_search_', '').split('_');

    // Handle info button (non-interactive)
    if (parts[0] === 'info') {
      await ctx.answerCallbackQuery();
      return;
    }

    // Extract page and keyword
    const requestedPage = parseInt(parts[0]);
    const encodedKeyword = parts.slice(1).join('_');
    const keyword = decodeURIComponent(encodedKeyword);

    // Validate page number
    if (isNaN(requestedPage) || requestedPage < 1) {
      await ctx.answerCallbackQuery('❌ Invalid page number');
      return;
    }

    await this.showUnifiedSearchResults(ctx, userId, keyword, requestedPage);
    await ctx.answerCallbackQuery();
    return;
  }
  ```

**Acceptance**:
- ✅ Callback handler recognizes `unified_search_` pattern
- ✅ Page number extracted correctly
- ✅ Keyword decoded correctly
- ✅ Invalid page numbers handled gracefully
- ✅ Info button click acknowledged without action

---

## T-7: Handle Edit Message for Pagination

**Effort**: 0.5h | **Dependencies**: T-6

- [ ] Update `showUnifiedSearchResults()` to handle both new and edit contexts
- [ ] Add context detection
  ```typescript
  if (ctx.callbackQuery) {
    // Edit existing message for pagination
    await ctx.editMessageText(message, {
      reply_markup: replyMarkup,
      parse_mode: 'MarkdownV2'
    });
  } else {
    // New search - complete status with results
    await status.complete(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: replyMarkup
    });
  }
  ```
- [ ] Test pagination flow (search → next page → previous page)

**Acceptance**:
- ✅ New search creates new message
- ✅ Pagination edits existing message
- ✅ No duplicate messages on pagination
- ✅ Status message not shown on pagination

---

## T-8: Update Help Command and Start Message

**Effort**: 0.5h | **Dependencies**: T-1

- [ ] Update `/start` welcome message in `client.ts` (around line 47)
- [ ] Add `/search` to commands list
  ```
  • /search <keyword> - Search both notes and links
  ```
- [ ] Update `src/constants/helpMessages.ts`
- [ ] Add `/search` command documentation
  ```typescript
  📍 /search <keyword>
  Search both notes and links simultaneously. Results ranked by relevance.

  Examples:
  • /search typescript
  • /search job interview
  ```
- [ ] Test help messages display correctly

**Acceptance**:
- ✅ `/start` message includes `/search`
- ✅ `/help` command documents `/search`
- ✅ Examples provided for clarity
- ✅ MarkdownV2 escaping correct

---

## Final Verification (MVP)

**Functional**:
- [ ] `/search keyword` searches both notes and links
- [ ] Results merged and sorted by relevance
- [ ] Pagination works across merged results
- [ ] Type indicators (📝/🔗) distinguish result types
- [ ] Empty search shows usage message
- [ ] No matches shows "No results found"
- [ ] Fuzzy matching works (typos handled)
- [ ] Parallel search completes quickly

**UI/UX**:
- [ ] Typing indicator shows during search
- [ ] Note results display content + links
- [ ] Link results display title + URL + description
- [ ] Relevance scores shown as percentages
- [ ] Pagination buttons work correctly
- [ ] Page indicator accurate
- [ ] Results scannable and clear

**Edge Cases**:
- [ ] Single result works correctly
- [ ] Large result set (100+ items) paginates correctly
- [ ] Special characters in keyword handled
- [ ] Very long keywords truncated/handled
- [ ] Mixed results with ties in relevance score

**Integration**:
- [ ] Existing `/notes search` still works
- [ ] Existing `/links search` still works
- [ ] No regression in other commands
- [ ] Authorization checks work

**Performance**:
- [ ] Search completes in <1 second
- [ ] No memory leaks
- [ ] Parallel execution faster than sequential
- [ ] Client-side pagination efficient

---

## Robust Product Tasks

**T-9: Search Type Filter Buttons** (+2h)
- Add inline keyboard with filter options: All / Notes Only / Links Only
- Persist filter selection across pagination
- Update callback handlers for filter state

**T-10: Search History** (+2h)
- Create z_search_history table migration
- Track last 10 searches per user with timestamps
- Add `/recent` command to show search history
- Quick-search from history with inline buttons

---

## Advanced Product Tasks

**T-11: Result Grouping UI** (+4h)
- Separate note results and link results into sections
- Independent pagination for each section
- Collapsible sections with counts
- Toggle between unified and grouped views

**T-12: Export Search Results** (+4h)
- Add export button to search results
- Support CSV, JSON, Markdown formats
- Send as document download via Telegram
- Include metadata and relevance scores

---

**Total MVP Tasks**: T-1 through T-8 | **Effort**: 8 hours

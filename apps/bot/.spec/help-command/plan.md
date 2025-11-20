# Help Command Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Help Text Storage** | Constants file (`src/constants/helpMessages.ts`) | Centralized, maintainable, easy to update without touching handler logic |
| **Command Handler Location** | Add to `client.ts` setupCommands() | Follows existing pattern (start, note, notes, links commands) |
| **Formatting Strategy** | MarkdownV2 with escapeMarkdownV2() | Matches existing bot message style, utility already available |
| **Content Organization** | Category-based sections (Notes, Links, Photos, etc.) | Scannable structure, users can quickly find what they need |
| **Authorization** | Same pattern as /start command | Consistent security model, reuse existing isAuthorizedUser() check |
| **Text Structure** | Multi-line template literal with sections | Easy to read in code, simple to modify sections independently |

## Codebase Integration Strategy

**Constants Location**: `src/constants/helpMessages.ts`
- New file following existing constants pattern (see `src/constants/noteCategories.ts`)
- Export `HELP_MESSAGES` object with sections
- Keep each section as separate constant for modularity

**Command Handler Location**: `src/bot/client.ts` (in setupCommands method)
- Add after `/start` command handler (line ~81)
- Follow exact same pattern: authorization check → format message → send reply
- Use existing utilities: `isAuthorizedUser()`, `escapeMarkdownV2()`, `createMainKeyboard()`

**Message Formatting**:
- Use template literals for multi-line help text
- Call `escapeMarkdownV2()` on final message
- Set `parse_mode: 'MarkdownV2'` in reply options
- Include persistent keyboard with `createMainKeyboard()`

## Technical Approach

**Existing Patterns to Follow**:
1. **Command Handler**: Study `src/bot/client.ts:38-81` (/start command) for exact pattern
2. **Constants Structure**: Study `src/constants/noteCategories.ts` for export pattern
3. **Message Formatting**: Use `escapeMarkdownV2()` from `src/utils/linkFormatter.ts`
4. **Authorization**: Use `isAuthorizedUser()` pattern from client.ts

**Help Text Composition**:
- Break help text into logical sections (Header, Notes, Links, Photos, etc.)
- Each section is a separate constant for easy updates
- Final `HELP_MESSAGES.MAIN` concatenates all sections
- Use emoji consistently with existing bot messages

**Command Handler Flow**:
```typescript
bot.command('help', async (ctx) => {
  // 1. Extract user ID
  const userId = ctx.from?.id;

  // 2. Check authorization (same as /start)
  if (!userId || !this.isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  // 3. Get help text from constants
  const helpText = HELP_MESSAGES.MAIN;

  // 4. Escape for MarkdownV2
  const escapedHelp = escapeMarkdownV2(helpText);

  // 5. Send with persistent keyboard
  await ctx.reply(escapedHelp, {
    reply_markup: this.createMainKeyboard(),
    parse_mode: 'MarkdownV2'
  });
});
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **MarkdownV2 formatting errors** | Test message in Telegram before deployment; use escapeMarkdownV2() utility |
| **Outdated command documentation** | Review all commands in client.ts before writing help text; verify syntax |
| **Help text too long** | Keep concise; use examples sparingly; test readability on mobile |
| **Missing new commands** | Document process for updating help when adding new commands |

## Integration Points

**client.ts**: Line ~81 (after /start command handler)
**New file**: `src/constants/helpMessages.ts`
**Utilities**: `escapeMarkdownV2` from `src/utils/linkFormatter.ts`

## Success Criteria

**Technical**:
- No TypeScript errors
- Help command follows existing pattern exactly
- MarkdownV2 renders correctly in Telegram
- All commands documented with correct syntax

**User**:
- Help text is scannable and easy to read
- Examples are clear and realistic
- Users can find command they need in <30 seconds
- No confusion about command syntax

**Business**:
- Reduced support questions about "how do I..."
- Users discover features they didn't know existed
- Clear documentation improves user retention

## Robust Product (+1 day)

Per-command help (`/help notes`), inline help buttons in error messages, context-sensitive help (show relevant help per feature), help button in pagination controls, command auto-completion hints.

## Advanced Product (+2 days)

Interactive help with command builder (click buttons to construct command), searchable help (`/help search <term>`), multi-language help with i18n support, embedded video tutorials, FAQ section, help analytics (track which commands users need help with).

---

**Total MVP Effort**: 6-8 hours (1 day) | **Dependencies**: None

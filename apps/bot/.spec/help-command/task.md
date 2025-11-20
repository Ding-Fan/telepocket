# Help Command Implementation Tasks

**Status**: Not Started | **MVP Effort**: 6-8 hours | **Priority**: Medium

---

## T-1: Create Help Messages Constants File

**Effort**: 1h | **Dependencies**: None

- [ ] Create `src/constants/helpMessages.ts`
- [ ] Define `HELP_MESSAGES` object with sections:
  ```typescript
  export const HELP_MESSAGES = {
    HEADER: '📚 **Telepocket Help**\n\n...',
    ABOUT: 'ℹ️ **About**\n...',
    BASIC_COMMANDS: '**Basic Commands:**\n...',
    NOTES_SECTION: '**📝 Notes Management:**\n...',
    LINKS_SECTION: '**🔗 Links Management:**\n...',
    PHOTOS_SECTION: '**📸 Photos:**\n...',
    SEARCH_SECTION: '**🔍 Search Tips:**\n...',
    CATEGORIES_SECTION: '**🏷️ Categories:**\n...',
    TIPS_SECTION: '**💡 Pro Tips:**\n...',
    MAIN: '', // Concatenation of all sections
  };
  ```
- [ ] Document all commands with correct syntax:
  - `/start`, `/help`
  - `/note <text>` with examples
  - `/notes`, `/notes <page>`, `/notes <category>`, `/notes search <keyword>`
  - `/links`, `/links <page>`, `/links search <keyword>`
  - Photo upload behavior
- [ ] Add usage examples for complex commands
- [ ] Include category descriptions with emojis
- [ ] Add tips section (multiple links, auto-save, categories)
- [ ] Concatenate all sections into `MAIN` constant

**Acceptance**:
- ✅ All existing commands documented
- ✅ Syntax matches actual implementation
- ✅ Examples are realistic and helpful
- ✅ Organized into 7+ clear sections
- ✅ No TypeScript errors

---

## T-2: Review All Existing Commands

**Effort**: 30min | **Dependencies**: None

- [ ] Read `src/bot/client.ts` setupCommands() method
- [ ] List all command handlers:
  - `/start` (line 38)
  - `/note` (line 84)
  - `/notes` (line 95)
  - `/links` (line 145)
  - Photo handler (line 191)
  - Keyboard button handler (line 333)
- [ ] Document command parameters and variants:
  - `/notes` with no args, page number, category, search
  - `/links` with no args, page number, search
- [ ] Note any command syntax requirements
- [ ] Check for any undocumented features

**Acceptance**:
- ✅ All commands identified and documented
- ✅ Parameter syntax verified
- ✅ No missing commands in help text

---

## T-3: Add Help Command Handler

**Effort**: 1h | **Dependencies**: T-1, T-2

- [ ] Open `src/bot/client.ts`
- [ ] Import help messages: `import { HELP_MESSAGES } from '../constants/helpMessages';`
- [ ] Add command handler after `/start` (around line 81):
  ```typescript
  // Help command
  this.bot.command('help', async (ctx) => {
    const userId = ctx.from?.id;

    if (!userId || !this.isAuthorizedUser(userId)) {
      await ctx.reply('🚫 Unauthorized access. This bot is private.');
      return;
    }

    const helpText = HELP_MESSAGES.MAIN;
    const escapedHelp = escapeMarkdownV2(helpText);

    await ctx.reply(escapedHelp, {
      reply_markup: this.createMainKeyboard(),
      parse_mode: 'MarkdownV2'
    });
  });
  ```
- [ ] Ensure proper indentation and formatting
- [ ] Follow existing command handler pattern exactly

**Acceptance**:
- ✅ Command handler added in correct location
- ✅ Authorization check implemented
- ✅ Uses escapeMarkdownV2 utility
- ✅ Includes persistent keyboard
- ✅ No TypeScript errors

---

## T-4: Test MarkdownV2 Formatting

**Effort**: 1h | **Dependencies**: T-1, T-3

- [ ] Build project: `pnpm build`
- [ ] Check for TypeScript errors
- [ ] Start bot: `pnpm dev` or deploy with PM2
- [ ] Send `/help` command in Telegram
- [ ] Verify formatting renders correctly:
  - Bold headers (**Section**)
  - Bullet points (•)
  - Code formatting for examples
  - Emoji display correctly
  - No escaped characters visible (\\, \_, etc.)
- [ ] Check readability on mobile device
- [ ] Test message length (should fit in single message)

**Test Cases**:
- [ ] `/help` shows full help message
- [ ] Bold sections render correctly
- [ ] Examples are properly formatted
- [ ] Emoji display correctly
- [ ] No MarkdownV2 syntax errors
- [ ] Message is readable on mobile

**Acceptance**:
- ✅ Help message renders correctly
- ✅ All formatting displays as intended
- ✅ No escaped characters showing
- ✅ Readable on mobile device
- ✅ No Telegram API errors

---

## T-5: Update Help Text with Current Commands

**Effort**: 30min | **Dependencies**: T-2, T-4

- [ ] Verify all commands from T-2 are in help text
- [ ] Update any incorrect syntax
- [ ] Add missing command variants
- [ ] Update examples to match actual behavior
- [ ] Verify category names match `src/constants/noteCategories.ts`
- [ ] Check that features match current implementation

**Acceptance**:
- ✅ All commands documented
- ✅ Syntax matches implementation
- ✅ No outdated or incorrect information
- ✅ Examples reflect actual bot behavior

---

## T-6: Add Help to /start Message

**Effort**: 30min | **Dependencies**: T-3

- [ ] Open `src/bot/client.ts`
- [ ] Update `/start` command welcome message (line 46)
- [ ] Add help command to command list:
  ```typescript
  📚 **Commands:**
  • /start - Show welcome message
  • /help - Show detailed command help 👈 NEW!
  • /links - View all your saved links
  ...
  ```
- [ ] Keep welcome message concise, refer to `/help` for details

**Acceptance**:
- ✅ `/start` mentions `/help` command
- ✅ Users know where to find detailed help
- ✅ Welcome message not overloaded with details

---

## T-7: Documentation Update

**Effort**: 30min | **Dependencies**: T-3, T-4

- [ ] Update `CLAUDE.md` with `/help` command in commands list
- [ ] Add note about updating help text when adding new commands
- [ ] Document help message structure for future maintainers
- [ ] Add example of how to test help formatting

**Acceptance**:
- ✅ CLAUDE.md updated with `/help` command
- ✅ Maintenance notes added
- ✅ Future developers know how to update help

---

## T-8: Final Testing

**Effort**: 1h | **Dependencies**: T-1 through T-7

- [ ] Build project: `pnpm build`
- [ ] Deploy with PM2: `pm2 stop telepocket && pm2 start telepocket && pm2 save`
- [ ] Test all scenarios:
  - Unauthorized user tries `/help` → Gets rejection message
  - Authorized user sends `/help` → Gets formatted help
  - Help text is complete and accurate
  - All examples work as documented
  - Links in help (if any) are clickable
- [ ] Test on mobile and desktop Telegram clients
- [ ] Verify persistent keyboard appears with help message

**Test Cases**:
- [ ] Unauthorized access rejected
- [ ] Authorized user sees help
- [ ] All sections present
- [ ] Examples are accurate
- [ ] Formatting perfect on mobile
- [ ] Persistent keyboard included

**Acceptance**:
- ✅ All tests pass
- ✅ Help works for authorized users only
- ✅ Formatting correct on all devices
- ✅ No errors in logs

---

## Final Verification (MVP)

**Functional**:
- [ ] `/help` command responds correctly
- [ ] Authorization check works
- [ ] All 8+ commands documented
- [ ] Usage examples included
- [ ] Categories explained
- [ ] Tips section present

**Content**:
- [ ] All commands listed
- [ ] Correct syntax with parameters
- [ ] Realistic examples
- [ ] Organized into sections
- [ ] Emoji for visual hierarchy
- [ ] No missing commands

**Formatting**:
- [ ] MarkdownV2 properly rendered
- [ ] Bold headers display correctly
- [ ] Bullet points formatted
- [ ] Examples indented properly
- [ ] Readable on mobile
- [ ] No formatting errors

**Integration**:
- [ ] Follows existing command pattern
- [ ] Uses same authorization
- [ ] Uses escapeMarkdownV2 utility
- [ ] No breaking changes
- [ ] Deployed successfully

---

## Robust Product Tasks

**T-9: Per-Command Help** (+2h)
- Parse `/help <command>` arguments
- Show detailed help for specific command
- Examples: `/help notes`, `/help links`

**T-10: Inline Help Buttons** (+2h)
- Add "❓ Help" buttons to error messages
- Context-sensitive help based on error type
- Deep link to relevant help section

**T-11: Help in Pagination** (+1h)
- Add help button to pagination controls
- Quick access to search syntax
- Command reminders in pagination footer

---

## Advanced Product Tasks

**T-12: Interactive Help Builder** (+6h)
- Inline keyboard to construct commands
- Click buttons to add parameters
- Preview command before sending

**T-13: Searchable Help** (+4h)
- `/help search <term>` to search help
- Fuzzy matching on command names
- Return relevant help sections

**T-14: Multi-Language Help** (+6h)
- i18n integration for help text
- Language selection in /start
- Translate all help sections

**T-15: Help Analytics** (+2h)
- Track which commands users request help for
- Store in database
- Identify confusing features

---

**Total MVP Tasks**: T-1 through T-8 | **Effort**: 6-8 hours

# Help Command Specification

## Problem & Solution

**Problem**: Users don't know what commands are available or how to use them. Current `/start` command shows welcome message but users need quick reference for command syntax and usage examples. No dedicated help command exists.

**Solution**: Add `/help` command that displays comprehensive, organized guide of all bot commands with syntax, parameters, and usage examples. Categorize by feature (Notes, Links, Photos, Search, Categories) for easy scanning.

**Returns**: Formatted help message with MarkdownV2, organized by categories, showing all commands with usage examples.

## Component API

```typescript
// Help message constants
export const HELP_MESSAGES = {
  MAIN: string;        // Full help text with all commands
  HEADER: string;      // Help header with bot description
  NOTES_SECTION: string;
  LINKS_SECTION: string;
  PHOTOS_SECTION: string;
  SEARCH_SECTION: string;
  CATEGORIES_SECTION: string;
  TIPS_SECTION: string;
};

// Command handler signature (follows existing pattern)
bot.command('help', async (ctx: Context) => {
  // Send formatted help message
});
```

## Usage Example

```typescript
// User types in Telegram
/help

// Bot responds with formatted message
📚 **Telepocket Help**

**Basic Commands:**
• /start - Show welcome message
• /help - Show this help message

**Notes Management:**
• /note <text> - Save a note
  Example: /note Remember to review PR

• /notes - View all notes (page 1)
• /notes 2 - Go to page 2
• /notes todo - Filter by category
• /notes search react - Search notes

[... continues with all commands ...]
```

## Core Flow

```
User sends /help command
  ↓
Bot checks authorization
  ↓
Bot retrieves help text from constants
  ↓
Bot escapes text for MarkdownV2
  ↓
Bot sends formatted help message
  ↓
User sees organized command reference
```

## User Stories

**US-1: Quick Command Reference**
User forgets command syntax for searching notes. Types `/help`, sees "Notes Management" section with `/notes search <keyword>` example. User copies syntax and successfully searches notes.

**US-2: New User Onboarding**
New user receives bot access. Types `/help` to understand capabilities. Sees organized categories (Notes, Links, Photos, Search). Reads examples, sends first note successfully.

**US-3: Feature Discovery**
User knows about notes but doesn't know about categories. Reads `/help`, discovers "Categories" section explaining todo, idea, blog, youtube, reference filters. Uses `/notes todo` to filter tasks.

## MVP Scope

**Included**:
- `/help` command handler in client.ts
- Help text constants in `src/constants/helpMessages.ts`
- Organized by categories (Notes, Links, Photos, Search, Categories)
- Command syntax with parameter placeholders (e.g., `<text>`, `<page>`, `<keyword>`)
- Usage examples for each command variant
- Tips section for power users
- MarkdownV2 formatting (escaping handled)
- Authorization check (same as other commands)

**NOT Included** (Future):
- Per-command help (`/help notes`) → 🔧 Robust
- Inline help buttons → 🔧 Robust
- Context-sensitive help → 🔧 Robust
- Error message help hints → 🔧 Robust
- Interactive help with command builder → 🚀 Advanced
- Searchable help → 🚀 Advanced
- Multi-language help (i18n) → 🚀 Advanced
- Video tutorials → 🚀 Advanced

## Help Message Structure

```markdown
📚 **Telepocket Help**

ℹ️ **About**
Your personal link and note manager for Telegram.

**Basic Commands:**
• /start - Show welcome message
• /help - Show this help message

**📝 Notes Management:**
• /note <text> - Save a note (links optional)
  Example: /note Remember to review PR #123
  Example: /note Check out https://example.com

• /notes - View all notes (page 1)
• /notes <page> - Go to specific page
  Example: /notes 3

• /notes <category> - Filter by category
  Example: /notes todo
  Example: /notes blog

• /notes search <keyword> - Search notes
  Example: /notes search react hooks

**🔗 Links Management:**
• /links - View all saved links (page 1)
• /links <page> - Go to specific page
  Example: /links 2

• /links search <keyword> - Search links
  Example: /links search typescript

**📸 Photos:**
• Send photo - Auto-upload to cloud storage
• Send photo with caption - Save as note with image
  Example: Send photo with caption "Product screenshot"

**🔍 Search Tips:**
• Fuzzy matching - typos are forgiven
• Searches content, titles, descriptions, URLs
• Case-insensitive

**🏷️ Categories:**
• todo 📋 - Tasks and reminders
• idea 💡 - Brainstorms and concepts
• blog 📝 - Blog posts and articles
• youtube 📺 - Video content
• reference 📚 - Documentation and guides

**⚡ Quick Access:**
• 📋 My Notes button - Quick access to notes list
• Just send text - Auto-saved as note

**💡 Pro Tips:**
• Send multiple links in one message
• Photos auto-upload with public URLs
• Categories appear as buttons after saving
• All data stored in your Supabase database
```

## Acceptance Criteria (MVP)

**Functional**:
- [ ] `/help` command handler added to client.ts
- [ ] Help text stored in `src/constants/helpMessages.ts`
- [ ] Authorization check implemented (same as other commands)
- [ ] All 8+ command variants documented
- [ ] Usage examples included for complex commands
- [ ] Categories explained with emojis
- [ ] Tips section included

**Content**:
- [ ] All existing commands listed
- [ ] Correct syntax with parameter placeholders
- [ ] Examples use realistic scenarios
- [ ] Organized into 7 sections (About, Basic, Notes, Links, Photos, Search, Categories, Tips)
- [ ] Emoji icons for visual hierarchy
- [ ] No missing or outdated commands

**Formatting**:
- [ ] MarkdownV2 properly escaped
- [ ] Bold headers for sections
- [ ] Bullet points for commands
- [ ] Indented examples
- [ ] Readable on mobile devices
- [ ] No formatting errors in Telegram

**Integration**:
- [ ] Follows existing command handler pattern
- [ ] Uses same authorization check as /start
- [ ] Uses escapeMarkdownV2 utility
- [ ] No breaking changes to other commands

## Future Tiers

**🔧 Robust** (+1 day): Per-command help (`/help notes`, `/help links`), inline help buttons in error messages, context-sensitive help (different help per feature), help button in pagination controls, command auto-completion hints.

**🚀 Advanced** (+2 days): Interactive help with command builder (click to construct command), searchable help (`/help search <term>`), multi-language help with i18n, embedded video tutorials, FAQ section with common issues, help analytics (track which commands users need help with most).

---

**Status**: Ready for Implementation | **MVP Effort**: 1 day (6-8 hours)

# Bot Architecture Restructuring Specification

## Problem & Solution

**Problem**: The 2,800-line `client.ts` file contains 10 commands, 2 event handlers, and 15+ view methods, making it difficult to maintain, test, and scale. The monolithic structure violates single responsibility principle and makes the codebase hard to navigate.

**Solution**: Refactor into modular structure following grammY's Composer pattern. Each module exports a Composer instance handling specific functionality. Main bot assembly file imports and installs all modules.

**Returns**: Organized codebase with ~20 focused files (10-15 commands, 2 handlers, 5-10 views) that are easier to maintain, test, and extend.

## Module API

```typescript
// Command module pattern
import { Composer } from 'grammy';

export const classifyCommand = new Composer();

classifyCommand.command('classify', async (ctx) => {
  // Handler logic
});

// Handler module pattern
export const callbackHandler = new Composer();

callbackHandler.on('callback_query', async (ctx) => {
  // Callback routing logic
});

// View function pattern
export async function showGlanceView(ctx: any, userId: number): Promise<void> {
  // Rendering logic
}
```

## Usage Example

```typescript
// src/bot/bot.ts - Main assembly
import { Bot } from 'grammy';
import { classifyCommand } from './commands/classify';
import { notesCommand } from './commands/notes';
import { callbackHandler } from './handlers/callbacks';

const bot = new Bot(token);

// Install command modules
bot.use(classifyCommand);
bot.use(notesCommand);

// Install event handlers
bot.use(callbackHandler);

bot.start();
```

## Current Structure Analysis

**Existing File** (`src/bot/client.ts` - 2800 lines):
- Commands: 10 (start, help, note, notes, archived, links, search, glance, suggest, classify)
- Event Handlers: 2 (callback_query, message:photo)
- View Methods: 15+ (showNotesPage, showLinksPage, showGlanceView, etc.)
- Helper Methods: 10+ (createMainKeyboard, handleCategoryButtonClick, etc.)

## Target Structure

```
src/bot/
├── bot.ts                    # Main bot assembly (~50 lines)
├── commands/
│   ├── start.ts             # /start command
│   ├── help.ts              # /help command
│   ├── note.ts              # /note command
│   ├── notes.ts             # /notes command
│   ├── archived.ts          # /archived command
│   ├── links.ts             # /links command
│   ├── search.ts            # /search command
│   ├── glance.ts            # /glance command
│   ├── suggest.ts           # /suggest command
│   ├── classify.ts          # /classify command (MVP first)
│   └── index.ts             # Export all composers
├── handlers/
│   ├── callbacks.ts         # Callback query router
│   ├── messages.ts          # Photo message handler
│   └── index.ts             # Export all handlers
├── views/
│   ├── notes.ts             # showNotesPage, showNoteDetail, etc.
│   ├── links.ts             # showLinksPage, showLinksOnlyPage
│   ├── glance.ts            # showGlanceView
│   ├── suggest.ts           # showSuggestView
│   ├── search.ts            # showSearchResults, showUnifiedSearchResults
│   ├── archived.ts          # showArchivedNotesPage
│   └── index.ts             # Export all view functions
├── utils/
│   ├── keyboards.ts         # createMainKeyboard
│   └── index.ts
├── client.ts                # Legacy (delete after migration)
├── handlers.ts              # Keep as-is
└── noteHandlers.ts          # Keep as-is
```

## Core Flow

```
User sends /classify
  ↓
bot.ts routes to classifyCommand Composer
  ↓
classify.ts handles command
  ↓
Calls view functions from views/
  ↓
Returns formatted message to user
```

## User Stories

**US-1: Developer Navigates Codebase**
Developer needs to modify classify command. Opens `src/bot/commands/classify.ts` (150 lines) instead of searching through 2,800-line monolith. Finds relevant code immediately.

**US-2: Developer Adds New Command**
Developer creates new command. Creates `commands/newcmd.ts`, exports Composer, imports in `bot.ts`. No risk of breaking existing commands in separate files.

**US-3: Developer Debugs Callback Handler**
Callback query fails. Developer opens `handlers/callbacks.ts` (300 lines) to debug routing logic. Clear separation from commands and views makes debugging faster.

## MVP Scope

**Included**:
- Extract `/classify` command first (highest priority, currently broken)
- Extract remaining 9 commands into `commands/` directory
- Extract 2 event handlers into `handlers/` directory
- Extract 15 view methods into `views/` directory
- Create main `bot.ts` assembly file
- Create barrel exports (`index.ts`) for each directory
- Incremental migration: test after each extraction
- Keep `noteHandlers.ts` and `handlers.ts` unchanged
- Manual testing via Telegram

**NOT Included** (Future):
- grammY Router plugin or middleware → 🔧 Robust
- Unit tests for commands → 🔧 Robust
- Plugin architecture or conversation flows → 🚀 Advanced
- Webhook mode or multi-language support → 🚀 Advanced

## File Size Targets

- Command files: 50-200 lines each
- Handler files: 200-400 lines each
- View files: 150-300 lines each
- Main bot.ts: ~50 lines
- Total lines: Same as before, but organized

## Acceptance Criteria (MVP)

**Functional**:
- [ ] `/classify` command works after extraction
- [ ] All 10 commands work after extraction
- [ ] Callback queries route correctly
- [ ] Photo messages handled correctly
- [ ] All view methods render correctly
- [ ] No functionality lost during migration
- [ ] Bot starts without errors

**Code Organization**:
- [ ] Each command in separate file under `commands/`
- [ ] Event handlers in separate files under `handlers/`
- [ ] View methods grouped logically under `views/`
- [ ] All modules export Composer instances
- [ ] Main `bot.ts` assembles all modules
- [ ] Barrel exports in each directory

**Migration**:
- [ ] Classify command extracted and tested first
- [ ] Each command tested after extraction
- [ ] No breaking changes between extractions
- [ ] Legacy `client.ts` deleted after full migration

## Future Tiers

**🔧 Robust** (+1-2 days): Add grammY Router plugin for cleaner routing, custom middleware for logging/metrics/rate-limiting, unit tests for each command module, error boundaries per module.

**🚀 Advanced** (+3-5 days): Plugin architecture for extensibility, conversation flows using grammY Conversations plugin, webhook mode for production, multi-language bot responses, command permissions/roles system.

---

**Status**: Ready for Implementation | **MVP Effort**: 2-3 days (16-20 hours)

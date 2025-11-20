# Bot Architecture Restructuring Implementation Plan

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Module Pattern** | grammY Composer | Official recommendation for large codebases; middleware composition |
| **Directory Structure** | Commands + Handlers + Views | Matches MVC pattern; clear separation of concerns |
| **Migration Strategy** | Incremental (classify first) | Reduces risk; allows testing between extractions |
| **Export Pattern** | Barrel exports (index.ts) | Clean imports; easy to add new modules |
| **Dependencies** | No new libraries | Just reorganization; avoid scope creep |
| **Testing** | Manual via Telegram | Quickest validation; matches current workflow |
| **File Retention** | Keep handlers.ts, noteHandlers.ts | These files already modular; no need to touch |

## Codebase Integration Strategy

**Component Location**: `src/bot/`
- Follows existing `src/bot/` structure
- New subdirectories: `commands/`, `handlers/`, `views/`, `utils/`
- Legacy `client.ts` remains until full migration complete

**Module Integration Pattern**:
- Each module exports Composer: `export const cmdName = new Composer()`
- Main `bot.ts` imports and installs: `bot.use(cmdName)`
- View functions exported as plain async functions
- No breaking changes to external callers

**Import Strategy**:
```typescript
// Before (monolith)
import { telegramClient } from './bot/client';

// After (modular)
import { telegramClient } from './bot/bot';  // bot.ts exports same interface
```

**Incremental Migration Flow**:
1. Create new directory structure
2. Extract classify command → test
3. Extract remaining commands one-by-one → test each
4. Extract handlers → test
5. Extract views → test
6. Delete legacy client.ts

## Technical Approach

**Existing Patterns to Follow**:
1. **Composer Pattern**: Study grammY docs at `https://grammy.dev/advanced/structuring`
2. **Command Structure**: Existing pattern in `client.ts:355` (classify command)
3. **View Methods**: Existing pattern in `client.ts:1180` (showGlanceView)
4. **Barrel Exports**: Similar to `src/services/index.ts` pattern

**File Extraction Steps** (per command):
1. Create `commands/[name].ts`
2. Copy command handler from `client.ts`
3. Add Composer boilerplate
4. Fix imports (ctx, dbOps, noteOps, etc.)
5. Export Composer
6. Import in `bot.ts`
7. Test command via Telegram
8. Remove from `client.ts` (after all extractions)

**Composer Boilerplate**:
```typescript
import { Composer } from 'grammy';

export const classifyCommand = new Composer();

classifyCommand.command('classify', async (ctx) => {
  // Existing handler logic copied from client.ts
});
```

**View Function Extraction**:
- Group related views in same file (e.g., all notes views in `views/notes.ts`)
- Export as plain async functions (not Composers)
- Keep method signatures identical
- Import shared dependencies (dbOps, noteOps, formatters)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| **Breaking existing functionality** | Incremental migration with testing after each step |
| **Import path issues** | Use barrel exports; test imports after each extraction |
| **Shared state between modules** | Ensure modules are stateless; pass dependencies explicitly |
| **Large file conflicts** | Extract classify first (highest priority); avoid parallel work on client.ts |
| **Missing dependencies** | Review all imports during extraction; test immediately |

## Integration Points

**Commands**: `src/bot/client.ts:64-364` → `src/bot/commands/*.ts`
**Handlers**: `src/bot/client.ts:367-678` → `src/bot/handlers/*.ts`
**Views**: `src/bot/client.ts:737-2489` → `src/bot/views/*.ts`
**Utils**: `src/bot/client.ts:56-61` → `src/bot/utils/keyboards.ts`

## Success Criteria

**Technical**:
- All commands respond correctly in Telegram
- No TypeScript compilation errors
- File sizes: commands 50-200 lines, handlers 200-400 lines, views 150-300 lines
- Main bot.ts under 100 lines

**User**:
- No behavior changes from user perspective
- All existing functionality preserved
- Bot startup time unchanged

**Developer**:
- Easy to find specific command/handler/view
- Clear module boundaries
- New commands easy to add

## Robust Product (+1-2 days)

Add grammY Router plugin for cleaner routing, custom middleware for logging/metrics/rate-limiting, unit tests for each command module, error boundaries per module, TypeScript strict mode compliance.

## Advanced Product (+3-5 days)

Plugin architecture for extensibility, conversation flows using grammY Conversations plugin, webhook mode for production scaling, multi-language bot responses with i18n, command permissions/roles system, admin dashboard.

---

**Total MVP Effort**: 16-20 hours (2-3 days) | **Dependencies**: None

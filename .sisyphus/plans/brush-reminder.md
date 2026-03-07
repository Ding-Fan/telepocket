# Brush Teeth Reminder Feature

## TL;DR

> **Quick Summary**: Add a personal "brush teeth" reminder that sends twice daily (08:00 & 22:00 JST) with interactive buttons for acknowledgment/snooze, auto-expiration after 1 hour, streak tracking, and weekly summary.
> 
> **Deliverables**:
> - Database migration for `z_brush_events` table + streak function
> - Standalone worker process (`brushWorker.ts`) for scheduling
> - Callback handlers in main bot for button interactions
> - PM2 configuration for worker process
> 
> **Estimated Effort**: Medium (2-3 days)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (DB) → Task 2 (Service) → Task 3 (Worker) → Task 5 (Callbacks) → Task 6 (PM2)

---

## Context

### Original Request
User wants the bot to remind them every morning and night to brush teeth, with interactive acknowledgment.

### Interview Summary
**Key Discussions**:
- Scope: Hardcoded brush teeth only (personal use)
- Timing: Fixed 08:00 and 22:00 Asia/Tokyo
- Interaction: Streaks + Logging + Snooze (10 min) + Auto-expire (1 hour)
- Stats: Automatic weekly summary on Sunday 20:00

**Research Findings**:
- Bot uses Grammy.js with modular command handlers
- No existing scheduling system - need `node-cron`
- PM2 manages production processes
- **Critical**: Worker cannot import `telegramClient` singleton (starts long-polling)
- Worker must create own `Bot` instance for API calls only

### Metis Review
**Identified Gaps** (addressed):
- Worker architecture: Use separate Bot instance, never call `.start()`
- Message editing: Store `telegram_message_id` in DB after sending
- Timezone: Explicit `Asia/Tokyo` in `node-cron`
- Single table design: Compute streak on-demand instead of separate stats table

---

## Work Objectives

### Core Objective
Send automated brush teeth reminders twice daily with interactive feedback, streak tracking, and weekly summary.

### Concrete Deliverables
- `packages/shared/supabase/migrations/YYYYMMDD_add_brush_events.sql`
- `apps/bot/src/worker/brushWorker.ts`
- `apps/bot/src/services/brushReminderService.ts`
- `apps/bot/src/database/brushOperations.ts`
- `apps/bot/src/types/brushReminder.ts`
- Updated `apps/bot/src/bot/handlers/callbacks.ts`
- Updated `~/pm2-manager/ecosystem.config.js`

### Definition of Done
- [ ] Reminder sent at 08:00 and 22:00 JST daily
- [ ] ✅ Done button updates streak and edits message
- [ ] ⏰ Snooze button triggers 10-min delayed reminder
- [ ] Unresponded reminders auto-expire after 1 hour with "Missed" edit
- [ ] Weekly summary sent Sunday 20:00 JST
- [ ] Worker runs as separate PM2 process

### Must Have
- Fixed schedule: 08:00 and 22:00 Asia/Tokyo
- Interactive buttons: Done and Snooze (10 min)
- Auto-expire: 1 hour timeout, mark as missed, reset streak
- Streak tracking: Consecutive completions, best streak ever
- Weekly summary: Completion count, current streak, best streak
- Message editing: All state changes edit the original message in-place

### Must NOT Have (Guardrails)
- ❌ General reminders system - brush teeth only
- ❌ User preferences/settings table - hardcoded config
- ❌ Configurable times - fixed 08:00/22:00
- ❌ Multiple snooze durations - 10 min only
- ❌ Pause/resume feature - not in scope
- ❌ Web UI for reminders - not in scope
- ❌ Import `telegramClient` in worker - creates duplicate polling

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Jest in apps/bot)
- **User wants tests**: TDD for core logic
- **Framework**: Jest (existing)

### For API/Backend & Worker Changes

Each TODO includes agent-executable verification via:
- `curl` commands against Supabase REST API
- `pm2 logs` grep for scheduled execution
- Direct DB queries to verify state

**Evidence Requirements:**
- Command output captured and compared against expected patterns
- Exit codes checked (0 = success)
- JSON response fields validated with specific assertions

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: DB Migration (no dependencies)
└── Task 4: TypeScript Types (no dependencies)

Wave 2 (After Wave 1):
├── Task 2: DB Operations (depends: 1, 4)
├── Task 3: Reminder Service (depends: 1, 4)
└── Task 5: Callback Handlers (depends: 4)

Wave 3 (After Wave 2):
└── Task 6: Worker Entry Point (depends: 2, 3)

Wave 4 (After Wave 3):
├── Task 7: PM2 Configuration (depends: 6)
└── Task 8: Integration Testing (depends: all)

Critical Path: Task 1 → Task 2 → Task 6 → Task 7 → Task 8
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | 4 |
| 4 | None | 2, 3, 5 | 1 |
| 2 | 1, 4 | 6 | 3, 5 |
| 3 | 1, 4 | 6 | 2, 5 |
| 5 | 4 | 8 | 2, 3 |
| 6 | 2, 3 | 7, 8 | None |
| 7 | 6 | 8 | None |
| 8 | All | None | None (final) |

---

## TODOs

- [ ] 1. Create Database Migration

  **What to do**:
  - Create migration file `packages/shared/supabase/migrations/YYYYMMDD_add_brush_events.sql`
  - Create `z_brush_events` table with columns:
    - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
    - `telegram_user_id` BIGINT NOT NULL
    - `telegram_message_id` BIGINT (nullable, filled after send)
    - `chat_id` BIGINT NOT NULL
    - `event_type` TEXT NOT NULL CHECK (event_type IN ('morning', 'night'))
    - `status` TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'snoozed', 'completed', 'missed'))
    - `scheduled_at` TIMESTAMPTZ NOT NULL
    - `expires_at` TIMESTAMPTZ NOT NULL
    - `snooze_until` TIMESTAMPTZ (nullable)
    - `completed_at` TIMESTAMPTZ (nullable)
    - `created_at` TIMESTAMPTZ DEFAULT now()
  - Create indexes on `status`, `expires_at`, `snooze_until`
  - Create `calculate_brush_streak(p_user_id BIGINT)` function that:
    - Returns `{ current_streak, best_streak, total_completions, completion_rate_7d }`
    - Counts consecutive days with at least one completion
    - Computes best streak ever from historical data

  **Must NOT do**:
  - Create separate stats table (compute from events)
  - Add RLS policies (personal bot, single user)
  - Create general reminders schema

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation with clear SQL patterns from existing migrations
  - **Skills**: [`Supabase Database Manager`]
    - `Supabase Database Manager`: Migration file creation and deployment workflow

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/shared/supabase/migrations/20251229_create_search_history_table.sql` - Similar table structure with TIMESTAMPTZ, indexes, and cleanup trigger pattern
  - `packages/shared/supabase/migrations/20251115180312_create_suggestions_function.sql` - Function returning composite type pattern for `calculate_brush_streak`

  **API/Type References**:
  - `packages/shared/src/types.ts` - Where to add TypeScript interface later (Task 4)

  **External References**:
  - PostgreSQL CHECK constraints: https://www.postgresql.org/docs/current/ddl-constraints.html

  **Acceptance Criteria**:

  ```bash
  # Verify migration file exists
  ls packages/shared/supabase/migrations/*brush_events*.sql
  # Assert: File exists

  # Deploy migration
  cd packages/shared && supabase db push
  # Assert: Exit code 0

  # Verify table created
  curl -s "$SUPABASE_URL/rest/v1/z_brush_events?limit=0" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY"
  # Assert: HTTP 200 (empty array is fine)

  # Verify function exists
  curl -s "$SUPABASE_URL/rest/v1/rpc/calculate_brush_streak" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"p_user_id": 0}'
  # Assert: Returns JSON with current_streak, best_streak, total_completions
  ```

  **Commit**: YES
  - Message: `feat(db): add z_brush_events table and streak function`
  - Files: `packages/shared/supabase/migrations/*brush_events*.sql`
  - Pre-commit: `supabase db push` (verify migration applies)

---

- [ ] 2. Create Database Operations Module

  **What to do**:
  - Create `apps/bot/src/database/brushOperations.ts`
  - Implement functions:
    - `createBrushEvent(data: CreateBrushEventInput): Promise<BrushEvent>`
    - `updateBrushEventStatus(id: string, status: BrushEventStatus, additionalFields?: Partial<BrushEvent>): Promise<BrushEvent>`
    - `getPendingBrushEvents(): Promise<BrushEvent[]>` - status='pending' AND expires_at > now()
    - `getExpiredBrushEvents(): Promise<BrushEvent[]>` - status='pending' AND expires_at <= now()
    - `getSnoozedBrushEvents(): Promise<BrushEvent[]>` - status='snoozed' AND snooze_until <= now()
    - `getBrushEventById(id: string): Promise<BrushEvent | null>`
    - `getBrushStreak(userId: number): Promise<BrushStreak>` - calls RPC function
    - `getWeeklyStats(userId: number): Promise<WeeklyBrushStats>` - completions in last 7 days
  - Use existing Supabase client pattern from `apps/bot/src/database/connection.ts`

  **Must NOT do**:
  - Add caching layer
  - Create new database connection pattern

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard CRUD operations following existing patterns
  - **Skills**: [`Supabase Database Manager`]
    - `Supabase Database Manager`: Supabase client usage patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 4

  **References**:

  **Pattern References**:
  - `apps/bot/src/database/noteOperations.ts:15-45` - CRUD pattern with Supabase client, error handling
  - `apps/bot/src/database/operations.ts:20-60` - Query patterns for messages/links
  - `apps/bot/src/database/connection.ts` - Database client initialization

  **API/Type References**:
  - `apps/bot/src/types/brushReminder.ts` (Task 4) - TypeScript interfaces

  **Acceptance Criteria**:

  ```bash
  # TypeScript compilation
  cd apps/bot && pnpm build
  # Assert: Exit code 0, no type errors

  # Verify module exports
  bun -e "
    const ops = require('./dist/database/brushOperations');
    const funcs = ['createBrushEvent', 'updateBrushEventStatus', 'getPendingBrushEvents', 'getBrushStreak'];
    funcs.forEach(f => console.log(f + ': ' + (typeof ops[f] === 'function')));
  " 
  # Assert: All output "functionName: true"
  ```

  **Commit**: YES
  - Message: `feat(bot): add brush reminder database operations`
  - Files: `apps/bot/src/database/brushOperations.ts`
  - Pre-commit: `pnpm --filter @telepocket/bot build`

---

- [ ] 3. Create Brush Reminder Service

  **What to do**:
  - Create `apps/bot/src/services/brushReminderService.ts`
  - Implement `BrushReminderService` class with:
    - Constructor takes `Bot` instance (Grammy)
    - `sendReminder(userId: number, chatId: number, eventType: 'morning' | 'night'): Promise<void>`
      - Creates DB event with `scheduled_at`, `expires_at` (1 hour later)
      - Sends Telegram message with inline keyboard: [✅ Done] [⏰ Snooze 10m]
      - Updates DB with returned `message_id`
    - `handleDone(eventId: string): Promise<{ message: string, streak: number }>`
      - Updates status to 'completed', sets `completed_at`
      - Returns streak info for edited message
    - `handleSnooze(eventId: string): Promise<{ message: string }>`
      - Updates status to 'snoozed', sets `snooze_until` (now + 10 min)
      - Returns confirmation message
    - `processExpiredReminders(): Promise<number>`
      - Finds expired pending reminders
      - Updates status to 'missed'
      - Edits Telegram messages to show "Missed" (resets streak)
      - Returns count of processed
    - `processSnoozedReminders(): Promise<number>`
      - Finds snoozed reminders where `snooze_until <= now()`
      - Sends new reminder, links to original event
      - Returns count of processed
    - `sendWeeklySummary(userId: number, chatId: number): Promise<void>`
      - Fetches streak and weekly stats
      - Sends formatted summary message
  - Message templates:
    - Reminder: "🦷 Time to brush your teeth!\nCurrent streak: {N} days 🔥"
    - Done: "✅ Nice! Streak: {N} days 🔥"
    - Snoozed: "⏰ Snoozed - reminder in 10 minutes"
    - Missed: "😴 Missed this one. Streak reset to 0.\n(No worries, start fresh next time!)"
    - Weekly: "📊 Weekly Brush Report\n\nThis week: {X}/14 ✅ ({Y}%)\nCurrent streak: {N} days 🔥\nBest streak ever: {M} days\n\nKeep it up! 🦷✨"

  **Must NOT do**:
  - Import `telegramClient` singleton
  - Call `bot.start()` - API calls only
  - Add configurable message templates

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Business logic with clear inputs/outputs, moderate complexity
  - **Skills**: [`Context7 Library Documentation Lookup`]
    - `Context7 Library Documentation Lookup`: Grammy.js API for sendMessage, editMessageText, inline keyboards

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 4

  **References**:

  **Pattern References**:
  - `apps/bot/src/bot/client.ts:45-60` - `sendMessage` wrapper pattern, but use direct `bot.api.sendMessage`
  - `apps/bot/src/bot/noteHandlers.ts:120-150` - Inline keyboard creation pattern
  - `apps/bot/src/bot/handlers/callbacks.ts:200-250` - Message editing after callback pattern

  **API/Type References**:
  - `apps/bot/src/types/brushReminder.ts` (Task 4) - TypeScript interfaces
  - `apps/bot/src/database/brushOperations.ts` (Task 2) - DB operations

  **External References**:
  - Grammy sendMessage: https://grammy.dev/ref/core/api#sendmessage
  - Grammy inline keyboards: https://grammy.dev/plugins/keyboard#inline-keyboards

  **Acceptance Criteria**:

  ```bash
  # TypeScript compilation
  cd apps/bot && pnpm build
  # Assert: Exit code 0

  # Verify service exports
  bun -e "
    const { BrushReminderService } = require('./dist/services/brushReminderService');
    console.log('Class exists:', typeof BrushReminderService === 'function');
    const methods = ['sendReminder', 'handleDone', 'handleSnooze', 'processExpiredReminders', 'sendWeeklySummary'];
    methods.forEach(m => console.log(m + ':', m in BrushReminderService.prototype));
  "
  # Assert: All methods exist on prototype
  ```

  **Commit**: YES
  - Message: `feat(bot): add brush reminder service with send/done/snooze/expire logic`
  - Files: `apps/bot/src/services/brushReminderService.ts`
  - Pre-commit: `pnpm --filter @telepocket/bot build`

---

- [ ] 4. Create TypeScript Type Definitions

  **What to do**:
  - Create `apps/bot/src/types/brushReminder.ts`
  - Define interfaces:
    ```typescript
    export type BrushEventType = 'morning' | 'night';
    export type BrushEventStatus = 'pending' | 'snoozed' | 'completed' | 'missed';
    
    export interface BrushEvent {
      id: string;
      telegram_user_id: number;
      telegram_message_id: number | null;
      chat_id: number;
      event_type: BrushEventType;
      status: BrushEventStatus;
      scheduled_at: string;
      expires_at: string;
      snooze_until: string | null;
      completed_at: string | null;
      created_at: string;
    }
    
    export interface CreateBrushEventInput {
      telegram_user_id: number;
      chat_id: number;
      event_type: BrushEventType;
      scheduled_at: Date;
      expires_at: Date;
    }
    
    export interface BrushStreak {
      current_streak: number;
      best_streak: number;
      total_completions: number;
      completion_rate_7d: number;
    }
    
    export interface WeeklyBrushStats {
      completions: number;
      total_expected: number; // 14 (2 per day × 7 days)
      completion_rate: number;
    }
    
    export interface BrushReminderConfig {
      morningTime: string; // "08:00"
      nightTime: string;   // "22:00"
      timezone: string;    // "Asia/Tokyo"
      expireAfterMinutes: number; // 60
      snoozeMinutes: number; // 10
    }
    ```
  - Export all types from module

  **Must NOT do**:
  - Add types to shared package (bot-specific feature)
  - Create overly generic types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definitions, no logic
  - **Skills**: []
    - No special skills needed for type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 2, 3, 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/bot/src/types/noteCategories.ts` - Type definition file pattern
  - `packages/shared/src/types.ts:Note` - Interface pattern for DB entities

  **Acceptance Criteria**:

  ```bash
  # TypeScript compilation
  cd apps/bot && pnpm build
  # Assert: Exit code 0

  # Verify types exported
  bun -e "
    const types = require('./dist/types/brushReminder');
    const expected = ['BrushEvent', 'CreateBrushEventInput', 'BrushStreak', 'WeeklyBrushStats', 'BrushReminderConfig'];
    // Note: Types don't exist at runtime, but if file compiles, types are valid
    console.log('Module loaded successfully');
  "
  # Assert: "Module loaded successfully"
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `feat(bot): add brush reminder types`
  - Files: `apps/bot/src/types/brushReminder.ts`
  - Pre-commit: `pnpm --filter @telepocket/bot build`

---

- [ ] 5. Add Callback Handlers to Main Bot

  **What to do**:
  - Edit `apps/bot/src/bot/handlers/callbacks.ts`
  - Add callback handlers for `brush:done:{eventId}` and `brush:snooze:{eventId}` prefixes
  - Handler flow:
    1. `ctx.answerCallbackQuery()` immediately
    2. Parse event ID from callback data
    3. Validate event exists and is pending/snoozed
    4. Call `BrushReminderService.handleDone()` or `handleSnooze()`
    5. Edit message with result using `ctx.editMessageText()`
  - Handle edge cases:
    - Event not found → answer with "Reminder not found"
    - Event already processed → answer with "Already handled"

  **Must NOT do**:
  - Create new callback handler file
  - Add complex validation logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding to existing pattern in callbacks.ts
  - **Skills**: []
    - No special skills needed, follow existing callback pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3)
  - **Blocks**: Task 8
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `apps/bot/src/bot/handlers/callbacks.ts:76-120` - Existing callback routing pattern with `data?.startsWith()`
  - `apps/bot/src/bot/handlers/callbacks.ts:200-250` - `ctx.answerCallbackQuery()` + `ctx.editMessageText()` pattern
  - `apps/bot/src/bot/commands/classify.ts:80-120` - Callback handling with state lookup pattern

  **API/Type References**:
  - `apps/bot/src/services/brushReminderService.ts` (Task 3) - Service methods to call

  **Acceptance Criteria**:

  ```bash
  # TypeScript compilation
  cd apps/bot && pnpm build
  # Assert: Exit code 0

  # Verify callback patterns added (grep for brush: prefix)
  grep -n "brush:done" apps/bot/src/bot/handlers/callbacks.ts
  grep -n "brush:snooze" apps/bot/src/bot/handlers/callbacks.ts
  # Assert: Both patterns found in file
  ```

  **Commit**: YES
  - Message: `feat(bot): add brush reminder callback handlers`
  - Files: `apps/bot/src/bot/handlers/callbacks.ts`
  - Pre-commit: `pnpm --filter @telepocket/bot build`

---

- [ ] 6. Create Worker Entry Point

  **What to do**:
  - Create `apps/bot/src/worker/brushWorker.ts`
  - Initialize:
    - Load environment config
    - Create **own** `Bot` instance: `new Bot(config.telegram.botToken)` - DO NOT call `.start()`
    - Create `BrushReminderService` with bot instance
  - Schedule with `node-cron` (add dependency: `pnpm add node-cron && pnpm add -D @types/node-cron`):
    - Morning reminder: `cron.schedule('0 8 * * *', ..., { timezone: 'Asia/Tokyo' })`
    - Night reminder: `cron.schedule('0 22 * * *', ..., { timezone: 'Asia/Tokyo' })`
    - Expire check: `cron.schedule('* * * * *', ...)` (every minute)
    - Snooze check: `cron.schedule('* * * * *', ...)` (every minute, can combine with expire)
    - Weekly summary: `cron.schedule('0 20 * * 0', ..., { timezone: 'Asia/Tokyo' })` (Sunday 20:00)
  - Add graceful shutdown handling (SIGTERM, SIGINT)
  - Add startup log: `console.log('[BrushWorker] Started at', new Date().toISOString())`
  - Add log for each scheduled task execution

  **Must NOT do**:
  - Import `telegramClient` from `bot.ts`
  - Call `bot.start()` - API calls only
  - Use `setInterval` instead of `node-cron`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Worker setup with cron scheduling, moderate complexity
  - **Skills**: [`Context7 Library Documentation Lookup`]
    - `Context7 Library Documentation Lookup`: node-cron API for schedule syntax and timezone

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `apps/bot/src/index.ts:1-30` - Entry point pattern with graceful shutdown
  - `apps/bot/src/config/environment.ts` - Config loading pattern

  **API/Type References**:
  - `apps/bot/src/services/brushReminderService.ts` (Task 3) - Service to instantiate

  **External References**:
  - node-cron: https://www.npmjs.com/package/node-cron
  - Cron timezone: https://github.com/node-cron/node-cron#timezone

  **Acceptance Criteria**:

  ```bash
  # TypeScript compilation
  cd apps/bot && pnpm build
  # Assert: Exit code 0

  # Verify worker file exists and compiles
  ls apps/bot/dist/worker/brushWorker.js
  # Assert: File exists

  # Verify node-cron dependency added
  grep "node-cron" apps/bot/package.json
  # Assert: Found in dependencies

  # Dry run worker (will exit after startup log since no long-running poll)
  timeout 5s node apps/bot/dist/worker/brushWorker.js || true
  # Assert: Output contains "[BrushWorker] Started"
  ```

  **Commit**: YES
  - Message: `feat(bot): add brush reminder worker with cron scheduling`
  - Files: `apps/bot/src/worker/brushWorker.ts`, `apps/bot/package.json`
  - Pre-commit: `pnpm --filter @telepocket/bot build`

---

- [ ] 7. Add PM2 Configuration

  **What to do**:
  - Edit `~/pm2-manager/ecosystem.config.js`
  - Add new app entry for brush worker:
    ```javascript
    {
      name: "telepocket-brush-worker",
      script: "./dist/worker/brushWorker.js",
      cwd: "/Users/ding/Github/telepocket/apps/bot",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env_file: ".env",
      env: { NODE_ENV: "production" },
      error_file: "./logs/brush-worker-err.log",
      out_file: "./logs/brush-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_restarts: 10,
      min_uptime: "10s"
    }
    ```
  - Create logs directory if needed: `mkdir -p apps/bot/logs`

  **Must NOT do**:
  - Use cluster mode (single instance needed for cron)
  - Remove or modify existing app entries

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple config addition following existing pattern
  - **Skills**: [`PM2 Process Manager`]
    - `PM2 Process Manager`: PM2 ecosystem config patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after worker)
  - **Blocks**: Task 8
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `~/pm2-manager/ecosystem.config.js:17-37` - Existing app configuration pattern for telepocket-bot

  **Acceptance Criteria**:

  ```bash
  # Verify config updated
  grep "telepocket-brush-worker" ~/pm2-manager/ecosystem.config.js
  # Assert: Found in file

  # Verify logs directory exists
  ls -d apps/bot/logs
  # Assert: Directory exists

  # Validate PM2 config syntax
  node -e "require('$HOME/pm2-manager/ecosystem.config.js')"
  # Assert: Exit code 0 (valid JS)
  ```

  **Commit**: YES
  - Message: `feat(deploy): add PM2 config for brush reminder worker`
  - Files: `~/pm2-manager/ecosystem.config.js`
  - Pre-commit: Validate JS syntax

---

- [ ] 8. Integration Testing and Deployment

  **What to do**:
  - Build the bot: `cd apps/bot && pnpm build`
  - Start worker locally to verify cron schedules register
  - Test end-to-end flow manually:
    1. Temporarily modify cron to fire in 1 minute
    2. Verify reminder sent with correct buttons
    3. Click Done → verify message edited, streak updated
    4. Click Snooze → verify snooze scheduled
    5. Let reminder expire → verify "Missed" edit
  - Deploy to production using PM2 skill workflow

  **Must NOT do**:
  - Skip local testing before deploy
  - Deploy without building first

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Testing and deployment coordination
  - **Skills**: [`PM2 Process Manager`]
    - `PM2 Process Manager`: Production deployment workflow

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: All previous tasks

  **References**:

  **Pattern References**:
  - CLAUDE.md PM2 deployment section - stop → delete → start pattern

  **Acceptance Criteria**:

  ```bash
  # Build succeeds
  cd apps/bot && pnpm build
  # Assert: Exit code 0

  # PM2 shows worker running
  pm2 list | grep telepocket-brush-worker
  # Assert: Shows "online" status

  # Check worker logs for startup
  pm2 logs telepocket-brush-worker --nostream --lines 10 | grep "Started"
  # Assert: Contains startup message

  # Verify cron schedules in logs
  pm2 logs telepocket-brush-worker --nostream --lines 20 | grep -E "(08:00|22:00|weekly)"
  # Assert: Schedule registration logged
  ```

  **Commit**: NO (deployment, not code change)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(db): add z_brush_events table and streak function` | migrations/*.sql | `supabase db push` |
| 2+4 | `feat(bot): add brush reminder types and db operations` | types/, database/ | `pnpm build` |
| 3 | `feat(bot): add brush reminder service` | services/ | `pnpm build` |
| 5 | `feat(bot): add brush reminder callback handlers` | handlers/callbacks.ts | `pnpm build` |
| 6 | `feat(bot): add brush reminder worker with cron` | worker/, package.json | `pnpm build` |
| 7 | `feat(deploy): add PM2 config for brush worker` | ecosystem.config.js | JS syntax valid |

---

## Success Criteria

### Verification Commands
```bash
# All builds pass
pnpm build  # Expected: Exit 0

# Worker starts and registers schedules
pm2 start telepocket-brush-worker
pm2 logs telepocket-brush-worker --nostream --lines 5
# Expected: "[BrushWorker] Started" + schedule logs

# DB function works
curl -s "$SUPABASE_URL/rest/v1/rpc/calculate_brush_streak" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_user_id": 123}'
# Expected: JSON with streak fields
```

### Final Checklist
- [ ] Reminder sent at 08:00 and 22:00 JST
- [ ] Done button updates streak, edits message
- [ ] Snooze button triggers 10-min delay
- [ ] Auto-expire after 1 hour with "Missed" edit
- [ ] Weekly summary sent Sunday 20:00 JST
- [ ] Worker runs as separate PM2 process
- [ ] All "Must NOT Have" items absent

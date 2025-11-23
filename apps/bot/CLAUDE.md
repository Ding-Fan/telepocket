# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Running
- `pnpm dev` - Start development server with hot reload using ts-node
- `pnpm build` - Compile TypeScript to JavaScript in `dist/` directory
- `pnpm start` - Run compiled version from `dist/index.js`
- `pnpm clean` - Remove the `dist/` directory

### Testing
- `pnpm test` - Run all tests with Jest
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Generate test coverage report
- `pnpm test:unit` - Run only unit tests from `tests/unit/`
- `pnpm test:integration` - Run only integration tests from `tests/integration/`

### Package Management
- Uses pnpm as the package manager (version 10.12.1)
- Run `pnpm install` to install dependencies

### Deployment

**CRITICAL: When deploying, ALWAYS deploy BOTH apps (bot + web)**

This is a Turborepo monorepo with two production apps:
- `telepocket-bot` - Telegram bot (apps/bot)
- `telepocket-web` - Next.js web app (apps/web)

**Supabase migrations location**: `packages/shared/supabase/migrations/`

**Before deployment (if schema changes exist):**
1. Navigate to `packages/shared/supabase/`
2. Review pending migrations: `supabase migration list`
3. Deploy migrations: `supabase db push`
4. Verify schema changes: `supabase db diff`

**Deployment workflow when user says "deploy":**

```bash
# 1. Build entire monorepo (from root)
pnpm build

# 2. Stop both apps
pm2 stop telepocket-bot telepocket-web

# 3. Delete old processes (ensures fresh config)
pm2 delete telepocket-bot telepocket-web

# 4. Start both apps using ecosystem config
pm2 start ~/pm2-manager/ecosystem.config.js --only telepocket-bot,telepocket-web

# 5. Save PM2 state
pm2 save

# 6. Verify deployment
pm2 logs --lines 30 --nostream
pm2 list
```

**Why deploy both:**
- They share the `@telepocket/shared` package
- Schema changes affect both apps
- Ensures consistency across the entire system

**PM2 Configuration:**
- Global PM2 config: `~/pm2-manager/ecosystem.config.js`
- Bot process name: `telepocket-bot`
- Web process name: `telepocket-web`
- Bot runs from: `/Users/ding/Github/telepocket/apps/bot/dist/index.js`
- Web runs on port: `3013`

**Important PM2 Notes:**
- **ALWAYS use stop → delete → start** pattern for code changes
- **NEVER use `pm2 restart`** for deployments (may not pick up new code)
- Ecosystem config provides: env files, log paths, memory limits, restart policies

## Architecture Overview

This is a TypeScript Telegram bot that automatically captures and stores links from messages using Grammy.js framework and Supabase database.

### Core Components

**Entry Point (`src/index.ts`)**
- Main application bootstrapper
- Handles database connection testing
- Sets up graceful shutdown handlers (SIGINT/SIGTERM)
- Initializes bot and message handlers

**Bot Layer (`src/bot/`)**
- `client.ts` - TelegramClient class managing Grammy bot instance, commands, and UI
- `handlers.ts` - Message processing logic for link extraction and storage

**Database Layer (`src/database/`)**
- `connection.ts` - Supabase client wrapper with connection testing
- `operations.ts` - Database CRUD operations for messages and links

**Services (`src/services/`)**
- `linkExtractor.ts` - URL extraction from text messages
- `metadataFetcher.ts` - Web scraping for link metadata (title, description, og_image)

**Configuration (`src/config/`)**
- `environment.ts` - Environment variable handling and validation

### Database Schema

Two main tables with `z_` prefix:
- `z_messages` - Stores Telegram message data
- `z_links` - Stores extracted URLs with metadata, foreign key to messages

### Key Features

- **Security**: Only responds to authorized Telegram user ID
- **Link Processing**: Automatically extracts URLs and fetches metadata
- **Pagination**: `/list` and `/ls` commands show saved links with navigation
- **Keyboard UI**: Persistent keyboard with "📋 My Saved Links" button
- **MarkdownV2**: Proper escaping for Telegram message formatting

### Testing Setup

- Uses Jest with ts-jest preset
- Test timeout: 10 seconds
- Separate unit and integration test directories
- Mock factories in `tests/mocks/factories.ts`
- Setup file: `tests/setup.ts`
- Coverage collection excludes `src/index.ts`

### Environment Requirements

Required environment variables:
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `TELEGRAM_USER_ID` - Authorized user's Telegram ID
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `NODE_ENV` - Environment mode

### Development Notes

- TypeScript target: ES2020, CommonJS modules
- Strict mode enabled with comprehensive type checking
- Source maps and declarations generated
- Grammy.js used for Telegram Bot API interactions
- Supabase for PostgreSQL database operations
- Axios and Cheerio for web scraping metadata
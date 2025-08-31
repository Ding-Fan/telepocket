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
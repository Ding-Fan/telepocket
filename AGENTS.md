# AGENTS.md - Telepocket Monorepo

This file provides guidance for AI coding agents working with the Telepocket monorepo.

## Project Overview

Turborepo monorepo with pnpm workspaces containing:
- **apps/bot** - Grammy.js Telegram bot (Node.js + TypeScript)
- **apps/web** - Next.js 14 web app (React 18 + TypeScript)
- **packages/shared** - Shared utilities, types, Supabase client, AI services
- **packages/mcp-server** - MCP server for todo generation
- **servers/search-history** - MCP search history server

**Package Manager**: pnpm@10.12.1 (MUST use pnpm, not npm/yarn)

## Build / Test / Lint Commands

### Monorepo-wide (from root)
```bash
pnpm install              # Install all dependencies
pnpm build                # Build all packages (turbo)
pnpm dev                  # Run all apps in dev mode
pnpm test                 # Run all tests (turbo)
pnpm lint                 # Lint all packages (turbo)
pnpm clean                # Clean build artifacts
```

### Per-package commands
```bash
# Bot (apps/bot)
pnpm --filter @telepocket/bot dev          # Dev with ts-node
pnpm --filter @telepocket/bot build        # Compile with tsc
pnpm --filter @telepocket/bot start        # Run compiled code
pnpm --filter @telepocket/bot test         # Run all tests (Jest)
pnpm --filter @telepocket/bot test:unit    # Unit tests only
pnpm --filter @telepocket/bot test:integration  # Integration tests only
pnpm --filter @telepocket/bot test:watch  # Watch mode
pnpm --filter @telepocket/bot test:coverage  # With coverage

# Web (apps/web)
pnpm --filter @telepocket/web dev          # Next.js dev server
pnpm --filter @telepocket/web build        # Next.js build
pnpm --filter @telepocket/web start        # Next.js prod server
pnpm --filter @telepocket/web lint         # ESLint (Next.js config)

# Shared (packages/shared)
pnpm --filter @telepocket/shared build     # TypeScript compile
pnpm --filter @telepocket/shared dev       # Watch mode (tsc --watch)
```

### Running a single test file
```bash
# From apps/bot directory
cd apps/bot
npx jest tests/unit/linkExtractor.test.ts

# Or with filter from root
pnpm --filter @telepocket/bot test tests/unit/linkExtractor.test.ts
```

## Code Style Guidelines

### TypeScript Configuration

**Bot & Shared**:
- `strict: true` - All strict type checks enabled
- `esModuleInterop: true`
- `skipLibCheck: true`
- `target: ES2020`, `module: commonjs`
- Declaration files generated (`declaration: true`)

**Web (Next.js)**:
- `strict: true`
- `noEmit: true` (Next.js handles compilation)
- `jsx: "preserve"`
- `moduleResolution: "bundler"`
- Path alias: `@/*` maps to `./*` (web root)

### Import Patterns

**Web app** - Use path aliases:
```typescript
import { useToast } from '@/components/ui/ToastProvider';
import { searchNotes } from '@/actions/notes';
```

**Bot & Shared** - Use relative imports:
```typescript
import { config } from '../../config/environment';
import { handlePhotoMessage } from '../noteHandlers';
```

**Workspace packages**:
```json
"@telepocket/shared": "workspace:*"
```

### Type vs Interface

**Prefer `interface`** for:
- Database entities (Message, Link, Note, NoteImage)
- API response shapes
- Component props
- Configuration objects
- Objects that may be extended

**Prefer `type`** for:
- Union types: `type NoteCategory = 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese'`
- Type aliases: `type StreamNote = PriorityNote | GlanceNote`
- Mapped/conditional types

**Examples from codebase**:
```typescript
// interface for extendable objects
export interface Note {
  id?: string;
  telegram_user_id: number;
  telegram_message_id: number;
  content: string;
  created_at?: string;
}

// type for unions
export type NoteCategory = 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese';
```

### Avoid `any` Type

The codebase has legacy `any` usage (108+ occurrences in bot), but **NEW CODE MUST NOT USE `any`**.

**Instead use**:
- `unknown` - for truly unknown types (then narrow with type guards)
- Proper types from Grammy: `Context`, `CallbackQueryContext`, etc.
- Generic types: `Record<string, unknown>`, `T extends object`

**Acceptable cases**:
- Test mocks: `let mockContext: any;` (tests only)
- Temporary during refactoring (must be fixed before PR)

### Error Handling

**Standard pattern** - Structured error handling with context:
```typescript
import { handleDatabaseError, handleCommandError, ErrorContext } from '../utils/errorHandler';

try {
  await saveNote(data);
} catch (error) {
  const context: ErrorContext = {
    userId: ctx.from?.id,
    operation: 'saveNote',
    timestamp: new Date().toISOString(),
    additionalInfo: { noteId: data.id }
  };
  const errorMessage = handleDatabaseError(error, context);
  await ctx.reply(errorMessage);
}
```

**Error handler utilities**:
- `handleDatabaseError()` - for DB operations
- `handleCommandError()` - for command execution
- `handleValidationError()` - for input validation

All error handlers:
1. Log structured context (user, operation, timestamp)
2. Return user-friendly messages
3. Include stack traces in logs (not user messages)

### File Naming Conventions

**Bot** (src/):
- Services: `camelCase.ts` - `linkExtractor.ts`, `noteClassifier.ts`, `imageUploader.ts`
- Commands: `camelCase.ts` - `notes.ts`, `search.ts`, `archived.ts`
- Handlers: `camelCase.ts` - `messages.ts`, `callbacks.ts`
- Utils: `camelCase.ts` - `errorHandler.ts`, `rateLimiter.ts`, `validation.ts`
- Types: `camelCase.ts` - `noteCategories.ts`, `statusMessage.ts`
- Constants: `camelCase.ts` - `helpMessages.ts`, `categoryPrompts.ts`

**Web** (App Router):
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx`
- Components: `PascalCase.tsx` - typically in `components/` dir
- Hooks: `useCamelCase.ts` - `useTelegram.ts`, `useCopyToClipboard.ts`
- Actions: `camelCase.ts` - `notes.ts` (server actions)

**Tests**:
- Unit: `moduleName.test.ts` - `linkExtractor.test.ts`
- Integration: `feature.test.ts`
- Location: `apps/bot/tests/unit/`, `apps/bot/tests/integration/`

**Shared**:
- Services: `camelCase.ts` - `todoGenerator.ts`, `embeddingService.ts`
- Types: `types.ts` (centralized)
- Constants: `constants.ts`, `categoryPrompts.ts`

### Function & Component Structure

**Bot handlers** - Async functions with clear authorization:
```typescript
messageHandler.on('message:photo', async (ctx) => {
  const userId = ctx.from?.id;
  
  if (!userId || !isAuthorizedUser(userId)) {
    return;
  }
  
  await handlePhotoMessage(ctx);
});

function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}
```

**React components** (Web) - Functional with hooks:
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useTelegram();
  
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/notes');
    }
  }, [isAuthenticated, router]);
  
  return <div>...</div>;
}
```

**Services** - Export pure functions with clear interfaces:
```typescript
export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface UploadOptions {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
}

export async function uploadToCloudflare(
  options: UploadOptions
): Promise<UploadResult> {
  // Implementation
}
```

### Optional Fields & Nullability

- Use `?` for optional fields: `id?: string`, `title?: string`
- Use `| null` for explicit nullable: `note_id: string | null`
- Avoid mixing: Choose one approach per context

## Deployment Workflow

**CRITICAL**: When deploying, ALWAYS deploy BOTH apps (bot + web) together.

**See CLAUDE.md for full PM2 deployment workflow** (stop → delete → start pattern)

## Database Migrations

**Location**: `packages/shared/supabase/migrations/`

**Before deployment**:
```bash
cd packages/shared/supabase/
supabase migration list
supabase db push
```

## Environment Variables

**Required by Bot**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
**Required by Web**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_AI_API_KEY`

## Code Quality Rules

1. **TypeScript strict mode enabled** - No `any` types in new code
2. **Error handling required** - Use structured error handlers with context
3. **Authorization checks** - Bot: verify `userId === config.telegram.userId`
4. **Path aliases** - Web uses `@/*`, bot/shared use relative imports
5. **ESLint** - Web has Next.js ESLint, no repo-wide config (yet)
6. **Testing** - Jest (ts-jest) for bot, write tests for business logic
7. **Naming** - camelCase files, PascalCase components, meaningful names
8. **Comments** - JSDoc for public APIs, inline for complex logic

## Additional Notes

- **Supabase client**: Import from `@telepocket/shared` (`createClient()`, server/client variants)
- **AI Services**: Google Gemini for embeddings/classification (`@telepocket/shared`)
- **Testing**: Focus on business logic (services, utils), not UI components
- **Database schema**: See bot README for table structures (z_messages, z_links, z_notes, etc.)
- **PM2 prod config**: Global at `~/pm2-manager/ecosystem.config.js`

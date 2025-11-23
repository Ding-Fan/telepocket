# CLAUDE.md - Telepocket Monorepo

This file provides guidance to Claude Code when working with the Telepocket monorepo.

## Project Structure

This is a Turborepo monorepo with:
- **apps/bot** - Telegram bot using Grammy.js
- **apps/web** - Next.js web application
- **packages/shared** - Shared utilities and Supabase client

## Development Commands

### Building
```bash
pnpm build          # Build all packages
pnpm build --filter @telepocket/bot   # Build bot only
pnpm build --filter @telepocket/web   # Build web only
```

### Development
```bash
pnpm dev            # Run all apps in dev mode
```

### Package Management
- Uses pnpm workspaces (version 10.12.1)
- Run `pnpm install` from root to install all dependencies

## Production Deployment

**CRITICAL: When deploying, ALWAYS deploy BOTH apps (bot + web)**

### Why Deploy Both?
- They share the `@telepocket/shared` package
- Schema changes affect both apps
- Ensures consistency across the entire system

### Supabase Migrations

**Location**: `packages/shared/supabase/migrations/`

**Before deployment (if schema changes exist):**
```bash
cd packages/shared/supabase/
supabase migration list      # Review pending migrations
supabase db push            # Deploy migrations to production
supabase db diff            # Verify schema changes
```

### PM2 Deployment Workflow

**PM2 Configuration**: Global config at `~/pm2-manager/ecosystem.config.js`

**Process Names:**
- Bot: `telepocket-bot`
- Web: `telepocket-web`

**Deployment Steps (when user says "deploy"):**

```bash
# 1. Build entire monorepo (from root)
pnpm build

# 2. Stop both apps
pm2 stop telepocket-bot telepocket-web

# 3. Delete old processes (if config changed)
pm2 delete telepocket-bot telepocket-web

# 4. Start both apps using ecosystem config
pm2 start ~/pm2-manager/ecosystem.config.js --only telepocket-bot,telepocket-web

# 5. Save PM2 state
pm2 save

# 6. Verify deployment
pm2 logs --lines 30 --nostream
pm2 list
```

**Important PM2 Notes:**
- **ALWAYS use stop → delete → start** pattern for code changes
- **NEVER use `pm2 restart`** for deployments (may not pick up new code)
- Ecosystem config provides: proper ports, env files, log paths, memory limits
- Bot runs on port N/A, Web runs on port 3013

### Production Configuration

**Bot (`telepocket-bot`):**
- Script: `./dist/index.js`
- Working directory: `/Users/ding/Github/telepocket/apps/bot`
- Environment file: `.env`
- Max memory: 300M
- Logs: `./logs/err.log`, `./logs/out.log`

**Web (`telepocket-web`):**
- Script: `node_modules/next/dist/bin/next start -p 3013`
- Working directory: `/Users/ding/Github/telepocket/apps/web`
- Environment file: `.env.local`
- Port: 3013
- Max memory: 500M
- Logs: `./logs/err.log`, `./logs/out.log`

## Environment Variables

**Bot requires:**
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_USER_ID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NODE_ENV`

**Web requires:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV`

## Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm build` | Build all packages |
| `pm2 start ~/pm2-manager/ecosystem.config.js --only telepocket-bot,telepocket-web` | Start both apps |
| `pm2 logs --lines 30 --nostream` | Check logs with timestamps |
| `pm2 list` | View all running processes |
| `pm2 save` | Save current PM2 state |

## Development Workflow

1. Make changes to code
2. Test locally with `pnpm dev`
3. Build with `pnpm build`
4. Deploy using PM2 workflow above
5. Verify with logs and `pm2 list`

## Troubleshooting

**Apps not picking up changes?**
- Use `pm2 delete` before `pm2 start` (not just restart)
- Verify build completed: check `dist/` folders
- Check logs: `pm2 logs --lines 50 --nostream`

**Database migration issues?**
- Run from `packages/shared/supabase/`
- Check migration status: `supabase migration list`
- Verify remote: `supabase db diff`

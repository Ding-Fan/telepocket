# CLAUDE.md - Telepocket Web

This file provides guidance to Claude Code when working with the Telepocket Next.js web application.

## Overview

Next.js 14.0.4 web application for viewing and managing Telegram saved links.

## Development Commands

### Building and Running
```bash
pnpm dev          # Start Next.js dev server (hot reload)
pnpm build        # Build production bundle
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

### Package Management
- Uses pnpm (version 10.12.1)
- Run `pnpm install` to install dependencies

## Production Deployment

**CRITICAL: Always deploy BOTH bot and web together**

See root `/CLAUDE.md` for full deployment instructions.

### Quick Deployment

```bash
# From monorepo root
pnpm build
pm2 stop telepocket-bot telepocket-web
pm2 delete telepocket-bot telepocket-web
pm2 start ~/pm2-manager/ecosystem.config.js --only telepocket-bot,telepocket-web
pm2 save
```

### PM2 Configuration

**Process Name:** `telepocket-web`

**Configuration (from `~/pm2-manager/ecosystem.config.js`):**
- Script: `node_modules/next/dist/bin/next start -p 3013`
- Port: **3013** (not 3000!)
- Working directory: `/Users/ding/Github/telepocket/apps/web`
- Environment file: `.env.local`
- Max memory restart: 500M
- Logs: `./logs/err.log`, `./logs/out.log`

## Environment Variables

Required in `.env.local`:

```bash
# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase (Server-side)
SUPABASE_SERVICE_ROLE_KEY=

# Environment
NODE_ENV=production
```

## Architecture

### App Router Structure
```
app/
├── layout.tsx           # Root layout with providers
├── page.tsx            # Home page
├── notes/              # Notes routes
│   ├── page.tsx        # Notes list
│   └── [id]/
│       └── page.tsx    # Note detail
└── search/
    └── page.tsx        # Search page
```

### Key Components

**Notes:**
- `NoteDetail.tsx` - Individual note display with metadata
- `GlanceSection.tsx` - Glances (quick notes) section
- `GlanceCard.tsx` - Single glance card
- `PinToggleButton.tsx` - Pin/unpin functionality with optimistic UI

**Providers:**
- Located in `components/providers/`
- QueryClientProvider for TanStack Query

### Server Actions

Location: `actions/notes.ts`

Server actions for:
- Creating notes
- Updating notes
- Deleting notes
- Pinning/unpinning notes

**Why Server Actions?**
- Keep Supabase service key secure (server-side only)
- Type-safe mutations from components
- Simplified data mutations without API routes

### Hooks

**Data Fetching:**
- `useGlanceData.ts` - Fetch glances with TanStack Query

**Mutations:**
- `usePinNoteMutation.ts` - Pin/unpin with optimistic updates

### Configuration

- `navigation.ts` - Navigation menu structure

## Production Access

**URL:** https://telepocket.dokojob.tech (via Cloudflare Tunnel)
**Port:** 3013 (localhost)

## Database

Shares Supabase database with bot via `@telepocket/shared` package.

**Migrations location:** `packages/shared/supabase/migrations/`

**Tables:**
- `z_messages` - Telegram messages
- `z_links` - Extracted links with metadata

## Development Notes

- Next.js 14 App Router (not Pages Router)
- TypeScript strict mode enabled
- Tailwind CSS for styling
- TanStack Query for data fetching and caching
- Server Actions for mutations
- Shared types from `@telepocket/shared`

## Troubleshooting

**App not accessible after deployment:**
- Check port is 3013: `pm2 show telepocket-web`
- Verify Cloudflare tunnel is running
- Check logs: `pm2 logs telepocket-web --lines 50 --nostream`

**Changes not showing:**
- Ensure `pnpm build` ran successfully
- Use `pm2 delete` + `pm2 start` (not `pm2 restart`)
- Check build output in `.next/` folder

**Database errors:**
- Verify `.env.local` has correct Supabase credentials
- Check server actions have service role key access
- Review migrations: `cd packages/shared/supabase && supabase migration list`

## Integration with Bot

- Bot saves links to database
- Web displays and manages those links
- Both share `@telepocket/shared` package for types and Supabase client
- Changes to shared package require rebuilding both apps

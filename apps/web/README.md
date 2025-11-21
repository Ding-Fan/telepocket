# Telepocket Web App

This is the Next.js web application for Telepocket, providing a rich interface for managing notes.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in the required values:
   ```bash
   cp .env.local.example .env.local
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

## Semantic Search

This app uses Google Gemini for semantic search. You need to provide a `GOOGLE_AI_API_KEY` in `.env.local`.

### Backfill Embeddings

To generate embeddings for existing notes, run the backfill script:

```bash
cd ../bot
npx tsx scripts/backfill-embeddings.ts
```

This script will process notes in batches and generate embeddings using the Gemini API. It respects rate limits automatically.

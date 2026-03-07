# Telepocket MCP Server

Model Context Protocol (MCP) server for Telepocket note, link, search, summary, and todo workflows.

## Overview

This MCP server lets AI assistants such as OpenClaw talk to Telepocket through a stable tool layer instead of writing to Supabase directly.

Current tool set:

- `system.health`
- `system.whoami`
- `notes.save`
- `notes.get`
- `notes.search`
- `notes.summarize`
- `todos.generate`
- `generate_todos_from_notes` (legacy compatibility)

The design goal is:

```text
OpenClaw -> Telepocket MCP -> Telepocket schema/services -> Supabase
```

That keeps Telepocket as the source of truth for notes and links while OpenClaw handles orchestration and chat UX.

## Installation

### Prerequisites

- Node.js 20+
- pnpm 10+
- Access to Supabase database
- Google AI API key
- Telepocket `TELEGRAM_USER_ID`

### Apply the MCP migration

Before using `notes.save`, apply the migration that adds source metadata and idempotent MCP writes:

```bash
cd /Users/ding/Github/telepocket/packages/shared/supabase
supabase migration list
supabase db push
```

### Build

```bash
cd packages/mcp-server
pnpm install
pnpm build
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "telepocket-todos": {
      "command": "node",
      "args": [
        "/Users/ding/Github/telepocket/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://yyrazbunplmullccevot.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<your_service_role_key>",
        "GOOGLE_AI_API_KEY": "<your_google_ai_api_key>",
        "GEMINI_MODEL": "gemini-2.5-flash",
        "TELEGRAM_USER_ID": "<your_telepocket_user_id>"
      }
    }
  }
}
```

### OpenClaw

Point OpenClaw at the compiled MCP server using a stdio command entry. The exact config shape depends on your OpenClaw version, but the important parts are:

- command: `node`
- args: `[/Users/ding/Github/telepocket/packages/mcp-server/dist/index.js]`
- env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_AI_API_KEY`, `GEMINI_MODEL`, `TELEGRAM_USER_ID`

Representative stdio MCP block:

```json
{
  "name": "telepocket",
  "command": "node",
  "args": [
    "/Users/ding/Github/telepocket/packages/mcp-server/dist/index.js"
  ],
  "env": {
    "SUPABASE_URL": "https://your-project.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "<your_service_role_key>",
    "GOOGLE_AI_API_KEY": "<your_google_ai_api_key>",
    "GEMINI_MODEL": "gemini-2.5-flash",
    "TELEGRAM_USER_ID": "123456789"
  }
}
```

Use your own OpenClaw config file format, but keep those values the same.

### Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for privileged access)
- `GOOGLE_AI_API_KEY` - Google AI API key for Gemini
- `TELEGRAM_USER_ID` - Telepocket owner user ID used for note ownership

## Usage

Once configured in OpenClaw or another MCP client, you can ask for actions like:

```text
Save this note: MCP design should be coarse-grained, not raw SQL.

Save this link with a note: https://modelcontextprotocol.io/docs and say it is about MCP basics.

Find my recent notes about embeddings.

Summarize my notes about OpenClaw from the last week.

Generate todos from my latest notes.
```

Example todo flow:

```
User: Can you generate a todo list from my recent notes?

Assistant: [Uses todos.generate tool]
Here's your todo list based on your recent notes:

# 📋 Todo List

## 🏢 Work
- [ ] Complete project proposal (by Friday)
- [ ] Review PR #123

## 📚 Learning
- [ ] Read TypeScript handbook
- [ ] Practice React patterns

[etc.]
```

## Tool Reference

### system.health

Checks whether the MCP server is up and can reach Supabase.

**Parameters:** none

**Returns:**
- health status
- tool version
- current AI model
- Supabase connectivity status

### system.whoami

Returns the Telepocket user identity this MCP server acts for.

**Parameters:** none

**Returns:**
- `telepocket_user_id`
- `source`

### notes.save

Saves a note and stores any explicit or extracted links and images using an idempotent MCP-safe write path.

**Parameters:**
- `content` (string, required)
- `idempotency_key` (string, required)
- `urls` (string[], optional)
- `images` (object[], optional)
- `images[].image_source_id` (string, optional but recommended for stable retries)
- `source` (string, optional, defaults to `openclaw`)
- `source_item_id` (string, optional)
- `created_at` (string, optional ISO timestamp)

**Returns:**
- `note_id`
- `created`
- `deduplicated`
- `link_count`
- `image_count`
- stored link metadata
- stored image metadata

For external images, prefer sending a stable `image_source_id` if the image URL may change between retries.

### notes.get

Fetches one saved note with links and images.

**Parameters:**
- `note_id` (string, required)

**Returns:**
- canonical note payload from Telepocket

### notes.search

Searches or lists notes.

**Parameters:**
- `query` (string, optional)
- `limit` (number, optional, default 10)
- `since` (string, optional ISO timestamp)
- `until` (string, optional ISO timestamp)
- `has_links` (boolean, optional)
- `source` (string, optional)

**Returns:**
- note IDs
- snippets
- link previews
- source and relevance metadata

### notes.summarize

Summarizes stored notes only, either by explicit note IDs or a query.

**Parameters:**
- `note_ids` (string[], optional)
- `query` (string, optional)
- `limit` (number, optional)
- `style` (`bullets` | `paragraph` | `brief`)
- `length` (`short` | `medium` | `long`)
- `include_citations` (boolean, optional)

**Returns:**
- generated summary
- note citations
- number of notes considered

### todos.generate

Generates a todo list from the current Telepocket user's notes.

**Parameters:**
- `max_notes` (number, optional)

**Returns:**
- markdown todo list

### generate_todos_from_notes

Legacy compatibility tool.

**Parameters:**
- `user_id` (number, required) - Telegram user ID to fetch notes for
- `max_notes` (number, optional) - Maximum number of recent notes to analyze (default: 100)

**Returns:**
- Formatted markdown todo list with categorized action items
- Error message if generation fails

## Development

### Run in development mode

```bash
pnpm dev
```

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Architecture

The MCP server uses shared logic from `@telepocket/shared` package:
- Core todo generation: `packages/shared/src/services/todoGenerator.ts`
- Gemini AI integration for summaries and extraction
- Supabase database for note access
- MCP-specific save path via `save_note_with_links_from_source(...)`

Important design constraints:

- OpenClaw should call MCP tools, not Supabase directly
- Telepocket remains the source of truth for note/link persistence
- `notes.save` requires an idempotency key so retries do not create duplicates
- `notes.summarize` summarizes stored notes only; it does not fetch arbitrary live web pages

## Troubleshooting

**Server won't start:**
- Check all environment variables are set
- Verify Supabase credentials
- Check Google AI API key is valid
- Verify `TELEGRAM_USER_ID` matches your Telepocket owner ID
- Confirm the MCP migration has been applied

**Tool not appearing in the MCP client:**
- Verify config file path
- Restart the MCP client
- Check server logs from the MCP host process

**Generation fails:**
- Check user has notes in database
- Verify API quotas not exceeded
- Check server logs for detailed errors

**`notes.save` fails:**
- Apply the latest Supabase migration
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is valid
- Check for malformed `created_at` timestamps
- Make sure `idempotency_key` is always present

**`notes.save` with images fails:**
- Apply the migration that adds `save_note_payload_from_source(...)`
- Include at least one image locator per image: `url`, `cloudflare_url`, or `telegram_file_id`
- Provide `mime_type` and `file_name` when you have them for better fidelity

# Telepocket MCP Guide for OpenClaw

Use Telepocket as the source of truth for saved notes and links.

Your job is to use Telepocket MCP tools to save, find, and summarize the user's information. Do not bypass Telepocket by writing directly to Supabase.

## Core Rules

1. Always prefer Telepocket MCP tools over raw database access.
2. Use `notes.save` for both notes and links.
3. Always provide an `idempotency_key` for `notes.save`.
4. If you have a stable external message ID, also provide `source_item_id`.
5. Treat Telepocket as single-user unless told otherwise.
6. Summarize stored notes only. Do not fetch arbitrary live URLs during summary unless the user explicitly asks for a separate web fetch.
7. When the user asks to save a link, save it through Telepocket first, then summarize from the saved note if needed.

## Available Tools

### `system.health`

Use this first when starting a session or when tool behavior seems broken.

Purpose:
- verify the MCP server is available
- verify Supabase connectivity
- confirm the configured AI model

### `system.whoami`

Use this when you need to confirm which Telepocket user the MCP server is acting for.

### `notes.save`

Primary ingestion tool.

Use it for:
- saving plain notes
- saving links with optional context
- saving mixed note + link content

Arguments:

```json
{
  "content": "string, required",
  "idempotency_key": "string, required",
  "urls": ["string, optional"],
  "source": "string, optional, usually openclaw",
  "source_item_id": "string, optional",
  "created_at": "ISO timestamp, optional"
}
```

Behavior:
- Telepocket extracts links from `content`
- explicit `urls` may also be provided
- Telepocket stores the note and attached links
- repeated calls with the same `idempotency_key` should deduplicate

### `notes.get`

Fetch one canonical note by `note_id`.

Arguments:

```json
{
  "note_id": "uuid"
}
```

Use it when:
- the user wants full detail for one note
- you need the full saved content before summarizing or answering

### `notes.search`

Searches or lists notes.

Arguments:

```json
{
  "query": "string, optional",
  "limit": 10,
  "since": "ISO timestamp, optional",
  "until": "ISO timestamp, optional",
  "has_links": true,
  "source": "openclaw"
}
```

Use it when:
- the user asks to find notes by topic
- the user asks for recent notes
- you need candidate notes before calling `notes.summarize`

### `notes.summarize`

Summarizes stored notes by IDs or by search query.

Arguments:

```json
{
  "note_ids": ["uuid"],
  "query": "string",
  "limit": 5,
  "style": "bullets",
  "length": "medium",
  "include_citations": true
}
```

Rules:
- provide either `note_ids` or `query`
- prefer `note_ids` if you already know the exact target notes
- keep `include_citations` enabled unless the user explicitly wants a clean version

### `todos.generate`

Generate a todo list from the current Telepocket user's notes.

Arguments:

```json
{
  "max_notes": 50
}
```

## Default Workflows

### Save a note

If the user says something like:
- save this note
- remember this
- store this thought

Call `notes.save`.

Example:

```json
{
  "content": "MCP tools should be coarse-grained and retry-safe.",
  "idempotency_key": "openclaw-note-2026-03-07T13:00:00Z",
  "source": "openclaw"
}
```

### Save a link

If the user shares a URL and wants it saved, still use `notes.save`.

Example:

```json
{
  "content": "Save this MCP reference for later reading: https://modelcontextprotocol.io/docs",
  "urls": ["https://modelcontextprotocol.io/docs"],
  "idempotency_key": "openclaw-link-mcp-docs-2026-03-07",
  "source": "openclaw"
}
```

### Save then summarize

If the user says:
- save this and summarize it
- keep this link and tell me the key points

Use this sequence:
1. `notes.save`
2. `notes.summarize` using the returned `note_id`

### Search then summarize

If the user asks:
- summarize my notes about embeddings
- what have I saved about OpenClaw

Use this sequence:
1. `notes.search`
2. if the result set is small and relevant, call `notes.summarize` with `note_ids`
3. if the result set is empty, say nothing relevant was found

### Generate todos

If the user asks:
- create todos from my notes
- extract action items from recent notes

Call `todos.generate`.

## Choosing Good `idempotency_key` Values

Use stable keys when possible.

Good patterns:
- `openclaw-telegram-<message-id>`
- `openclaw-chat-<conversation-id>-<turn-id>`
- `openclaw-manual-<date>-<short-slug>`

Bad patterns:
- random values on retries
- values that change every time you resend the same save request

## Response Strategy

After using tools:
- confirm what was saved or found
- include the note count or `note_id` when useful
- mention deduplication if the save was not new
- for summaries, mention that the answer comes from stored Telepocket notes

## What Not To Do

- do not write SQL directly
- do not bypass Telepocket and write to Supabase yourself
- do not summarize arbitrary web pages as if they were saved notes
- do not omit `idempotency_key` on writes
- do not call `notes.summarize` without `note_ids` or `query`

## Recommended Session Start

At the beginning of a new session:
1. call `system.health`
2. optionally call `system.whoami`
3. proceed with note operations

## Example User Requests and Actions

User: Save this note: hybrid search should combine semantic and fuzzy ranking.

Action:
- call `notes.save`

User: Save this link and summarize it: https://example.com/post

Action:
- call `notes.save`
- call `notes.summarize` with the returned `note_id`

User: What have I saved about embeddings?

Action:
- call `notes.search` with `query: "embeddings"`
- if relevant notes exist, optionally call `notes.summarize`

User: Generate todos from my latest notes.

Action:
- call `todos.generate`

## Safe Assumptions

- `source` should usually be `openclaw`
- if the user message already contains the URL, you can still provide `urls` explicitly
- summaries should be grounded in Telepocket note IDs
- Telepocket owns persistence; OpenClaw owns orchestration

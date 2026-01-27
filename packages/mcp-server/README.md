# Telepocket MCP Server

Model Context Protocol (MCP) server for Telepocket todo generation functionality.

## Overview

This MCP server exposes a `generate_todos_from_notes` tool that AI assistants (like Claude Desktop) can invoke to analyze a user's recent notes and extract action items.

## Installation

### Prerequisites

- Node.js 20+
- pnpm 10+
- Access to Supabase database
- Google AI API key

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
        "GOOGLE_AI_API_KEY": "<your_google_ai_api_key>"
      }
    }
  }
}
```

### Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for privileged access)
- `GOOGLE_AI_API_KEY` - Google AI API key for Gemini

## Usage

Once configured in Claude Desktop, you can ask Claude to generate todos:

```
User: Can you generate a todo list from my recent notes?

Claude: [Uses generate_todos_from_notes tool]
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

## Tool Schema

### generate_todos_from_notes

Analyzes user's recent notes and extracts action items using AI.

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
- Gemini AI integration for extraction
- Supabase database for notes access

## Troubleshooting

**Server won't start:**
- Check all environment variables are set
- Verify Supabase credentials
- Check Google AI API key is valid

**Tool not appearing in Claude Desktop:**
- Verify config file path
- Restart Claude Desktop
- Check server logs in Claude Desktop developer console

**Generation fails:**
- Check user has notes in database
- Verify API quotas not exceeded
- Check server logs for detailed errors

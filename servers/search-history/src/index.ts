#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import {
  getSearchHistory,
  saveSearch,
  deleteSearch,
  clearAllHistory,
} from './handlers.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const server = new Server(
  {
    name: 'search-history',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get-search-history',
        description: 'Get recent search history for a user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'number',
              description: 'Telegram user ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of searches to return (default: 10)',
              default: 10,
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'save-search',
        description: 'Save a search query to history',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'number',
              description: 'Telegram user ID',
            },
            query: {
              type: 'string',
              description: 'Search query to save',
            },
          },
          required: ['userId', 'query'],
        },
      },
      {
        name: 'delete-search',
        description: 'Delete a specific search from history',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'number',
              description: 'Telegram user ID',
            },
            query: {
              type: 'string',
              description: 'Search query to delete',
            },
          },
          required: ['userId', 'query'],
        },
      },
      {
        name: 'clear-all-history',
        description: 'Clear all search history for a user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'number',
              description: 'Telegram user ID',
            },
          },
          required: ['userId'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get-search-history': {
        const { userId, limit = 10 } = args as { userId: number; limit?: number };
        const result = await getSearchHistory(supabase, userId, limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'save-search': {
        const { userId, query } = args as { userId: number; query: string };
        const result = await saveSearch(supabase, userId, query);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'delete-search': {
        const { userId, query } = args as { userId: number; query: string };
        const result = await deleteSearch(supabase, userId, query);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'clear-all-history': {
        const { userId } = args as { userId: number };
        const result = await clearAllHistory(supabase, userId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Search History MCP server running on stdio');
}

main();

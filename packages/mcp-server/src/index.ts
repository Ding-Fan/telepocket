#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { generateTodosToolDefinition, handleGenerateTodos } from './tools/generateTodos.js';

/**
 * Telepocket MCP Server
 * Provides todo generation functionality for AI assistants
 */
async function main() {
  console.error('Starting Telepocket MCP Server...');

  try {
    // Load configuration
    const config = loadConfig();
    console.error('Configuration loaded successfully');

    // Create MCP server instance
    const server = new Server(
      {
        name: 'telepocket-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Handler for listing available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [generateTodosToolDefinition],
      };
    });

    // Handler for tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'generate_todos_from_notes') {
        try {
          const result = await handleGenerateTodos(
            args as { user_id: number; max_notes?: number },
            config
          );

          return {
            content: [
              {
                type: 'text',
                text: result,
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Tool execution error:', errorMessage);

          return {
            content: [
              {
                type: 'text',
                text: `Error: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      }

      throw new Error(`Unknown tool: ${name}`);
    });

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    console.error('Telepocket MCP Server running on stdio');

  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

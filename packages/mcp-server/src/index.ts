#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { createToolRegistry } from './toolRegistry.js';
import { systemHealthTool } from './tools/systemHealth.js';
import { systemWhoAmITool } from './tools/systemWhoAmI.js';
import { saveNoteTool } from './tools/saveNote.js';
import { getNoteTool } from './tools/getNote.js';
import { searchNotesTool } from './tools/searchNotes.js';
import { summarizeNotesTool } from './tools/summarizeNotes.js';
import { legacyTodosGenerateTool, todosGenerateTool } from './tools/todosGenerate.js';
import { linksExposureRecordTool } from './tools/linksExposureRecord.js';
import { linksExposureStatsTool } from './tools/linksExposureStats.js';

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

    const registry = createToolRegistry([
      systemHealthTool,
      systemWhoAmITool,
      saveNoteTool,
      getNoteTool,
      searchNotesTool,
      summarizeNotesTool,
      todosGenerateTool,
      legacyTodosGenerateTool,
      linksExposureRecordTool,
      linksExposureStatsTool,
    ]);

    // Handler for listing available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(registry.values()).map((tool) => tool.definition),
      };
    });

    // Handler for tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = registry.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await tool.handler((args as Record<string, unknown> | undefined) || {}, {
          config,
        });

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

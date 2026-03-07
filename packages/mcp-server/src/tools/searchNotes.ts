import { RegisteredTool } from '../toolRegistry.js';
import {
  parseOptionalBoolean,
  parseOptionalInteger,
  parseOptionalString,
  searchNotes,
  toJsonText
} from '../telepocket.js';

export const searchNotesTool: RegisteredTool = {
  definition: {
    name: 'notes.search',
    description: 'Search or list Telepocket notes with optional date, source, and link filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search query. When omitted, returns recent notes.'
        },
        limit: {
          type: 'number',
          description: 'Maximum notes to return (1-20, default 10).'
        },
        since: {
          type: 'string',
          description: 'Optional ISO timestamp lower bound.'
        },
        until: {
          type: 'string',
          description: 'Optional ISO timestamp upper bound.'
        },
        has_links: {
          type: 'boolean',
          description: 'Filter notes by whether they have links.'
        },
        source: {
          type: 'string',
          description: 'Optional source filter, such as openclaw or telegram.'
        }
      },
      additionalProperties: false
    }
  },
  handler: async (args, context) => {
    const result = await searchNotes(context.config, {
      query: parseOptionalString(args.query, 'query'),
      limit: parseOptionalInteger(args.limit, 'limit', 10, 1, 20),
      since: parseOptionalString(args.since, 'since'),
      until: parseOptionalString(args.until, 'until'),
      hasLinks: parseOptionalBoolean(args.has_links, 'has_links'),
      source: parseOptionalString(args.source, 'source')
    });

    return toJsonText({
      total_count: result.totalCount,
      results: result.results
    });
  }
};

import { RegisteredTool } from '../toolRegistry.js';
import {
  parseOptionalInteger,
  parseOptionalString,
  parseOptionalStringArray,
  summarizeNotes,
  toJsonText
} from '../telepocket.js';

function parseStyle(value: unknown): 'bullets' | 'paragraph' | 'brief' {
  const parsed = parseOptionalString(value, 'style');
  if (!parsed) {
    return 'bullets';
  }
  if (!['bullets', 'paragraph', 'brief'].includes(parsed)) {
    throw new Error('style must be one of: bullets, paragraph, brief');
  }
  return parsed as 'bullets' | 'paragraph' | 'brief';
}

function parseLength(value: unknown): 'short' | 'medium' | 'long' {
  const parsed = parseOptionalString(value, 'length');
  if (!parsed) {
    return 'medium';
  }
  if (!['short', 'medium', 'long'].includes(parsed)) {
    throw new Error('length must be one of: short, medium, long');
  }
  return parsed as 'short' | 'medium' | 'long';
}

export const summarizeNotesTool: RegisteredTool = {
  definition: {
    name: 'notes.summarize',
    description: 'Summarize stored Telepocket notes by note IDs or by a search query.',
    inputSchema: {
      type: 'object',
      properties: {
        note_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional explicit note IDs to summarize.'
        },
        query: {
          type: 'string',
          description: 'Optional search query used to choose notes when note_ids are omitted.'
        },
        limit: {
          type: 'number',
          description: 'Maximum notes to summarize (1-10, default 5).'
        },
        style: {
          type: 'string',
          description: 'Summary style: bullets, paragraph, or brief.'
        },
        length: {
          type: 'string',
          description: 'Summary length: short, medium, or long.'
        },
        include_citations: {
          type: 'boolean',
          description: 'Whether the summary should include note IDs inline.'
        }
      },
      additionalProperties: false
    }
  },
  handler: async (args, context) => {
    const noteIds = parseOptionalStringArray(args.note_ids, 'note_ids');
    const query = parseOptionalString(args.query, 'query');

    if ((!noteIds || noteIds.length === 0) && !query) {
      throw new Error('Provide either note_ids or query');
    }

    const result = await summarizeNotes(context.config, {
      noteIds,
      query,
      limit: parseOptionalInteger(args.limit, 'limit', 5, 1, 10),
      style: parseStyle(args.style),
      length: parseLength(args.length),
      includeCitations: args.include_citations === undefined ? true : Boolean(args.include_citations)
    });

    return toJsonText(result);
  }
};

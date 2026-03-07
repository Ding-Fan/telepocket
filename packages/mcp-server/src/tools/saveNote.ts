import { RegisteredTool } from '../toolRegistry.js';
import {
  parseOptionalString,
  parseOptionalStringArray,
  saveNoteFromSource,
  toJsonText
} from '../telepocket.js';

export const saveNoteTool: RegisteredTool = {
  definition: {
    name: 'notes.save',
    description: 'Save a Telepocket note, optionally extracting and storing links from the content.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Note content to save.'
        },
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional explicit URLs to save with the note.'
        },
        source: {
          type: 'string',
          description: 'Source label, defaults to openclaw.'
        },
        source_item_id: {
          type: 'string',
          description: 'External source item identifier for deduplication.'
        },
        idempotency_key: {
          type: 'string',
          description: 'Required unique key for retry-safe writes.'
        },
        created_at: {
          type: 'string',
          description: 'Optional ISO timestamp for original event time.'
        }
      },
      required: ['content', 'idempotency_key'],
      additionalProperties: false
    }
  },
  handler: async (args, context) => {
    if (typeof args.content !== 'string' || args.content.trim().length === 0) {
      throw new Error('content is required and must be a non-empty string');
    }

    const idempotencyKey = parseOptionalString(args.idempotency_key, 'idempotency_key');
    if (!idempotencyKey) {
      throw new Error('idempotency_key is required');
    }

    const result = await saveNoteFromSource(context.config, {
      content: args.content.trim(),
      urls: parseOptionalStringArray(args.urls, 'urls'),
      source: parseOptionalString(args.source, 'source') || 'openclaw',
      sourceItemId: parseOptionalString(args.source_item_id, 'source_item_id'),
      idempotencyKey,
      createdAt: parseOptionalString(args.created_at, 'created_at')
    });

    return toJsonText({
      note_id: result.noteId,
      created: result.created,
      deduplicated: result.deduplicated,
      link_count: result.links.length,
      links: result.links
    });
  }
};

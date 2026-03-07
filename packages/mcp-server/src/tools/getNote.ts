import { RegisteredTool } from '../toolRegistry.js';
import { createSupabaseClient, fetchNoteById, getTelepocketUserId, toJsonText } from '../telepocket.js';

export const getNoteTool: RegisteredTool = {
  definition: {
    name: 'notes.get',
    description: 'Fetch a Telepocket note with links and images by note ID.',
    inputSchema: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: 'Telepocket note ID.'
        }
      },
      required: ['note_id'],
      additionalProperties: false
    }
  },
  handler: async (args, context) => {
    if (typeof args.note_id !== 'string' || args.note_id.trim().length === 0) {
      throw new Error('note_id is required and must be a string');
    }

    const note = await fetchNoteById(
      createSupabaseClient(context.config),
      getTelepocketUserId(context.config),
      args.note_id.trim()
    );

    if (!note) {
      throw new Error('Note not found');
    }

    return toJsonText({ note });
  }
};

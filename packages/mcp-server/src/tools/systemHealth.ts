import { RegisteredTool } from '../toolRegistry.js';
import { createSupabaseClient, toJsonText } from '../telepocket.js';

export const systemHealthTool: RegisteredTool = {
  definition: {
    name: 'system.health',
    description: 'Check whether the Telepocket MCP server is healthy and can reach Supabase.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  handler: async (_args, context) => {
    const client = createSupabaseClient(context.config);
    const { error } = await client.from('z_notes').select('id', { head: true, count: 'exact' });

    return toJsonText({
      ok: !error,
      version: '1.2.0',
      tools: 'notes.save, notes.get, notes.search, notes.summarize, todos.generate, links.exposure.record, links.exposure.stats',
      supabase: error ? error.message : 'ok',
      ai: context.config.googleAI.model
    });
  }
};

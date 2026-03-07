import { RegisteredTool } from '../toolRegistry.js';
import { getTelepocketUserId, toJsonText } from '../telepocket.js';

export const systemWhoAmITool: RegisteredTool = {
  definition: {
    name: 'system.whoami',
    description: 'Return the Telepocket user identity that this MCP server acts on behalf of.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  handler: async (_args, context) => {
    return toJsonText({
      telepocket_user_id: getTelepocketUserId(context.config),
      source: 'openclaw'
    });
  }
};

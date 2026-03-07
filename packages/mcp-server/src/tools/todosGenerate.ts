import { RegisteredTool } from '../toolRegistry.js';
import { generateTodosToolDefinition, handleGenerateTodos } from './generateTodos.js';

const sharedTodoInputSchema = {
  ...generateTodosToolDefinition.inputSchema,
  type: 'object' as const,
};

export const todosGenerateTool: RegisteredTool = {
  definition: {
    ...generateTodosToolDefinition,
    name: 'todos.generate',
    description: 'Generate a markdown todo list from the current Telepocket user notes.',
    inputSchema: sharedTodoInputSchema
  },
  handler: async (args, context) => {
    return handleGenerateTodos(
      {
        user_id: context.config.telepocket.userId,
        max_notes: typeof args.max_notes === 'number' ? args.max_notes : undefined
      },
      context.config
    );
  }
};

export const legacyTodosGenerateTool: RegisteredTool = {
  definition: {
    ...generateTodosToolDefinition,
    inputSchema: sharedTodoInputSchema
  },
  handler: async (args, context) => {
    return handleGenerateTodos(
      {
        user_id: typeof args.user_id === 'number' ? args.user_id : context.config.telepocket.userId,
        max_notes: typeof args.max_notes === 'number' ? args.max_notes : undefined
      },
      context.config
    );
  }
};

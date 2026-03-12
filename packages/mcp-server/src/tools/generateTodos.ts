import { createClient } from '@supabase/supabase-js';
import { generateTodosFromNotes } from '../../../shared/dist/services/todoGenerator.js';
import { Config } from '../config.js';

/**
 * MCP Tool: Generate todos from user's recent notes
 */
export async function handleGenerateTodos(
  args: { user_id: number; max_notes?: number },
  config: Config
): Promise<string> {
  const { user_id, max_notes = 100 } = args;

  // Validate user_id
  if (!user_id || typeof user_id !== 'number') {
    return 'Error: user_id is required and must be a number';
  }

  // Validate max_notes
  if (max_notes && (typeof max_notes !== 'number' || max_notes < 1 || max_notes > 200)) {
    return 'Error: max_notes must be a number between 1 and 200';
  }

  try {
    const supabase = createClient(
      config.supabase.url,
      config.supabase.apiKey
    );

    // Call shared todo generation service
    const result = await generateTodosFromNotes(
      supabase,
      user_id,
      config.googleAI.apiKey,
      max_notes
    );

    // Handle result
    if (!result.success) {
      return `Error generating todos: ${result.error}`;
    }

    // Return the generated todo markdown
    return result.todoMarkdown || 'No todos generated';

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in handleGenerateTodos:', errorMessage);
    return `Unexpected error: ${errorMessage}`;
  }
}

/**
 * Tool definition for MCP protocol
 */
export const generateTodosToolDefinition = {
  name: 'generate_todos_from_notes',
  description: 'Analyze user\'s recent notes and extract action items/todos using AI. Returns a formatted markdown todo list organized by categories.',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'number',
        description: 'Telegram user ID to fetch notes for (required)'
      },
      max_notes: {
        type: 'number',
        description: 'Maximum number of recent notes to analyze (default: 100, max: 200)',
        default: 100
      }
    },
    required: ['user_id']
  }
};

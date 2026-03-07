'use server';

import { createServerClient as createClient } from '@telepocket/shared';
import { generateTodosFromNotes } from '@telepocket/shared/dist/services/todoGenerator';
import { revalidatePath } from 'next/cache';

export interface GenerateTodosResult {
  success: boolean;
  noteId?: string;
  error?: string;
}

/**
 * Generate web-specific message ID for notes created from web app
 * Convention: Negative timestamp-based IDs to distinguish from Telegram messages
 * Format: -1YYYYMMDDHHMMSS (example: -120251229143022)
 */
function generateWebMessageId(): number {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .substring(0, 14); // YYYYMMDDHHmmss

  return -1 * Number('1' + timestamp);
}

/**
 * Generate todos from user's notes and save as a new note
 *
 * @param userId - Telegram user ID
 * @returns Result with note ID or error message
 */
export async function generateTodosFromNotesAndSave(
  userId: number
): Promise<GenerateTodosResult> {
  try {
    // Step 1: Create Supabase client
    const supabase = createClient();

    // Step 2: Get Groq API key
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('GROQ_API_KEY not configured');
      return {
        success: false,
        error: 'AI service not configured. Please contact support.'
      };
    }

    // Step 3: Generate todos using shared service
    const result = await generateTodosFromNotes(supabase, userId, apiKey, 60);

    if (!result.success || !result.todoMarkdown) {
      return {
        success: false,
        error: result.error || 'Failed to generate todos'
      };
    }

    // Step 4: Save generated todos as a new note
    const webMessageId = generateWebMessageId();

    const { data: savedNote, error: saveError } = await supabase.rpc(
      'save_note_with_links_atomic',
      {
        telegram_user_id_param: userId,
        telegram_message_id_param: webMessageId,
        content_param: result.todoMarkdown,
        links_param: [] // No links for generated todos
      }
    );

    if (saveError || !savedNote?.[0]?.note_id) {
      console.error('Failed to save todo note:', saveError);
      return {
        success: false,
        error: 'Failed to save generated todos. Please try again.'
      };
    }

    // Step 5: Revalidate paths
    revalidatePath('/');
    revalidatePath('/notes');

    return {
      success: true,
      noteId: savedNote[0].note_id
    };

  } catch (error) {
    console.error('Unexpected error in generateTodosFromNotesAndSave:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { NoteCategory } from '@/constants/categories';

/**
 * Confirm a category for a note (sets user_confirmed = true)
 */
export async function confirmNoteCategory(
  noteId: string,
  category: NoteCategory,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Update the category to mark it as user-confirmed
    const { error } = await supabase
      .from('z_note_categories')
      .update({ user_confirmed: true })
      .eq('note_id', noteId)
      .eq('category', category);

    if (error) {
      console.error('Failed to confirm note category:', error);
      return { success: false, error: error.message };
    }

    // Revalidate the note detail page
    revalidatePath(`/notes/${noteId}`);

    return { success: true };
  } catch (error) {
    console.error('Unexpected error confirming note category:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Archive a note (sets status = 'archived')
 */
export async function archiveNote(
  noteId: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Update the note status to archived
    const { error } = await supabase
      .from('z_notes')
      .update({ status: 'archived' })
      .eq('id', noteId)
      .eq('telegram_user_id', userId);

    if (error) {
      console.error('Failed to archive note:', error);
      return { success: false, error: error.message };
    }

    // Revalidate the home page (glance view)
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Unexpected error archiving note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

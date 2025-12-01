'use server';

import { createServerClient as createClient, Tag, CreateTagInput, UpdateTagInput } from '@telepocket/shared';
import { revalidatePath } from 'next/cache';

const TAG_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$/;

/**
 * Get all tags for a user (non-archived)
 */
export async function getUserTags(userId: number): Promise<{ success: boolean; tags?: Tag[]; error?: string }> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('z_tags')
      .select('*')
      .eq('created_by', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch user tags:', error);
      return { success: false, error: error.message };
    }

    return { success: true, tags: data || [] };
  } catch (error) {
    console.error('Unexpected error fetching user tags:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a new tag
 */
export async function createTag(
  input: CreateTagInput,
  userId: number
): Promise<{ success: boolean; tag?: Tag; error?: string }> {
  try {
    // 1. Validate tag name format
    if (!TAG_NAME_REGEX.test(input.tag_name)) {
      return {
        success: false,
        error: 'Invalid tag name. Use lowercase letters, numbers, hyphens, underscores (2-30 chars)'
      };
    }

    const supabase = createClient();

    // 2. Create tag
    const { data: newTag, error } = await supabase
      .from('z_tags')
      .insert({
        tag_name: input.tag_name,
        score_prompt: input.score_prompt || null,
        is_ai_enabled: input.is_ai_enabled || false,
        created_by: userId,
        auto_confirm_threshold: input.auto_confirm_threshold || 95,
        suggest_threshold: input.suggest_threshold || 60
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create tag:', error);
      return {
        success: false,
        error: error.message.includes('duplicate')
          ? 'Tag already exists'
          : 'Failed to create tag'
      };
    }

    // Revalidate tags page
    revalidatePath('/tags');

    return { success: true, tag: newTag };
  } catch (error) {
    console.error('Unexpected error creating tag:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update an existing tag
 */
export async function updateTag(
  tagId: string,
  input: UpdateTagInput,
  userId: number
): Promise<{ success: boolean; tag?: Tag; error?: string }> {
  try {
    // Validate tag name format if provided
    if (input.tag_name && !TAG_NAME_REGEX.test(input.tag_name)) {
      return {
        success: false,
        error: 'Invalid tag name. Use lowercase letters, numbers, hyphens, underscores (2-30 chars)'
      };
    }

    const supabase = createClient();

    // Build update object (only include provided fields)
    const updates: Partial<Tag> = {};
    if (input.tag_name !== undefined) updates.tag_name = input.tag_name;
    if (input.score_prompt !== undefined) updates.score_prompt = input.score_prompt;
    if (input.is_ai_enabled !== undefined) updates.is_ai_enabled = input.is_ai_enabled;
    if (input.auto_confirm_threshold !== undefined) updates.auto_confirm_threshold = input.auto_confirm_threshold;
    if (input.suggest_threshold !== undefined) updates.suggest_threshold = input.suggest_threshold;

    const { data: updatedTag, error } = await supabase
      .from('z_tags')
      .update(updates)
      .eq('id', tagId)
      .eq('created_by', userId)  // Ensure user owns the tag
      .select()
      .single();

    if (error) {
      console.error('Failed to update tag:', error);
      return {
        success: false,
        error: error.message.includes('duplicate')
          ? 'Tag name already exists'
          : 'Failed to update tag'
      };
    }

    // Revalidate tags page
    revalidatePath('/tags');

    return { success: true, tag: updatedTag };
  } catch (error) {
    console.error('Unexpected error updating tag:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Archive a tag (soft delete)
 */
export async function archiveTag(
  tagId: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('z_tags')
      .update({ is_archived: true })
      .eq('id', tagId)
      .eq('created_by', userId);  // Ensure user owns the tag

    if (error) {
      console.error('Failed to archive tag:', error);
      return { success: false, error: error.message };
    }

    // Revalidate tags page
    revalidatePath('/tags');

    return { success: true };
  } catch (error) {
    console.error('Unexpected error archiving tag:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Add a tag to a note
 */
export async function addTagToNote(
  noteId: string,
  tagId: string,
  userId: number,
  confidence: number = 1.0,
  userConfirmed: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Verify user owns the tag
    const { data: tag, error: tagError } = await supabase
      .from('z_tags')
      .select('id')
      .eq('id', tagId)
      .eq('created_by', userId)
      .single();

    if (tagError || !tag) {
      return { success: false, error: 'Tag not found or access denied' };
    }

    // Add tag to note (upsert to handle duplicates)
    const { error } = await supabase
      .from('z_note_tags')
      .upsert({
        note_id: noteId,
        tag_id: tagId,
        confidence,
        user_confirmed: userConfirmed,
        confirmed_at: userConfirmed ? new Date().toISOString() : null
      }, {
        onConflict: 'note_id,tag_id'
      });

    if (error) {
      console.error('Failed to add tag to note:', error);
      return { success: false, error: error.message };
    }

    // Update tag usage (fetch current count first)
    const { data: currentTag } = await supabase
      .from('z_tags')
      .select('usage_count')
      .eq('id', tagId)
      .single();

    if (currentTag) {
      await supabase
        .from('z_tags')
        .update({
          usage_count: currentTag.usage_count + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', tagId);
    }

    // Revalidate note detail page
    revalidatePath(`/notes/${noteId}`);

    return { success: true };
  } catch (error) {
    console.error('Unexpected error adding tag to note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Remove a tag from a note
 */
export async function removeTagFromNote(
  noteId: string,
  tagId: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Verify user owns the tag
    const { data: tag, error: tagError } = await supabase
      .from('z_tags')
      .select('id')
      .eq('id', tagId)
      .eq('created_by', userId)
      .single();

    if (tagError || !tag) {
      return { success: false, error: 'Tag not found or access denied' };
    }

    // Remove tag from note
    const { error } = await supabase
      .from('z_note_tags')
      .delete()
      .eq('note_id', noteId)
      .eq('tag_id', tagId);

    if (error) {
      console.error('Failed to remove tag from note:', error);
      return { success: false, error: error.message };
    }

    // Revalidate note detail page
    revalidatePath(`/notes/${noteId}`);

    return { success: true };
  } catch (error) {
    console.error('Unexpected error removing tag from note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Confirm a suggested tag (sets user_confirmed = true)
 */
export async function confirmNoteTag(
  noteId: string,
  tagId: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Verify user owns the tag
    const { data: tag, error: tagError } = await supabase
      .from('z_tags')
      .select('id')
      .eq('id', tagId)
      .eq('created_by', userId)
      .single();

    if (tagError || !tag) {
      return { success: false, error: 'Tag not found or access denied' };
    }

    // Update the note-tag relationship to mark it as confirmed
    const { error } = await supabase
      .from('z_note_tags')
      .update({
        user_confirmed: true,
        confirmed_at: new Date().toISOString()
      })
      .eq('note_id', noteId)
      .eq('tag_id', tagId);

    if (error) {
      console.error('Failed to confirm note tag:', error);
      return { success: false, error: error.message };
    }

    // Revalidate note detail page
    revalidatePath(`/notes/${noteId}`);

    return { success: true };
  } catch (error) {
    console.error('Unexpected error confirming note tag:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Initialize starter tags for a user by calling the database function.
 * This function is idempotent - it won't create tags if the user already has any.
 *
 * @param userId - Telegram user ID
 * @param supabaseClient - Supabase client instance
 * @returns Number of tags created (0 if user already had tags)
 */
export async function initializeStarterTags(
  userId: number,
  supabaseClient: SupabaseClient
): Promise<{ success: boolean; tagsCreated: number; error?: string }> {
  try {
    const supabase = supabaseClient;

    // Call the database function that creates starter tags
    const { data, error } = await supabase
      .rpc('ensure_user_starter_tags', { user_id_param: userId });

    if (error) {
      console.error('Failed to initialize starter tags:', error);
      return { success: false, tagsCreated: 0, error: error.message };
    }

    const tagsCreated = data || 0;

    if (tagsCreated > 0) {
      console.log(`✅ Created ${tagsCreated} starter tags for user ${userId}`);
    } else {
      console.log(`ℹ️ User ${userId} already has tags, skipped starter tag creation`);
    }

    return { success: true, tagsCreated };
  } catch (error) {
    console.error('Unexpected error initializing starter tags:', error);
    return {
      success: false,
      tagsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

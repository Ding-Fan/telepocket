import { SupabaseClient } from '@supabase/supabase-js';

export async function getSearchHistory(
  supabase: SupabaseClient,
  userId: number,
  limit: number = 10
) {
  try {
    const { data, error } = await supabase
      .from('z_search_history')
      .select('query, searched_at')
      .eq('telegram_user_id', userId)
      .order('searched_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      searches: data || [],
      count: data?.length || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function saveSearch(
  supabase: SupabaseClient,
  userId: number,
  query: string
) {
  try {
    // Validation
    if (!query || query.trim().length < 2) {
      return { success: false, error: 'Query too short (min 2 chars)' };
    }
    if (query.length > 500) {
      return { success: false, error: 'Query too long (max 500 chars)' };
    }

    const { error } = await supabase.rpc('save_search_query', {
      user_id: userId,
      search_query: query.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: 'Search saved to history' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteSearch(
  supabase: SupabaseClient,
  userId: number,
  query: string
) {
  try {
    const { error } = await supabase
      .from('z_search_history')
      .delete()
      .eq('telegram_user_id', userId)
      .eq('query', query);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: 'Search deleted from history' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function clearAllHistory(
  supabase: SupabaseClient,
  userId: number
) {
  try {
    const { error } = await supabase
      .from('z_search_history')
      .delete()
      .eq('telegram_user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: 'All search history cleared' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

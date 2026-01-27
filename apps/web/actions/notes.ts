'use server';

import { createServerClient as createClient } from '@telepocket/shared';
import { revalidatePath } from 'next/cache';

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

/**
 * Unarchive a note (sets status = 'active')
 */
export async function unarchiveNote(
  noteId: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Update the note status to active
    const { error } = await supabase
      .from('z_notes')
      .update({ status: 'active' })
      .eq('id', noteId)
      .eq('telegram_user_id', userId);

    if (error) {
      console.error('Failed to unarchive note:', error);
      return { success: false, error: error.message };
    }

    // Revalidate the home page (glance view)
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Unexpected error unarchiving note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Toggle note pin status (toggles is_marked)
 */
export async function toggleNotePin(
  noteId: string,
  userId: number
): Promise<{ success: boolean; isMarked?: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Get current is_marked status
    const { data: currentNote, error: fetchError } = await supabase
      .from('z_notes')
      .select('is_marked')
      .eq('id', noteId)
      .eq('telegram_user_id', userId)
      .single();

    if (fetchError || !currentNote) {
      console.error('Failed to fetch note for pin toggle:', fetchError);
      return { success: false, error: 'Note not found or unauthorized' };
    }

    // Toggle the is_marked status
    const newStatus = !currentNote.is_marked;

    const { error } = await supabase
      .from('z_notes')
      .update({ is_marked: newStatus })
      .eq('id', noteId)
      .eq('telegram_user_id', userId);

    if (error) {
      console.error('Failed to toggle note pin:', error);
      return { success: false, error: error.message };
    }

    // Revalidate the home page (glance view)
    revalidatePath('/');

    return { success: true, isMarked: newStatus };
  } catch (error) {
    console.error('Unexpected error toggling note pin:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


/**
 * Generate and save an embedding for a note
 */
import { EmbeddingService, NoteLink, HybridSearchResult } from '@telepocket/shared';

// Singleton instance of EmbeddingService
let embeddingService: EmbeddingService | null = null;

function getEmbeddingService() {
  if (!embeddingService) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set');
    }
    embeddingService = new EmbeddingService(apiKey);
  }
  return embeddingService;
}

export async function embedNote(
  noteId: string,
  content: string,
  links: NoteLink[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    const service = getEmbeddingService();
    const text = service.prepareNoteText({ content, links });
    const embedding = await service.generateEmbedding(text);

    const supabase = createClient();
    const { error } = await supabase
      .from('z_notes')
      .update({ embedding })
      .eq('id', noteId);

    if (error) {
      console.error('Failed to save embedding:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error embedding note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Search notes using hybrid approach (semantic + fuzzy)
 */
export async function searchNotesHybrid(
  userId: number,
  query: string,
  page: number = 1,
  pageSize: number = 20,
  category: string | null = null
): Promise<{ results: HybridSearchResult[]; totalCount: number; error?: string }> {
  try {
    const service = getEmbeddingService();

    // Generate embedding for the query
    const queryEmbedding = await service.generateEmbedding(query);

    const supabase = createClient();

    // Call the hybrid search RPC function
    const { data, error } = await supabase.rpc('search_notes_hybrid', {
      query_embedding: queryEmbedding,
      query_text: query,
      user_id: userId,
      match_threshold: 0.5,
      page_size: pageSize,
      category_filter: category
    });

    if (error) {
      console.error('Hybrid search failed:', error);
      return { results: [], totalCount: 0, error: error.message };
    }

    if (!data || data.length === 0) {
      return { results: [], totalCount: 0 };
    }

    // Parse results
    const results: HybridSearchResult[] = data.map((item: any) => ({
      id: item.id,
      content: item.content,
      category: item.category,
      tags: item.tags || [],
      relevance_score: item.relevance_score,
      search_type: item.search_type,
      links: item.links || [],
      created_at: item.created_at,
      total_count: item.total_count
    }));

    const totalCount = results.length > 0 ? results[0].total_count : 0;

    return { results, totalCount };
  } catch (error) {
    console.error('Error in hybrid search:', error);
    return {
      results: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save search query to history
 */
export async function saveSearchHistory(
  userId: number,
  query: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validation
    if (!query || query.trim().length < 2) {
      return { success: false, error: 'Query too short' };
    }
    if (query.length > 500) {
      return { success: false, error: 'Query too long' };
    }

    const supabase = createClient();

    const { error } = await supabase.rpc('save_search_query', {
      user_id: userId,
      search_query: query.trim()
    });

    if (error) {
      console.error('Failed to save search history:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving search history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get search history for a user
 */
export async function getSearchHistory(
  userId: number,
  limit: number = 10
): Promise<{ searches: string[]; error?: string }> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('z_search_history')
      .select('query')
      .eq('telegram_user_id', userId)
      .order('searched_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch search history:', error);
      return { searches: [], error: error.message };
    }

    return {
      searches: data?.map(row => row.query) || []
    };
  } catch (error) {
    console.error('Error fetching search history:', error);
    return {
      searches: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clear all search history for a user
 */
export async function clearSearchHistory(
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('z_search_history')
      .delete()
      .eq('telegram_user_id', userId);

    if (error) {
      console.error('Failed to clear search history:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error clearing search history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

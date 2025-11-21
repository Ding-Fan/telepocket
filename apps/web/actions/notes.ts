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
  pageSize: number = 20
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
      page_size: pageSize
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

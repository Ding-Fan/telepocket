import { db, Note, NoteLink } from './connection';
import { validateAuthorizedUser, validatePagination } from '../utils/validation';
import { handleDatabaseError } from '../utils/errorHandler';

export interface NoteSearchResult {
  note_id: string;
  note_content: string;
  telegram_message_id: number;
  created_at: string;
  links: Array<{
    id: string;
    url: string;
    title?: string;
    description?: string;
    og_image?: string;
    created_at: string;
    updated_at: string;
  }>;
  relevance_score?: number;
}

export class NoteOperations {
  async saveNote(note: Omit<Note, 'id' | 'created_at'>): Promise<string | null> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(note.telegram_user_id);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return null;
      }

      const { data, error } = await db.getClient()
        .from('z_notes')
        .insert(note)
        .select('id')
        .single();

      if (error) {
        console.error('Failed to save note:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      handleDatabaseError(error, {
        userId: note.telegram_user_id,
        operation: 'saveNote',
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  async saveNoteLinks(links: Omit<NoteLink, 'id' | 'created_at' | 'updated_at'>[]): Promise<boolean> {
    try {
      const { error } = await db.getClient()
        .from('z_note_links')
        .insert(links);

      if (error) {
        console.error('Failed to save note links:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error saving note links:', error);
      return false;
    }
  }

  async saveNoteWithLinks(
    note: Omit<Note, 'id' | 'created_at'>,
    links: Omit<NoteLink, 'id' | 'note_id' | 'created_at' | 'updated_at'>[]
  ): Promise<{ success: boolean; linkCount: number }> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(note.telegram_user_id);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return { success: false, linkCount: 0 };
      }

      // Prepare links as JSONB array for the atomic function
      const linksJsonb = links.length > 0 ? links : [];

      // Use atomic function to save note with links in a single transaction
      const { data, error } = await db.getClient()
        .rpc('save_note_with_links_atomic', {
          telegram_user_id_param: note.telegram_user_id,
          telegram_message_id_param: note.telegram_message_id,
          content_param: note.content,
          links_param: linksJsonb
        })
        .single();

      if (error) {
        console.error('Failed to save note with links:', error);
        return { success: false, linkCount: 0 };
      }

      // Extract result from RPC response
      const result = data as { note_id: string; links_saved: number; success: boolean };

      return {
        success: result.success,
        linkCount: result.links_saved
      };
    } catch (error) {
      handleDatabaseError(error, {
        userId: note.telegram_user_id,
        operation: 'saveNoteWithLinks',
        timestamp: new Date().toISOString(),
        additionalInfo: { linkCount: links.length }
      });
      return { success: false, linkCount: 0 };
    }
  }

  async getNotesWithPagination(
    userId: number,
    page: number = 1,
    limit: number = 5
  ): Promise<{
    notes: NoteSearchResult[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      // Validate pagination
      const paginationValidation = validatePagination(page, limit);
      if (!paginationValidation.valid) {
        console.error('Invalid pagination:', paginationValidation.error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      // Call optimized pagination function (single query with window function)
      const { data, error } = await db.getClient()
        .rpc('get_notes_with_pagination', {
          telegram_user_id_param: userId,
          page_number: page,
          page_size: limit
        });

      if (error) {
        console.error('Failed to fetch notes:', error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const results = (data || []) as Array<NoteSearchResult & { total_count: number }>;

      // Extract total count from first result (all rows have same total_count from window function)
      const totalCount = results.length > 0 ? Number(results[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Remove total_count from results as it's not part of NoteSearchResult
      const notes = results.map(({ total_count, ...note }) => note) as NoteSearchResult[];

      return {
        notes,
        totalCount,
        currentPage: page,
        totalPages
      };
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'getNotesWithPagination',
        timestamp: new Date().toISOString(),
        additionalInfo: { page, limit }
      });
      return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
    }
  }

  async searchNotesWithPagination(
    userId: number,
    keyword: string,
    page: number = 1,
    limit: number = 5
  ): Promise<{
    notes: NoteSearchResult[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    keyword: string;
  }> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      // Validate pagination
      const paginationValidation = validatePagination(page, limit);
      if (!paginationValidation.valid) {
        console.error('Invalid pagination:', paginationValidation.error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      // Call optimized search function (single query with window function)
      const { data, error } = await db.getClient()
        .rpc('search_notes_fuzzy_optimized', {
          telegram_user_id_param: userId,
          search_keyword: keyword,
          page_number: page,
          page_size: limit
        });

      if (error) {
        console.error('Failed to search notes:', error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      const results = (data || []) as Array<NoteSearchResult & { total_count: number }>;

      // Extract total count from first result (all rows have same total_count from window function)
      const totalCount = results.length > 0 ? Number(results[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Remove total_count from results as it's not part of NoteSearchResult
      const notes = results.map(({ total_count, ...note }) => note) as NoteSearchResult[];

      return {
        notes,
        totalCount,
        currentPage: page,
        totalPages,
        keyword
      };
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'searchNotesWithPagination',
        timestamp: new Date().toISOString(),
        additionalInfo: { keyword, page, limit }
      });
      return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
    }
  }

  /**
   * Update metadata for a specific link URL in z_note_links table
   * Used by background metadata fetch
   */
  async updateNoteLinkMetadata(
    noteId: string,
    url: string,
    metadata: { title?: string; description?: string; og_image?: string }
  ): Promise<boolean> {
    try {
      const { error } = await db.getClient()
        .from('z_note_links')
        .update({
          title: metadata.title,
          description: metadata.description,
          og_image: metadata.og_image,
          updated_at: new Date().toISOString()
        })
        .eq('note_id', noteId)
        .eq('url', url);

      if (error) {
        console.error('Failed to update note link metadata:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error updating note link metadata:', error);
      return false;
    }
  }
}

export const noteOps = new NoteOperations();

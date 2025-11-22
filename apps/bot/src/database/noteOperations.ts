import { db, Note, NoteLink, NoteImage } from './connection';
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

export interface LinkOnlyResult {
  link_id: string;
  note_id: string;
  url: string;
  title?: string;
  description?: string;
  og_image?: string;
  created_at: string;
  updated_at: string;
  relevance_score?: number;
}

export interface GlanceNote {
  note_id: string;
  category: string;
  content: string;
  updated_at: string;
  created_at: string;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  row_number: number;
  category_total: number;
  category_max_updated: string;
}

export interface StreamNote {
  note_id: string;
  category: string;
  content: string;
  updated_at: string;
  created_at: string;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  is_marked: boolean;
  impression_count: number;
  row_number: number;
  category_total: number;
  section: 'priority' | 'category';
}

export interface SuggestionNote {
  note_id: string;
  category: string;
  content: string;
  created_at: string;
  impression_count: number;
  last_shown_at: string | null;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  min_impression_count: number;
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
  ): Promise<{ success: boolean; linkCount: number; noteId?: string }> {
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
        linkCount: result.links_saved,
        noteId: result.note_id
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

  /**
   * Get individual links with pagination (links-only view)
   * Returns individual links from z_note_links table
   */
  async getLinksOnlyWithPagination(
    userId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    links: LinkOnlyResult[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      // Validate inputs
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const paginationValidation = validatePagination(page, limit);
      if (!paginationValidation.valid) {
        console.error('Invalid pagination:', paginationValidation.error);
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const { data, error } = await db.getClient()
        .rpc('get_links_with_pagination', {
          telegram_user_id_param: userId,
          page_number: page,
          page_size: limit
        });

      if (error) {
        handleDatabaseError(error, {
          userId,
          operation: 'getLinksOnlyWithPagination',
          timestamp: new Date().toISOString()
        });
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const links = data || [];
      const totalCount = links.length > 0 ? Number(links[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        links: links.map((link: any) => ({
          link_id: link.link_id,
          note_id: link.note_id,
          url: link.url,
          title: link.title,
          description: link.description,
          og_image: link.og_image,
          created_at: link.created_at,
          updated_at: link.updated_at
        })),
        totalCount,
        currentPage: page,
        totalPages
      };
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'getLinksOnlyWithPagination',
        timestamp: new Date().toISOString()
      });
      return { links: [], totalCount: 0, currentPage: 1, totalPages: 0 };
    }
  }

  /**
   * Search individual links with fuzzy matching (links-only search)
   * Searches only in link metadata: title, URL, description
   */
  async searchLinksOnlyWithPagination(
    userId: number,
    keyword: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    links: LinkOnlyResult[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    keyword: string;
  }> {
    try {
      // Validate inputs
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      const paginationValidation = validatePagination(page, limit);
      if (!paginationValidation.valid) {
        console.error('Invalid pagination:', paginationValidation.error);
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      const { data, error } = await db.getClient()
        .rpc('search_links_fuzzy_optimized', {
          telegram_user_id_param: userId,
          search_keyword: keyword,
          page_number: page,
          page_size: limit
        });

      if (error) {
        handleDatabaseError(error, {
          userId,
          operation: 'searchLinksOnlyWithPagination',
          timestamp: new Date().toISOString(),
          additionalInfo: { keyword }
        });
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      const links = data || [];
      const totalCount = links.length > 0 ? Number(links[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        links: links.map((link: any) => ({
          link_id: link.link_id,
          note_id: link.note_id,
          url: link.url,
          title: link.title,
          description: link.description,
          og_image: link.og_image,
          created_at: link.created_at,
          updated_at: link.updated_at,
          relevance_score: link.relevance_score
        })),
        totalCount,
        currentPage: page,
        totalPages,
        keyword
      };
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'searchLinksOnlyWithPagination',
        timestamp: new Date().toISOString(),
        additionalInfo: { keyword }
      });
      return { links: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
    }
  }

  async saveNoteImages(
    noteId: string,
    images: Omit<NoteImage, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<void> {
    try {
      const { error } = await db.getClient()
        .from('z_note_images')
        .insert(images.map(img => ({ ...img, note_id: noteId })));

      if (error) {
        handleDatabaseError(error, {
          operation: 'saveNoteImages',
          timestamp: new Date().toISOString(),
          additionalInfo: { noteId, imageCount: images.length }
        });
        throw new Error(`Failed to save images: ${error.message}`);
      }
    } catch (error) {
      handleDatabaseError(error, {
        operation: 'saveNoteImages',
        timestamp: new Date().toISOString(),
        additionalInfo: { noteId, imageCount: images.length }
      });
      throw error;
    }
  }

  // Method overloads for batch and single note image fetching
  async getNoteImages(noteIds: string[]): Promise<Map<string, NoteImage[]>>;
  async getNoteImages(noteId: string): Promise<NoteImage[]>;
  async getNoteImages(input: string | string[]): Promise<Map<string, NoteImage[]> | NoteImage[]> {
    try {
      // Handle batch fetching (array input)
      if (Array.isArray(input)) {
        if (input.length === 0) {
          return new Map();
        }

        const { data, error } = await db.getClient()
          .from('z_note_images')
          .select('*')
          .in('note_id', input)
          .order('created_at', { ascending: true });

        if (error) {
          handleDatabaseError(error, {
            operation: 'getNoteImages (batch)',
            timestamp: new Date().toISOString(),
            additionalInfo: { noteIds: input }
          });
          return new Map();
        }

        // Group images by note_id into Map
        const imageMap = new Map<string, NoteImage[]>();
        (data || []).forEach(image => {
          const existing = imageMap.get(image.note_id) || [];
          existing.push(image);
          imageMap.set(image.note_id, existing);
        });

        return imageMap;
      }

      // Handle single note fetching (string input - backward compatibility)
      const { data, error } = await db.getClient()
        .from('z_note_images')
        .select('*')
        .eq('note_id', input)
        .order('created_at', { ascending: true });

      if (error) {
        handleDatabaseError(error, {
          operation: 'getNoteImages',
          timestamp: new Date().toISOString(),
          additionalInfo: { noteId: input }
        });
        throw new Error(`Failed to get images: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      handleDatabaseError(error, {
        operation: 'getNoteImages',
        timestamp: new Date().toISOString(),
        additionalInfo: { input }
      });

      // Return appropriate empty value based on input type
      return Array.isArray(input) ? new Map() : [];
    }
  }

  /**
   * Get full note details by ID including all links and images
   */
  async getNoteById(noteId: string, userId: number): Promise<{
    note: NoteSearchResult & { is_marked?: boolean; status?: string };
    images: NoteImage[];
  } | null> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return null;
      }

      // Get note with links
      const { data, error } = await db.getClient()
        .from('z_notes')
        .select(`
          id,
          content,
          telegram_message_id,
          created_at,
          is_marked,
          status,
          z_note_links(id, url, title, description, og_image, created_at, updated_at)
        `)
        .eq('id', noteId)
        .eq('telegram_user_id', userId)
        .single();

      if (error) {
        console.error('Failed to get note by ID:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      // Get images for this note
      const images = await this.getNoteImages(noteId);

      // Transform to NoteSearchResult format
      const note: NoteSearchResult & { is_marked?: boolean; status?: string } = {
        note_id: data.id,
        note_content: data.content,
        telegram_message_id: data.telegram_message_id,
        created_at: data.created_at,
        is_marked: data.is_marked,
        status: data.status,
        links: (data.z_note_links || []).map((link: any) => ({
          id: link.id,
          url: link.url,
          title: link.title,
          description: link.description,
          og_image: link.og_image,
          created_at: link.created_at,
          updated_at: link.updated_at
        }))
      };

      return { note, images };
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'getNoteById',
        timestamp: new Date().toISOString(),
        additionalInfo: { noteId }
      });
      return null;
    }
  }

  /**
   * Delete a note and all related data (cascade)
   */
  async deleteNote(noteId: string, userId: number): Promise<boolean> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return false;
      }

      // Delete note (CASCADE will handle z_note_links, z_note_images, z_note_categories)
      const { error } = await db.getClient()
        .from('z_notes')
        .delete()
        .eq('id', noteId)
        .eq('telegram_user_id', userId); // Security: only allow user to delete their own notes

      if (error) {
        console.error('Failed to delete note:', error);
        return false;
      }

      return true;
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'deleteNote',
        timestamp: new Date().toISOString(),
        additionalInfo: { noteId }
      });
      return false;
    }
  }

  /**
   * Toggle the is_marked status of a note
   */
  async toggleNoteMark(noteId: string, userId: number): Promise<{ success: boolean; isMarked?: boolean }> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return { success: false };
      }

      // Get current is_marked status
      const { data: currentNote, error: fetchError } = await db.getClient()
        .from('z_notes')
        .select('is_marked')
        .eq('id', noteId)
        .eq('telegram_user_id', userId)
        .single();

      if (fetchError || !currentNote) {
        console.error('Failed to fetch note for mark toggle:', fetchError);
        return { success: false };
      }

      // Toggle the status
      const newStatus = !currentNote.is_marked;

      const { error } = await db.getClient()
        .from('z_notes')
        .update({ is_marked: newStatus })
        .eq('id', noteId)
        .eq('telegram_user_id', userId);

      if (error) {
        console.error('Failed to toggle note mark:', error);
        return { success: false };
      }

      return { success: true, isMarked: newStatus };
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'toggleNoteMark',
        timestamp: new Date().toISOString(),
        additionalInfo: { noteId }
      });
      return { success: false };
    }
  }

  /**
   * Archive a note (set status to 'archived')
   */
  async archiveNote(noteId: string, userId: number): Promise<boolean> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return false;
      }

      // Update status to archived
      const { error } = await db.getClient()
        .from('z_notes')
        .update({ status: 'archived' })
        .eq('id', noteId)
        .eq('telegram_user_id', userId); // Security: only allow user to archive their own notes

      if (error) {
        console.error('Failed to archive note:', error);
        return false;
      }

      return true;
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'archiveNote',
        timestamp: new Date().toISOString(),
        additionalInfo: { noteId }
      });
      return false;
    }
  }

  /**
   * Unarchive a note (set status to 'active')
   */
  async unarchiveNote(noteId: string, userId: number): Promise<boolean> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return false;
      }

      // Update status to active
      const { error } = await db.getClient()
        .from('z_notes')
        .update({ status: 'active' })
        .eq('id', noteId)
        .eq('telegram_user_id', userId); // Security: only allow user to unarchive their own notes

      if (error) {
        console.error('Failed to unarchive note:', error);
        return false;
      }

      return true;
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'unarchiveNote',
        timestamp: new Date().toISOString(),
        additionalInfo: { noteId }
      });
      return false;
    }
  }

  /**
   * Get archived notes with pagination
   */
  async getArchivedNotesWithPagination(
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

      // Call archived notes pagination function
      const { data, error } = await db.getClient()
        .rpc('get_archived_notes_with_pagination', {
          telegram_user_id_param: userId,
          page_number: page,
          page_size: limit
        });

      if (error) {
        console.error('Failed to fetch archived notes:', error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const results = (data || []) as Array<NoteSearchResult & { total_count: number }>;

      // Extract total count from first result
      const totalCount = results.length > 0 ? Number(results[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Remove total_count from results
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
        operation: 'getArchivedNotesWithPagination',
        timestamp: new Date().toISOString(),
        additionalInfo: { page, limit }
      });
      return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
    }
  }

  /**
   * Search archived notes with fuzzy matching
   */
  async searchArchivedNotesWithPagination(
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

      // Call archived search function
      const { data, error } = await db.getClient()
        .rpc('search_archived_notes_fuzzy_optimized', {
          telegram_user_id_param: userId,
          search_keyword: keyword,
          page_number: page,
          page_size: limit
        });

      if (error) {
        console.error('Failed to search archived notes:', error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      const results = (data || []) as Array<NoteSearchResult & { total_count: number }>;

      // Extract total count from first result
      const totalCount = results.length > 0 ? Number(results[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Remove total_count from results
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
        operation: 'searchArchivedNotesWithPagination',
        timestamp: new Date().toISOString(),
        additionalInfo: { keyword, page, limit }
      });
      return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
    }
  }

  /**
   * Get glance view - N most recent notes per category
   */
  async getNotesGlanceView(
    userId: number,
    notesPerCategory: number = 2
  ): Promise<GlanceNote[]> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return [];
      }

      // Call RPC function
      const { data, error } = await db.getClient()
        .rpc('get_notes_glance_view', {
          telegram_user_id_param: userId,
          notes_per_category: notesPerCategory
        });

      if (error) {
        console.error('Failed to fetch glance view:', error);
        return [];
      }

      return (data || []) as GlanceNote[];
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'getNotesGlanceView',
        timestamp: new Date().toISOString(),
        additionalInfo: { notesPerCategory }
      });
      return [];
    }
  }

  /**
   * Get glance priority stream - 3 priority notes + 2 per category
   */
  async getNotesGlancePriorityStream(
    userId: number,
    priorityLimit: number = 3,
    notesPerCategory: number = 2
  ): Promise<StreamNote[]> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return [];
      }

      // Call RPC function
      const { data, error } = await db.getClient()
        .rpc('get_notes_priority_stream', {
          telegram_user_id_param: userId,
          priority_limit: priorityLimit,
          notes_per_category: notesPerCategory
        });

      if (error) {
        console.error('Failed to fetch glance priority stream:', error);
        return [];
      }

      return (data || []) as StreamNote[];
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'getNotesGlancePriorityStream',
        timestamp: new Date().toISOString(),
        additionalInfo: { priorityLimit, notesPerCategory }
      });
      return [];
    }
  }

  /**
   * Get suggestions by impression - notes from past N days with min impression count per category
   * Used by /suggest command for weighted selection algorithm
   */
  async getSuggestionsByImpression(
    userId: number,
    daysBack: number = 7
  ): Promise<SuggestionNote[]> {
    try {
      // Validate authorized user
      const userValidation = validateAuthorizedUser(userId);
      if (!userValidation.valid) {
        console.error('Unauthorized user attempt:', userValidation.error);
        return [];
      }

      // Call RPC function
      const { data, error } = await db.getClient()
        .rpc('get_suggestions_by_impression', {
          telegram_user_id_param: userId,
          days_back: daysBack
        });

      if (error) {
        console.error('Failed to fetch suggestions:', error);
        return [];
      }

      return (data || []) as SuggestionNote[];
    } catch (error) {
      handleDatabaseError(error, {
        userId,
        operation: 'getSuggestionsByImpression',
        timestamp: new Date().toISOString(),
        additionalInfo: { daysBack }
      });
      return [];
    }
  }

  /**
   * Increment impression count and update last_shown_at for given notes
   * Used by suggestion algorithm to track which notes have been shown
   */
  async incrementImpressions(noteIds: string[]): Promise<boolean> {
    try {
      // Handle empty array gracefully
      if (noteIds.length === 0) {
        return true;
      }

      // Call database function to atomically increment impressions
      const { data, error } = await db.getClient()
        .rpc('increment_note_impressions', {
          note_ids: noteIds
        });

      if (error) {
        console.error('Failed to increment impressions:', error);
        return false;
      }

      // data contains the count of updated rows
      const updatedCount = data as number;
      if (updatedCount !== noteIds.length) {
        console.warn(`Impression increment mismatch: expected ${noteIds.length}, got ${updatedCount}`);
      }

      return true;
    } catch (error) {
      handleDatabaseError(error, {
        operation: 'incrementImpressions',
        timestamp: new Date().toISOString(),
        additionalInfo: { noteCount: noteIds.length }
      });
      return false;
    }
  }
}

export const noteOps = new NoteOperations();

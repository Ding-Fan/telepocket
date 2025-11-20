import { db, Message, Link } from './connection';
import { NoteCategory, NoteCategoryInsert, NoteCategoryRecord } from '../types/noteCategories';

export class DatabaseOperations {
  async saveMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<string | null> {
    try {
      const { data, error } = await db.getClient()
        .from('z_messages')
        .insert(message)
        .select('id')
        .single();

      if (error) {
        console.error('Failed to save message:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Database error saving message:', error);
      return null;
    }
  }

  async saveLinks(links: Omit<Link, 'id' | 'created_at' | 'updated_at'>[]): Promise<boolean> {
    try {
      const { error } = await db.getClient()
        .from('z_links')
        .insert(links);

      if (error) {
        console.error('Failed to save links:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error saving links:', error);
      return false;
    }
  }

  async saveMessageWithLinks(
    message: Omit<Message, 'id' | 'created_at'>,
    links: Omit<Link, 'id' | 'message_id' | 'created_at' | 'updated_at'>[]
  ): Promise<{ success: boolean; linkCount: number }> {
    try {
      // Save message first
      const messageId = await this.saveMessage(message);
      if (!messageId) {
        return { success: false, linkCount: 0 };
      }

      // Prepare links with message_id
      const linksWithMessageId = links.map(link => ({
        ...link,
        message_id: messageId
      }));

      // Save links
      const linksSuccess = await this.saveLinks(linksWithMessageId);
      if (!linksSuccess) {
        return { success: false, linkCount: 0 };
      }

      return { success: true, linkCount: links.length };
    } catch (error) {
      console.error('Database error in saveMessageWithLinks:', error);
      return { success: false, linkCount: 0 };
    }
  }

  async getLinksWithPagination(
    userId: number,
    page: number = 1,
    limit: number = 5
  ): Promise<{
    links: (Link & { message_content?: string })[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const { count, error: countError } = await db.getClient()
        .from('z_links')
        .select('*, z_messages!inner(telegram_user_id)', { count: 'exact' })
        .eq('z_messages.telegram_user_id', userId);

      if (countError) {
        console.error('Failed to get links count:', countError);
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Get paginated links with message content
      const { data, error } = await db.getClient()
        .from('z_links')
        .select(`
          *,
          z_messages!inner(content, telegram_user_id)
        `)
        .eq('z_messages.telegram_user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Failed to fetch links:', error);
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const links = (data || []).map(item => ({
        id: item.id,
        message_id: item.message_id,
        url: item.url,
        title: item.title,
        description: item.description,
        og_image: item.og_image,
        created_at: item.created_at,
        updated_at: item.updated_at,
        message_content: item.z_messages?.content
      }));

      return {
        links,
        totalCount,
        currentPage: page,
        totalPages
      };
    } catch (error) {
      console.error('Database error getting links:', error);
      return { links: [], totalCount: 0, currentPage: 1, totalPages: 0 };
    }
  }

  async searchLinksWithPagination(
    userId: number,
    keyword: string,
    page: number = 1,
    limit: number = 5
  ): Promise<{
    links: (Link & { message_content?: string })[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    keyword: string;
  }> {
    try {
      const offset = (page - 1) * limit;
      const searchTerm = `%${keyword}%`;

      // Get total count for search results - try without foreign table in OR
      const { count, error: countError } = await db.getClient()
        .from('z_links')
        .select('*, z_messages!inner(telegram_user_id, content)', { count: 'exact' })
        .eq('z_messages.telegram_user_id', userId)
        .or(`url.ilike.*${keyword}*,title.ilike.*${keyword}*,description.ilike.*${keyword}*`);

      if (countError) {
        console.error('Failed to get search count:', countError);
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Get paginated search results with message content
      const { data, error } = await db.getClient()
        .from('z_links')
        .select(`
          *,
          z_messages!inner(content, telegram_user_id)
        `)
        .eq('z_messages.telegram_user_id', userId)
        .or(`url.ilike.*${keyword}*,title.ilike.*${keyword}*,description.ilike.*${keyword}*`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Failed to search links:', error);
        return { links: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
      }

      const links = (data || []).map(item => ({
        id: item.id,
        message_id: item.message_id,
        url: item.url,
        title: item.title,
        description: item.description,
        og_image: item.og_image,
        created_at: item.created_at,
        updated_at: item.updated_at,
        message_content: item.z_messages?.content
      }));

      return {
        links,
        totalCount,
        currentPage: page,
        totalPages,
        keyword
      };
    } catch (error) {
      console.error('Database error searching links:', error);
      return { links: [], totalCount: 0, currentPage: 1, totalPages: 0, keyword };
    }
  }

  /**
   * Check metadata cache in z_note_links for given URLs
   * Returns a Map of url -> metadata for cache hits
   */
  async checkMetadataCache(urls: string[]): Promise<Map<string, { title?: string; description?: string; og_image?: string }>> {
    try {
      if (urls.length === 0) {
        return new Map();
      }

      const { data, error } = await db.getClient()
        .from('z_note_links')
        .select('url, title, description, og_image, updated_at')
        .in('url', urls)
        .not('title', 'is', null); // Only return entries that have metadata

      if (error) {
        console.error('Failed to check metadata cache:', error);
        return new Map();
      }

      const cache = new Map<string, { title?: string; description?: string; og_image?: string }>();

      (data || []).forEach(item => {
        if (item.url) {
          cache.set(item.url, {
            title: item.title || undefined,
            description: item.description || undefined,
            og_image: item.og_image || undefined
          });
        }
      });

      return cache;
    } catch (error) {
      console.error('Database error checking metadata cache:', error);
      return new Map();
    }
  }

  /**
   * Update metadata for a specific link URL in z_links table
   * Used by background metadata fetch
   */
  async updateLinkMetadata(
    messageId: string,
    url: string,
    metadata: { title?: string; description?: string; og_image?: string }
  ): Promise<boolean> {
    try {
      const { error } = await db.getClient()
        .from('z_links')
        .update({
          title: metadata.title,
          description: metadata.description,
          og_image: metadata.og_image,
          updated_at: new Date().toISOString()
        })
        .eq('message_id', messageId)
        .eq('url', url);

      if (error) {
        console.error('Failed to update link metadata:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error updating link metadata:', error);
      return false;
    }
  }

  /**
   * Add a category to a note
   */
  async addNoteCategory(
    noteId: string,
    category: NoteCategory,
    confidence: number,
    userConfirmed: boolean = false
  ): Promise<boolean> {
    try {
      const { error } = await db.getClient()
        .from('z_note_categories')
        .insert({
          note_id: noteId,
          category,
          confidence,
          user_confirmed: userConfirmed
        });

      if (error) {
        console.error('Failed to add note category:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error adding note category:', error);
      return false;
    }
  }

  /**
   * Get all categories for a note
   */
  async getNoteCategories(noteId: string): Promise<NoteCategoryRecord[]> {
    try {
      const { data, error } = await db.getClient()
        .from('z_note_categories')
        .select('*')
        .eq('note_id', noteId)
        .order('confidence', { ascending: false });

      if (error) {
        console.error('Failed to get note categories:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Database error getting note categories:', error);
      return [];
    }
  }

  /**
   * Get notes filtered by category with pagination
   * Only returns user-confirmed categories
   */
  async getNotesByCategory(
    userId: number,
    category: NoteCategory,
    page: number = 1,
    limit: number = 5
  ): Promise<{
    notes: Array<{
      id: string;
      content: string;
      telegram_message_id: number;
      created_at: string;
      links: any[];
      categories: NoteCategoryRecord[];
    }>;
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count of notes with this category
      const { count, error: countError } = await db.getClient()
        .from('z_notes')
        .select('id, z_note_categories!inner(category, user_confirmed)', { count: 'exact' })
        .eq('telegram_user_id', userId)
        .eq('z_note_categories.category', category)
        .eq('z_note_categories.user_confirmed', true);

      if (countError) {
        console.error('Failed to get notes count by category:', countError);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Get paginated notes with links and categories
      const { data, error } = await db.getClient()
        .from('z_notes')
        .select(`
          id,
          content,
          telegram_message_id,
          created_at,
          z_note_links(id, url, title, description, og_image, created_at, updated_at),
          z_note_categories!inner(id, category, confidence, user_confirmed, created_at)
        `)
        .eq('telegram_user_id', userId)
        .eq('z_note_categories.category', category)
        .eq('z_note_categories.user_confirmed', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Failed to fetch notes by category:', error);
        return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }

      const notes = (data || []).map(item => ({
        id: item.id,
        content: item.content,
        telegram_message_id: item.telegram_message_id,
        created_at: item.created_at,
        links: item.z_note_links || [],
        categories: (item.z_note_categories || []).map((cat: any) => ({
          ...cat,
          note_id: item.id
        }))
      }));

      return {
        notes,
        totalCount,
        currentPage: page,
        totalPages
      };
    } catch (error) {
      console.error('Database error getting notes by category:', error);
      return { notes: [], totalCount: 0, currentPage: 1, totalPages: 0 };
    }
  }

  /**
   * Update a note category to mark it as user-confirmed
   */
  async confirmNoteCategory(noteId: string, category: NoteCategory): Promise<boolean> {
    try {
      const { error } = await db.getClient()
        .from('z_note_categories')
        .update({ user_confirmed: true })
        .eq('note_id', noteId)
        .eq('category', category);

      if (error) {
        console.error('Failed to confirm note category:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error confirming note category:', error);
      return false;
    }
  }

  /**
   * Get all confirmed categories for multiple notes (for list display)
   */
  async getNotesCategories(noteIds: string[]): Promise<Map<string, NoteCategoryRecord[]>> {
    try {
      if (noteIds.length === 0) {
        return new Map();
      }

      const { data, error } = await db.getClient()
        .from('z_note_categories')
        .select('*')
        .in('note_id', noteIds)
        .eq('user_confirmed', true)
        .order('confidence', { ascending: false });

      if (error) {
        console.error('Failed to get notes categories:', error);
        return new Map();
      }

      const categoryMap = new Map<string, NoteCategoryRecord[]>();

      (data || []).forEach(category => {
        const existing = categoryMap.get(category.note_id) || [];
        existing.push(category);
        categoryMap.set(category.note_id, existing);
      });

      return categoryMap;
    } catch (error) {
      console.error('Database error getting notes categories:', error);
      return new Map();
    }
  }

  /**
   * Fetch all unclassified notes (notes without any category)
   * Used by /classify command for batch classification
   */
  async fetchUnclassifiedNotes(userId: number, limit?: number): Promise<Array<{
    id: string;
    content: string;
    telegram_message_id: number;
  }>> {
    try {
      // Use raw SQL with NOT EXISTS for proper unclassified detection
      const { data, error } = await db.getClient()
        .rpc('fetch_unclassified_notes', {
          user_id_param: userId,
          limit_param: limit || null
        });

      if (error) {
        console.error('Failed to fetch unclassified notes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching unclassified notes:', error);
      return [];
    }
  }

  /**
   * Fetch all unclassified links (links without any category)
   * Used by /classify command for batch classification
   */
  async fetchUnclassifiedLinks(userId: number, limit?: number): Promise<Array<{
    id: string;
    url: string;
    title?: string;
    description?: string;
  }>> {
    try {
      // Use raw SQL with NOT EXISTS for proper unclassified detection
      const { data, error } = await db.getClient()
        .rpc('fetch_unclassified_links', {
          user_id_param: userId,
          limit_param: limit || null
        });

      if (error) {
        console.error('Failed to fetch unclassified links:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching unclassified links:', error);
      return [];
    }
  }

  /**
   * Add a category to a link
   * Used by /classify command for batch link classification
   */
  async addLinkCategory(
    linkId: string,
    category: NoteCategory,
    confidence: number,
    userConfirmed: boolean = true
  ): Promise<boolean> {
    try {
      const { error } = await db.getClient()
        .from('z_note_categories')
        .insert({
          link_id: linkId,
          note_id: null,
          category,
          confidence,
          user_confirmed: userConfirmed
        });

      if (error) {
        console.error('Failed to add link category:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error adding link category:', error);
      return false;
    }
  }
}

export const dbOps = new DatabaseOperations();

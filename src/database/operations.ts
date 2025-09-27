import { db, Message, Link } from './connection';

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
}

export const dbOps = new DatabaseOperations();

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
}

export const dbOps = new DatabaseOperations();

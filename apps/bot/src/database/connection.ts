import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

import { Message, Link, Note, NoteLink, NoteImage } from '@telepocket/shared';

export { Message, Link, Note, NoteLink, NoteImage };

class DatabaseConnection {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.anonKey);
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.client.from('z_messages').select('count', { count: 'exact' });
      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}

export const db = new DatabaseConnection();

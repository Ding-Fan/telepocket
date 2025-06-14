import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

export interface Message {
  id?: string;
  telegram_user_id: number;
  telegram_message_id: number;
  content: string;
  created_at?: string;
}

export interface Link {
  id?: string;
  message_id: string;
  url: string;
  title?: string;
  description?: string;
  og_image?: string;
  created_at?: string;
  updated_at?: string;
}

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
      const { error } = await this.client.from('messages').select('count', { count: 'exact' });
      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}

export const db = new DatabaseConnection();

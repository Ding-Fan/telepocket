export type NoteCategory = 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese';

export const CATEGORY_EMOJI: Record<NoteCategory, string> = {
  todo: '📋',
  idea: '💡',
  blog: '📝',
  youtube: '📺',
  reference: '📚',
  japanese: '🇯🇵'
};

export const CATEGORY_LABELS: Record<NoteCategory, string> = {
  todo: 'Todo',
  idea: 'Idea',
  blog: 'Blog',
  youtube: 'YouTube',
  reference: 'Reference',
  japanese: 'Japanese'
};

export const ALL_CATEGORIES: NoteCategory[] = ['todo', 'idea', 'blog', 'youtube', 'reference', 'japanese'];

export interface GlanceNote {
  note_id: string;
  category: NoteCategory;
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

export interface NoteLink {
  link_id: string;
  note_id: string;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

export interface NoteImage {
  image_id: string;
  note_id: string;
  file_id: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface NoteDetail {
  note_id: string;
  category: NoteCategory;
  content: string;
  updated_at: string;
  created_at: string;
  telegram_user_id: number;
  telegram_message_id: number;
  status: 'active' | 'archived';
  confirmed_categories: NoteCategory[];
  links: NoteLink[];
  images: NoteImage[];
}

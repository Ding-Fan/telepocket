
// Note Categories
export type NoteCategory = 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese';

export interface CategorySuggestion {
    category: NoteCategory;
    confidence: number; // 0-1 (legacy, will be deprecated for score 0-100)
    reason?: string;
}

export interface CategoryScore {
    category: NoteCategory;
    score: number; // 0-100
    tier: 'definite' | 'high' | 'moderate' | 'low' | 'insufficient';
    action: 'auto-confirm' | 'show-button' | 'skip';
}

export interface NoteCategoryRecord {
    id: string;
    note_id: string | null;
    link_id?: string | null;
    category: string;
    confidence: number;
    user_confirmed: boolean;
    created_at: string;
}

export interface NoteCategoryInsert {
    note_id?: string | null;
    link_id?: string | null;
    category: NoteCategory;
    confidence: number;
    user_confirmed: boolean;
}

// Database Entities
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

export interface Note {
    id?: string;
    telegram_user_id: number;
    telegram_message_id: number;
    content: string;
    created_at?: string;
}

export interface NoteLink {
    id?: string;
    note_id: string;
    url: string;
    title?: string;
    description?: string;
    og_image?: string;
    created_at?: string;
    updated_at?: string;
}

export interface NoteImage {
    id?: string;
    note_id: string;
    telegram_file_id: string;
    telegram_file_unique_id: string;
    cloudflare_url: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    width?: number;
    height?: number;
    created_at?: string;
    updated_at?: string;
}

export interface HybridSearchResult {
    id: string;
    content: string;
    category: NoteCategory | null;
    relevance_score: number;
    search_type: 'semantic' | 'fuzzy' | 'semantic+fuzzy';
    links: { id: string; url: string; title?: string }[];
    created_at: string;
    total_count: number;
}

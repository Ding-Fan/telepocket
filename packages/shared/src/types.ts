
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
    category_max_updated?: string;
    is_marked?: boolean;
    impression_count?: number;
    section?: 'priority' | 'category';
}

export interface PriorityNote {
    note_id: string;
    category: NoteCategory;
    content: string;
    updated_at: string;
    created_at: string;
    telegram_message_id: number;
    link_count: number;
    image_count: number;
    is_marked: boolean;
    impression_count: number;
    section: 'priority';
}

export type StreamNote = PriorityNote | GlanceNote;

export interface NoteDetailLink {
    link_id: string;
    note_id: string;
    url: string;
    title: string | null;
    description: string | null;
    image_url: string | null;
    created_at: string;
}

export interface NoteDetailImage {
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
    links: NoteDetailLink[];
    images: NoteDetailImage[];
}

// ============================================================
// Tags System (Unified Tag System)
// ============================================================

export interface Tag {
    id: string;
    tag_name: string;
    score_prompt?: string | null;  // AI prompt text (can exist even if AI disabled)
    is_ai_enabled: boolean;  // Whether AI classification is active
    created_by: number;  // telegram_user_id
    is_archived: boolean;
    auto_confirm_threshold: number;
    suggest_threshold: number;
    usage_count: number;
    last_used_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface NoteTag {
    id: string;
    note_id: string;
    tag_id: string;
    confidence: number;  // 0.0-1.0
    user_confirmed: boolean;
    created_at: string;
    confirmed_at?: string | null;

    // Joined data (optional, populated when joining with z_tags)
    tag?: Tag;
}

export interface TagScore {
    tag_id: string;
    tag_name: string;
    score: number;  // 0-100
    tier: 'definite' | 'high' | 'moderate' | 'low' | 'insufficient';
    action: 'auto-confirm' | 'suggest' | 'skip';
}

export interface CreateTagInput {
    tag_name: string;  // Must match: /^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$/
    score_prompt?: string;  // AI prompt text
    is_ai_enabled?: boolean;  // Whether AI classification is active (default: false)
    auto_confirm_threshold?: number;  // Default: 95
    suggest_threshold?: number;  // Default: 60
}

export interface UpdateTagInput {
    tag_name?: string;
    score_prompt?: string;
    is_ai_enabled?: boolean;
    auto_confirm_threshold?: number;
    suggest_threshold?: number;
}

export interface NoteTagInsert {
    note_id: string;
    tag_id: string;
    confidence: number;
    user_confirmed: boolean;
}


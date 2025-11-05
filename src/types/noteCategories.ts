/**
 * Note category types for LLM-based classification
 */

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
  note_id: string;
  category: string;
  confidence: number;
  user_confirmed: boolean;
  created_at: string;
}

export interface NoteCategoryInsert {
  note_id: string;
  category: NoteCategory;
  confidence: number;
  user_confirmed: boolean;
}

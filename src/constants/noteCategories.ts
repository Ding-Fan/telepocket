import { NoteCategory } from '../types/noteCategories';

/**
 * Category emoji mapping for UI display
 */
export const CATEGORY_EMOJI: Record<NoteCategory, string> = {
  todo: '📋',
  idea: '💡',
  blog: '📝',
  youtube: '📺',
  reference: '📚',
  japanese: '🇯🇵'
};

/**
 * Category display labels
 */
export const CATEGORY_LABELS: Record<NoteCategory, string> = {
  todo: 'Todo',
  idea: 'Idea',
  blog: 'Blog',
  youtube: 'YouTube',
  reference: 'Reference',
  japanese: 'Japanese'
};

/**
 * All available categories
 */
export const ALL_CATEGORIES: NoteCategory[] = ['todo', 'idea', 'blog', 'youtube', 'reference', 'japanese'];

/**
 * Category descriptions for LLM prompt (legacy - deprecated for category-specific prompts)
 */
export const CATEGORY_DESCRIPTIONS: Record<NoteCategory, string> = {
  todo: 'Tasks, reminders, action items',
  idea: 'Brainstorms, concepts, potential projects',
  blog: 'Blog posts, articles, written content',
  youtube: 'Video content, tutorials, talks',
  reference: 'Documentation, guides, resources',
  japanese: 'Japanese language study materials, vocabulary, grammar, syntax'
};

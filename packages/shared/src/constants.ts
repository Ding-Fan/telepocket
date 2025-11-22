import { NoteCategory } from './types';

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

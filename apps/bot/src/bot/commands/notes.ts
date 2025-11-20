import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { validateSearchKeyword } from '../../utils/validation';
import { handleValidationError } from '../../utils/errorHandler';
import { ALL_CATEGORIES } from '../../constants/noteCategories';

export const notesCommand = new Composer();

// Forward declare view functions - will be imported from legacy client until views are extracted
let showNotesPage: (ctx: any, userId: number, page: number) => Promise<void>;
let showNotesByCategory: (ctx: any, userId: number, category: string, page: number) => Promise<void>;
let showNoteSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;

/**
 * Initialize view function references
 * This is a temporary solution until view methods are extracted
 */
export function initNotesCommandViews(views: {
  showNotesPage: typeof showNotesPage;
  showNotesByCategory: typeof showNotesByCategory;
  showNoteSearchResults: typeof showNoteSearchResults;
}) {
  showNotesPage = views.showNotesPage;
  showNotesByCategory = views.showNotesByCategory;
  showNoteSearchResults = views.showNoteSearchResults;
}

/**
 * Notes command - list, filter by category, or search notes
 *
 * Usage:
 * - /notes - List all notes (page 1)
 * - /notes <page> - Go to specific page
 * - /notes <category> - Filter by category (todo, idea, blog, youtube, reference, japanese)
 * - /notes search <keyword> - Search notes with fuzzy matching
 */
notesCommand.command('notes', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  // Parse arguments from command
  const args = ctx.message?.text?.split(' ') || [];

  // Check if first argument is 'search'
  if (args.length > 1 && args[1] === 'search') {
    // /notes search <keyword>
    const keyword = args.slice(2).join(' ');
    if (!keyword) {
      await ctx.reply('Usage: /notes search <keyword>');
      return;
    }

    // Validate search keyword
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      const errorMessage = handleValidationError(validation.error!, {
        userId,
        operation: 'notesSearchCommand',
        timestamp: new Date().toISOString()
      });
      await ctx.reply(errorMessage);
      return;
    }

    await showNoteSearchResults(ctx, userId, keyword, 1);
  } else if (args.length > 1 && ALL_CATEGORIES.includes(args[1].toLowerCase() as any)) {
    // /notes <category>
    const category = args[1].toLowerCase();
    await showNotesByCategory(ctx, userId, category, 1);
  } else if (args.length > 1 && !isNaN(parseInt(args[1]))) {
    // /notes <page_number>
    const page = parseInt(args[1]);
    await showNotesPage(ctx, userId, page);
  } else if (args.length === 1) {
    // /notes (no arguments, show first page)
    await showNotesPage(ctx, userId, 1);
  } else {
    await ctx.reply('Usage:\n/notes - List all notes\n/notes <page> - Go to specific page\n/notes <category> - Filter by category (todo, idea, blog, youtube, reference, japanese)\n/notes search <keyword> - Search notes');
  }
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

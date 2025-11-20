import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { validateSearchKeyword } from '../../utils/validation';
import { handleValidationError } from '../../utils/errorHandler';

export const archivedCommand = new Composer();

// Forward declare view functions - will be imported from legacy client until views are extracted
let showArchivedNotesPage: (ctx: any, userId: number, page: number) => Promise<void>;
let showArchivedNoteSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;

/**
 * Initialize view function references
 * This is a temporary solution until view methods are extracted
 */
export function initArchivedCommandViews(views: {
  showArchivedNotesPage: typeof showArchivedNotesPage;
  showArchivedNoteSearchResults: typeof showArchivedNoteSearchResults;
}) {
  showArchivedNotesPage = views.showArchivedNotesPage;
  showArchivedNoteSearchResults = views.showArchivedNoteSearchResults;
}

/**
 * Archived command - list or search archived notes
 *
 * Usage:
 * - /archived - List archived notes (page 1)
 * - /archived <page> - Go to specific page
 * - /archived search <keyword> - Search archived notes
 */
archivedCommand.command('archived', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  // Parse arguments from command
  const args = ctx.message?.text?.split(' ') || [];

  // Check if first argument is 'search'
  if (args.length > 1 && args[1] === 'search') {
    // /archived search <keyword>
    const keyword = args.slice(2).join(' ');
    if (!keyword) {
      await ctx.reply('Usage: /archived search <keyword>');
      return;
    }

    // Validate search keyword
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      const errorMessage = handleValidationError(validation.error!, {
        userId,
        operation: 'archivedSearchCommand',
        timestamp: new Date().toISOString()
      });
      await ctx.reply(errorMessage);
      return;
    }

    await showArchivedNoteSearchResults(ctx, userId, keyword, 1);
  } else if (args.length > 1 && !isNaN(parseInt(args[1]))) {
    // /archived <page_number>
    const page = parseInt(args[1]);
    await showArchivedNotesPage(ctx, userId, page);
  } else if (args.length === 1) {
    // /archived (no arguments, show first page)
    await showArchivedNotesPage(ctx, userId, 1);
  } else {
    await ctx.reply('Usage:\n/archived - List archived notes\n/archived <page> - Go to specific page\n/archived search <keyword> - Search archived notes');
  }
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

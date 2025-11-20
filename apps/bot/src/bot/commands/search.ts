import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { validateSearchKeyword } from '../../utils/validation';
import { handleValidationError } from '../../utils/errorHandler';

export const searchCommand = new Composer();

// Forward declare view function - will be imported from legacy client until views are extracted
let showUnifiedSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;

/**
 * Initialize view function references
 * This is a temporary solution until view methods are extracted
 */
export function initSearchCommandViews(views: {
  showUnifiedSearchResults: typeof showUnifiedSearchResults;
}) {
  showUnifiedSearchResults = views.showUnifiedSearchResults;
}

/**
 * Search command - unified search for both notes and links
 *
 * Usage:
 * - /search <keyword> - Search both notes and links simultaneously
 */
searchCommand.command('search', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  // Parse keyword from command
  const args = ctx.message?.text?.split(' ') || [];
  const keyword = args.slice(1).join(' ');

  if (!keyword) {
    await ctx.reply('Usage: /search <keyword>\n\nSearch both notes and links simultaneously.');
    return;
  }

  // Validate search keyword
  const validation = validateSearchKeyword(keyword);
  if (!validation.valid) {
    const errorMessage = handleValidationError(validation.error!, {
      userId,
      operation: 'unifiedSearchCommand',
      timestamp: new Date().toISOString()
    });
    await ctx.reply(errorMessage);
    return;
  }

  await showUnifiedSearchResults(ctx, userId, keyword, 1);
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

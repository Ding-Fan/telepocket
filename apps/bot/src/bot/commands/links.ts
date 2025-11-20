import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { validateSearchKeyword } from '../../utils/validation';
import { handleValidationError } from '../../utils/errorHandler';

export const linksCommand = new Composer();

// Forward declare view functions - will be imported from legacy client until views are extracted
let showLinksOnlyPage: (ctx: any, userId: number, page: number) => Promise<void>;
let showLinksOnlySearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;

/**
 * Initialize view function references
 * This is a temporary solution until view methods are extracted
 */
export function initLinksCommandViews(views: {
  showLinksOnlyPage: typeof showLinksOnlyPage;
  showLinksOnlySearchResults: typeof showLinksOnlySearchResults;
}) {
  showLinksOnlyPage = views.showLinksOnlyPage;
  showLinksOnlySearchResults = views.showLinksOnlySearchResults;
}

/**
 * Links command - list or search individual links
 *
 * Usage:
 * - /links - List all links (page 1)
 * - /links <page> - Go to specific page
 * - /links search <keyword> - Search links
 */
linksCommand.command('links', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  // Parse arguments from command
  const args = ctx.message?.text?.split(' ') || [];

  // Check if first argument is 'search'
  if (args.length > 1 && args[1] === 'search') {
    // /links search <keyword>
    const keyword = args.slice(2).join(' ');
    if (!keyword) {
      await ctx.reply('Usage: /links search <keyword>');
      return;
    }

    // Validate search keyword
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      const errorMessage = handleValidationError(validation.error!, {
        userId,
        operation: 'linksSearchCommand',
        timestamp: new Date().toISOString()
      });
      await ctx.reply(errorMessage);
      return;
    }

    await showLinksOnlySearchResults(ctx, userId, keyword, 1);
  } else if (args.length > 1 && !isNaN(parseInt(args[1]))) {
    // /links <page_number>
    const page = parseInt(args[1]);
    await showLinksOnlyPage(ctx, userId, page);
  } else if (args.length === 1) {
    // /links (no arguments, show first page)
    await showLinksOnlyPage(ctx, userId, 1);
  } else {
    await ctx.reply('Usage:\n/links - List all links\n/links <page> - Go to specific page\n/links search <keyword> - Search links');
  }
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

import { Composer } from 'grammy';
import { config } from '../../config/environment';

export const suggestCommand = new Composer();

// Forward declare view functions - will be imported from legacy client until views are extracted
let showSuggestView: (ctx: any, userId: number) => Promise<void>;
let showSuggestViewWithQuery: (ctx: any, userId: number, query: string) => Promise<void>;

/**
 * Initialize view function references
 * This is a temporary solution until view methods are extracted
 */
export function initSuggestCommandViews(views: {
  showSuggestView: typeof showSuggestView;
  showSuggestViewWithQuery: typeof showSuggestViewWithQuery;
}) {
  showSuggestView = views.showSuggestView;
  showSuggestViewWithQuery = views.showSuggestViewWithQuery;
}

/**
 * Suggest command - smart suggestions from past 7 days (weighted or LLM-powered)
 *
 * Usage:
 * - /suggest - Show smart suggestions
 * - /suggest <query> - Show suggestions filtered by query
 */
suggestCommand.command('suggest', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  // Extract query if provided (everything after /suggest)
  const text = ctx.message?.text || '';
  const query = text.replace('/suggest', '').trim();

  if (query) {
    await showSuggestViewWithQuery(ctx, userId, query);
  } else {
    await showSuggestView(ctx, userId);
  }
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

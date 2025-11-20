import { Composer } from 'grammy';
import { config } from '../../config/environment';

export const glanceCommand = new Composer();

// Forward declare view function - will be imported from legacy client until views are extracted
let showGlanceView: (ctx: any, userId: number) => Promise<void>;

/**
 * Initialize view function references
 * This is a temporary solution until view methods are extracted
 */
export function initGlanceCommandViews(views: {
  showGlanceView: typeof showGlanceView;
}) {
  showGlanceView = views.showGlanceView;
}

/**
 * Glance command - quick overview of notes across all categories
 *
 * Usage:
 * - /glance - Show quick overview of recent notes by category
 */
glanceCommand.command('glance', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  await showGlanceView(ctx, userId);
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

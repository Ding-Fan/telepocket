import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { escapeMarkdownV2 } from '../../utils/linkFormatter';
import { createMainKeyboard } from '../utils/keyboards';
import { HELP_MESSAGES } from '../../constants/helpMessages';

export const helpCommand = new Composer();

/**
 * Help command - show all available commands and usage
 */
helpCommand.command('help', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  const helpText = HELP_MESSAGES.MAIN;
  const escapedHelp = escapeMarkdownV2(helpText);

  await ctx.reply(escapedHelp, {
    reply_markup: createMainKeyboard(),
    parse_mode: 'MarkdownV2'
  });
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

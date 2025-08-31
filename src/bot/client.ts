import { Bot, Keyboard } from 'grammy';
import { config } from '../config/environment';
import { dbOps } from '../database/operations';

export class TelegramClient {
  private bot: Bot;

  constructor() {
    this.bot = new Bot(config.telegram.botToken);
    this.setupErrorHandling();
    this.setupCommands();
  }

  getBot(): Bot {
    return this.bot;
  }

  private setupErrorHandling(): void {
    this.bot.catch((err) => {
      console.error('Grammy bot error:', err);
    });
  }

  private createMainKeyboard() {
    return new Keyboard()
      .text('📋 My Saved Links')
      .resized()
      .persistent();
  }

  private setupCommands(): void {
    this.bot.command('start', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.reply('🚫 Unauthorized access. This bot is private.');
        return;
      }

      const welcomeMessage = `🎉 Welcome back, my master! 👑

🤖 **Telepocket Bot** is ready to serve you! 

✨ **What I do:**
📝 I automatically save your messages that contain links
🔗 I extract and store metadata from those links (title, description, images)
💾 Everything is safely stored in your Supabase database with z_ prefixed tables

📋 **How to use me:**
📱 Just send me any message with URLs and I'll handle the rest!
🏷️ I'll fetch webpage titles, descriptions, and preview images
📊 All your links are organized and searchable in your database

📚 **Commands:**
• /list or /ls - View your saved links with pagination
• /list 2 - Jump to a specific page
• 📋 Use the "My Saved Links" button below for quick access!

💡 **Pro tip:** Send me multiple links in one message - I'll process them all! 🚀

Ready to start collecting your digital treasures? 💎✨`;

      const escapedWelcome = this.escapeMarkdownV2(welcomeMessage);
      await ctx.reply(escapedWelcome, {
        reply_markup: this.createMainKeyboard(),
        parse_mode: 'MarkdownV2'
      });
    });

    // List commands (both /list and /ls)
    this.bot.command(['list', 'ls'], async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.reply('🚫 Unauthorized access. This bot is private.');
        return;
      }

      // Parse page number from command arguments
      const args = ctx.message?.text?.split(' ') || [];
      const pageArg = args[1];
      const page = pageArg && !isNaN(parseInt(pageArg)) ? parseInt(pageArg) : 1;

      await this.showLinksPage(ctx, userId, page);
    });

    // Handle callback queries for pagination
    this.bot.on('callback_query', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.answerCallbackQuery('🚫 Unauthorized access.');
        return;
      }

      const data = ctx.callbackQuery.data;
      if (data?.startsWith('links_page_')) {
        const requestedPage = parseInt(data.replace('links_page_', ''));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        await this.showLinksPage(ctx, userId, requestedPage);
        await ctx.answerCallbackQuery();
      } else if (data === 'page_info') {
        // Handle page indicator click (non-functional, just acknowledge)
        await ctx.answerCallbackQuery('📄 Current page indicator');
      }
    });

    // Handle keyboard button for "📋 My Saved Links"
    this.bot.hears('📋 My Saved Links', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.reply('🚫 Unauthorized access. This bot is private.');
        return;
      }

      await this.showLinksPage(ctx, userId, 1);
    });
  }

  async sendMessage(chatId: number, text: string): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(chatId, text);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  isAuthorizedUser(userId: number): boolean {
    return userId === config.telegram.userId;
  }

  private escapeMarkdownV2(text: string): string {
    // For MarkdownV2, we need to escape: \ _ * [ ] ( ) ~ ` > # + - = | { } . !
    // Note: backslash must be escaped first to avoid double-escaping
    return text.replace(/[\\\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!]/g, '\\$&');
  }

  async start(): Promise<void> {
    console.log('Starting Telepocket bot...');
    await this.bot.start();
  }

  async stop(): Promise<void> {
    console.log('Stopping Telepocket bot...');
    await this.bot.stop();
  }

  private async showLinksPage(ctx: any, userId: number, page: number): Promise<void> {
    try {
      // First, get a quick count to validate page bounds
      const quickResult = await dbOps.getLinksWithPagination(userId, 1, 1);

      if (quickResult.totalCount === 0) {
        await ctx.reply('📭 No saved links found yet!\n\nSend me a message with URLs to start building your collection! 🔗✨', {
          reply_markup: this.createMainKeyboard()
        });
        return;
      }

      const totalPages = Math.ceil(quickResult.totalCount / 5);

      // Validate page bounds
      if (page < 1) {
        page = 1;
      } else if (page > totalPages) {
        page = totalPages;
      }

      const result = await dbOps.getLinksWithPagination(userId, page, 5);

      let headerText = `🔗 *Your Saved Links* (Page ${result.currentPage}/${result.totalPages})\n`;
      headerText += `📊 Total: ${result.totalCount} links\n\n`;
      let message = this.escapeMarkdownV2(headerText);

      result.links.forEach((link, index) => {
        const linkNumber = (result.currentPage - 1) * 5 + index + 1;
        const title = this.escapeMarkdownV2(link.title || 'Untitled');

        message += `*${linkNumber}\\.* ${title}\n`;
        message += `🌐 ${this.escapeMarkdownV2(link.url)}\n`;

        if (link.description) {
          // Truncate description if too long
          const truncatedDesc = link.description.length > 100
            ? link.description.substring(0, 100) + '...'
            : link.description;
          const desc = this.escapeMarkdownV2(truncatedDesc);
          message += `📝 ${desc}\n`;
        }

        if (link.created_at) {
          const date = new Date(link.created_at).toLocaleDateString();
          message += `📅 Saved: ${this.escapeMarkdownV2(date)}\n`;
        }

        message += '\n';
      });

      // Create pagination buttons with proper boundary checks
      const keyboard = [];
      const buttons = [];

      // Only show Previous button if not on first page
      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `links_page_${result.currentPage - 1}`
        });
      }

      // Always show current page indicator (non-clickable)
      buttons.push({
        text: `📄 ${result.currentPage}/${result.totalPages}`,
        callback_data: `page_info`
      });

      // Only show Next button if not on last page
      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `links_page_${result.currentPage + 1}`
        });
      }

      // Only create keyboard if we have navigation buttons (more than just the page indicator)
      if (buttons.length > 1) {
        keyboard.push(buttons);
      }

      const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

      if (ctx.callbackQuery) {
        // Edit existing message for pagination
        await ctx.editMessageText(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      } else {
        // Send new message for command
        if (replyMarkup) {
          // If there are pagination buttons, use inline keyboard
          await ctx.reply(message, {
            reply_markup: replyMarkup,
            parse_mode: 'MarkdownV2'
          });
        } else {
          // If no pagination, use persistent keyboard
          await ctx.reply(message, {
            reply_markup: this.createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing links page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your links. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }
}

export const telegramClient = new TelegramClient();

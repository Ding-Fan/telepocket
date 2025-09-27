import { Bot, Keyboard } from 'grammy';
import { config } from '../config/environment';
import { dbOps } from '../database/operations';
import { escapeMarkdownV2, formatLinksForDisplay } from '../utils/linkFormatter';

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
• /ls keyword - Search links by keyword
• 📋 Use the "My Saved Links" button below for quick access!

💡 **Pro tip:** Send me multiple links in one message - I'll process them all! 🚀

Ready to start collecting your digital treasures? 💎✨`;

      const escapedWelcome = escapeMarkdownV2(welcomeMessage);
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

      // Parse arguments from command
      const args = ctx.message?.text?.split(' ') || [];
      const keyword = args.slice(1).join(' ');

      if (!keyword) {
        // No arguments, show first page
        await this.showLinksPage(ctx, userId, 1);
      } else {
        // Arguments provided, treat as search keyword(s)
        await this.showSearchResults(ctx, userId, keyword, 1);
      }
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
      } else if (data?.startsWith('search_page_')) {
        const parts = data.replace('search_page_', '').split('_');
        const requestedPage = parseInt(parts[0]);
        const keyword = decodeURIComponent(parts.slice(1).join('_'));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        await this.showSearchResults(ctx, userId, keyword, requestedPage);
        await ctx.answerCallbackQuery();
      } else if (data === 'page_info' || data === 'search_info') {
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

      const totalPages = Math.ceil(quickResult.totalCount / 10);

      // Validate page bounds
      if (page < 1) {
        page = 1;
      } else if (page > totalPages) {
        page = totalPages;
      }

      const result = await dbOps.getLinksWithPagination(userId, page, 10);

      let headerText = `🔗 *Your Saved Links* (Page ${result.currentPage}/${result.totalPages})\n`;
      headerText += `📊 Total: ${result.totalCount} links\n\n`;
      let message = escapeMarkdownV2(headerText);

      // Format the links using the utility function
      const startNumber = (result.currentPage - 1) * 10 + 1;
      const formattedLinks = formatLinksForDisplay(result.links, {
        startNumber,
        maxDescriptionLength: 100,
        showNumbers: true
      });
      message += formattedLinks;

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

  private async showSearchResults(ctx: any, userId: number, keyword: string, page: number): Promise<void> {
    try {
      const result = await dbOps.searchLinksWithPagination(userId, keyword, page, 10);

      if (result.totalCount === 0) {
        await ctx.reply(`🔍 No links found matching "${keyword}".\n\nTry a different search term or use /ls to see all your links.`, {
          reply_markup: this.createMainKeyboard()
        });
        return;
      }

      // Validate page bounds
      if (page < 1) {
        page = 1;
      } else if (page > result.totalPages) {
        page = result.totalPages;
      }

      let headerText = `🔍 *Search Results for "${keyword}"* (Page ${result.currentPage}/${result.totalPages})\n`;
      headerText += `📊 Found: ${result.totalCount} links\n\n`;
      let message = escapeMarkdownV2(headerText);

      // Format the links using the utility function
      const startNumber = (result.currentPage - 1) * 10 + 1;
      const formattedLinks = formatLinksForDisplay(result.links, {
        startNumber,
        maxDescriptionLength: 100,
        showNumbers: true
      });
      message += formattedLinks;

      // Create pagination buttons with proper boundary checks
      const keyboard = [];
      const buttons = [];
      const encodedKeyword = encodeURIComponent(keyword);

      // Only show Previous button if not on first page
      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `search_page_${result.currentPage - 1}_${encodedKeyword}`
        });
      }

      // Always show current page indicator (non-clickable)
      buttons.push({
        text: `🔍 ${result.currentPage}/${result.totalPages}`,
        callback_data: `search_info`
      });

      // Only show Next button if not on last page
      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `search_page_${result.currentPage + 1}_${encodedKeyword}`
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
      console.error('Error showing search results:', error);
      await ctx.reply('❌ Sorry, there was an error searching your links. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }
}

export const telegramClient = new TelegramClient();

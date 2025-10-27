import { Bot, Keyboard } from 'grammy';
import { config } from '../config/environment';
import { dbOps } from '../database/operations';
import { noteOps } from '../database/noteOperations';
import { escapeMarkdownV2, formatLinksForDisplay, formatNoteForDisplay } from '../utils/linkFormatter';
import { handleNoteCommand } from './noteHandlers';
import { validateSearchKeyword } from '../utils/validation';
import { handleValidationError } from '../utils/errorHandler';

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
• /note <text> - Save a note (links optional)
• /notes - View all your notes
• /notes search <keyword> - Search notes with fuzzy matching
• 📋 Use the "My Saved Links" button below for quick access!

💡 **Pro tips:**
• Send me multiple links in one message - I'll process them all! 🚀
• Use /note to save quick thoughts - links are optional! 💭

Ready to start collecting your digital treasures? 💎✨`;

      const escapedWelcome = escapeMarkdownV2(welcomeMessage);
      await ctx.reply(escapedWelcome, {
        reply_markup: this.createMainKeyboard(),
        parse_mode: 'MarkdownV2'
      });
    });

    // Note command - save notes with optional links
    this.bot.command('note', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.reply('🚫 Unauthorized access. This bot is private.');
        return;
      }

      await handleNoteCommand(ctx);
    });

    // Notes command - list or search notes
    this.bot.command('notes', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
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

        await this.showNoteSearchResults(ctx, userId, keyword, 1);
      } else if (args.length > 1 && !isNaN(parseInt(args[1]))) {
        // /notes <page_number>
        const page = parseInt(args[1]);
        await this.showNotesPage(ctx, userId, page);
      } else if (args.length === 1) {
        // /notes (no arguments, show first page)
        await this.showNotesPage(ctx, userId, 1);
      } else {
        await ctx.reply('Usage:\n/notes - List all notes\n/notes <page> - Go to specific page\n/notes search <keyword> - Search notes');
      }
    });

    // List commands (both /list and /ls) - now using note system with fuzzy search
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
        // No arguments, show first page of notes
        await this.showNotesPage(ctx, userId, 1);
      } else {
        // Validate search keyword
        const validation = validateSearchKeyword(keyword);
        if (!validation.valid) {
          const errorMessage = handleValidationError(validation.error!, {
            userId,
            operation: 'listSearchCommand',
            timestamp: new Date().toISOString()
          });
          await ctx.reply(errorMessage);
          return;
        }

        // Arguments provided, search notes with fuzzy matching
        await this.showNoteSearchResults(ctx, userId, keyword, 1);
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
      } else if (data?.startsWith('notes_page_')) {
        const requestedPage = parseInt(data.replace('notes_page_', ''));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        await this.showNotesPage(ctx, userId, requestedPage);
        await ctx.answerCallbackQuery();
      } else if (data?.startsWith('notes_search_')) {
        const parts = data.replace('notes_search_', '').split('_');
        const requestedPage = parseInt(parts[0]);
        const keyword = decodeURIComponent(parts.slice(1).join('_'));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        await this.showNoteSearchResults(ctx, userId, keyword, requestedPage);
        await ctx.answerCallbackQuery();
      } else if (data === 'page_info' || data === 'search_info' || data === 'notes_page_info' || data === 'notes_search_info') {
        // Handle page indicator click (non-functional, just acknowledge)
        await ctx.answerCallbackQuery('📄 Current page indicator');
      }
    });

    // Handle keyboard button for "📋 My Saved Links" - now shows notes
    this.bot.hears('📋 My Saved Links', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.reply('🚫 Unauthorized access. This bot is private.');
        return;
      }

      await this.showNotesPage(ctx, userId, 1);
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

  async showNotesPage(ctx: any, userId: number, page: number): Promise<void> {
    try {
      // First, get a quick count to validate page bounds
      const quickResult = await noteOps.getNotesWithPagination(userId, 1, 1);

      if (quickResult.totalCount === 0) {
        await ctx.reply('📭 No saved notes found yet!\n\nSend me any message to start building your collection! ✨', {
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

      const result = await noteOps.getNotesWithPagination(userId, page, 5);

      let headerText = `📝 *Your Notes* (Page ${result.currentPage}/${result.totalPages})\n`;
      headerText += `📊 Total: ${result.totalCount} notes\n\n`;
      let message = escapeMarkdownV2(headerText);

      // Format the notes with their links
      result.notes.forEach((note, index) => {
        const noteNumber = (result.currentPage - 1) * 5 + index + 1;
        message += `*${noteNumber}\\.* `;
        message += formatNoteForDisplay(note, {
          maxContentLength: 150,
          maxDescriptionLength: 60,
          showRelevanceScore: false
        });
      });

      // Create pagination buttons with proper boundary checks
      const keyboard = [];
      const buttons = [];

      // Only show Previous button if not on first page
      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `notes_page_${result.currentPage - 1}`
        });
      }

      // Always show current page indicator (non-clickable)
      buttons.push({
        text: `📄 ${result.currentPage}/${result.totalPages}`,
        callback_data: `notes_page_info`
      });

      // Only show Next button if not on last page
      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `notes_page_${result.currentPage + 1}`
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
          await ctx.reply(message, {
            reply_markup: replyMarkup,
            parse_mode: 'MarkdownV2'
          });
        } else {
          await ctx.reply(message, {
            reply_markup: this.createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing notes page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your notes. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  async showNoteSearchResults(ctx: any, userId: number, keyword: string, page: number): Promise<void> {
    try {
      const result = await noteOps.searchNotesWithPagination(userId, keyword, page, 5);

      if (result.totalCount === 0) {
        await ctx.reply(`🔍 No notes found matching "${keyword}".\n\nTry a different search term or use /ls to see all your notes.`, {
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
      headerText += `📊 Found: ${result.totalCount} notes\n\n`;
      let message = escapeMarkdownV2(headerText);

      // Format the notes with their links and relevance scores
      result.notes.forEach((note, index) => {
        const noteNumber = (result.currentPage - 1) * 5 + index + 1;
        message += `*${noteNumber}\\.* `;
        message += formatNoteForDisplay(note, {
          maxContentLength: 150,
          maxDescriptionLength: 60,
          showRelevanceScore: true
        });
      });

      // Create pagination buttons with proper boundary checks
      const keyboard = [];
      const buttons = [];
      const encodedKeyword = encodeURIComponent(keyword);

      // Only show Previous button if not on first page
      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `notes_search_${result.currentPage - 1}_${encodedKeyword}`
        });
      }

      // Always show current page indicator (non-clickable)
      buttons.push({
        text: `🔍 ${result.currentPage}/${result.totalPages}`,
        callback_data: `notes_search_info`
      });

      // Only show Next button if not on last page
      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `notes_search_${result.currentPage + 1}_${encodedKeyword}`
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
          await ctx.reply(message, {
            reply_markup: replyMarkup,
            parse_mode: 'MarkdownV2'
          });
        } else {
          await ctx.reply(message, {
            reply_markup: this.createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing note search results:', error);
      await ctx.reply('❌ Sorry, there was an error searching your notes. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }
}

export const telegramClient = new TelegramClient();

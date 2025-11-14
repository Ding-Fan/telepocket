import { Bot, Keyboard } from 'grammy';
import { config } from '../config/environment';
import { dbOps } from '../database/operations';
import { noteOps } from '../database/noteOperations';
import { escapeMarkdownV2, formatLinksForDisplay, formatNoteForDisplay } from '../utils/linkFormatter';
import { handleNoteCommand, handlePhotoMessage } from './noteHandlers';
import { validateSearchKeyword } from '../utils/validation';
import { handleValidationError } from '../utils/errorHandler';
import { StatusMessageManager } from '../utils/statusMessageManager';
import { HELP_MESSAGES } from '../constants/helpMessages';
import { NoteClassifier } from '../services/noteClassifier';

interface UnifiedSearchResult {
  type: 'note' | 'link';
  relevance_score: number;
  note_id?: string;
  note_content?: string;
  telegram_message_id?: number;
  created_at?: string;
  links?: Array<{
    id: string;
    url: string;
    title?: string;
    description?: string;
    og_image?: string;
  }>;
  link_id?: string;
  url?: string;
  title?: string;
  description?: string;
  og_image?: string;
}

export class TelegramClient {
  private bot: Bot;
  private shouldStopClassification: boolean = false;

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
      .text('📋 My Notes')
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
• /start - Show this welcome message
• /help - Show detailed command help 📖
• /note <text> - Save a note (links optional)
• /glance - Quick overview of recent notes by category
• /search <keyword> - Search both notes and links
• /notes - View all your notes
• /notes search <keyword> - Search notes with fuzzy matching
• /archived - View archived notes
• /archived search <keyword> - Search archived notes
• /links - View all your saved links
• /links search <keyword> - Search links with fuzzy matching
• 📋 Use the "My Notes" button below for quick access!

💡 **Tip:** Use /help to see all commands with examples!

💡 **Pro tips:**
• Send me multiple links in one message - I'll process them all! 🚀
• Use /note to save quick thoughts - links are optional! 💭
• Archive notes to hide them without deleting permanently! 📦
• Use /search to find anything across both notes and links! 🔍

Ready to start collecting your digital treasures? 💎✨`;

      const escapedWelcome = escapeMarkdownV2(welcomeMessage);
      await ctx.reply(escapedWelcome, {
        reply_markup: this.createMainKeyboard(),
        parse_mode: 'MarkdownV2'
      });
    });

    // Help command - show all available commands and usage
    this.bot.command('help', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.reply('🚫 Unauthorized access. This bot is private.');
        return;
      }

      const helpText = HELP_MESSAGES.MAIN;
      const escapedHelp = escapeMarkdownV2(helpText);

      await ctx.reply(escapedHelp, {
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
      } else if (args.length > 1 && ['todo', 'idea', 'blog', 'youtube', 'reference'].includes(args[1].toLowerCase())) {
        // /notes <category>
        const category = args[1].toLowerCase();
        await this.showNotesByCategory(ctx, userId, category as any, 1);
      } else if (args.length > 1 && !isNaN(parseInt(args[1]))) {
        // /notes <page_number>
        const page = parseInt(args[1]);
        await this.showNotesPage(ctx, userId, page);
      } else if (args.length === 1) {
        // /notes (no arguments, show first page)
        await this.showNotesPage(ctx, userId, 1);
      } else {
        await ctx.reply('Usage:\n/notes - List all notes\n/notes <page> - Go to specific page\n/notes <category> - Filter by category (todo, idea, blog, youtube, reference)\n/notes search <keyword> - Search notes');
      }
    });

    // Archived command - list or search archived notes
    this.bot.command('archived', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
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

        await this.showArchivedNoteSearchResults(ctx, userId, keyword, 1);
      } else if (args.length > 1 && !isNaN(parseInt(args[1]))) {
        // /archived <page_number>
        const page = parseInt(args[1]);
        await this.showArchivedNotesPage(ctx, userId, page);
      } else if (args.length === 1) {
        // /archived (no arguments, show first page)
        await this.showArchivedNotesPage(ctx, userId, 1);
      } else {
        await ctx.reply('Usage:\n/archived - List archived notes\n/archived <page> - Go to specific page\n/archived search <keyword> - Search archived notes');
      }
    });

    // Links command - list or search individual links (from z_note_links table)
    this.bot.command('links', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
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

        await this.showLinksOnlySearchResults(ctx, userId, keyword, 1);
      } else if (args.length > 1 && !isNaN(parseInt(args[1]))) {
        // /links <page_number>
        const page = parseInt(args[1]);
        await this.showLinksOnlyPage(ctx, userId, page);
      } else if (args.length === 1) {
        // /links (no arguments, show first page)
        await this.showLinksOnlyPage(ctx, userId, 1);
      } else {
        await ctx.reply('Usage:\n/links - List all links\n/links <page> - Go to specific page\n/links search <keyword> - Search links');
      }
    });

    // Search command - unified search for both notes and links
    this.bot.command('search', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
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

      await this.showUnifiedSearchResults(ctx, userId, keyword, 1);
    });

    // Glance command - quick overview of notes across all categories
    this.bot.command('glance', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.reply('🚫 Unauthorized access. This bot is private.');
        return;
      }

      await this.showGlanceView(ctx, userId);
    });

    // Classify command - batch auto-classify all unclassified notes and links
    this.bot.command('classify', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        await ctx.reply('🚫 Unauthorized access. This bot is private.');
        return;
      }

      await this.runBatchClassification(ctx, userId);
    });

    // Handle photo messages - auto-upload to Cloudflare R2
    this.bot.on('message:photo', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId || !this.isAuthorizedUser(userId)) {
        return;
      }

      await handlePhotoMessage(ctx);
    });

    // Handle callback queries for pagination
    this.bot.on('callback_query', async (ctx) => {
      const startTime = Date.now();
      const data = ctx.callbackQuery.data;
      const userId = ctx.from?.id;
      console.log(`[Callback] ${data} started at ${new Date().toISOString()}`);

      try {
        if (!userId || !this.isAuthorizedUser(userId)) {
          await ctx.answerCallbackQuery('🚫 Unauthorized access.');
          return;
        }
        if (data?.startsWith('links_page_')) {
        const requestedPage = parseInt(data.replace('links_page_', ''));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showLinksPage(ctx, userId, requestedPage);
      } else if (data?.startsWith('search_page_')) {
        const parts = data.replace('search_page_', '').split('_');
        const requestedPage = parseInt(parts[0]);
        let keyword = decodeURIComponent(parts.slice(1).join('_'));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Sanitize keyword: remove control characters and null bytes
        keyword = keyword.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();

        // Validate keyword using proper validation function
        const validation = validateSearchKeyword(keyword);
        if (!validation.valid) {
          await ctx.answerCallbackQuery(`❌ ${validation.error}`);
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showSearchResults(ctx, userId, keyword, requestedPage);
      } else if (data?.startsWith('notes_page_')) {
        const requestedPage = parseInt(data.replace('notes_page_', ''));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showNotesPage(ctx, userId, requestedPage);
      } else if (data?.startsWith('notes_search_')) {
        const parts = data.replace('notes_search_', '').split('_');
        const requestedPage = parseInt(parts[0]);
        let keyword = decodeURIComponent(parts.slice(1).join('_'));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Sanitize keyword: remove control characters and null bytes
        keyword = keyword.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();

        // Validate keyword using proper validation function
        const validation = validateSearchKeyword(keyword);
        if (!validation.valid) {
          await ctx.answerCallbackQuery(`❌ ${validation.error}`);
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showNoteSearchResults(ctx, userId, keyword, requestedPage);
      } else if (data?.startsWith('links_only_page_')) {
        const requestedPage = parseInt(data.replace('links_only_page_', ''));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showLinksOnlyPage(ctx, userId, requestedPage);
      } else if (data?.startsWith('links_only_search_')) {
        const parts = data.replace('links_only_search_', '').split('_');
        const requestedPage = parseInt(parts[0]);
        const keyword = decodeURIComponent(parts.slice(1).join('_'));

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Validate keyword to prevent injection attacks
        if (!keyword || keyword.length < 1 || keyword.length > 100) {
          await ctx.answerCallbackQuery('❌ Invalid search keyword.');
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showLinksOnlySearchResults(ctx, userId, keyword, requestedPage);
      } else if (data?.startsWith('category:')) {
        // Handle category button click
        await this.handleCategoryButtonClick(ctx, data);
      } else if (data?.startsWith('category_page_')) {
        // Handle category pagination
        const parts = data.replace('category_page_', '').split('_');
        const category = parts[0];
        const requestedPage = parseInt(parts[1]);

        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showNotesByCategory(ctx, userId, category, requestedPage);
      } else if (data?.startsWith('detail:')) {
        // Handle note detail view
        const parts = data.split(':');
        const noteId = parts[1];
        const returnPageStr = parts[2];

        if (!noteId) {
          await ctx.answerCallbackQuery('❌ Invalid note ID.');
          return;
        }

        // Parse returnPage - can be number or "glance"
        const returnPage = returnPageStr === 'glance' ? 'glance' : parseInt(returnPageStr);

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showNoteDetail(ctx, userId, noteId, returnPage);
      } else if (data === 'back_to_glance') {
        // Handle back to glance view
        await ctx.answerCallbackQuery();
        await this.showGlanceView(ctx, userId);
      } else if (data?.startsWith('back:notes:')) {
        // Handle back to notes list
        const page = parseInt(data.replace('back:notes:', ''));

        if (isNaN(page) || page < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showNotesPage(ctx, userId, page);
      } else if (data?.startsWith('confirm_delete:')) {
        // Handle delete confirmation
        const parts = data.split(':');
        const noteId = parts[1];
        const returnPage = parseInt(parts[2]);

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showDeleteConfirmation(ctx, noteId, returnPage);
      } else if (data?.startsWith('delete:')) {
        // Handle delete note
        const parts = data.split(':');
        const noteId = parts[1];
        const returnPage = parseInt(parts[2]);

        await this.deleteNoteAndReturn(ctx, userId, noteId, returnPage);
        await ctx.answerCallbackQuery('🗑️ Note deleted');
      } else if (data?.startsWith('cancel_delete:')) {
        // Handle cancel delete
        const parts = data.split(':');
        const noteId = parts[1];
        const returnPage = parseInt(parts[2]);

        // Answer immediately with message, then show detail
        await ctx.answerCallbackQuery('❌ Cancelled');
        await this.showNoteDetail(ctx, userId, noteId, returnPage);
      } else if (data?.startsWith('mark:')) {
        // Handle mark toggle
        const parts = data.split(':');
        const noteId = parts[1];
        const returnPage = parseInt(parts[2]);

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.toggleNoteMarkAndRefresh(ctx, userId, noteId, returnPage);
      } else if (data?.startsWith('archived_page_')) {
        // Handle archived notes pagination
        const requestedPage = parseInt(data.replace('archived_page_', ''));

        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showArchivedNotesPage(ctx, userId, requestedPage);
      } else if (data?.startsWith('archived_search_')) {
        // Handle archived search pagination
        const parts = data.replace('archived_search_', '').split('_');
        const requestedPage = parseInt(parts[0]);
        const keyword = decodeURIComponent(parts.slice(1).join('_'));

        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        if (!keyword || keyword.length < 1 || keyword.length > 100) {
          await ctx.answerCallbackQuery('❌ Invalid search keyword.');
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showArchivedNoteSearchResults(ctx, userId, keyword, requestedPage);
      } else if (data?.startsWith('archive:')) {
        // Handle archive note
        const parts = data.split(':');
        const noteId = parts[1];
        const returnPage = parseInt(parts[2]);

        await this.archiveNoteAndReturn(ctx, userId, noteId, returnPage);
        await ctx.answerCallbackQuery('📦 Note archived');
      } else if (data?.startsWith('unarchive:')) {
        // Handle unarchive note
        const parts = data.split(':');
        const noteId = parts[1];
        const returnPage = parseInt(parts[2]);

        await this.unarchiveNoteAndReturn(ctx, userId, noteId, returnPage);
        await ctx.answerCallbackQuery('📤 Note restored');
      } else if (data?.startsWith('unified_search_')) {
        // Handle unified search pagination
        const parts = data.replace('unified_search_', '').split('_');

        // Handle info button (non-interactive)
        if (parts[0] === 'info') {
          await ctx.answerCallbackQuery();
          return;
        }

        // Extract page and keyword
        const requestedPage = parseInt(parts[0]);
        const encodedKeyword = parts.slice(1).join('_');
        const keyword = decodeURIComponent(encodedKeyword);

        // Validate page number
        if (isNaN(requestedPage) || requestedPage < 1) {
          await ctx.answerCallbackQuery('❌ Invalid page number.');
          return;
        }

        // Sanitize keyword: remove control characters and null bytes
        const sanitizedKeyword = keyword.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();

        // Validate keyword using proper validation function
        const validation = validateSearchKeyword(sanitizedKeyword);
        if (!validation.valid) {
          await ctx.answerCallbackQuery(`❌ ${validation.error}`);
          return;
        }

        // Answer immediately before slow operations
        await ctx.answerCallbackQuery();
        await this.showUnifiedSearchResults(ctx, userId, sanitizedKeyword, requestedPage);
      } else if (data === 'stop_classify') {
        // Handle stop classification request
        this.shouldStopClassification = true;
        await ctx.answerCallbackQuery('⏹️ Stopping classification...');
      } else if (data === 'page_info' || data === 'search_info' || data === 'notes_page_info' || data === 'notes_search_info' || data === 'links_only_page_info' || data === 'links_only_search_info' || data === 'category_page_info' || data === 'archived_page_info' || data === 'archived_search_info' || data === 'unified_search_info') {
        // Handle page indicator click (non-functional, just acknowledge)
        await ctx.answerCallbackQuery('📄 Current page indicator');
      }

        // Log successful completion
        const duration = Date.now() - startTime;
        console.log(`[Callback] ${data} completed in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if this is a timeout error
        if (errorMessage.includes('query is too old')) {
          console.error(`[Timeout] Callback query expired after ${duration}ms (userId: ${userId}, data: ${data})`);
          // Don't try to answer again - it will fail
          return;
        }

        console.error(`[Callback] ${data} failed after ${duration}ms:`, error);
        try {
          await ctx.answerCallbackQuery('❌ An error occurred. Please try again.');
        } catch (e) {
          console.error('Failed to send error callback:', e);
        }
      }
    });

    // Handle keyboard button for "📋 My Notes"
    this.bot.hears('📋 My Notes', async (ctx) => {
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

      // Escape keyword to prevent MarkdownV2 injection
      const escapedKeyword = escapeMarkdownV2(keyword);
      let headerText = `🔍 *Search Results for "${escapedKeyword}"* \\(Page ${result.currentPage}/${result.totalPages}\\)\n`;
      headerText += `📊 Found: ${result.totalCount} links\n\n`;
      let message = headerText;

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
      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      // Get the requested page directly (no wasteful count query)
      const result = await noteOps.getNotesWithPagination(userId, page, 5);

      if (result.totalCount === 0) {
        await ctx.reply('📭 No saved notes found yet!\n\nSend me any message to start building your collection! ✨', {
          reply_markup: this.createMainKeyboard()
        });
        return;
      }

      // Validate page bounds after getting data
      if (page < 1 || page > result.totalPages) {
        // If invalid page, redirect to page 1
        if (!ctx.callbackQuery) {
          await this.showNotesPage(ctx, userId, 1);
          return;
        }
      }

      let headerText = `📝 *Your Notes* (Page ${result.currentPage}/${result.totalPages})\n`;
      headerText += `📊 Total: ${result.totalCount} notes\n\n`;
      let message = escapeMarkdownV2(headerText);

      // Fetch images and categories for all notes on this page (batch queries)
      const noteIds = result.notes.map(n => n.note_id);
      const categoriesMap = await dbOps.getNotesCategories(noteIds);
      const imagesMap = await noteOps.getNoteImages(noteIds);
      const { CATEGORY_EMOJI } = await import('../constants/noteCategories');

      const notesWithImages = result.notes.map((note) => {
        const images = imagesMap.get(note.note_id) || [];
        const categories = categoriesMap.get(note.note_id) || [];
        return {
          ...note,
          images: images.map(img => ({ cloudflare_url: img.cloudflare_url })),
          categories
        };
      });

      // Emoji numbers for visual consistency
      const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

      // Format notes with emoji numbers
      notesWithImages.forEach((note, index) => {
        const noteNumber = (result.currentPage - 1) * 5 + index + 1;
        const emojiNumber = emojiNumbers[index];

        // Add category indicators
        let categoryIndicators = '';
        if (note.categories && note.categories.length > 0) {
          categoryIndicators = note.categories
            .map((cat: any) => CATEGORY_EMOJI[cat.category as keyof typeof CATEGORY_EMOJI])
            .join(' ') + ' ';
        }

        message += `${emojiNumber} ${escapeMarkdownV2(categoryIndicators)}`;
        message += formatNoteForDisplay(note, {
          maxContentLength: 80,
          maxDescriptionLength: 60,
          showRelevanceScore: false,
          compact: true
        });
      });

      // Create inline keyboard
      const keyboard = [];

      // Row 1: Emoji number buttons for each note on this page
      const noteButtons = notesWithImages.map((note, index) => ({
        text: emojiNumbers[index],
        callback_data: `detail:${note.note_id}:${result.currentPage}`
      }));
      keyboard.push(noteButtons);

      // Add pagination buttons
      const paginationButtons = [];

      // Only show Previous button if not on first page
      if (result.currentPage > 1) {
        paginationButtons.push({
          text: '⬅️ Previous',
          callback_data: `notes_page_${result.currentPage - 1}`
        });
      }

      // Always show current page indicator (non-clickable)
      paginationButtons.push({
        text: `📄 ${result.currentPage}/${result.totalPages}`,
        callback_data: `notes_page_info`
      });

      // Only show Next button if not on last page
      if (result.currentPage < result.totalPages) {
        paginationButtons.push({
          text: 'Next ➡️',
          callback_data: `notes_page_${result.currentPage + 1}`
        });
      }

      // Only add pagination row if we have navigation buttons (more than just the page indicator)
      if (paginationButtons.length > 1) {
        keyboard.push(paginationButtons);
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

  async showNotesByCategory(ctx: any, userId: number, category: any, page: number): Promise<void> {
    try {
      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      // Import category constants
      const { CATEGORY_EMOJI, CATEGORY_LABELS } = await import('../constants/noteCategories');
      const emoji = CATEGORY_EMOJI[category as keyof typeof CATEGORY_EMOJI];
      const label = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];

      // Get notes filtered by category
      const result = await dbOps.getNotesByCategory(userId, category, page, 5);

      if (result.totalCount === 0) {
        await ctx.reply(`📭 No ${emoji} ${label} notes found yet!\n\nNotes will appear here once you confirm their category.`, {
          reply_markup: this.createMainKeyboard()
        });
        return;
      }

      // Validate page bounds after getting data
      if (page < 1 || page > result.totalPages) {
        // If invalid page, redirect to page 1
        if (!ctx.callbackQuery) {
          await this.showNotesByCategory(ctx, userId, category, 1);
          return;
        }
      }

      let headerText = `${emoji} *${label} Notes* (Page ${result.currentPage}/${result.totalPages})\n`;
      headerText += `📊 Total: ${result.totalCount} notes\n\n`;
      let message = escapeMarkdownV2(headerText);

      // Format the notes with their links
      result.notes.forEach((note, index) => {
        const noteNumber = (result.currentPage - 1) * 5 + index + 1;
        message += `*${noteNumber}\\.* `;

        // Format note content
        const content = note.content.substring(0, 150);
        const truncated = note.content.length > 150;
        message += escapeMarkdownV2(content + (truncated ? '...' : '')) + '\n';

        // Show links if any
        if (note.links && note.links.length > 0) {
          note.links.forEach((link: any) => {
            message += `  🔗 ${escapeMarkdownV2(link.title || link.url)}\n`;
          });
        }

        message += '\n';
      });

      // Create pagination buttons
      const keyboard = [];
      const buttons = [];

      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `category_page_${category}_${result.currentPage - 1}`
        });
      }

      buttons.push({
        text: `${emoji} ${result.currentPage}/${result.totalPages}`,
        callback_data: `category_page_info`
      });

      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `category_page_${category}_${result.currentPage + 1}`
        });
      }

      if (buttons.length > 1) {
        keyboard.push(buttons);
      }

      const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      } else {
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
      console.error('Error showing notes by category:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your notes. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  async showGlanceView(ctx: any, userId: number): Promise<void> {
    try {
      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      // Import category constants
      const { ALL_CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABELS } = await import('../constants/noteCategories');

      // Fetch glance data (2 notes per category)
      const notes = await noteOps.getNotesGlanceView(userId, 2);

      // Group notes by category
      const notesMap = new Map<string, typeof notes>();
      notes.forEach(note => {
        const categoryNotes = notesMap.get(note.category) || [];
        categoryNotes.push(note);
        notesMap.set(note.category, categoryNotes);
      });

      // Build message
      let message = '📋 *Quick Glance*\n\n';
      let globalIndex = 1;
      const buttonData: Array<{ text: string; callback_data: string }> = [];

      // Loop through all categories to ensure all 6 are shown
      for (const category of ALL_CATEGORIES) {
        const categoryNotes = notesMap.get(category) || [];
        const emoji = CATEGORY_EMOJI[category as keyof typeof CATEGORY_EMOJI];
        const label = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];

        message += `${emoji} *${escapeMarkdownV2(label)}*\n`;

        if (categoryNotes.length === 0) {
          message += escapeMarkdownV2('  (No notes)') + '\n\n';
        } else {
          categoryNotes.forEach(note => {
            // Extract title (first line or first 30 chars)
            const lines = note.content.split('\n');
            const firstLine = lines[0] || note.content;
            const title = firstLine.substring(0, 30) + (firstLine.length > 30 ? '...' : '');

            // Format date as "Nov 14"
            const date = new Date(note.updated_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });

            // Content preview (30 chars)
            const preview = note.content.substring(0, 30) + (note.content.length > 30 ? '...' : '');

            message += `${globalIndex}\\. ${escapeMarkdownV2(title)} \\- ${escapeMarkdownV2(date)} \\- ${escapeMarkdownV2(preview)}\n`;

            // Add button data
            buttonData.push({
              text: `${globalIndex}`,
              callback_data: `detail:${note.note_id}:glance`
            });

            globalIndex++;
          });
          message += '\n';
        }
      }

      // Build inline keyboard
      const keyboard = [];
      if (buttonData.length > 0) {
        if (buttonData.length <= 6) {
          // Single row
          keyboard.push(buttonData);
        } else {
          // Two rows
          keyboard.push(buttonData.slice(0, 6));
          keyboard.push(buttonData.slice(6));
        }
      }

      const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

      // Send or edit message
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      } else {
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
      console.error('Error showing glance view:', error);
      await ctx.reply('❌ Sorry, there was an error loading the glance view. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  async showNoteSearchResults(ctx: any, userId: number, keyword: string, page: number): Promise<void> {
    try {
      // Start status message (shorter threshold for search)
      const status = await StatusMessageManager.start(ctx, {
        operation: 'searching_notes',
        showAfterMs: 300
      });

      const result = await noteOps.searchNotesWithPagination(userId, keyword, page, 5);

      if (result.totalCount === 0) {
        await status.complete(`🔍 No notes found matching "${keyword}".\n\nTry a different search term or use /links to see all your notes.`);
        return;
      }

      // Validate page bounds
      if (page < 1) {
        page = 1;
      } else if (page > result.totalPages) {
        page = result.totalPages;
      }

      // Escape keyword to prevent MarkdownV2 injection
      const escapedKeyword = escapeMarkdownV2(keyword);
      let headerText = `🔍 *Search Results for "${escapedKeyword}"* \\(Page ${result.currentPage}/${result.totalPages}\\)\n`;
      headerText += `📊 Found: ${result.totalCount} notes\n\n`;
      let message = headerText;

      // Fetch images for all notes on this page
      const notesWithImages = await Promise.all(
        result.notes.map(async (note) => {
          const images = await noteOps.getNoteImages(note.note_id);
          return {
            ...note,
            images: images.map(img => ({ cloudflare_url: img.cloudflare_url }))
          };
        })
      );

      // Format the notes with their links, images and relevance scores
      notesWithImages.forEach((note, index) => {
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
        // Complete status with search results
        await status.complete(message, {
          parse_mode: 'MarkdownV2',
          reply_markup: replyMarkup
        });
      }
    } catch (error) {
      console.error('Error showing note search results:', error);
      await ctx.reply('❌ Sorry, there was an error searching your notes. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  async showLinksOnlyPage(ctx: any, userId: number, page: number): Promise<void> {
    try {
      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      // Get the requested page directly (no wasteful count query)
      const result = await noteOps.getLinksOnlyWithPagination(userId, page, 10);

      if (result.totalCount === 0) {
        await ctx.reply('📭 No saved links found yet!\n\nSend me any message with URLs to start building your collection! 🔗✨', {
          reply_markup: this.createMainKeyboard()
        });
        return;
      }

      // Validate page bounds after getting data
      if (page < 1 || page > result.totalPages) {
        // If invalid page, redirect to page 1
        if (!ctx.callbackQuery) {
          await this.showLinksOnlyPage(ctx, userId, 1);
          return;
        }
      }

      let headerText = `🔗 *Your Saved Links* (Page ${result.currentPage}/${result.totalPages})\n`;
      headerText += `📊 Total: ${result.totalCount} links\n\n`;
      let message = escapeMarkdownV2(headerText);

      // Format individual links
      result.links.forEach((link, index) => {
        const linkNumber = (result.currentPage - 1) * 10 + index + 1;
        message += `*${linkNumber}\\.* `;

        // Add URL as clickable link
        const escapedUrl = escapeMarkdownV2(link.url);
        const escapedTitle = link.title ? escapeMarkdownV2(link.title) : escapeMarkdownV2(link.url);
        message += `[${escapedTitle}](${escapedUrl})\n`;

        // Add description if available
        if (link.description) {
          const truncatedDesc = link.description.length > 100
            ? link.description.substring(0, 100) + '...'
            : link.description;
          message += `   ${escapeMarkdownV2(truncatedDesc)}\n`;
        }

        message += '\n';
      });

      // Create pagination buttons
      const keyboard = [];
      const buttons = [];

      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `links_only_page_${result.currentPage - 1}`
        });
      }

      buttons.push({
        text: `📄 ${result.currentPage}/${result.totalPages}`,
        callback_data: `links_only_page_info`
      });

      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `links_only_page_${result.currentPage + 1}`
        });
      }

      if (buttons.length > 1) {
        keyboard.push(buttons);
      }

      const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      } else {
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
      console.error('Error showing links page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your links. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  async showLinksOnlySearchResults(ctx: any, userId: number, keyword: string, page: number): Promise<void> {
    try {
      // Start status message (shorter threshold for search)
      const status = await StatusMessageManager.start(ctx, {
        operation: 'searching_notes',
        showAfterMs: 300
      });

      const result = await noteOps.searchLinksOnlyWithPagination(userId, keyword, page, 10);

      if (result.totalCount === 0) {
        await status.complete(`🔍 No links found matching "${keyword}".\n\nTry a different search term or use /links to see all your links.`);
        return;
      }

      // Validate page bounds
      if (page < 1) {
        page = 1;
      } else if (page > result.totalPages) {
        page = result.totalPages;
      }

      // Escape keyword to prevent MarkdownV2 injection
      const escapedKeyword = escapeMarkdownV2(keyword);
      let headerText = `🔍 *Search Results for "${escapedKeyword}"* \\(Page ${result.currentPage}/${result.totalPages}\\)\n`;
      headerText += `📊 Found: ${result.totalCount} links\n\n`;
      let message = headerText;

      // Format individual links with relevance scores
      result.links.forEach((link, index) => {
        const linkNumber = (result.currentPage - 1) * 10 + index + 1;
        message += `*${linkNumber}\\.* `;

        // Add title (if available and not generic) or URL as clickable link
        const escapedUrl = escapeMarkdownV2(link.url);
        const escapedTitle = link.title ? escapeMarkdownV2(link.title) : escapeMarkdownV2(link.url);
        message += `[${escapedTitle}](${escapedUrl})`;

        // Add relevance score
        if (link.relevance_score !== undefined) {
          const percentage = Math.round(link.relevance_score * 100);
          message += ` ${escapeMarkdownV2(`(${percentage}%)`)}`;
        }
        message += '\n';

        // Always show the actual URL for links-only search (helps distinguish duplicate titles)
        message += `   🔗 ${escapeMarkdownV2(link.url)}\n`;

        // Add description if available
        if (link.description) {
          const truncatedDesc = link.description.length > 100
            ? link.description.substring(0, 100) + '...'
            : link.description;
          message += `   ${escapeMarkdownV2(truncatedDesc)}\n`;
        }

        message += '\n';
      });

      // Create pagination buttons
      const keyboard = [];
      const buttons = [];
      const encodedKeyword = encodeURIComponent(keyword);

      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `links_only_search_${result.currentPage - 1}_${encodedKeyword}`
        });
      }

      buttons.push({
        text: `🔍 ${result.currentPage}/${result.totalPages}`,
        callback_data: `links_only_search_info`
      });

      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `links_only_search_${result.currentPage + 1}_${encodedKeyword}`
        });
      }

      if (buttons.length > 1) {
        keyboard.push(buttons);
      }

      const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      } else {
        // Complete status with search results
        await status.complete(message, {
          parse_mode: 'MarkdownV2',
          reply_markup: replyMarkup
        });
      }
    } catch (error) {
      console.error('Error showing link search results:', error);
      await ctx.reply('❌ Sorry, there was an error searching your links. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  /**
   * Show unified search results for both notes and links
   */
  async showUnifiedSearchResults(ctx: any, userId: number, keyword: string, page: number): Promise<void> {
    try {
      // Start status message (shorter threshold for search)
      const status = await StatusMessageManager.start(ctx, {
        operation: 'searching_notes',
        showAfterMs: 300
      });

      // Execute parallel searches (fetch 100 from each for better ranking)
      const [noteResults, linkResults] = await Promise.all([
        noteOps.searchNotesWithPagination(userId, keyword, 1, 100),
        noteOps.searchLinksOnlyWithPagination(userId, keyword, 1, 100)
      ]);

      // Merge results
      const mergedResults = this.mergeSearchResults(noteResults, linkResults);

      if (mergedResults.length === 0) {
        await status.complete(`🔍 No results found matching "${keyword}".\n\nTry a different search term.`);
        return;
      }

      // Client-side pagination (10 items per page)
      const itemsPerPage = 10;
      const totalPages = Math.ceil(mergedResults.length / itemsPerPage);

      // Validate page bounds
      if (page < 1) {
        page = 1;
      } else if (page > totalPages) {
        page = totalPages;
      }

      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageResults = mergedResults.slice(startIndex, endIndex);

      // Build header message
      const escapedKeyword = escapeMarkdownV2(keyword);
      const noteCount = noteResults.totalCount;
      const linkCount = linkResults.totalCount;
      const totalCount = mergedResults.length;

      let message = `🔍 *Search Results for "${escapedKeyword}"* \\(Page ${page}/${totalPages}\\)\n`;
      message += `📊 Found: ${totalCount} results \\(${noteCount} notes, ${linkCount} links\\)\n\n`;

      // Format results based on type (note vs link)
      pageResults.forEach((result, index) => {
        const resultNumber = startIndex + index + 1;

        if (result.type === 'note') {
          // Format note result
          message += `📝 *${resultNumber}\\.* `;
          message += formatNoteForDisplay({
            note_content: result.note_content!,
            links: result.links || [],
            relevance_score: result.relevance_score
          }, {
            maxContentLength: 100,
            maxDescriptionLength: 60,
            showRelevanceScore: true
          });
        } else {
          // Format link result
          message += `🔗 *${resultNumber}\\.* `;
          const escapedTitle = result.title
            ? escapeMarkdownV2(result.title)
            : escapeMarkdownV2(result.url!);
          const escapedUrl = escapeMarkdownV2(result.url!);
          message += `[${escapedTitle}](${escapedUrl})`;

          // Add relevance score
          const percentage = Math.round(result.relevance_score * 100);
          message += ` ${escapeMarkdownV2(`(${percentage}%)`)}`;
          message += '\n';

          // Show URL
          message += `   🔗 ${escapeMarkdownV2(result.url!)}\n`;

          // Add description if available
          if (result.description) {
            const truncatedDesc = result.description.length > 80
              ? result.description.substring(0, 80) + '...'
              : result.description;
            message += `   ${escapeMarkdownV2(truncatedDesc)}\n`;
          }

          message += '\n';
        }
      });

      // Create pagination keyboard
      const keyboard = [];
      const buttons = [];
      const encodedKeyword = encodeURIComponent(keyword);

      // Previous button (only if not on first page)
      if (page > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `unified_search_${page - 1}_${encodedKeyword}`
        });
      }

      // Page indicator
      buttons.push({
        text: `🔍 ${page}/${totalPages}`,
        callback_data: `unified_search_info`
      });

      // Next button (only if not on last page)
      if (page < totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `unified_search_${page + 1}_${encodedKeyword}`
        });
      }

      // Only create keyboard if we have navigation buttons
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
        // Complete status with search results
        await status.complete(message, {
          parse_mode: 'MarkdownV2',
          reply_markup: replyMarkup
        });
      }
    } catch (error) {
      console.error('Error showing unified search results:', error);
      await ctx.reply('❌ Sorry, there was an error searching. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  private async handleCategoryButtonClick(ctx: any, data: string): Promise<void> {
    try {
      // Parse callback data: category:noteId:category:confidence
      const parts = data.split(':');
      if (parts.length !== 4) {
        await ctx.answerCallbackQuery('❌ Invalid category data');
        return;
      }

      const [, noteId, category, confidenceStr] = parts;

      // Confirm the category in the database
      const success = await dbOps.confirmNoteCategory(noteId, category as any);

      if (!success) {
        await ctx.answerCallbackQuery('❌ Failed to save category');
        return;
      }

      // Import category constants dynamically to avoid circular deps
      const { CATEGORY_EMOJI, CATEGORY_LABELS } = await import('../constants/noteCategories');
      const emoji = CATEGORY_EMOJI[category as keyof typeof CATEGORY_EMOJI];
      const label = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];

      // Answer with success message
      await ctx.answerCallbackQuery(`✅ Tagged as ${emoji} ${label}`);

      // Refresh the view to remove the confirmed category button
      // Try to detect if we're in detail view by checking message content
      const messageText = ctx.callbackQuery?.message?.text || '';
      if (messageText.includes('📝 Note Details')) {
        // We're in detail view, refresh it
        // Need to extract the returnPage from somewhere - default to 1 for now
        await this.showNoteDetail(ctx, ctx.from!.id, noteId, 1);
      }
      // Otherwise, we're in the note list view and the buttons will be removed on next view
    } catch (error) {
      console.error('Error handling category button click:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Show detailed view of a single note
   */
  async showNoteDetail(ctx: any, userId: number, noteId: string, returnPage: number | string): Promise<void> {
    try {
      await ctx.replyWithChatAction('typing');

      const result = await noteOps.getNoteById(noteId, userId);

      if (!result) {
        await ctx.reply('❌ Note not found or you do not have permission to view it.', {
          reply_markup: this.createMainKeyboard()
        });
        return;
      }

      const { note, images } = result;
      const { formatNoteDetailView } = await import('../utils/linkFormatter');

      // Format the detail view
      const message = formatNoteDetailView(note, images);

      // Get existing confirmed categories for this note
      const existingCategories = await dbOps.getNoteCategories(noteId);
      const confirmedCategoryNames = existingCategories
        .filter(cat => cat.user_confirmed)
        .map(cat => cat.category);

      // Create inline keyboard with action buttons
      const keyboard = [];

      // Determine which buttons to show based on note status
      const isArchived = note.status === 'archived';

      // First row: Back button + conditional action buttons
      const actionRow = [
        {
          text: returnPage === 'glance' ? '← Glance' : '⬅️ Back',
          callback_data: returnPage === 'glance'
            ? 'back_to_glance'
            : (isArchived ? `archived_page_${returnPage}` : `back:notes:${returnPage}`)
        }
      ];

      if (isArchived) {
        // Archived note: show Unarchive and Delete buttons
        actionRow.push(
          {
            text: '📤 Unarchive',
            callback_data: `unarchive:${noteId}:${returnPage}`
          },
          {
            text: '🗑️ Delete',
            callback_data: `confirm_delete:${noteId}:${returnPage}`
          }
        );
      } else {
        // Active note: show Archive and Mark buttons
        actionRow.push(
          {
            text: '📦 Archive',
            callback_data: `archive:${noteId}:${returnPage}`
          },
          {
            text: note.is_marked ? '⭐ Unmark' : '⭐ Mark',
            callback_data: `mark:${noteId}:${returnPage}`
          }
        );
      }

      keyboard.push(actionRow);

      // Always show all category buttons (except already confirmed ones)
      const { CATEGORY_EMOJI, CATEGORY_LABELS, ALL_CATEGORIES } = await import('../constants/noteCategories');

      // Filter out already confirmed categories
      const availableCategories = ALL_CATEGORIES.filter(
        cat => !confirmedCategoryNames.includes(cat)
      );

      if (availableCategories.length > 0) {
        // Add category buttons (3 per row for better layout)
        for (let i = 0; i < availableCategories.length; i += 3) {
          const row = [];

          for (let j = 0; j < 3 && i + j < availableCategories.length; j++) {
            const category = availableCategories[i + j];
            const emoji = CATEGORY_EMOJI[category];
            const label = CATEGORY_LABELS[category];
            row.push({
              text: `${emoji} ${label}`,
              callback_data: `category:${noteId}:${category}:1.0`
            });
          }

          keyboard.push(row);
        }
      }

      const replyMarkup = { inline_keyboard: keyboard };

      if (ctx.callbackQuery) {
        // Edit existing message
        await ctx.editMessageText(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      } else {
        // Send new message
        await ctx.reply(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      }
    } catch (error) {
      console.error('Error showing note detail:', error);
      await ctx.reply('❌ Sorry, there was an error showing the note details.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  /**
   * Show delete confirmation dialog
   */
  async showDeleteConfirmation(ctx: any, noteId: string, returnPage: number): Promise<void> {
    try {
      const message = escapeMarkdownV2('⚠️ Are you sure you want to delete this note?\n\nThis action cannot be undone. All images, links, and categories will be permanently deleted.');

      const keyboard = [
        [
          {
            text: '✅ Yes, Delete',
            callback_data: `delete:${noteId}:${returnPage}`
          },
          {
            text: '❌ No, Cancel',
            callback_data: `cancel_delete:${noteId}:${returnPage}`
          }
        ]
      ];

      await ctx.editMessageText(message, {
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'MarkdownV2'
      });
    } catch (error) {
      console.error('Error showing delete confirmation:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Delete note and return to notes list
   */
  async deleteNoteAndReturn(ctx: any, userId: number, noteId: string, returnPage: number): Promise<void> {
    try {
      const success = await noteOps.deleteNote(noteId, userId);

      if (!success) {
        await ctx.answerCallbackQuery('❌ Failed to delete note');
        return;
      }

      // Return to notes list
      await this.showNotesPage(ctx, userId, returnPage);
    } catch (error) {
      console.error('Error deleting note:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Toggle note mark status and refresh detail view
   */
  async toggleNoteMarkAndRefresh(ctx: any, userId: number, noteId: string, returnPage: number): Promise<void> {
    try {
      const result = await noteOps.toggleNoteMark(noteId, userId);

      if (!result.success) {
        await ctx.answerCallbackQuery('❌ Failed to toggle mark');
        return;
      }

      // Refresh the detail view with updated mark status
      await this.showNoteDetail(ctx, userId, noteId, returnPage);

      // Show success feedback
      const message = result.isMarked ? '⭐ Note marked' : '⭐ Note unmarked';
      await ctx.answerCallbackQuery(message);
    } catch (error) {
      console.error('Error toggling note mark:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Archive note and return to notes list
   */
  async archiveNoteAndReturn(ctx: any, userId: number, noteId: string, returnPage: number): Promise<void> {
    try {
      const success = await noteOps.archiveNote(noteId, userId);

      if (!success) {
        await ctx.answerCallbackQuery('❌ Failed to archive note');
        return;
      }

      // Return to notes list
      await this.showNotesPage(ctx, userId, returnPage);
    } catch (error) {
      console.error('Error archiving note:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Unarchive note and return to archived list
   */
  async unarchiveNoteAndReturn(ctx: any, userId: number, noteId: string, returnPage: number): Promise<void> {
    try {
      const success = await noteOps.unarchiveNote(noteId, userId);

      if (!success) {
        await ctx.answerCallbackQuery('❌ Failed to unarchive note');
        return;
      }

      // Return to archived notes list
      await this.showArchivedNotesPage(ctx, userId, returnPage);
    } catch (error) {
      console.error('Error unarchiving note:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Show archived notes page with pagination
   */
  async showArchivedNotesPage(ctx: any, userId: number, page: number): Promise<void> {
    try {
      await ctx.replyWithChatAction('typing');

      const result = await noteOps.getArchivedNotesWithPagination(userId, page, 5);

      if (result.totalCount === 0) {
        await ctx.reply('📦 No archived notes found.\n\nNotes will appear here when you archive them from the detail view.', {
          reply_markup: this.createMainKeyboard()
        });
        return;
      }

      // Validate page bounds
      if (page < 1 || page > result.totalPages) {
        if (!ctx.callbackQuery) {
          await this.showArchivedNotesPage(ctx, userId, 1);
          return;
        }
      }

      let headerText = `📦 *Archived Notes* (Page ${result.currentPage}/${result.totalPages})\n`;
      headerText += `📊 Total: ${result.totalCount} notes\n\n`;
      let message = escapeMarkdownV2(headerText);

      // Fetch images and categories for all notes on this page (batch queries)
      const noteIds = result.notes.map(n => n.note_id);
      const categoriesMap = await dbOps.getNotesCategories(noteIds);
      const imagesMap = await noteOps.getNoteImages(noteIds);
      const { CATEGORY_EMOJI } = await import('../constants/noteCategories');

      const notesWithImages = result.notes.map((note) => {
        const images = imagesMap.get(note.note_id) || [];
        const categories = categoriesMap.get(note.note_id) || [];
        return {
          ...note,
          images: images.map(img => ({ cloudflare_url: img.cloudflare_url })),
          categories
        };
      });

      // Emoji numbers for visual consistency
      const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

      // Format notes with emoji numbers
      notesWithImages.forEach((note, index) => {
        const noteNumber = (result.currentPage - 1) * 5 + index + 1;
        const emojiNumber = emojiNumbers[index];

        // Add category indicators
        let categoryIndicators = '';
        if (note.categories && note.categories.length > 0) {
          categoryIndicators = note.categories
            .map((cat: any) => CATEGORY_EMOJI[cat.category as keyof typeof CATEGORY_EMOJI])
            .join(' ') + ' ';
        }

        message += `${emojiNumber} ${escapeMarkdownV2(categoryIndicators)}`;
        message += formatNoteForDisplay(note, {
          maxContentLength: 80,
          maxDescriptionLength: 60,
          showRelevanceScore: false,
          compact: true
        });
      });

      // Create inline keyboard
      const keyboard = [];

      // Row 1: Emoji number buttons for each note on this page
      const noteButtons = notesWithImages.map((note, index) => ({
        text: emojiNumbers[index],
        callback_data: `detail:${note.note_id}:${result.currentPage}`
      }));
      keyboard.push(noteButtons);

      // Add pagination buttons
      const paginationButtons = [];

      if (result.currentPage > 1) {
        paginationButtons.push({
          text: '⬅️ Previous',
          callback_data: `archived_page_${result.currentPage - 1}`
        });
      }

      paginationButtons.push({
        text: `📦 ${result.currentPage}/${result.totalPages}`,
        callback_data: `archived_page_info`
      });

      if (result.currentPage < result.totalPages) {
        paginationButtons.push({
          text: 'Next ➡️',
          callback_data: `archived_page_${result.currentPage + 1}`
        });
      }

      if (paginationButtons.length > 1) {
        keyboard.push(paginationButtons);
      }

      const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      } else {
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
      console.error('Error showing archived notes page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving archived notes. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  /**
   * Show archived note search results with pagination
   */
  async showArchivedNoteSearchResults(ctx: any, userId: number, keyword: string, page: number): Promise<void> {
    try {
      const status = await StatusMessageManager.start(ctx, {
        operation: 'searching_notes',
        showAfterMs: 300
      });

      const result = await noteOps.searchArchivedNotesWithPagination(userId, keyword, page, 5);

      if (result.totalCount === 0) {
        await status.complete(`🔍 No archived notes found matching "${keyword}".\n\nTry a different search term or use /archived to see all archived notes.`);
        return;
      }

      // Validate page bounds
      if (page < 1) {
        page = 1;
      } else if (page > result.totalPages) {
        page = result.totalPages;
      }

      const escapedKeyword = escapeMarkdownV2(keyword);
      let headerText = `🔍 *Archived Search: "${escapedKeyword}"* \\(Page ${result.currentPage}/${result.totalPages}\\)\n`;
      headerText += `📊 Found: ${result.totalCount} notes\n\n`;
      let message = headerText;

      // Fetch images for all notes on this page
      const notesWithImages = await Promise.all(
        result.notes.map(async (note) => {
          const images = await noteOps.getNoteImages(note.note_id);
          return {
            ...note,
            images: images.map(img => ({ cloudflare_url: img.cloudflare_url }))
          };
        })
      );

      // Format the notes with their links, images and relevance scores
      notesWithImages.forEach((note, index) => {
        const noteNumber = (result.currentPage - 1) * 5 + index + 1;
        message += `*${noteNumber}\\.* `;
        message += formatNoteForDisplay(note, {
          maxContentLength: 150,
          maxDescriptionLength: 60,
          showRelevanceScore: true
        });
      });

      // Create pagination buttons
      const keyboard = [];
      const buttons = [];
      const encodedKeyword = encodeURIComponent(keyword);

      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `archived_search_${result.currentPage - 1}_${encodedKeyword}`
        });
      }

      buttons.push({
        text: `🔍 ${result.currentPage}/${result.totalPages}`,
        callback_data: `archived_search_info`
      });

      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `archived_search_${result.currentPage + 1}_${encodedKeyword}`
        });
      }

      if (buttons.length > 1) {
        keyboard.push(buttons);
      }

      const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          reply_markup: replyMarkup,
          parse_mode: 'MarkdownV2'
        });
      } else {
        await status.complete(message, {
          parse_mode: 'MarkdownV2',
          reply_markup: replyMarkup
        });
      }
    } catch (error) {
      console.error('Error showing archived note search results:', error);
      await ctx.reply('❌ Sorry, there was an error searching archived notes. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  /**
   * Merge and sort search results from notes and links by relevance score
   */
  private mergeSearchResults(
    noteResults: { notes: any[]; totalCount: number },
    linkResults: { links: any[]; totalCount: number }
  ): UnifiedSearchResult[] {
    // Transform note results
    const notesUnified: UnifiedSearchResult[] = noteResults.notes.map(note => ({
      type: 'note' as const,
      relevance_score: note.relevance_score || 0,
      note_id: note.note_id,
      note_content: note.note_content,
      telegram_message_id: note.telegram_message_id,
      created_at: note.created_at,
      links: note.links
    }));

    // Transform link results
    const linksUnified: UnifiedSearchResult[] = linkResults.links.map(link => ({
      type: 'link' as const,
      relevance_score: link.relevance_score || 0,
      link_id: link.link_id,
      note_id: link.note_id,
      url: link.url,
      title: link.title,
      description: link.description,
      og_image: link.og_image,
      created_at: link.created_at
    }));

    // Merge and sort by relevance score descending
    const merged = [...notesUnified, ...linksUnified];
    merged.sort((a, b) => b.relevance_score - a.relevance_score);

    return merged;
  }

  /**
   * Batch classification of unclassified notes and links (small batches of 10 items)
   * Used by /classify command
   */
  private async runBatchClassification(ctx: any, userId: number): Promise<void> {
    try {
      // Reset stop flag
      this.shouldStopClassification = false;

      // Create NoteClassifier instance
      const noteClassifier = new NoteClassifier();

      const BATCH_SIZE = 10;

      // 1. Fetch small batch of unclassified items (10 total)
      const [notes, links] = await Promise.all([
        dbOps.fetchUnclassifiedNotes(userId, BATCH_SIZE),
        dbOps.fetchUnclassifiedLinks(userId, BATCH_SIZE)
      ]);

      // Combine and limit to 10 total items
      const allItems: Array<{type: 'note' | 'link', data: any}> = [
        ...notes.map(n => ({type: 'note' as const, data: n})),
        ...links.map(l => ({type: 'link' as const, data: l}))
      ].slice(0, BATCH_SIZE);

      if (allItems.length === 0) {
        await ctx.reply('No unclassified items found. All caught up! ✅', {
          reply_markup: this.createMainKeyboard()
        });
        return;
      }

      // Count how many more items remain unclassified
      const [allNotes, allLinks] = await Promise.all([
        dbOps.fetchUnclassifiedNotes(userId),
        dbOps.fetchUnclassifiedLinks(userId)
      ]);
      const totalRemaining = allNotes.length + allLinks.length;

      await ctx.reply(
        `Starting classification...\nProcessing ${allItems.length} items (${totalRemaining} total unclassified)`,
        { reply_markup: this.createMainKeyboard() }
      );

      // 2. Process with rate limiting and stop button
      let autoConfirmedCount = 0;
      let assignedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let processedCount = 0;
      const skipReasons: string[] = []; // Track why items were skipped

      // Process all items (notes and links combined)
      for (const item of allItems) {
        // Check if user requested stop
        if (this.shouldStopClassification) {
          let stopMsg = `⏹️ Classification stopped by user.\n✅ ${autoConfirmedCount} auto-confirmed\n📝 ${assignedCount} assigned (needs review)\n⏭️ ${skippedCount} skipped\n❌ ${failedCount} failed`;

          if (skipReasons.length > 0) {
            const recentSkips = skipReasons.slice(-3);
            stopMsg += '\n\n📋 Recent skips (score < 60):';
            recentSkips.forEach(reason => {
              stopMsg += `\n• ${reason}`;
            });
          }

          await ctx.reply(stopMsg, { reply_markup: this.createMainKeyboard() });
          this.shouldStopClassification = false;
          return;
        }

        try {
          let scores;
          let autoConfirmedCategories = 0;
          let assignedCategories = 0;

          if (item.type === 'note') {
            const note = item.data;
            scores = await noteClassifier.suggestCategories(note.content, []);

            // 1. Auto-confirm high-confidence categories (≥95)
            const autoConfirm = scores.filter(s => s.action === 'auto-confirm');
            for (const categoryScore of autoConfirm) {
              const success = await dbOps.addNoteCategory(
                note.id,
                categoryScore.category,
                categoryScore.score / 100,
                true // userConfirmed = true
              );
              if (success) autoConfirmedCategories++;
            }

            // 2. If no auto-confirm, assign best match (≥60) for review
            if (autoConfirmedCategories === 0 && scores.length > 0) {
              const bestMatch = scores[0]; // Highest score
              if (bestMatch.score >= 60) {
                const success = await dbOps.addNoteCategory(
                  note.id,
                  bestMatch.category,
                  bestMatch.score / 100,
                  false // userConfirmed = false (needs review)
                );
                if (success) assignedCategories++;
              }
            }
          } else {
            const link = item.data;
            scores = await noteClassifier.classifyLink(link.url, link.title, link.description);

            // 1. Auto-confirm high-confidence categories (≥95)
            const autoConfirm = scores.filter(s => s.action === 'auto-confirm');
            for (const categoryScore of autoConfirm) {
              const success = await dbOps.addLinkCategory(
                link.id,
                categoryScore.category,
                categoryScore.score / 100,
                true // userConfirmed = true
              );
              if (success) autoConfirmedCategories++;
            }

            // 2. If no auto-confirm, assign best match (≥60) for review
            if (autoConfirmedCategories === 0 && scores.length > 0) {
              const bestMatch = scores[0]; // Highest score
              if (bestMatch.score >= 60) {
                const success = await dbOps.addLinkCategory(
                  link.id,
                  bestMatch.category,
                  bestMatch.score / 100,
                  false // userConfirmed = false (needs review)
                );
                if (success) assignedCategories++;
              }
            }
          }

          // Update counts
          if (autoConfirmedCategories > 0) {
            autoConfirmedCount++;
          } else if (assignedCategories > 0) {
            assignedCount++;
          } else {
            // Item was skipped - log the reason
            skippedCount++;
            if (scores && scores.length > 0) {
              const bestScore = scores[0];
              const itemPreview = item.type === 'note'
                ? item.data.content.substring(0, 50)
                : item.data.url.substring(0, 50);
              const reason = `"${itemPreview}..." → ${bestScore.category}:${bestScore.score}`;
              skipReasons.push(reason);
              console.log(`⏭️ Skipped: ${reason}`);
            } else {
              const itemPreview = item.type === 'note'
                ? item.data.content.substring(0, 50)
                : item.data.url.substring(0, 50);
              const reason = `"${itemPreview}..." → no scores returned`;
              skipReasons.push(reason);
              console.log(`⏭️ Skipped: ${reason}`);
            }
          }
        } catch (err) {
          console.error(`Failed to classify item:`, err);
          failedCount++;
        }

        processedCount++;

        // Progress update with stop button
        if (processedCount % 3 === 0 || processedCount === allItems.length) {
          const { InlineKeyboard } = await import('grammy');
          const keyboard = new InlineKeyboard().text('⏹️ Stop', 'stop_classify');

          let progressMsg = `Progress: ${processedCount}/${allItems.length} processed...\n✅ ${autoConfirmedCount} auto-confirmed\n📝 ${assignedCount} assigned (needs review)\n⏭️ ${skippedCount} skipped\n❌ ${failedCount} failed`;

          // Show last 3 skip reasons if any
          if (skipReasons.length > 0) {
            const recentSkips = skipReasons.slice(-3);
            progressMsg += '\n\n📋 Recent skips (score < 60):';
            recentSkips.forEach(reason => {
              progressMsg += `\n• ${reason}`;
            });
          }

          await ctx.reply(progressMsg, { reply_markup: keyboard });
        }

        // Rate limiting: 500ms delay between API calls
        await this.delay(500);
      }

      // 3. Final summary
      this.shouldStopClassification = false;

      // Check remaining items
      const [remainingNotes, remainingLinks] = await Promise.all([
        dbOps.fetchUnclassifiedNotes(userId),
        dbOps.fetchUnclassifiedLinks(userId)
      ]);
      const remaining = remainingNotes.length + remainingLinks.length;

      let summary = `Batch complete!\n✅ ${autoConfirmedCount} auto-confirmed (≥95)\n📝 ${assignedCount} assigned for review (60-94)\n⏭️ ${skippedCount} skipped (< 60)\n❌ ${failedCount} failed`;

      // Show skip reasons if any
      if (skipReasons.length > 0) {
        const recentSkips = skipReasons.slice(-5); // Show last 5 in final summary
        summary += '\n\n📋 Skip reasons (score < 60):';
        recentSkips.forEach(reason => {
          summary += `\n• ${reason}`;
        });
      }

      if (remaining > 0) {
        summary += `\n\n📊 ${remaining} unclassified items remaining\nRun /classify again to process next batch`;
      } else {
        summary += `\n\n🎉 All items classified!`;
      }

      await ctx.reply(summary, { reply_markup: this.createMainKeyboard() });
    } catch (error) {
      console.error('Error in batch classification:', error);
      this.shouldStopClassification = false;
      await ctx.reply('❌ Sorry, there was an error during classification. Please try again later.', {
        reply_markup: this.createMainKeyboard()
      });
    }
  }

  /**
   * Utility function for rate limiting delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const telegramClient = new TelegramClient();

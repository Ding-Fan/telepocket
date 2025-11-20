import { Bot } from 'grammy';
import { config } from '../config/environment';
import { dbOps } from '../database/operations';
import { noteOps } from '../database/noteOperations';
import { escapeMarkdownV2, formatLinksForDisplay, formatNoteForDisplay } from '../utils/linkFormatter';
import { handleNoteCommand, handlePhotoMessage } from './noteHandlers';
import { validateSearchKeyword } from '../utils/validation';
import { handleValidationError } from '../utils/errorHandler';
import { StatusMessageManager } from '../utils/statusMessageManager';
import { HELP_MESSAGES } from '../constants/helpMessages';
import { createMainKeyboard } from './utils/keyboards';

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

  constructor() {
    this.bot = new Bot(config.telegram.botToken);
    this.setupErrorHandling();
  }

  getBot(): Bot {
    return this.bot;
  }

  private setupErrorHandling(): void {
    this.bot.catch((err) => {
      console.error('Grammy bot error:', err);
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

    // Set the menu button to open the Web App
    await this.bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Dashboard',
        web_app: { url: config.telegram.webAppUrl }
      }
    });

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
          reply_markup: createMainKeyboard()
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
            reply_markup: createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing links page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your links. Please try again later.', {
        reply_markup: createMainKeyboard()
      });
    }
  }

  private async showSearchResults(ctx: any, userId: number, keyword: string, page: number): Promise<void> {
    try {
      const result = await dbOps.searchLinksWithPagination(userId, keyword, page, 10);

      if (result.totalCount === 0) {
        await ctx.reply(`🔍 No links found matching "${keyword}".\n\nTry a different search term or use /ls to see all your links.`, {
          reply_markup: createMainKeyboard()
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
            reply_markup: createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing search results:', error);
      await ctx.reply('❌ Sorry, there was an error searching your links. Please try again later.', {
        reply_markup: createMainKeyboard()
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
          reply_markup: createMainKeyboard()
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
        callback_data: `detail:${note.note_id}:/notes/${result.currentPage}`
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
            reply_markup: createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing notes page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your notes. Please try again later.', {
        reply_markup: createMainKeyboard()
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
          reply_markup: createMainKeyboard()
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
            reply_markup: createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing notes by category:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your notes. Please try again later.', {
        reply_markup: createMainKeyboard()
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
        reply_markup: createMainKeyboard()
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
          reply_markup: createMainKeyboard()
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
            reply_markup: createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing links page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your links. Please try again later.', {
        reply_markup: createMainKeyboard()
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
        reply_markup: createMainKeyboard()
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
        reply_markup: createMainKeyboard()
      });
    }
  }

  /**
   * Show detailed view of a single note
   */
  async showNoteDetail(ctx: any, userId: number, noteId: string, returnPath: string): Promise<void> {
    try {
      await ctx.replyWithChatAction('typing');

      const result = await noteOps.getNoteById(noteId, userId);

      if (!result) {
        await ctx.reply('❌ Note not found or you do not have permission to view it.', {
          reply_markup: createMainKeyboard()
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

      // Determine back button label based on return path
      let backButtonLabel = '⬅️ Back';
      if (returnPath.includes('/glance')) {
        backButtonLabel = '← Glance';
      } else if (returnPath.includes('/suggest')) {
        backButtonLabel = '← Suggest';
      }

      // First row: Back button + conditional action buttons
      const actionRow = [
        {
          text: backButtonLabel,
          callback_data: `back:${returnPath}`
        }
      ];

      if (isArchived) {
        // Archived note: show Unarchive and Delete buttons
        actionRow.push(
          {
            text: '📤 Unarchive',
            callback_data: `unarchive:${noteId}:${returnPath}`
          },
          {
            text: '🗑️ Delete',
            callback_data: `confirm_delete:${noteId}:${returnPath}`
          }
        );
      } else {
        // Active note: show Archive and Mark buttons
        actionRow.push(
          {
            text: '📦 Archive',
            callback_data: `archive:${noteId}:${returnPath}`
          },
          {
            text: note.is_marked ? '⭐ Unmark' : '⭐ Mark',
            callback_data: `mark:${noteId}:${returnPath}`
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
            // Encode returnPath to avoid callback_data length/character issues
            const encodedPath = Buffer.from(returnPath).toString('base64url');
            // Use short category codes to stay under 64-byte limit
            const categoryCode = category.substring(0, 2); // td, id, bl, yt, rf, jp
            row.push({
              text: `${emoji} ${label}`,
              callback_data: `category:${noteId}:${categoryCode}:${encodedPath}`
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
        reply_markup: createMainKeyboard()
      });
    }
  }

  /**
   * Show delete confirmation dialog
   */
  async showDeleteConfirmation(ctx: any, noteId: string, returnPath: string): Promise<void> {
    try {
      const message = escapeMarkdownV2('⚠️ Are you sure you want to delete this note?\n\nThis action cannot be undone. All images, links, and categories will be permanently deleted.');

      const keyboard = [
        [
          {
            text: '✅ Yes, Delete',
            callback_data: `delete:${noteId}:${returnPath}`
          },
          {
            text: '❌ No, Cancel',
            callback_data: `cancel_delete:${noteId}:${returnPath}`
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
   * Delete note and return to previous view
   */
  async deleteNoteAndReturn(ctx: any, userId: number, noteId: string, returnPath: string): Promise<void> {
    try {
      const success = await noteOps.deleteNote(noteId, userId);

      if (!success) {
        await ctx.answerCallbackQuery('❌ Failed to delete note');
        return;
      }

      // Return to previous view using router
      const { navigateToPath } = await import('./utils/viewRouter');
      await navigateToPath(ctx, userId, returnPath, this.getViewFunctions());
    } catch (error) {
      console.error('Error deleting note:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Toggle note mark status and refresh detail view
   */
  async toggleNoteMarkAndRefresh(ctx: any, userId: number, noteId: string, returnPath: string): Promise<void> {
    try {
      const result = await noteOps.toggleNoteMark(noteId, userId);

      if (!result.success) {
        await ctx.answerCallbackQuery('❌ Failed to toggle mark');
        return;
      }

      // Refresh the detail view with updated mark status
      await this.showNoteDetail(ctx, userId, noteId, returnPath);

      // Show success feedback
      const message = result.isMarked ? '⭐ Note marked' : '⭐ Note unmarked';
      await ctx.answerCallbackQuery(message);
    } catch (error) {
      console.error('Error toggling note mark:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Archive note and return to previous view
   */
  async archiveNoteAndReturn(ctx: any, userId: number, noteId: string, returnPath: string): Promise<void> {
    try {
      const success = await noteOps.archiveNote(noteId, userId);

      if (!success) {
        await ctx.answerCallbackQuery('❌ Failed to archive note');
        return;
      }

      // Return to previous view using router
      const { navigateToPath } = await import('./utils/viewRouter');
      await navigateToPath(ctx, userId, returnPath, this.getViewFunctions());
    } catch (error) {
      console.error('Error archiving note:', error);
      await ctx.answerCallbackQuery('❌ An error occurred');
    }
  }

  /**
   * Unarchive note and return to previous view
   */
  async unarchiveNoteAndReturn(ctx: any, userId: number, noteId: string, returnPath: string): Promise<void> {
    try {
      const success = await noteOps.unarchiveNote(noteId, userId);

      if (!success) {
        await ctx.answerCallbackQuery('❌ Failed to unarchive note');
        return;
      }

      // Return to previous view using router
      const { navigateToPath } = await import('./utils/viewRouter');
      await navigateToPath(ctx, userId, returnPath, this.getViewFunctions());
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
          reply_markup: createMainKeyboard()
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
        callback_data: `detail:${note.note_id}:/archived/${result.currentPage}`
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
            reply_markup: createMainKeyboard(),
            parse_mode: 'MarkdownV2'
          });
        }
      }
    } catch (error) {
      console.error('Error showing archived notes page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving archived notes. Please try again later.', {
        reply_markup: createMainKeyboard()
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
        reply_markup: createMainKeyboard()
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
   * Get all view functions for router
   * This provides a centralized interface for the view router to call any view
   */
  getViewFunctions() {
    return {
      showGlanceView: async (ctx: any, userId: number) => {
        const { showGlanceView } = await import('./views/glance');
        return showGlanceView(ctx, userId);
      },
      showNotesPage: this.showNotesPage.bind(this),
      showNotesByCategory: this.showNotesByCategory.bind(this),
      showNoteSearchResults: this.showNoteSearchResults.bind(this),
      showSuggestView: async (ctx: any, userId: number) => {
        const { showSuggestView } = await import('./views/suggest');
        return showSuggestView(ctx, userId);
      },
      showSuggestViewWithQuery: async (ctx: any, userId: number, query: string) => {
        const { showSuggestViewWithQuery } = await import('./views/suggest');
        return showSuggestViewWithQuery(ctx, userId, query);
      },
      showArchivedNotesPage: this.showArchivedNotesPage.bind(this),
      showArchivedNoteSearchResults: this.showArchivedNoteSearchResults.bind(this),
      showUnifiedSearchResults: this.showUnifiedSearchResults.bind(this),
    };
  }
}

export const telegramClient = new TelegramClient();

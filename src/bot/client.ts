import { Bot } from 'grammy';
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
• \`/list\` or \`/ls\` - View your saved links with pagination
• \`/list 2\` - Jump to a specific page

💡 **Pro tip:** Send me multiple links in one message - I'll process them all! 🚀

Ready to start collecting your digital treasures? 💎✨`;

      await ctx.reply(welcomeMessage);
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
        const page = parseInt(data.replace('links_page_', ''));
        await this.showLinksPage(ctx, userId, page);
        await ctx.answerCallbackQuery();
      }
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
      const result = await dbOps.getLinksWithPagination(userId, page, 5);
      
      if (result.totalCount === 0) {
        await ctx.reply('📭 No saved links found yet!\n\nSend me a message with URLs to start building your collection! 🔗✨');
        return;
      }

      let message = `🔗 **Your Saved Links** (Page ${result.currentPage}/${result.totalPages})\n`;
      message += `📊 Total: ${result.totalCount} links\n\n`;

      result.links.forEach((link, index) => {
        const linkNumber = (result.currentPage - 1) * 5 + index + 1;
        message += `**${linkNumber}.** ${link.title || 'Untitled'}\n`;
        message += `🌐 ${link.url}\n`;
        
        if (link.description) {
          // Truncate description if too long
          const desc = link.description.length > 100 
            ? link.description.substring(0, 100) + '...' 
            : link.description;
          message += `📝 ${desc}\n`;
        }
        
        if (link.created_at) {
          const date = new Date(link.created_at).toLocaleDateString();
          message += `📅 Saved: ${date}\n`;
        }
        
        message += '\n';
      });

      // Create pagination buttons
      const keyboard = [];
      const buttons = [];

      if (result.currentPage > 1) {
        buttons.push({
          text: '⬅️ Previous',
          callback_data: `links_page_${result.currentPage - 1}`
        });
      }

      buttons.push({
        text: `📄 ${result.currentPage}/${result.totalPages}`,
        callback_data: `links_page_${result.currentPage}`
      });

      if (result.currentPage < result.totalPages) {
        buttons.push({
          text: 'Next ➡️',
          callback_data: `links_page_${result.currentPage + 1}`
        });
      }

      if (buttons.length > 0) {
        keyboard.push(buttons);
      }

      const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

      if (ctx.callbackQuery) {
        // Edit existing message for pagination
        await ctx.editMessageText(message, { 
          reply_markup: replyMarkup,
          parse_mode: 'Markdown'
        });
      } else {
        // Send new message for command
        await ctx.reply(message, { 
          reply_markup: replyMarkup,
          parse_mode: 'Markdown'
        });
      }
    } catch (error) {
      console.error('Error showing links page:', error);
      await ctx.reply('❌ Sorry, there was an error retrieving your links. Please try again later.');
    }
  }
}

export const telegramClient = new TelegramClient();

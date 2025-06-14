import { Bot, Context } from 'grammy';
import { telegramClient } from './client';
import { linkExtractor } from '../services/linkExtractor';
import { metadataFetcher } from '../services/metadataFetcher';
import { dbOps } from '../database/operations';

export class MessageHandler {
  private bot: Bot;

  constructor() {
    this.bot = telegramClient.getBot();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.on('message:text', this.handleMessage.bind(this));
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const msg = ctx.message;
    
    // Only process messages from authorized user
    if (!telegramClient.isAuthorizedUser(msg?.from?.id || 0)) {
      console.log(`Ignored message from unauthorized user: ${msg?.from?.id}`);
      return;
    }

    try {
      await this.processMessage(ctx);
    } catch (error) {
      console.error('Error processing message:', error);
      await ctx.reply('Failed: Internal error while processing your message');
    }
  }

  private async processMessage(ctx: Context): Promise<void> {
    const messageText = ctx.message?.text;
    
    if (!messageText) {
      return;
    }
    
    // Extract URLs from the message
    const urls = linkExtractor.extractAndValidateUrls(messageText);
    
    if (urls.length === 0) {
      await ctx.reply('Failed: No links found in your message');
      return;
    }

    // Send processing message
    const processingMsg = await ctx.reply('Processing...');

    try {
      // Fetch metadata for all URLs
      const urlsWithMetadata = await metadataFetcher.fetchMetadataForUrls(urls);

      // Prepare data for database
      const message = {
        telegram_user_id: ctx.message!.from!.id,
        telegram_message_id: ctx.message!.message_id,
        content: messageText,
      };

      const links = urlsWithMetadata.map(({ url, metadata }) => ({
        url,
        title: metadata.title,
        description: metadata.description,
        og_image: metadata.og_image,
      }));

      // Save to database
      const result = await dbOps.saveMessageWithLinks(message, links);

      // Update the processing message with the result
      if (result.success) {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          `Success: Saved ${result.linkCount} link(s)`
        );
      } else {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          'Failed: Database error while saving links'
        );
      }
    } catch (error) {
      console.error('Error in processMessage:', error);
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const messageHandler = new MessageHandler();

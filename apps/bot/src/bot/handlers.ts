import { Bot, Context } from 'grammy';
import { telegramClient } from './client';
import { linkExtractor } from '../services/linkExtractor';
import { metadataFetcher } from '../services/metadataFetcher';
import { dbOps } from '../database/operations';
import { noteOps } from '../database/noteOperations';
import { db } from '../database/connection';
import { escapeMarkdownV2, formatLinksForDisplay } from '../utils/linkFormatter';
import { processNoteInBackground } from '../services/autoClassifyAdapter';

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
      // STEP 1: Check metadata cache from z_note_links
      const cachedMetadata = await dbOps.checkMetadataCache(urls);
      console.log(`Cache check: ${cachedMetadata.size}/${urls.length} URLs found in cache`);

      // STEP 2: Merge URLs with cached metadata
      const linksWithMetadata = urls.map(url => {
        const cached = cachedMetadata.get(url);
        return {
          url,
          title: cached?.title,
          description: cached?.description,
          og_image: cached?.og_image,
        };
      });

      // Prepare data for both systems
      const message = {
        telegram_user_id: ctx.message!.from!.id,
        telegram_message_id: ctx.message!.message_id,
        content: messageText,
      };

      const note = {
        telegram_user_id: ctx.message!.from!.id,
        telegram_message_id: ctx.message!.message_id,
        content: messageText,
      };

      // STEP 3: Dual-write to both systems in parallel
      const [oldResult, newResult] = await Promise.all([
        dbOps.saveMessageWithLinks(message, linksWithMetadata),
        noteOps.saveNoteWithLinks(note, linksWithMetadata)
      ]);

      // STEP 4: Instant feedback to user
      if (oldResult.success || newResult.success) {
        const linkCount = oldResult.linkCount || newResult.linkCount;
        let successMessage = `✅ *Saved ${linkCount} link${linkCount === 1 ? '' : 's'}:*\n\n`;

        // Format saved links (show URLs, metadata will appear later)
        const formattedLinks = formatLinksForDisplay(linksWithMetadata.map(link => ({
          url: link.url,
          title: link.title,
          description: link.description
        })), {
          startNumber: 1,
          maxDescriptionLength: 80,
          showNumbers: true
        });

        successMessage += formattedLinks;

        await ctx.api.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          successMessage,
          { parse_mode: 'MarkdownV2' }
        );

        // STEP 4.5: Background auto-classification and embedding generation
        if (newResult.success && newResult.noteId) {
          processNoteInBackground(newResult.noteId, messageText, urls).catch(err => {
            console.error('Auto-classification failed:', err);
          });
        }

        // STEP 5: Background metadata fetch for uncached URLs
        const uncachedUrls = urls.filter(url => !cachedMetadata.has(url));
        if (uncachedUrls.length > 0 && oldResult.success && newResult.success) {
          console.log(`Fetching metadata in background for ${uncachedUrls.length} URLs`);
          this.fetchAndUpdateMetadataInBackground(
            uncachedUrls,
            message.telegram_user_id,
            message.telegram_message_id
          ).catch(err => {
            console.error('Background metadata fetch failed:', err);
          });
        }
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

  /**
   * Fetch metadata in background and update both systems
   * Fire-and-forget pattern - doesn't block user interaction
   */
  private async fetchAndUpdateMetadataInBackground(
    urls: string[],
    userId: number,
    messageId: number
  ): Promise<void> {
    try {
      // Fetch metadata for all URLs
      const urlsWithMetadata = await metadataFetcher.fetchMetadataForUrls(urls);

      // Find the message_id and note_id for updates
      // We use the telegram_message_id to find both records
      const { data: messageData } = await db.getClient()
        .from('z_messages')
        .select('id')
        .eq('telegram_user_id', userId)
        .eq('telegram_message_id', messageId)
        .single();

      const { data: noteData } = await db.getClient()
        .from('z_notes')
        .select('id')
        .eq('telegram_user_id', userId)
        .eq('telegram_message_id', messageId)
        .single();

      if (!messageData?.id || !noteData?.id) {
        console.error('Could not find message or note for background update');
        return;
      }

      // Update both systems with metadata
      for (const { url, metadata } of urlsWithMetadata) {
        await Promise.all([
          dbOps.updateLinkMetadata(messageData.id, url, metadata),
          noteOps.updateNoteLinkMetadata(noteData.id, url, metadata)
        ]);
      }

      console.log(`Background metadata update complete for ${urls.length} URLs`);
    } catch (error) {
      console.error('Error in background metadata fetch:', error);
      // Silent failure - metadata is optional
    }
  }
}

export const messageHandler = new MessageHandler();

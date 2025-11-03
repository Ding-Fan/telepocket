import { Bot, Context } from 'grammy';
import { telegramClient } from './client';
import { linkExtractor } from '../services/linkExtractor';
import { metadataFetcher } from '../services/metadataFetcher';
import { noteOps } from '../database/noteOperations';
import { escapeMarkdownV2, formatLinksForDisplay } from '../utils/linkFormatter';
import { validateNoteContent } from '../utils/validation';
import { handleCommandError, handleValidationError } from '../utils/errorHandler';
import { imageUploader } from '../services/imageUploader';

/**
 * Handles /note command - saves notes with optional links
 * @param ctx Grammy context
 */
export async function handleNoteCommand(ctx: Context): Promise<void> {
  try {
    const messageText = ctx.message?.text;

    if (!messageText) {
      await ctx.reply('❌ No text provided');
      return;
    }

    // Extract note content (remove /note command prefix)
    const noteContent = messageText.replace(/^\/note\s+/, '').trim();

    if (!noteContent) {
      await ctx.reply('❌ No note content provided. Usage: /note <your note text>');
      return;
    }

    // Validate note content
    const validation = validateNoteContent(noteContent);
    if (!validation.valid) {
      const errorMessage = handleValidationError(validation.error!, {
        userId: ctx.message?.from?.id,
        operation: 'handleNoteCommand',
        timestamp: new Date().toISOString()
      });
      await ctx.reply(errorMessage);
      return;
    }

    await processNoteMessage(ctx, noteContent);
  } catch (error) {
    const errorMessage = handleCommandError(error, {
      userId: ctx.message?.from?.id,
      operation: 'handleNoteCommand',
      timestamp: new Date().toISOString()
    });
    await ctx.reply(errorMessage);
  }
}

/**
 * Message handler class that listens to all text messages and saves them as notes
 */
export class NoteMessageHandler {
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
      const messageText = msg?.text;
      if (messageText) {
        await processNoteMessage(ctx, messageText);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      await ctx.reply('Failed: Internal error while processing your message');
    }
  }
}

/**
 * Process note message and save to database
 * @param ctx Grammy context
 * @param messageText The note content to save
 */
async function processNoteMessage(ctx: Context, messageText: string): Promise<void> {
    // Validate note content
    const validation = validateNoteContent(messageText);
    if (!validation.valid) {
      const errorMessage = handleValidationError(validation.error!, {
        userId: ctx.message?.from?.id,
        operation: 'processNoteMessage',
        timestamp: new Date().toISOString()
      });
      await ctx.reply(errorMessage);
      return;
    }

    // Extract URLs from the message (optional - note can exist without links)
    const urls = linkExtractor.extractAndValidateUrls(messageText);

    // Send processing message
    const processingMsg = await ctx.reply('Processing...');

    try {
      // Prepare note data
      const note = {
        telegram_user_id: ctx.message!.from!.id,
        telegram_message_id: ctx.message!.message_id,
        content: messageText,
      };

      let result: { success: boolean; linkCount: number };

      // If there are links, fetch metadata and save with links
      if (urls.length > 0) {
        // Fetch metadata for all URLs
        const urlsWithMetadata = await metadataFetcher.fetchMetadataForUrls(urls);

        const links = urlsWithMetadata.map(({ url, metadata }) => ({
          url,
          title: metadata.title,
          description: metadata.description,
          og_image: metadata.og_image,
        }));

        // Save note with links
        result = await noteOps.saveNoteWithLinks(note, links);

        // Build success message with links
        if (result.success) {
          let successMessage = `✅ *Saved note with ${result.linkCount} link${result.linkCount === 1 ? '' : 's'}:*\n\n`;

          // Show note content
          const escapedContent = escapeMarkdownV2(messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''));
          successMessage += `📝 _${escapedContent}_\n\n`;

          // Format saved links
          const formattedLinks = formatLinksForDisplay(urlsWithMetadata.map(item => ({
            url: item.url,
            title: item.metadata.title,
            description: item.metadata.description
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
        } else {
          await ctx.api.editMessageText(
            ctx.chat!.id,
            processingMsg.message_id,
            '❌ Database error while saving note. Please try again.'
          );
        }
      } else {
        // No links - just save as a plain note
        result = await noteOps.saveNoteWithLinks(note, []);

        if (result.success) {
          const escapedContent = escapeMarkdownV2(messageText.substring(0, 150) + (messageText.length > 150 ? '...' : ''));
          const successMessage = `✅ *Saved note:*\n\n📝 _${escapedContent}_`;

          await ctx.api.editMessageText(
            ctx.chat!.id,
            processingMsg.message_id,
            successMessage,
            { parse_mode: 'MarkdownV2' }
          );
        } else {
          await ctx.api.editMessageText(
            ctx.chat!.id,
            processingMsg.message_id,
            '❌ Database error while saving note. Please try again.'
          );
        }
      }
    } catch (error) {
      const errorMessage = handleCommandError(error, {
        userId: ctx.message?.from?.id,
        operation: 'processNoteMessage',
        timestamp: new Date().toISOString()
      });
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        errorMessage
      );
    }
}

/**
 * Handle photo messages - auto-upload to Cloudflare R2
 */
export async function handlePhotoMessage(ctx: Context): Promise<void> {
  try {
    // 1. Extract photo (largest size)
    const photos = ctx.message?.photo;
    if (!photos || photos.length === 0) {
      return;
    }
    const largestPhoto = photos[photos.length - 1];

    // 2. Get caption (note content)
    const caption = ctx.message?.caption?.trim() || '';

    // 3. Get user ID
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user');
      return;
    }

    // 4. Download from Telegram
    const file = await ctx.api.getFile(largestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 5. Upload to R2
    const uploadResult = await imageUploader.uploadImage(buffer, {
      originalFileName: file.file_path?.split('/').pop(),
      mimeType: 'image/jpeg', // Telegram converts photos to JPEG
    });

    // 6. Save note with caption
    const note = await noteOps.saveNote({
      telegram_user_id: userId,
      content: caption || '(Image)',
      telegram_message_id: ctx.message!.message_id,
    });

    if (!note) {
      await ctx.reply('❌ Failed to save note');
      return;
    }

    // 7. Save image record
    await noteOps.saveNoteImages(note, [{
      note_id: note,
      telegram_file_id: largestPhoto.file_id,
      telegram_file_unique_id: largestPhoto.file_unique_id,
      cloudflare_url: uploadResult.cloudflareUrl,
      file_name: uploadResult.fileName,
      file_size: uploadResult.fileSize,
      mime_type: uploadResult.mimeType,
      width: largestPhoto.width,
      height: largestPhoto.height,
    }]);

    // 8. Reply with URL
    await ctx.reply(
      `✅ Saved note with 1 image\n\n*Images:*\n• ${escapeMarkdownV2(uploadResult.cloudflareUrl)}`,
      { parse_mode: 'MarkdownV2' }
    );

  } catch (error) {
    console.error('Error handling photo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(`❌ Failed to upload image: ${errorMessage}`);
  }
}

// Export instance creation - will be initialized in index.ts
let handlerInstance: NoteMessageHandler | null = null;

export function initNoteMessageHandler(): NoteMessageHandler {
  if (!handlerInstance) {
    handlerInstance = new NoteMessageHandler();
  }
  return handlerInstance;
}

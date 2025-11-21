import { Bot, Context, InlineKeyboard } from 'grammy';
import { telegramClient } from './bot';
import { linkExtractor } from '../services/linkExtractor';
import { metadataFetcher } from '../services/metadataFetcher';
import { noteOps } from '../database/noteOperations';
import { escapeMarkdownV2, formatLinksForDisplay } from '../utils/linkFormatter';
import { validateNoteContent } from '../utils/validation';
import { handleCommandError, handleValidationError } from '../utils/errorHandler';
import { imageUploader } from '../services/imageUploader';
import { NoteClassifier } from '../services/noteClassifier';
import { dbOps } from '../database/operations';
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '../constants/noteCategories';
import { config } from '../config/environment';
import { StatusMessageManager } from '../utils/statusMessageManager';

// Initialize classifier
const noteClassifier = new NoteClassifier();

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
        // Skip commands - they're handled by command handlers
        if (messageText.startsWith('/')) {
          return;
        }

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

  // Calculate total steps for progress tracking
  const hasLinks = urls.length > 0;
  const hasClassification = config.llm.classificationEnabled;
  const totalSteps = (hasLinks ? 2 : 0) + (hasClassification ? 1 : 0);

  // Start status message with timing threshold
  const status = await StatusMessageManager.start(ctx, {
    operation: 'processing_note',
    totalSteps: totalSteps > 0 ? totalSteps : undefined,
    showAfterMs: 500
  });

  try {
    // Prepare note data
    const note = {
      telegram_user_id: ctx.message!.from!.id,
      telegram_message_id: ctx.message!.message_id,
      content: messageText,
    };

    let result: { success: boolean; linkCount: number; noteId?: string };
    let currentStep = 0;

    // If there are links, fetch metadata and save with links
    if (urls.length > 0) {
      // Step 1: Extract links (already done above, but update status)
      if (totalSteps > 0) {
        currentStep++;
        await status.update(currentStep);
      }

      // Step 2: Fetch metadata for all URLs
      const urlsWithMetadata = await metadataFetcher.fetchMetadataForUrls(urls);

      if (totalSteps > 0) {
        currentStep++;
        await status.update(currentStep);
      }

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

        // Complete status with final message
        const completion = await status.complete(successMessage, { parse_mode: 'MarkdownV2' });

        // Trigger async classification (non-blocking)
        if (result.noteId && hasClassification && completion.messageId) {
          // Classification happens asynchronously without blocking user
          classifyNoteAsync(ctx, result.noteId, completion.messageId, messageText, urls, successMessage)
            .catch(err => console.error('Async classification error:', err));
        }

        // Trigger async embedding (non-blocking)
        if (result.noteId) {
          embedNoteAsync(result.noteId, messageText, links)
            .catch(err => console.error('Async embedding error:', err));
        }
      } else {
        await status.complete('❌ Database error while saving note. Please try again.');
      }
    } else {
      // No links - just save as a plain note
      result = await noteOps.saveNoteWithLinks(note, []);

      if (result.success) {
        const escapedContent = escapeMarkdownV2(messageText.substring(0, 150) + (messageText.length > 150 ? '...' : ''));
        const successMessage = `✅ *Saved note:*\n\n📝 _${escapedContent}_`;

        // Complete status with final message
        const completion = await status.complete(successMessage, { parse_mode: 'MarkdownV2' });

        // Trigger async classification (non-blocking)
        if (result.noteId && hasClassification && completion.messageId) {
          // Classification happens asynchronously without blocking user
          classifyNoteAsync(ctx, result.noteId, completion.messageId, messageText, [], successMessage)
            .catch(err => console.error('Async classification error:', err));
        }

        // Trigger async embedding (non-blocking)
        if (result.noteId) {
          embedNoteAsync(result.noteId, messageText, [])
            .catch(err => console.error('Async embedding error:', err));
        }
      } else {
        await status.complete('❌ Database error while saving note. Please try again.');
      }
    }
  } catch (error) {
    const errorMessage = handleCommandError(error, {
      userId: ctx.message?.from?.id,
      operation: 'processNoteMessage',
      timestamp: new Date().toISOString()
    });
    await status.complete(errorMessage);
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

    // Start status message with 2 steps: upload + save
    const status = await StatusMessageManager.start(ctx, {
      operation: 'uploading_image',
      totalSteps: 2,
      showAfterMs: 500
    });

    // 4. Download from Telegram
    const file = await ctx.api.getFile(largestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 5. Upload to R2 (Step 1)
    await status.update(1);
    const uploadResult = await imageUploader.uploadImage(buffer, {
      originalFileName: file.file_path?.split('/').pop(),
      mimeType: 'image/jpeg', // Telegram converts photos to JPEG
    });

    // 6. Save note with caption (Step 2)
    await status.update(2);
    const note = await noteOps.saveNote({
      telegram_user_id: userId,
      content: caption || '(Image)',
      telegram_message_id: ctx.message!.message_id,
    });

    if (!note) {
      await status.complete('❌ Failed to save note');
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

    // 8. Complete with success message
    await status.complete(
      `✅ Saved note with 1 image\n\n*Images:*\n• ${escapeMarkdownV2(uploadResult.cloudflareUrl)}`,
      { parse_mode: 'MarkdownV2' }
    );

  } catch (error) {
    console.error('Error handling photo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(`❌ Failed to upload image: ${errorMessage}`);
  }
}

/**
 * Async function to classify note and add category buttons
 * Runs in background after note is saved
 * Supports auto-confirm for high-confidence categories (score ≥95)
 */
async function classifyNoteAsync(
  ctx: Context,
  noteId: string,
  messageId: number,
  noteContent: string,
  urls: string[],
  existingMessage: string
): Promise<void> {
  try {
    // Skip if classification is disabled
    if (!config.llm.classificationEnabled) {
      return;
    }

    // Get category scores from LLM (0-100 scoring system)
    const scores = await noteClassifier.suggestCategories(noteContent, urls);

    // If no suggestions or all below threshold, skip
    if (scores.length === 0) {
      return;
    }

    // Separate auto-confirm and show-button categories
    const autoConfirmCategories = scores.filter(s => s.action === 'auto-confirm');
    const showButtonCategories = scores.filter(s => s.action === 'show-button');

    // Auto-confirm high-confidence categories (score ≥95)
    for (const score of autoConfirmCategories) {
      // Convert 0-100 score to 0-1 confidence for database (legacy compatibility)
      const confidence = score.score / 100;
      await dbOps.addNoteCategory(noteId, score.category, confidence, false); // user_confirmed = false (LLM-confirmed)
    }

    // Add show-button categories to database as unconfirmed
    for (const score of showButtonCategories) {
      const confidence = score.score / 100;
      await dbOps.addNoteCategory(noteId, score.category, confidence, false);
    }

    // Build message with auto-confirmed categories and buttons
    let updatedMessage = existingMessage;

    // If there are auto-confirmed categories, add them to the message
    if (autoConfirmCategories.length > 0) {
      const categoryTags = autoConfirmCategories
        .map(s => `${CATEGORY_EMOJI[s.category]} ${CATEGORY_LABELS[s.category]}`)
        .join(' ');
      updatedMessage += `\n\n🏷️ *Auto\\-tagged:* ${escapeMarkdownV2(categoryTags)}`;
    }

    // If there are show-button categories, build inline keyboard
    if (showButtonCategories.length > 0) {
      const keyboard = new InlineKeyboard();

      // Add buttons (max 2 per row)
      showButtonCategories.forEach((score, index) => {
        const emoji = CATEGORY_EMOJI[score.category];
        const label = CATEGORY_LABELS[score.category];
        const callbackData = `category:${noteId}:${score.category}:${score.score}`;

        keyboard.text(`${emoji} ${label}`, callbackData);

        // Add row break after every 2 buttons
        if ((index + 1) % 2 === 0 && index < showButtonCategories.length - 1) {
          keyboard.row();
        }
      });

      // Edit message with updated text and category buttons
      await ctx.api.editMessageText(
        ctx.chat!.id,
        messageId,
        updatedMessage,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: keyboard
        }
      );
    } else if (autoConfirmCategories.length > 0) {
      // Only auto-confirmed categories, no buttons - just update message text
      await ctx.api.editMessageText(
        ctx.chat!.id,
        messageId,
        updatedMessage,
        {
          parse_mode: 'MarkdownV2'
        }
      );
    }
  } catch (error) {
    console.error('Error in async classification:', error);
    // Fail silently - user still has their note saved
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

// Helper to embed note asynchronously
async function embedNoteAsync(noteId: string, content: string, links: any[]): Promise<void> {
  try {
    // Re-importing here to avoid top-level await issues or circular deps if any
    // Use require to avoid ESM/CJS interop issues with dynamic import in some environments
    // But for now, let's try standard import but handle the default export if needed
    const shared = await import('@telepocket/shared');
    const EmbeddingService = shared.EmbeddingService;

    const { createClient } = await import('@supabase/supabase-js');

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      console.warn('Missing env vars for embedding, skipping auto-embed');
      return;
    }

    const embeddingService = new EmbeddingService(apiKey);
    const supabase = createClient(supabaseUrl, supabaseKey);

    const text = embeddingService.prepareNoteText({
      content,
      links: links.map(l => ({ title: l.title, url: l.url }))
    });

    const embedding = await embeddingService.generateEmbedding(text);

    const { error } = await supabase
      .from('z_notes')
      .update({ embedding })
      .eq('id', noteId);

    if (error) {
      console.error('Failed to save embedding:', error);
    } else {
      console.log(`✅ Embedded note ${noteId}`);
    }
  } catch (error) {
    console.error('Error auto-embedding note:', error);
  }
}

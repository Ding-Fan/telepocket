import { Composer, InlineKeyboard } from 'grammy';
import { config } from '../../config/environment';
import { dbOps } from '../../database/operations';
import { NoteClassifier } from '../../services/noteClassifier';
import { CATEGORY_EMOJI, CATEGORY_LABELS, ALL_CATEGORIES } from '../../constants/noteCategories';
import { createMainKeyboard } from '../utils/keyboards';

// Module-level state for pending classifications
const pendingClassifications = new Map<string, { type: 'note' | 'link'; scores: any[]; itemData: any }>();
let classificationTimeout: NodeJS.Timeout | undefined;

// Map short keys to full item IDs (for callback data length limit)
const shortKeyMap = new Map<string, string>();
let shortKeyCounter = 0;

export const classifyCommand = new Composer();

/**
 * Classify command - batch auto-classify all unclassified notes and links
 * Usage: /classify [limit]
 * Example: /classify 10 (processes 10 items instead of default 3)
 */
classifyCommand.command('classify', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  // Parse batch size from command argument (default: 3, max: 50)
  const args = ctx.message?.text?.split(' ');
  let batchSize = 3; // default

  if (args && args.length > 1) {
    const parsedSize = parseInt(args[1], 10);
    if (!isNaN(parsedSize) && parsedSize >= 1 && parsedSize <= 50) {
      batchSize = parsedSize;
    } else if (!isNaN(parsedSize)) {
      await ctx.reply('❌ Batch size must be between 1 and 50. Using default (3).');
    }
  }

  await runBatchClassification(ctx, userId, batchSize);
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

/**
 * Batch classification of unclassified notes and links
 * Used by /classify command
 *
 * Workflow:
 * 1. Auto-confirm items with score >= 95
 * 2. Show buttons for items with score < 95
 * 3. Wait 3 minutes for user interaction
 * 4. Auto-assign best match to remaining items after timeout
 *
 * @param ctx - Grammy context
 * @param userId - Telegram user ID
 * @param batchSize - Number of items to process (default: 3, max: 50)
 */
async function runBatchClassification(ctx: any, userId: number, batchSize: number = 3): Promise<void> {
  try {
    // Clear any existing timeout and pending classifications
    if (classificationTimeout) {
      clearTimeout(classificationTimeout);
      classificationTimeout = undefined;
    }
    pendingClassifications.clear();
    shortKeyMap.clear();
    shortKeyCounter = 0;

    // Create NoteClassifier instance
    const noteClassifier = new NoteClassifier();

    // 1. Fetch batch of unclassified items
    const [notes, links] = await Promise.all([
      dbOps.fetchUnclassifiedNotes(userId, batchSize),
      dbOps.fetchUnclassifiedLinks(userId, batchSize)
    ]);

    // Combine and limit to batch size
    const allItems: Array<{type: 'note' | 'link', data: any}> = [
      ...notes.map(n => ({type: 'note' as const, data: n})),
      ...links.map(l => ({type: 'link' as const, data: l}))
    ].slice(0, batchSize);

    if (allItems.length === 0) {
      await ctx.reply('No unclassified items found. All caught up! ✅', {
        reply_markup: createMainKeyboard()
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
      { reply_markup: createMainKeyboard() }
    );

    // 2. Score all items and auto-confirm high-confidence (≥95)
    let autoConfirmedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    for (const item of allItems) {
      try {
        let scores;

        // Get LLM scores
        if (item.type === 'note') {
          const note = item.data;
          scores = await noteClassifier.suggestCategories(note.content, []);
        } else {
          const link = item.data;
          scores = await noteClassifier.classifyLink(link.url, link.title, link.description);
        }

        // Auto-confirm high-confidence categories (≥95)
        const autoConfirm = scores.filter(s => s.score >= 95);
        let wasAutoConfirmed = false;

        for (const categoryScore of autoConfirm) {
          const success = item.type === 'note'
            ? await dbOps.addNoteCategory(
                item.data.id,
                categoryScore.category,
                categoryScore.score / 100,
                true // userConfirmed = true
              )
            : await dbOps.addLinkCategory(
                item.data.id,
                categoryScore.category,
                categoryScore.score / 100,
                true // userConfirmed = true
              );

          if (success) wasAutoConfirmed = true;
        }

        if (wasAutoConfirmed) {
          autoConfirmedCount++;

          // Show auto-confirmed item
          const itemPreview = item.type === 'note'
            ? item.data.content.substring(0, 80)
            : item.data.url;
          const confirmedCategories = autoConfirm
            .map(s => `${CATEGORY_EMOJI[s.category]} ${CATEGORY_LABELS[s.category]} (${s.score})`)
            .join(', ');

          await ctx.reply(
            `✅ Auto-confirmed:\n📝 "${itemPreview}${itemPreview.length >= 80 ? '...' : ''}"\n\n🏷️ ${confirmedCategories}`
          );
        } else {
          // Show buttons for user interaction (score < 95)
          pendingCount++;

          // Store in pending map
          const itemId = item.type === 'note' ? item.data.id : item.data.id;

          // Create short key for callback data (Telegram 64-byte limit)
          const shortKey = `i${shortKeyCounter++}`;
          shortKeyMap.set(shortKey, itemId);

          pendingClassifications.set(itemId, {
            type: item.type,
            scores,
            itemData: item.data
          });

          // Build message with item preview
          const itemPreview = item.type === 'note'
            ? item.data.content.substring(0, 100)
            : `${item.data.title || item.data.url}`;

          let message = `📝 Item ${pendingCount}/${allItems.length}:\n"${itemPreview}${itemPreview.length >= 100 ? '...' : ''}"\n\nAssign category:`;

          // Build keyboard with ALL 6 categories, sorted by score (highest first)
          const keyboard = new InlineKeyboard();

          // Create array with all categories and their scores
          const allCategoriesWithScores = ALL_CATEGORIES.map(category => {
            const scoreObj = scores.find(s => s.category === category);
            return {
              category,
              score: scoreObj?.score || 0
            };
          }).sort((a, b) => b.score - a.score); // Sort by score descending

          // Add buttons for all categories (3 per row for better layout)
          allCategoriesWithScores.forEach((categoryItem, index) => {
            const emoji = CATEGORY_EMOJI[categoryItem.category];
            const label = CATEGORY_LABELS[categoryItem.category];
            const score = categoryItem.score;
            const callbackData = `ca:${shortKey}:${categoryItem.category}:${item.type}`;

            keyboard.text(`${emoji} ${label} (${score})`, callbackData);

            // Add row break after every 3 buttons
            if ((index + 1) % 3 === 0 && index < allCategoriesWithScores.length - 1) {
              keyboard.row();
            }
          });

          await ctx.reply(message, { reply_markup: keyboard });
        }

        // Rate limiting: 500ms delay between API calls
        await delay(500);
      } catch (err) {
        console.error(`Failed to classify item:`, err);
        failedCount++;
      }
    }

    // 3. Set 1-minute timeout for auto-assignment
    if (pendingClassifications.size > 0) {
      await ctx.reply(
        `⏰ Waiting 1 minute for your input...\nClick any category button above to assign manually.\nRemaining items will be auto-assigned to best match.`
      );

      classificationTimeout = setTimeout(async () => {
        await autoAssignPendingClassifications(ctx, userId);
      }, 1 * 60 * 1000); // 1 minute
    } else {
      // All items were auto-confirmed
      await showClassificationSummary(ctx, userId, autoConfirmedCount, 0, failedCount);
    }
  } catch (error) {
    console.error('Error in batch classification:', error);
    pendingClassifications.clear();
    if (classificationTimeout) {
      clearTimeout(classificationTimeout);
      classificationTimeout = undefined;
    }
    await ctx.reply('❌ Sorry, there was an error during classification. Please try again later.', {
      reply_markup: createMainKeyboard()
    });
  }
}

/**
 * Auto-assign best match to all pending classifications after timeout
 */
async function autoAssignPendingClassifications(ctx: any, userId: number): Promise<void> {
  try {
    let assignedCount = 0;

    for (const [itemId, pending] of pendingClassifications.entries()) {
      // Get best match (highest score)
      const bestMatch = pending.scores.length > 0 ? pending.scores[0] : null;

      if (bestMatch) {
        const success = pending.type === 'note'
          ? await dbOps.addNoteCategory(
              itemId,
              bestMatch.category,
              bestMatch.score / 100,
              false // userConfirmed = false (auto-assigned)
            )
          : await dbOps.addLinkCategory(
              itemId,
              bestMatch.category,
              bestMatch.score / 100,
              false // userConfirmed = false (auto-assigned)
            );

        if (success) assignedCount++;
      }
    }

    // Clear pending classifications
    pendingClassifications.clear();
    classificationTimeout = undefined;

    // Show summary
    await showClassificationSummary(ctx, userId, 0, assignedCount, 0);
  } catch (error) {
    console.error('Error auto-assigning pending classifications:', error);
    await ctx.reply('❌ An error occurred during auto-assignment.', {
      reply_markup: createMainKeyboard()
    });
  }
}

/**
 * Show classification summary after batch completion
 */
async function showClassificationSummary(
  ctx: any,
  userId: number,
  autoConfirmedCount: number,
  assignedCount: number,
  failedCount: number
): Promise<void> {
  // Check remaining items
  const [remainingNotes, remainingLinks] = await Promise.all([
    dbOps.fetchUnclassifiedNotes(userId),
    dbOps.fetchUnclassifiedLinks(userId)
  ]);
  const remaining = remainingNotes.length + remainingLinks.length;

  let summary = `Batch complete!\n✅ ${autoConfirmedCount} auto-confirmed (≥95)\n📝 ${assignedCount} auto-assigned`;

  if (failedCount > 0) {
    summary += `\n❌ ${failedCount} failed`;
  }

  if (remaining > 0) {
    summary += `\n\n📊 ${remaining} unclassified items remaining\nRun /classify again to process next batch`;
  } else {
    summary += `\n\n🎉 All items classified!`;
  }

  await ctx.reply(summary, { reply_markup: createMainKeyboard() });
}

/**
 * Handle classification assignment button click during /classify command
 * Callback data format: ca:shortKey:category:type
 *
 * Note: This will be registered in the main callback handler
 */
export async function handleClassifyAssignClick(ctx: any, data: string): Promise<void> {
  try {
    // Parse callback data: ca:shortKey:category:type
    const parts = data.split(':');
    if (parts.length !== 4) {
      await ctx.answerCallbackQuery('❌ Invalid data');
      return;
    }

    const [, shortKey, category, type] = parts;

    // Map short key back to full item ID
    const itemId = shortKeyMap.get(shortKey);
    if (!itemId) {
      await ctx.answerCallbackQuery('❌ Item key not found');
      return;
    }

    // Check if item is in pending classifications
    const pending = pendingClassifications.get(itemId);
    if (!pending) {
      await ctx.answerCallbackQuery('❌ Item not found or already classified');
      return;
    }

    // Assign category to database
    const success = type === 'note'
      ? await dbOps.addNoteCategory(
          itemId,
          category as any,
          1.0, // User-confirmed, so give full confidence
          true // userConfirmed = true
        )
      : await dbOps.addLinkCategory(
          itemId,
          category as any,
          1.0, // User-confirmed, so give full confidence
          true // userConfirmed = true
        );

    if (!success) {
      await ctx.answerCallbackQuery('❌ Failed to assign category');
      return;
    }

    // Remove from pending
    pendingClassifications.delete(itemId);

    // Answer callback query (no visual feedback per user preference)
    await ctx.answerCallbackQuery();

    // If all pending items are now classified, complete the batch
    if (pendingClassifications.size === 0) {
      // Clear timeout
      if (classificationTimeout) {
        clearTimeout(classificationTimeout);
        classificationTimeout = undefined;
      }

      // Show summary (all were user-confirmed in this case)
      await showClassificationSummary(ctx, ctx.from!.id, 0, 0, 0);
    }
  } catch (error) {
    console.error('Error handling classify assign click:', error);
    await ctx.answerCallbackQuery('❌ An error occurred');
  }
}

/**
 * Utility function for rate limiting delays
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

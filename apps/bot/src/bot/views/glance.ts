import { noteOps } from '../../database/noteOperations';
import { escapeMarkdownV2 } from '../../utils/linkFormatter';
import { createMainKeyboard } from '../utils/keyboards';

/**
 * Show glance view - quick overview of 2 recent notes per category
 */
export async function showGlanceView(ctx: any, userId: number): Promise<void> {
  try {
    // Show typing indicator
    await ctx.replyWithChatAction('typing');

    // Import category constants
    const { ALL_CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABELS } = await import('../../constants/noteCategories');

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
            callback_data: `detail:${note.note_id}:/glance/`
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
          reply_markup: createMainKeyboard(),
          parse_mode: 'MarkdownV2'
        });
      }
    }
  } catch (error) {
    console.error('Error showing glance view:', error);
    await ctx.reply('❌ Sorry, there was an error loading the glance view. Please try again later.', {
      reply_markup: createMainKeyboard()
    });
  }
}

import { noteOps } from '../../database/noteOperations';
import { escapeMarkdownV2, formatSuggestionsForDisplay } from '../../utils/linkFormatter';
import { createMainKeyboard } from '../utils/keyboards';
import { NoteClassifier } from '../../services/noteClassifier';
import { selectWeightedRandom, selectByLLMScore } from '../../services/suggestionSelector';

/**
 * Show suggest view - smart suggestions using weighted random algorithm
 */
export async function showSuggestView(ctx: any, userId: number): Promise<void> {
  try {
    // Show typing indicator
    await ctx.replyWithChatAction('typing');

    // Fetch suggestion notes from past 7 days
    const notes = await noteOps.getSuggestionsByImpression(userId, 7);

    if (notes.length === 0) {
      await ctx.reply('💡 No suggestions available from the past 7 days. Try /notes to browse all notes.', {
        reply_markup: createMainKeyboard(),
        parse_mode: 'MarkdownV2'
      });
      return;
    }

    // Select one note per category using weighted random algorithm
    const selectedNotes = selectWeightedRandom(notes);

    if (selectedNotes.length === 0) {
      await ctx.reply('💡 No suggestions available. Try /notes to browse all notes.', {
        reply_markup: createMainKeyboard(),
        parse_mode: 'MarkdownV2'
      });
      return;
    }

    // Increment impressions for selected notes
    const noteIds = selectedNotes.map(note => note.note_id);
    await noteOps.incrementImpressions(noteIds);

    // Format display
    const { message, buttons } = formatSuggestionsForDisplay(selectedNotes);

    // Build inline keyboard (up to 6 buttons in a row)
    const keyboard = [];
    if (buttons.length > 0) {
      if (buttons.length <= 6) {
        keyboard.push(buttons);
      } else {
        keyboard.push(buttons.slice(0, 6));
        keyboard.push(buttons.slice(6));
      }
    }

    const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

    // Send message
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        reply_markup: replyMarkup,
        parse_mode: 'MarkdownV2'
      });
    } else {
      await ctx.reply(message, {
        reply_markup: replyMarkup,
        parse_mode: 'MarkdownV2'
      });
    }
  } catch (error) {
    console.error('Error showing suggest view:', error);
    await ctx.reply('❌ Sorry, there was an error loading suggestions. Please try again later.', {
      reply_markup: createMainKeyboard()
    });
  }
}

/**
 * Show suggest view with query - smart suggestions using LLM semantic scoring
 */
export async function showSuggestViewWithQuery(ctx: any, userId: number, query: string): Promise<void> {
  try {
    // Validate query length
    if (query.length > 500) {
      await ctx.reply('⚠️ Query too long. Please use less than 500 characters.', {
        reply_markup: createMainKeyboard()
      });
      return;
    }

    // Show typing indicator
    await ctx.replyWithChatAction('typing');

    // Fetch suggestion notes from past 7 days
    const notes = await noteOps.getSuggestionsByImpression(userId, 7);

    if (notes.length === 0) {
      await ctx.reply(`💡 No suggestions available for "${escapeMarkdownV2(query)}" from the past 7 days\\. Try /notes to browse all notes\\.`, {
        reply_markup: createMainKeyboard(),
        parse_mode: 'MarkdownV2'
      });
      return;
    }

    // Initialize LLM classifier
    const classifier = new NoteClassifier();

    // Select one note per category using LLM semantic scoring
    const selectedNotes = await selectByLLMScore(notes, query, classifier);

    if (selectedNotes.length === 0) {
      await ctx.reply(`💡 No relevant suggestions found for "${escapeMarkdownV2(query)}"\\. Try /notes to browse all notes\\.`, {
        reply_markup: createMainKeyboard(),
        parse_mode: 'MarkdownV2'
      });
      return;
    }

    // Increment impressions for selected notes
    const noteIds = selectedNotes.map(note => note.note_id);
    await noteOps.incrementImpressions(noteIds);

    // Format display with query context
    const { message, buttons } = formatSuggestionsForDisplay(selectedNotes, query);

    // Build inline keyboard (up to 6 buttons in a row)
    const keyboard = [];
    if (buttons.length > 0) {
      if (buttons.length <= 6) {
        keyboard.push(buttons);
      } else {
        keyboard.push(buttons.slice(0, 6));
        keyboard.push(buttons.slice(6));
      }
    }

    const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

    // Send message
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        reply_markup: replyMarkup,
        parse_mode: 'MarkdownV2'
      });
    } else {
      await ctx.reply(message, {
        reply_markup: replyMarkup,
        parse_mode: 'MarkdownV2'
      });
    }
  } catch (error) {
    console.error('Error showing suggest view with query:', error);
    await ctx.reply('❌ Sorry, there was an error loading suggestions. Please try again later.', {
      reply_markup: createMainKeyboard()
    });
  }
}

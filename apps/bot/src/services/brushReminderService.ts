import { Bot, InlineKeyboard } from 'grammy';
import {
  BrushEvent,
  BrushEventType,
} from '../types/brushReminder';
import {
  createBrushEvent,
  updateBrushEventStatus,
  getBrushEventById,
  getBrushStreak,
  getExpiredBrushEvents,
  getSnoozedBrushEvents,
  getWeeklyStats,
} from '../database/brushOperations';

/**
 * Service for managing brush reminder notifications via Telegram
 * Handles reminder delivery, user interactions (done/snooze), and expiration processing
 */
export class BrushReminderService {
  private bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Send a brush reminder to the user with Done/Snooze buttons
   * Creates DB event, fetches streak, sends Telegram message with inline keyboard
   */
  async sendReminder(
    userId: number,
    chatId: number,
    eventType: BrushEventType
  ): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      const event = await createBrushEvent({
        telegram_user_id: userId,
        chat_id: chatId,
        event_type: eventType,
        scheduled_at: now,
        expires_at: expiresAt,
      });

      const streakData = await getBrushStreak(userId);
      const messageText = `🦷 Time to brush your teeth!\nCurrent streak: ${streakData.current_streak} days 🔥`;

      const keyboard = new InlineKeyboard();
      keyboard.text('✅ Done', `brush:done:${event.id}`);
      keyboard.text('⏰ Snooze 10m', `brush:snooze:${event.id}`);

      const sentMessage = await this.bot.api.sendMessage(chatId, messageText, {
        reply_markup: keyboard,
      });

      await updateBrushEventStatus(event.id, 'pending', {
        telegram_message_id: sentMessage.message_id,
      });

      console.log(`Sent ${eventType} brush reminder to user ${userId}, event ${event.id}`);
    } catch (error) {
      console.error('Failed to send brush reminder:', error);
      throw error;
    }
  }

  /**
   * Handle "Done" button press - marks event as completed
   * Returns success message with updated streak
   */
  async handleDone(eventId: string): Promise<{ message: string; streak: number }> {
    try {
      const event = await getBrushEventById(eventId);
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      const completedAt = new Date();
      await updateBrushEventStatus(eventId, 'completed', {
        completed_at: completedAt.toISOString(),
      });

      const streakData = await getBrushStreak(event.telegram_user_id);
      const message = `✅ Nice! Streak: ${streakData.current_streak} days 🔥`;

      console.log(`Marked event ${eventId} as completed, streak: ${streakData.current_streak}`);

      return { message, streak: streakData.current_streak };
    } catch (error) {
      console.error('Failed to handle done action:', error);
      throw error;
    }
  }

  /**
   * Handle "Snooze" button press - delays reminder by 10 minutes
   * Returns snooze confirmation message
   */
  async handleSnooze(eventId: string): Promise<{ message: string }> {
    try {
      const event = await getBrushEventById(eventId);
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      const snoozeUntil = new Date();
      snoozeUntil.setMinutes(snoozeUntil.getMinutes() + 10);

      await updateBrushEventStatus(eventId, 'snoozed', {
        snooze_until: snoozeUntil.toISOString(),
      });

      const message = '⏰ Snoozed - reminder in 10 minutes';

      console.log(`Snoozed event ${eventId} until ${snoozeUntil.toISOString()}`);

      return { message };
    } catch (error) {
      console.error('Failed to handle snooze action:', error);
      throw error;
    }
  }

  /**
   * Process expired reminders - marks as missed and updates Telegram messages
   * Returns count of processed reminders
   */
  async processExpiredReminders(): Promise<number> {
    try {
      const expiredEvents = await getExpiredBrushEvents();

      let processedCount = 0;

      for (const event of expiredEvents) {
        try {
          await updateBrushEventStatus(event.id, 'missed');

          if (event.telegram_message_id && event.chat_id) {
            const missedMessage =
              '😴 Missed this one. Streak reset to 0.\n(No worries, start fresh next time!)';

            await this.bot.api.editMessageText(
              event.chat_id,
              event.telegram_message_id,
              missedMessage
            );
          }

          processedCount++;
          console.log(`Processed expired event ${event.id}`);
        } catch (error) {
          console.error(`Failed to process expired event ${event.id}:`, error);
        }
      }

      if (processedCount > 0) {
        console.log(`Processed ${processedCount} expired reminders`);
      }

      return processedCount;
    } catch (error) {
      console.error('Failed to process expired reminders:', error);
      throw error;
    }
  }

  /**
   * Process snoozed reminders - resends reminders after snooze period
   * Returns count of processed reminders
   */
  async processSnoozedReminders(): Promise<number> {
    try {
      const snoozedEvents = await getSnoozedBrushEvents();

      let processedCount = 0;

      for (const event of snoozedEvents) {
        try {
          await this.sendReminder(
            event.telegram_user_id,
            event.chat_id,
            event.event_type
          );

          processedCount++;
          console.log(`Processed snoozed event ${event.id}, sent new reminder`);
        } catch (error) {
          console.error(`Failed to process snoozed event ${event.id}:`, error);
        }
      }

      if (processedCount > 0) {
        console.log(`Processed ${processedCount} snoozed reminders`);
      }

      return processedCount;
    } catch (error) {
      console.error('Failed to process snoozed reminders:', error);
      throw error;
    }
  }

  /**
   * Send weekly summary report to user
   * Shows completion rate and streak statistics
   */
  async sendWeeklySummary(userId: number, chatId: number): Promise<void> {
    try {
      const streakData = await getBrushStreak(userId);
      const weeklyStats = await getWeeklyStats(userId);
      const completionRate = Math.round(weeklyStats.completion_rate);

      const message = `📊 Weekly Brush Report

This week: ${weeklyStats.completions}/${weeklyStats.total_expected} ✅ (${completionRate}%)
Current streak: ${streakData.current_streak} days 🔥
Best streak ever: ${streakData.best_streak} days

Keep it up! 🦷✨`;

      await this.bot.api.sendMessage(chatId, message);

      console.log(`Sent weekly summary to user ${userId}`);
    } catch (error) {
      console.error('Failed to send weekly summary:', error);
      throw error;
    }
  }
}

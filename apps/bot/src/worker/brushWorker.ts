import cron from 'node-cron';
import { Bot } from 'grammy';
import { config } from '../config/environment';
import { BrushReminderService } from '../services/brushReminderService';

// CRITICAL: Create own Bot instance, NEVER call .start()
const bot = new Bot(config.telegram.botToken);
const reminderService = new BrushReminderService(bot);

console.log('[BrushWorker] Started at', new Date().toISOString());

// Schedule 1: Morning reminder (08:00 JST)
cron.schedule('0 8 * * *', async () => {
  console.log('[BrushWorker] Sending morning reminder');
  try {
    await reminderService.sendReminder(
      config.telegram.userId,
      config.telegram.userId, // chatId = userId for private chat
      'morning'
    );
  } catch (error) {
    console.error('[BrushWorker] Morning reminder failed:', error);
  }
}, { timezone: 'Asia/Tokyo' });

// Schedule 2: Night reminder (22:00 JST)
cron.schedule('0 22 * * *', async () => {
  console.log('[BrushWorker] Sending night reminder');
  try {
    await reminderService.sendReminder(
      config.telegram.userId,
      config.telegram.userId,
      'night'
    );
  } catch (error) {
    console.error('[BrushWorker] Night reminder failed:', error);
  }
}, { timezone: 'Asia/Tokyo' });

// Schedule 3: Check for expired reminders (every minute)
cron.schedule('* * * * *', async () => {
  try {
    const count = await reminderService.processExpiredReminders();
    if (count > 0) {
      console.log(`[BrushWorker] Processed ${count} expired reminders`);
    }
  } catch (error) {
    console.error('[BrushWorker] Expire check failed:', error);
  }
});

// Schedule 4: Check for snoozed reminders (every minute)
cron.schedule('* * * * *', async () => {
  try {
    const count = await reminderService.processSnoozedReminders();
    if (count > 0) {
      console.log(`[BrushWorker] Processed ${count} snoozed reminders`);
    }
  } catch (error) {
    console.error('[BrushWorker] Snooze check failed:', error);
  }
});

// Schedule 5: Weekly summary (Sunday 20:00 JST)
cron.schedule('0 20 * * 0', async () => {
  console.log('[BrushWorker] Sending weekly summary');
  try {
    await reminderService.sendWeeklySummary(
      config.telegram.userId,
      config.telegram.userId
    );
  } catch (error) {
    console.error('[BrushWorker] Weekly summary failed:', error);
  }
}, { timezone: 'Asia/Tokyo' });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[BrushWorker] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[BrushWorker] SIGINT received, shutting down gracefully');
  process.exit(0);
});

console.log('[BrushWorker] All schedules registered:');
console.log('  - Morning reminder: 08:00 Asia/Tokyo');
console.log('  - Night reminder: 22:00 Asia/Tokyo');
console.log('  - Expire check: every minute');
console.log('  - Snooze check: every minute');
console.log('  - Weekly summary: Sunday 20:00 Asia/Tokyo');

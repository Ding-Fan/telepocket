import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { getBrushStreak, getWeeklyStats } from '../../database/brushOperations';
import { db } from '../../database/connection';

export const brushCommand = new Composer();

brushCommand.command('brush', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  try {
    const streak = await getBrushStreak(userId);
    const weeklyStats = await getWeeklyStats(userId);
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentEvents, error } = await db.getClient()
      .from('z_brush_events')
      .select('event_type, status, scheduled_at, completed_at')
      .eq('telegram_user_id', userId)
      .gte('scheduled_at', sevenDaysAgo)
      .order('scheduled_at', { ascending: false })
      .limit(14);

    if (error) {
      console.error('Error fetching brush events:', error);
      await ctx.reply('❌ Failed to fetch brush history. Please try again.');
      return;
    }

    const message = buildBrushHistoryMessage(streak, weeklyStats, recentEvents);
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in /brush command:', error);
    await ctx.reply('❌ An error occurred. Please try again later.');
  }
});

function buildBrushHistoryMessage(streak: any, weeklyStats: any, recentEvents: any[] | null): string {
  let message = '🦷 **Brush Teeth Tracker**\n\n';
  
  message += `🔥 **Current Streak:** ${streak.current_streak} days\n`;
  message += `🏆 **Best Streak:** ${streak.best_streak} days\n`;
  message += `✅ **Total Completions:** ${streak.total_completions}\n\n`;
  message += `📊 **This Week:** ${weeklyStats.completions}/14 (${weeklyStats.completion_rate}%)\n\n`;
  
  if (!recentEvents || recentEvents.length === 0) {
    message += '📭 **Recent History:** No reminders yet!\n\n';
    message += 'Your first reminder will be sent at:\n';
    message += '🌅 08:00 JST (morning)\n';
    message += '🌙 22:00 JST (night)';
  } else {
    message += '📜 **Recent History (Last 7 Days):**\n\n';
    message += formatEventsByDate(recentEvents);
  }
  
  message += '\n💡 **Tip:** Keep brushing twice daily to build your streak!';
  return message;
}

function formatEventsByDate(events: any[]): string {
  const eventsByDate = events.reduce((acc: any, event) => {
    const date = new Date(event.scheduled_at).toLocaleDateString('en-US', {
      timeZone: 'Asia/Tokyo',
      month: 'short',
      day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});
  
  let result = '';
  for (const [date, dateEvents] of Object.entries(eventsByDate)) {
    result += `**${date}:**\n`;
    for (const event of dateEvents as any[]) {
      const time = event.event_type === 'morning' ? '🌅 Morning' : '🌙 Night';
      const status = getStatusEmoji(event.status);
      result += `  ${time} - ${status}\n`;
    }
    result += '\n';
  }
  return result;
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'completed':
      return '✅ Done';
    case 'snoozed':
      return '⏰ Snoozed';
    case 'missed':
      return '😴 Missed';
    case 'pending':
      return '⏳ Pending';
    default:
      return '❓ Unknown';
  }
}

function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

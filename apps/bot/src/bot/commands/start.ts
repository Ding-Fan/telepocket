import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { escapeMarkdownV2 } from '../../utils/linkFormatter';
import { createMainKeyboard } from '../utils/keyboards';

export const startCommand = new Composer();

/**
 * Start command - show welcome message with bot features and commands
 */
startCommand.command('start', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedUser(userId)) {
    await ctx.reply('🚫 Unauthorized access. This bot is private.');
    return;
  }

  const welcomeMessage = `🎉 Welcome back, my master! 👑

🤖 **Telepocket Bot** is ready to serve you!

✨ **What I do:**
📝 I automatically save your messages that contain links
🔗 I extract and store metadata from those links (title, description, images)
💾 Everything is safely stored in your Supabase database with z_ prefixed tables

📋 **How to use me:**
📱 Just send me any message with URLs and I'll handle the rest!
🏷️ I'll fetch webpage titles, descriptions, and preview images
📊 All your links are organized and searchable in your database

📚 **Commands:**
• /start - Show this welcome message
• /help - Show detailed command help 📖
• /glance - Quick overview of recent notes by category
• /search <keyword> - Search both notes and links
• /notes - View all your notes
• /notes search <keyword> - Search notes with fuzzy matching
• /archived - View archived notes
• /archived search <keyword> - Search archived notes
• /links - View all your saved links
• /links search <keyword> - Search links with fuzzy matching
• 📋 Use the "My Notes" button below for quick access!

💡 **Tip:** Use /help to see all commands with examples!

💡 **Pro tips:**
• Just send any text - it's automatically saved as a note! 💭
• Send me multiple links in one message - I'll process them all! 🚀
• Archive notes to hide them without deleting permanently! 📦
• Use /search to find anything across both notes and links! 🔍

Ready to start collecting your digital treasures? 💎✨`;

  const escapedWelcome = escapeMarkdownV2(welcomeMessage);
  await ctx.reply(escapedWelcome, {
    reply_markup: createMainKeyboard(),
    parse_mode: 'MarkdownV2'
  });
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}

/**
 * Help messages for Telegram bot commands
 * Organized by category for easy maintenance
 */

const HEADER = `📚 **Telepocket Help**

`;

const ABOUT = `ℹ️ **About**
Your personal link and note manager for Telegram. I automatically save your messages, extract links with metadata, and organize everything in your database.

`;

const BASIC_COMMANDS = `**Basic Commands:**
• /start - Show welcome message
• /help - Show this help message
• /brush - View brush teeth streak and history

`;

const NOTES_SECTION = `**📝 Notes Management:**
• Just send any text - Automatically saved as a note!
  Example: Remember to review PR #123
  Example: Check out https://example.com

• /notes - View all notes (page 1)
• /notes <page> - Go to specific page
  Example: /notes 3

• /notes <category> - Filter by category
  Example: /notes todo
  Example: /notes blog

• /notes search <keyword> - Search notes with fuzzy matching
  Example: /notes search react hooks

• /archived - View archived notes (page 1)
• /archived <page> - Go to specific page
  Example: /archived 2

• /archived search <keyword> - Search archived notes
  Example: /archived search old project

`;

const LINKS_SECTION = `**🔗 Links Management:**
• /links - View all saved links (page 1)
• /links <page> - Go to specific page
  Example: /links 2

• /links search <keyword> - Search links with fuzzy matching
  Example: /links search typescript

`;

const PHOTOS_SECTION = `**📸 Photos:**
• Send photo - Auto-upload to cloud storage
• Send photo with caption - Save as note with image
  Example: Send photo with caption "Product screenshot"

`;

const UNIFIED_SEARCH_SECTION = `**🔍 Unified Search:**
• /search <keyword> - Search both notes and links simultaneously
  Example: /search typescript tutorial
  Example: /search job interview

Results are merged and ranked by relevance, showing both note content and individual links in a single list.

`;

const SEARCH_SECTION = `**🔍 Search Tips:**
• Fuzzy matching - typos are forgiven
• Searches content, titles, descriptions, URLs
• Case-insensitive
• Results show relevance scores (%)

`;

const CATEGORIES_SECTION = `**🏷️ Categories:**
• 📋 todo - Tasks and reminders
• 💡 idea - Brainstorms and concepts
• 📝 blog - Blog posts and articles
• 📺 youtube - Video content
• 📚 reference - Documentation and guides

`;

const TIPS_SECTION = `**💡 Pro Tips:**
• Send multiple links in one message - I'll process them all!
• Photos auto-upload with public URLs
• Categories appear as buttons after saving notes
• Archive notes to hide from main list without deleting
• Archived notes can be unarchived or permanently deleted
• All data stored securely in your Supabase database
• Just send any text - it's automatically saved as a note!

`;

const QUICK_ACCESS = `**⚡ Quick Access:**
• 📋 My Notes button - Quick access to notes list (persistent keyboard)
• Just send text - Auto-saved as note without commands`;

// Main help message (concatenation of all sections)
const MAIN = HEADER + ABOUT + BASIC_COMMANDS + NOTES_SECTION + LINKS_SECTION + UNIFIED_SEARCH_SECTION + PHOTOS_SECTION + SEARCH_SECTION + CATEGORIES_SECTION + TIPS_SECTION + QUICK_ACCESS;

export const HELP_MESSAGES = {
  HEADER,
  ABOUT,
  BASIC_COMMANDS,
  NOTES_SECTION,
  LINKS_SECTION,
  UNIFIED_SEARCH_SECTION,
  PHOTOS_SECTION,
  SEARCH_SECTION,
  CATEGORIES_SECTION,
  TIPS_SECTION,
  QUICK_ACCESS,
  MAIN,
};

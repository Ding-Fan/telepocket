# Telepocket v1.0 (MVP)

A personal Telegram bot that automatically captures links from your messages, enriches them with metadata, and stores them in a structured database.

Built with [Grammy.js](https://grammy.dev/) - the modern Telegram Bot Framework for TypeScript.

## Features

- 🔒 **Secure**: Only responds to the designated owner
- 🔗 **Auto-capture**: Extracts URLs from text messages automatically
- 📝 **Metadata enrichment**: Fetches title, description, and Open Graph images
- 💾 **Structured storage**: Saves to Supabase with proper relationships
- 🤖 **Silent operation**: Minimal, clear feedback messages

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm (package manager)
- A Telegram account
- A Supabase account (free tier works)

## Local Development Setup

### 1. Project Setup

```bash
# Clone and navigate to the project
cd telepocket

# Install dependencies (choose one)
npm install
# OR
pnpm install

# Create environment file
cp .env.example .env
```

### 2. Telegram Bot Setup

1. **Create a Telegram Bot**:
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` command
   - Follow the prompts to name your bot
   - Save the **Bot Token** (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **Get Your User ID**:
   - Search for `@userinfobot` on Telegram
   - Send `/start` to get your **User ID** (numeric, like `123456789`)

### 3. Supabase Database Setup

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new account (free)
   - Create a new project
   - Wait for the project to be ready (~2 minutes)

2. **Get Database Credentials**:
   - Go to Project Settings → API
   - Copy the **Project URL** and **anon public key**

3. **Create Database Tables**:
   - Go to SQL Editor in your Supabase dashboard
   - Run the following SQL:

```sql
-- Create messages table
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    telegram_message_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create links table
CREATE TABLE links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    og_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_telegram_user_id ON messages(telegram_user_id);
CREATE INDEX idx_links_created_at ON links(created_at);
CREATE INDEX idx_links_url ON links(url);
CREATE INDEX idx_links_message_id ON links(message_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

-- Create policies (allows all operations for now, customize as needed)
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on links" ON links FOR ALL USING (true);
```

### 4. Environment Configuration

Edit your `.env` file with your credentials:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_USER_ID=your_user_id_here

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Development
NODE_ENV=development
```

### 5. Running the Bot

**Development mode** (with hot reload):
```bash
# With npm
npm run dev
# OR with pnpm
pnpm dev
```

**Production mode** (compiled):
```bash
# With npm
npm run build
npm start
# OR with pnpm
pnpm build
pnpm start
```

## Project Structure

```
src/
├── bot/
│   ├── handlers.ts          # Message handling logic
│   └── client.ts           # Telegram bot setup
├── database/
│   ├── connection.ts       # Supabase client
│   └── operations.ts       # Database CRUD operations
├── services/
│   ├── linkExtractor.ts    # URL extraction logic
│   └── metadataFetcher.ts  # Web scraping for metadata
├── config/
│   └── environment.ts      # Environment variable handling
└── index.ts               # Main entry point
```

## Usage

1. Start the bot using the commands above
2. Send any message containing URLs to your bot in Telegram
3. The bot will automatically:
   - Extract all URLs from your message
   - Fetch metadata (title, description, image) for each URL
   - Save everything to your Supabase database
   - Reply with a confirmation message

## Database Schema

### Messages Table
| Column              | Type      | Description                       |
| ------------------- | --------- | --------------------------------- |
| id                  | UUID      | Primary key                       |
| telegram_user_id    | BIGINT    | Your Telegram user ID             |
| telegram_message_id | BIGINT    | Original message ID from Telegram |
| content             | TEXT      | Full message content              |
| created_at          | TIMESTAMP | When the message was saved        |

### Links Table
| Column      | Type      | Description                         |
| ----------- | --------- | ----------------------------------- |
| id          | UUID      | Primary key                         |
| message_id  | UUID      | Foreign key to messages table       |
| url         | TEXT      | The extracted URL                   |
| title       | TEXT      | Page title (if available)           |
| description | TEXT      | Page description (if available)     |
| og_image    | TEXT      | Open Graph image URL (if available) |
| created_at  | TIMESTAMP | When the link was saved             |
| updated_at  | TIMESTAMP | Last update time                    |

## Troubleshooting

### Common Issues

1. **Bot doesn't respond**:
   - Check that your `TELEGRAM_BOT_TOKEN` is correct
   - Verify that your `TELEGRAM_USER_ID` matches your account
   - Make sure the bot is running (`npm run dev` or `pnpm dev`)

2. **Database errors**:
   - Verify your Supabase credentials in `.env`
   - Check that the tables were created successfully
   - Ensure your Supabase project is active

3. **Metadata not fetching**:
   - Some websites block automated requests
   - The bot will still save the URL even if metadata fails
   - Check the logs for specific error messages

### Logs

The bot provides minimal logging. Check the console output for:
- Startup confirmation
- Message processing status
- Database operation results
- Error messages with reasons

## Security Notes

- Never share your `.env` file or commit it to version control
- The bot only responds to your specific Telegram user ID
- Consider enabling Supabase Row Level Security for additional protection
- Keep your bot token secure and regenerate it if compromised

## Future Enhancements

This MVP focuses on core functionality. Potential future features:
- Web interface for browsing saved links
- Search and filtering capabilities
- Export functionality
- Cloud deployment options
- Multiple user support

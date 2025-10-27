import { config } from './config/environment';
import { db } from './database/connection';
import { telegramClient } from './bot/client';
import { initNoteMessageHandler } from './bot/noteHandlers';

async function main() {
  console.log('🚀 Starting Telepocket Bot...');
  
  try {
    // Test database connection
    console.log('📊 Testing database connection...');
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connection successful');

    // Initialize message handler (note system)
    console.log('🤖 Initializing Telegram bot...');
    initNoteMessageHandler(); // Initialize note handlers
    console.log(`👤 Authorized user ID: ${config.telegram.userId}`);
    
    // Start the bot
    await telegramClient.start();
    console.log('✅ Bot is ready and listening for messages');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await telegramClient.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await telegramClient.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

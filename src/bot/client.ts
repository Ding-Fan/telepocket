import { Bot } from 'grammy';
import { config } from '../config/environment';

export class TelegramClient {
  private bot: Bot;

  constructor() {
    this.bot = new Bot(config.telegram.botToken);
    this.setupErrorHandling();
  }

  getBot(): Bot {
    return this.bot;
  }

  private setupErrorHandling(): void {
    this.bot.catch((err) => {
      console.error('Grammy bot error:', err);
    });
  }

  async sendMessage(chatId: number, text: string): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(chatId, text);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  isAuthorizedUser(userId: number): boolean {
    return userId === config.telegram.userId;
  }

  async start(): Promise<void> {
    console.log('Starting Telepocket bot...');
    await this.bot.start();
  }

  async stop(): Promise<void> {
    console.log('Stopping Telepocket bot...');
    await this.bot.stop();
  }
}

export const telegramClient = new TelegramClient();

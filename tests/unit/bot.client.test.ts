import { Bot } from 'grammy';
import { TelegramClient, telegramClient } from '../../src/bot/client';

// Mock Grammy
jest.mock('grammy');
const MockedBot = Bot as jest.MockedClass<typeof Bot>;

// Mock config
jest.mock('../../src/config/environment', () => ({
  config: {
    telegram: {
      botToken: 'test_bot_token',
      userId: 123456789
    }
  }
}));

describe('TelegramClient', () => {
  let mockBotInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockBotInstance = {
      api: {
        sendMessage: jest.fn(),
      },
      catch: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };

    MockedBot.mockImplementation(() => mockBotInstance);
  });

  describe('constructor', () => {
    it('should create Bot instance with correct token', () => {
      new TelegramClient();

      expect(MockedBot).toHaveBeenCalledWith('test_bot_token');
      expect(mockBotInstance.catch).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      mockBotInstance.api.sendMessage.mockResolvedValue({});

      const client = new TelegramClient();
      const result = await client.sendMessage(123456789, 'Test message');

      expect(result).toBe(true);
      expect(mockBotInstance.api.sendMessage).toHaveBeenCalledWith(123456789, 'Test message');
    });

    it('should handle sendMessage error', async () => {
      mockBotInstance.api.sendMessage.mockRejectedValue(new Error('Send failed'));

      const client = new TelegramClient();
      const result = await client.sendMessage(123456789, 'Test message');

      expect(result).toBe(false);
    });
  });

  describe('isAuthorizedUser', () => {
    it('should return true for authorized user', () => {
      const client = new TelegramClient();
      const result = client.isAuthorizedUser(123456789);

      expect(result).toBe(true);
    });

    it('should return false for unauthorized user', () => {
      const client = new TelegramClient();
      const result = client.isAuthorizedUser(987654321);

      expect(result).toBe(false);
    });
  });

  describe('start', () => {
    it('should start the bot', async () => {
      mockBotInstance.start.mockResolvedValue(undefined);

      const client = new TelegramClient();
      await client.start();

      expect(mockBotInstance.start).toHaveBeenCalled();
    });

    it('should handle start error', async () => {
      mockBotInstance.start.mockRejectedValue(new Error('Start failed'));

      const client = new TelegramClient();

      await expect(client.start()).rejects.toThrow('Start failed');
    });
  });

  describe('stop', () => {
    it('should stop the bot', async () => {
      mockBotInstance.stop.mockResolvedValue(undefined);

      const client = new TelegramClient();
      await client.stop();

      expect(mockBotInstance.stop).toHaveBeenCalled();
    });
  });

  describe('getBot', () => {
    it('should return the bot instance', () => {
      const client = new TelegramClient();
      const bot = client.getBot();

      expect(bot).toBe(mockBotInstance);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(telegramClient).toBeInstanceOf(TelegramClient);
    });
  });
});

import { Bot, Keyboard } from 'grammy';
import { TelegramClient, telegramClient } from '../../src/bot/client';

// Mock Grammy
jest.mock('grammy');
const MockedBot = Bot as jest.MockedClass<typeof Bot>;
const MockedKeyboard = Keyboard as jest.MockedClass<typeof Keyboard>;

// Mock config
jest.mock('../../src/config/environment', () => ({
  config: {
    telegram: {
      botToken: 'test_bot_token',
      userId: 123456789
    }
  }
}));

// Mock database operations
jest.mock('../../src/database/operations', () => ({
  dbOps: {
    getLinksWithPagination: jest.fn()
  }
}));

import { dbOps } from '../../src/database/operations';

describe('TelegramClient', () => {
  let mockBotInstance: any;
  let mockKeyboardInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBotInstance = {
      api: {
        sendMessage: jest.fn(),
      },
      catch: jest.fn(),
      command: jest.fn(),
      on: jest.fn(),
      hears: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };

    mockKeyboardInstance = {
      text: jest.fn().mockReturnThis(),
      resized: jest.fn().mockReturnThis(),
      persistent: jest.fn().mockReturnThis(),
    };

    MockedBot.mockImplementation(() => mockBotInstance);
    MockedKeyboard.mockImplementation(() => mockKeyboardInstance);
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

  describe('start command', () => {
    it('should register start command handler', () => {
      new TelegramClient();

      expect(mockBotInstance.command).toHaveBeenCalledWith('start', expect.any(Function));
    });
  });

  describe('list commands', () => {
    it('should register list and ls command handlers', () => {
      new TelegramClient();

      expect(mockBotInstance.command).toHaveBeenCalledWith(['list', 'ls'], expect.any(Function));
    });

    it('should register callback query handler', () => {
      new TelegramClient();

      expect(mockBotInstance.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
    });

    it('should register keyboard button handler', () => {
      new TelegramClient();

      expect(mockBotInstance.hears).toHaveBeenCalledWith('📋 My Saved Links', expect.any(Function));
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(telegramClient).toBeInstanceOf(TelegramClient);
    });
  });

  describe('pagination boundary conditions', () => {
    let client: TelegramClient;
    let mockContext: any;

    beforeEach(() => {
      client = new TelegramClient();
      mockContext = {
        from: { id: 123456789 },
        reply: jest.fn(),
        editMessageText: jest.fn(),
        callbackQuery: null,
        answerCallbackQuery: jest.fn()
      };
    });

    it('should handle page bounds validation - page too low', async () => {
      const mockDbOps = dbOps as jest.Mocked<typeof dbOps>;
      mockDbOps.getLinksWithPagination
        .mockResolvedValueOnce({
          links: [],
          totalCount: 15, // 3 pages with 5 items per page
          currentPage: 1,
          totalPages: 3
        })
        .mockResolvedValueOnce({
          links: [
            { id: '1', message_id: 'msg1', url: 'https://example.com', title: 'Test 1', description: 'Desc 1', created_at: '2025-01-01' }
          ],
          totalCount: 15,
          currentPage: 1,
          totalPages: 3
        });

      // Simulate requesting page -1, should be corrected to page 1
      await (client as any).showLinksPage(mockContext, 123456789, -1);

      expect(mockDbOps.getLinksWithPagination).toHaveBeenCalledWith(123456789, 1, 1); // First call for validation
      expect(mockDbOps.getLinksWithPagination).toHaveBeenCalledWith(123456789, 1, 5); // Second call for actual data
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Page 1/3'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '📄 1/3', callback_data: 'page_info' }),
                expect.objectContaining({ text: 'Next ➡️' })
              ])
            ])
          })
        })
      );
    });

    it('should handle page bounds validation - page too high', async () => {
      const mockDbOps = dbOps as jest.Mocked<typeof dbOps>;
      mockDbOps.getLinksWithPagination
        .mockResolvedValueOnce({
          links: [],
          totalCount: 15, // 3 pages with 5 items per page
          currentPage: 1,
          totalPages: 3
        })
        .mockResolvedValueOnce({
          links: [
            { id: '2', message_id: 'msg2', url: 'https://example.com', title: 'Test 1', description: 'Desc 1', created_at: '2025-01-01' }
          ],
          totalCount: 15,
          currentPage: 3,
          totalPages: 3
        });

      // Simulate requesting page 10, should be corrected to page 3 (last page)
      await (client as any).showLinksPage(mockContext, 123456789, 10);

      expect(mockDbOps.getLinksWithPagination).toHaveBeenCalledWith(123456789, 1, 1); // First call for validation
      expect(mockDbOps.getLinksWithPagination).toHaveBeenCalledWith(123456789, 3, 5); // Second call for actual data
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Page 3/3'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '⬅️ Previous' }),
                expect.objectContaining({ text: '📄 3/3', callback_data: 'page_info' })
              ])
            ])
          })
        })
      );
    });

    it('should hide Previous button on first page', async () => {
      const mockDbOps = dbOps as jest.Mocked<typeof dbOps>;
      mockDbOps.getLinksWithPagination
        .mockResolvedValueOnce({
          links: [],
          totalCount: 15,
          currentPage: 1,
          totalPages: 3
        })
        .mockResolvedValueOnce({
          links: [
            { id: '3', message_id: 'msg3', url: 'https://example.com', title: 'Test 1', description: 'Desc 1', created_at: '2025-01-01' }
          ],
          totalCount: 15,
          currentPage: 1,
          totalPages: 3
        });

      await (client as any).showLinksPage(mockContext, 123456789, 1);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Page 1/3'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.not.arrayContaining([
                expect.objectContaining({ text: '⬅️ Previous' })
              ])
            ])
          })
        })
      );
    });

    it('should hide Next button on last page', async () => {
      const mockDbOps = dbOps as jest.Mocked<typeof dbOps>;
      mockDbOps.getLinksWithPagination
        .mockResolvedValueOnce({
          links: [],
          totalCount: 15,
          currentPage: 1,
          totalPages: 3
        })
        .mockResolvedValueOnce({
          links: [
            { id: '4', message_id: 'msg4', url: 'https://example.com', title: 'Test 1', description: 'Desc 1', created_at: '2025-01-01' }
          ],
          totalCount: 15,
          currentPage: 3,
          totalPages: 3
        });

      await (client as any).showLinksPage(mockContext, 123456789, 3);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Page 3/3'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.not.arrayContaining([
                expect.objectContaining({ text: 'Next ➡️' })
              ])
            ])
          })
        })
      );
    });

    it('should show both Previous and Next buttons on middle page', async () => {
      const mockDbOps = dbOps as jest.Mocked<typeof dbOps>;
      mockDbOps.getLinksWithPagination
        .mockResolvedValueOnce({
          links: [],
          totalCount: 15,
          currentPage: 1,
          totalPages: 3
        })
        .mockResolvedValueOnce({
          links: [
            { id: '5', message_id: 'msg5', url: 'https://example.com', title: 'Test 1', description: 'Desc 1', created_at: '2025-01-01' }
          ],
          totalCount: 15,
          currentPage: 2,
          totalPages: 3
        });

      await (client as any).showLinksPage(mockContext, 123456789, 2);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Page 2/3'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '⬅️ Previous' }),
                expect.objectContaining({ text: '📄 2/3', callback_data: 'page_info' }),
                expect.objectContaining({ text: 'Next ➡️' })
              ])
            ])
          })
        })
      );
    });

    it('should handle callback query with invalid page number', async () => {
      mockContext.callbackQuery = { data: 'links_page_invalid' };

      const mockCallbackContext = {
        ...mockContext,
        from: { id: 123456789 },
        answerCallbackQuery: jest.fn()
      };

      // Get the callback handler
      const callbackHandler = mockBotInstance.on.mock.calls.find(
        (call: any) => call[0] === 'callback_query'
      )?.[1];

      if (callbackHandler) {
        await callbackHandler(mockCallbackContext);
      }

      expect(mockCallbackContext.answerCallbackQuery).toHaveBeenCalledWith('❌ Invalid page number.');
    });

    it('should handle callback query with negative page number', async () => {
      mockContext.callbackQuery = { data: 'links_page_-1' };

      const mockCallbackContext = {
        ...mockContext,
        from: { id: 123456789 },
        answerCallbackQuery: jest.fn()
      };

      // Get the callback handler
      const callbackHandler = mockBotInstance.on.mock.calls.find(
        (call: any) => call[0] === 'callback_query'
      )?.[1];

      if (callbackHandler) {
        await callbackHandler(mockCallbackContext);
      }

      expect(mockCallbackContext.answerCallbackQuery).toHaveBeenCalledWith('❌ Invalid page number.');
    });

    it('should handle page info callback gracefully', async () => {
      mockContext.callbackQuery = { data: 'page_info' };

      const mockCallbackContext = {
        ...mockContext,
        from: { id: 123456789 },
        answerCallbackQuery: jest.fn()
      };

      // Get the callback handler
      const callbackHandler = mockBotInstance.on.mock.calls.find(
        (call: any) => call[0] === 'callback_query'
      )?.[1];

      if (callbackHandler) {
        await callbackHandler(mockCallbackContext);
      }

      expect(mockCallbackContext.answerCallbackQuery).toHaveBeenCalledWith('📄 Current page indicator');
    });

    it('should not show pagination buttons for single page', async () => {
      const mockDbOps = dbOps as jest.Mocked<typeof dbOps>;
      mockDbOps.getLinksWithPagination
        .mockResolvedValueOnce({
          links: [],
          totalCount: 3, // Only 1 page with 5 items per page
          currentPage: 1,
          totalPages: 1
        })
        .mockResolvedValueOnce({
          links: [
            { id: '6', message_id: 'msg6', url: 'https://example.com', title: 'Test 1', description: 'Desc 1', created_at: '2025-01-01' }
          ],
          totalCount: 3,
          currentPage: 1,
          totalPages: 1
        });

      await (client as any).showLinksPage(mockContext, 123456789, 1);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Page 1/1'),
        expect.objectContaining({
          reply_markup: mockKeyboardInstance,
          parse_mode: 'Markdown'
        })
      );
    });
  });

  describe('escapeMarkdownV2', () => {
    it('should escape all MarkdownV2 special characters', () => {
      const client = new TelegramClient();

      // Test string with all special characters that need escaping
      const testString = 'Test_with*special[chars](url)~code`>header#+bold-=pipe|{curly}.period!backslash\\';

      // Access the private method for testing
      const escaped = (client as any).escapeMarkdownV2(testString);

      // Verify all special characters are escaped
      expect(escaped).toBe('Test\\_with\\*special\\[chars\\]\\(url\\)\\~code\\`\\>header\\#\\+bold\\-\\=pipe\\|\\{curly\\}\\.period\\!backslash\\\\');
    });

    it('should handle parentheses in pagination text', () => {
      const client = new TelegramClient();

      const paginationText = '🔗 *Your Saved Links* (Page 1/18)';
      const escaped = (client as any).escapeMarkdownV2(paginationText);

      expect(escaped).toBe('🔗 \\*Your Saved Links\\* \\(Page 1/18\\)');
    }); it('should handle URLs with special characters', () => {
      const client = new TelegramClient();

      const url = 'https://example.com/path?param=value&other=test#anchor';
      const escaped = (client as any).escapeMarkdownV2(url);

      expect(escaped).toBe('https://example\\.com/path?param\\=value&other\\=test\\#anchor');
    });
  });
});

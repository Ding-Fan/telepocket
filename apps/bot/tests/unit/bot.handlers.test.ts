import { MessageHandler } from '../../src/bot/handlers';
import { telegramClient } from '../../src/bot/client';
import { linkExtractor } from '../../src/services/linkExtractor';
import { metadataFetcher } from '../../src/services/metadataFetcher';
import { dbOps } from '../../src/database/operations';

// Mock all dependencies
jest.mock('../../src/bot/client');
jest.mock('../../src/services/linkExtractor');
jest.mock('../../src/services/metadataFetcher');
jest.mock('../../src/database/operations');

const mockedTelegramClient = telegramClient as jest.Mocked<typeof telegramClient>;
const mockedLinkExtractor = linkExtractor as jest.Mocked<typeof linkExtractor>;
const mockedMetadataFetcher = metadataFetcher as jest.Mocked<typeof metadataFetcher>;
const mockedDbOps = dbOps as jest.Mocked<typeof dbOps>;

describe('MessageHandler', () => {
  let mockBot: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBot = {
      on: jest.fn(),
      api: {
        editMessageText: jest.fn(),
      },
    };

    mockContext = {
      message: {
        text: 'Test message with https://example.com',
        from: { id: 123456789 },
        message_id: 1001,
      },
      chat: { id: 123456789 },
      reply: jest.fn(),
    };

    mockedTelegramClient.getBot.mockReturnValue(mockBot);
    mockedTelegramClient.isAuthorizedUser.mockReturnValue(true);
  });

  describe('constructor', () => {
    it('should setup message handlers', () => {
      new MessageHandler();

      expect(mockBot.on).toHaveBeenCalledWith('message:text', expect.any(Function));
    });
  });

  describe('handleMessage', () => {
    let handler: MessageHandler;
    let handleMessageFn: Function;

    beforeEach(() => {
      handler = new MessageHandler();
      handleMessageFn = mockBot.on.mock.calls[0][1];
    });

    it('should ignore messages from unauthorized users', async () => {
      mockedTelegramClient.isAuthorizedUser.mockReturnValue(false);

      await handleMessageFn(mockContext);

      expect(mockedLinkExtractor.extractAndValidateUrls).not.toHaveBeenCalled();
    });

    it('should process messages from authorized users', async () => {
      mockedLinkExtractor.extractAndValidateUrls.mockReturnValue(['https://example.com']);
      mockedMetadataFetcher.fetchMetadataForUrls.mockResolvedValue([
        { url: 'https://example.com', metadata: { title: 'Example' } }
      ]);
      mockedDbOps.saveMessageWithLinks.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        linkCount: 1
      });
      mockContext.reply.mockResolvedValue({ message_id: 2001 });

      await handleMessageFn(mockContext);

      expect(mockedLinkExtractor.extractAndValidateUrls).toHaveBeenCalledWith('Test message with https://example.com');
      expect(mockContext.reply).toHaveBeenCalledWith('Processing...');
    });

    it('should handle messages with no links', async () => {
      mockedLinkExtractor.extractAndValidateUrls.mockReturnValue([]);

      await handleMessageFn(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith('Failed: No links found in your message');
      expect(mockedMetadataFetcher.fetchMetadataForUrls).not.toHaveBeenCalled();
    });

    it('should handle successful link processing', async () => {
      mockedLinkExtractor.extractAndValidateUrls.mockReturnValue(['https://example.com']);
      mockedMetadataFetcher.fetchMetadataForUrls.mockResolvedValue([
        { url: 'https://example.com', metadata: { title: 'Example' } }
      ]);
      mockedDbOps.saveMessageWithLinks.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        linkCount: 1
      });
      mockContext.reply.mockResolvedValue({ message_id: 2001 });

      await handleMessageFn(mockContext);

      expect(mockBot.api.editMessageText).toHaveBeenCalledWith(
        123456789,
        2001,
        'Success: Saved 1 link(s)'
      );
    });

    it('should handle database save failure', async () => {
      mockedLinkExtractor.extractAndValidateUrls.mockReturnValue(['https://example.com']);
      mockedMetadataFetcher.fetchMetadataForUrls.mockResolvedValue([
        { url: 'https://example.com', metadata: { title: 'Example' } }
      ]);
      mockedDbOps.saveMessageWithLinks.mockResolvedValue({
        success: false,
        error: 'Database error'
      });
      mockContext.reply.mockResolvedValue({ message_id: 2001 });

      await handleMessageFn(mockContext);

      expect(mockBot.api.editMessageText).toHaveBeenCalledWith(
        123456789,
        2001,
        'Failed: Database error while saving links'
      );
    });

    it('should handle metadata fetching errors', async () => {
      mockedLinkExtractor.extractAndValidateUrls.mockReturnValue(['https://example.com']);
      mockedMetadataFetcher.fetchMetadataForUrls.mockRejectedValue(new Error('Fetch failed'));
      mockContext.reply.mockResolvedValue({ message_id: 2001 });

      await handleMessageFn(mockContext);

      expect(mockBot.api.editMessageText).toHaveBeenCalledWith(
        123456789,
        2001,
        'Failed: Fetch failed'
      );
    });

    it('should handle internal errors gracefully', async () => {
      mockedTelegramClient.isAuthorizedUser.mockImplementation(() => {
        throw new Error('Internal error');
      });

      await handleMessageFn(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith('Failed: Internal error while processing your message');
    });

    it('should process multiple links correctly', async () => {
      const urls = ['https://example.com', 'https://test.com'];
      mockedLinkExtractor.extractAndValidateUrls.mockReturnValue(urls);
      mockedMetadataFetcher.fetchMetadataForUrls.mockResolvedValue([
        { url: 'https://example.com', metadata: { title: 'Example' } },
        { url: 'https://test.com', metadata: { title: 'Test' } }
      ]);
      mockedDbOps.saveMessageWithLinks.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        linkCount: 2
      });
      mockContext.reply.mockResolvedValue({ message_id: 2001 });

      await handleMessageFn(mockContext);

      expect(mockedMetadataFetcher.fetchMetadataForUrls).toHaveBeenCalledWith(urls);
      expect(mockBot.api.editMessageText).toHaveBeenCalledWith(
        123456789,
        2001,
        'Success: Saved 2 link(s)'
      );
    });
  });
});

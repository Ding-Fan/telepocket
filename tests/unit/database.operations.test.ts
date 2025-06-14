import { dbOps } from '../../src/database/operations';
import { db } from '../../src/database/connection';

// Mock the database connection
jest.mock('../../src/database/connection');
const mockedDb = db as jest.Mocked<typeof db>;

describe('Database Operations', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockedDb.getClient.mockReturnValue(mockSupabaseClient);
  });

  describe('saveMessage', () => {
    const mockMessage = {
      telegram_user_id: 123456789,
      telegram_message_id: 1001,
      content: 'Test message with links'
    };

    it('should save message successfully', async () => {
      const mockResponse = {
        data: { id: 'msg-uuid-123', ...mockMessage },
        error: null
      };

      mockSupabaseClient.single.mockResolvedValue(mockResponse);

      const result = await dbOps.saveMessage(mockMessage);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-uuid-123');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle database error when saving message', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Database error' }
      };

      mockSupabaseClient.single.mockResolvedValue(mockResponse);

      const result = await dbOps.saveMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should handle exception when saving message', async () => {
      mockSupabaseClient.single.mockRejectedValue(new Error('Network error'));

      const result = await dbOps.saveMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('saveLinks', () => {
    const mockLinks = [
      {
        message_id: 'msg-uuid-123',
        url: 'https://example.com',
        title: 'Example Title',
        description: 'Example Description',
        og_image: 'https://example.com/image.jpg'
      },
      {
        message_id: 'msg-uuid-123',
        url: 'https://test.com',
        title: 'Test Title',
        description: null,
        og_image: null
      }
    ];

    it('should save links successfully', async () => {
      const mockResponse = {
        data: mockLinks.map((link, index) => ({ id: `link-uuid-${index}`, ...link })),
        error: null
      };

      mockSupabaseClient.select.mockResolvedValue(mockResponse);

      const result = await dbOps.saveLinks(mockLinks);

      expect(result.success).toBe(true);
      expect(result.linkCount).toBe(2);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('links');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(mockLinks);
    });

    it('should handle database error when saving links', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Constraint violation' }
      };

      mockSupabaseClient.select.mockResolvedValue(mockResponse);

      const result = await dbOps.saveLinks(mockLinks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Constraint violation');
    });

    it('should handle empty links array', async () => {
      const result = await dbOps.saveLinks([]);

      expect(result.success).toBe(true);
      expect(result.linkCount).toBe(0);
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });
  });

  describe('saveMessageWithLinks', () => {
    const mockMessage = {
      telegram_user_id: 123456789,
      telegram_message_id: 1001,
      content: 'Test message'
    };

    const mockLinks = [
      {
        url: 'https://example.com',
        title: 'Example',
        description: 'Test',
        og_image: null
      }
    ];

    it('should save message and links successfully', async () => {
      // Mock message save
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'msg-uuid-123', ...mockMessage },
        error: null
      });

      // Mock links save
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: [{ id: 'link-uuid-1', message_id: 'msg-uuid-123', ...mockLinks[0] }],
        error: null
      });

      const result = await dbOps.saveMessageWithLinks(mockMessage, mockLinks);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-uuid-123');
      expect(result.linkCount).toBe(1);
    });

    it('should handle message save failure', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to save message' }
      });

      const result = await dbOps.saveMessageWithLinks(mockMessage, mockLinks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save message');
    });

    it('should handle links save failure after successful message save', async () => {
      // Mock successful message save
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'msg-uuid-123', ...mockMessage },
        error: null
      });

      // Mock failed links save
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to save links' }
      });

      const result = await dbOps.saveMessageWithLinks(mockMessage, mockLinks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save links');
    });

    it('should save message with empty links array', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'msg-uuid-123', ...mockMessage },
        error: null
      });

      const result = await dbOps.saveMessageWithLinks(mockMessage, []);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-uuid-123');
      expect(result.linkCount).toBe(0);
    });
  });
});

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
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      notIn: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      then: jest.fn(),
      catch: jest.fn(),
      finally: jest.fn(),
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

      expect(result).toBe('msg-uuid-123');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('z_messages');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle database error when saving message', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Database error' }
      };

      mockSupabaseClient.single.mockResolvedValue(mockResponse);

      const result = await dbOps.saveMessage(mockMessage);

      expect(result).toBe(null);
    });

    it('should handle exception when saving message', async () => {
      mockSupabaseClient.single.mockRejectedValue(new Error('Network error'));

      const result = await dbOps.saveMessage(mockMessage);

      expect(result).toBe(null);
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
        description: undefined,
        og_image: undefined
      }
    ];

    it('should save links successfully', async () => {
      const mockResponse = {
        data: mockLinks.map((link, index) => ({ id: `link-uuid-${index}`, ...link })),
        error: null
      };

      // Note: saveLinks doesn't use select, it just uses insert
      mockSupabaseClient.insert.mockResolvedValue(mockResponse);

      const result = await dbOps.saveLinks(mockLinks);

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('z_links');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(mockLinks);
    });

    it('should handle database error when saving links', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Constraint violation' }
      };

      mockSupabaseClient.insert.mockResolvedValue(mockResponse);

      const result = await dbOps.saveLinks(mockLinks);

      expect(result).toBe(false);
    });

    it('should handle empty links array', async () => {
      const result = await dbOps.saveLinks([]);

      expect(result).toBe(true);
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
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
        og_image: undefined
      }
    ];

    it('should save message and links successfully', async () => {
      // Mock message save
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'msg-uuid-123', ...mockMessage },
        error: null
      });

      // Mock links save
      mockSupabaseClient.insert.mockResolvedValueOnce({
        data: [{ id: 'link-uuid-1', message_id: 'msg-uuid-123', ...mockLinks[0] }],
        error: null
      });

      const result = await dbOps.saveMessageWithLinks(mockMessage, mockLinks);

      expect(result.success).toBe(true);
      expect(result.linkCount).toBe(1);
    });

    it('should handle message save failure', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to save message' }
      });

      const result = await dbOps.saveMessageWithLinks(mockMessage, mockLinks);

      expect(result.success).toBe(false);
      expect(result.linkCount).toBe(0);
    });

    it('should handle links save failure after successful message save', async () => {
      // Mock successful message save
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'msg-uuid-123', ...mockMessage },
        error: null
      });

      // Mock failed links save
      mockSupabaseClient.insert.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to save links' }
      });

      const result = await dbOps.saveMessageWithLinks(mockMessage, mockLinks);

      expect(result.success).toBe(false);
      expect(result.linkCount).toBe(0);
    });

    it('should save message with empty links array', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'msg-uuid-123', ...mockMessage },
        error: null
      });

      mockSupabaseClient.insert.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await dbOps.saveMessageWithLinks(mockMessage, []);

      expect(result.success).toBe(true);
      expect(result.linkCount).toBe(0);
    });
  });

  describe('getLinksWithPagination', () => {
    const mockUserId = 123456789;
    const mockLinksData = [
      {
        id: 'link-1',
        message_id: 'msg-1',
        url: 'https://example.com',
        title: 'Example Site',
        description: 'Test description',
        og_image: 'https://example.com/image.jpg',
        created_at: '2025-06-14T10:00:00Z',
        updated_at: '2025-06-14T10:00:00Z',
        z_messages: { content: 'Check this out: https://example.com' }
      }
    ];

    it('should get links with pagination successfully', async () => {
      // Mock count query - ensure chaining works
      const countQueryMock = {
        count: 1,
        error: null
      };
      mockSupabaseClient.eq.mockReturnValueOnce(Promise.resolve(countQueryMock));

      // Mock data query - ensure chaining works
      const dataQueryMock = {
        data: mockLinksData,
        error: null
      };
      mockSupabaseClient.range.mockReturnValueOnce(Promise.resolve(dataQueryMock));

      const result = await dbOps.getLinksWithPagination(mockUserId, 1, 5);

      expect(result.totalCount).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.links).toHaveLength(1);
      expect(result.links[0].title).toBe('Example Site');
      expect(result.links[0].message_content).toBe('Check this out: https://example.com');
    });

    it('should handle empty results', async () => {
      // Mock count query
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: 0,
        error: null
      });

      // Mock data query
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await dbOps.getLinksWithPagination(mockUserId, 1, 5);

      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.links).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      // Mock count query error
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: null,
        error: { message: 'Database error' }
      });

      const result = await dbOps.getLinksWithPagination(mockUserId, 1, 5);

      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.links).toHaveLength(0);
    });
  });

  describe('searchLinksWithPagination', () => {
    const mockUserId = 123456789;
    const mockSearchKeyword = 'battery';
    const mockLinksData = [
      {
        id: 'link-1',
        message_id: 'msg-1',
        url: 'https://example.com/battery-guide',
        title: 'Battery Performance Guide',
        description: 'How to optimize your device battery life',
        og_image: 'https://example.com/battery.jpg',
        created_at: '2025-06-14T10:00:00Z',
        updated_at: '2025-06-14T10:00:00Z',
        z_messages: { content: 'Found this great battery guide: https://example.com/battery-guide' }
      },
      {
        id: 'link-2',
        message_id: 'msg-2',
        url: 'https://test.com/power',
        title: 'Power Management Tips',
        description: 'Battery saving techniques for mobile devices',
        og_image: undefined,
        created_at: '2025-06-14T09:00:00Z',
        updated_at: '2025-06-14T09:00:00Z',
        z_messages: { content: 'Battery tips here: https://test.com/power' }
      }
    ];

    it('should search links with keyword successfully', async () => {
      // Mock count query
      mockSupabaseClient.or.mockReturnThis();
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: 2,
        error: null
      });

      // Mock data query
      mockSupabaseClient.range.mockResolvedValue({
        data: mockLinksData,
        error: null
      });

      const result = await dbOps.searchLinksWithPagination(mockUserId, mockSearchKeyword, 1, 5);

      expect(result.totalCount).toBe(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.keyword).toBe(mockSearchKeyword);
      expect(result.links).toHaveLength(2);
      expect(result.links[0].title).toBe('Battery Performance Guide');
      expect(result.links[1].title).toBe('Power Management Tips');

      // Verify search query was called with correct parameters (updated syntax)
      expect(mockSupabaseClient.or).toHaveBeenCalledWith(
        'url.ilike.*battery*,title.ilike.*battery*,description.ilike.*battery*'
      );
    });

    it('should handle no search results', async () => {
      // Mock count query
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: 0,
        error: null
      });

      // Mock data query
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await dbOps.searchLinksWithPagination(mockUserId, 'nonexistent', 1, 5);

      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.keyword).toBe('nonexistent');
      expect(result.links).toHaveLength(0);
    });

    it('should handle search database errors', async () => {
      // Mock count query error
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: null,
        error: { message: 'Search query failed' }
      });

      const result = await dbOps.searchLinksWithPagination(mockUserId, mockSearchKeyword, 1, 5);

      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.keyword).toBe(mockSearchKeyword);
      expect(result.links).toHaveLength(0);
    });

    it('should handle multi-word search terms', async () => {
      const multiWordKeyword = 'battery life tips';

      // Mock count query
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: 1,
        error: null
      });

      // Mock data query
      mockSupabaseClient.range.mockResolvedValue({
        data: [mockLinksData[0]],
        error: null
      });

      const result = await dbOps.searchLinksWithPagination(mockUserId, multiWordKeyword, 1, 5);

      expect(result.keyword).toBe(multiWordKeyword);
      expect(mockSupabaseClient.or).toHaveBeenCalledWith(
        'url.ilike.*battery life tips*,title.ilike.*battery life tips*,description.ilike.*battery life tips*'
      );
    });

    it('should handle pagination for search results', async () => {
      // Mock count query - 12 total results
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: 12,
        error: null
      });

      // Mock data query - page 2 with 5 items per page
      mockSupabaseClient.range.mockResolvedValue({
        data: mockLinksData,
        error: null
      });

      const result = await dbOps.searchLinksWithPagination(mockUserId, mockSearchKeyword, 2, 5);

      expect(result.totalCount).toBe(12);
      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(3); // Math.ceil(12/5) = 3
      expect(result.keyword).toBe(mockSearchKeyword);

      // Verify range was called with correct offset
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(5, 9); // (page-1)*limit, (page-1)*limit + limit - 1
    });
  });
});

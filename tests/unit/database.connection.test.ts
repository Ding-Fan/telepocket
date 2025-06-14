import { createClient } from '@supabase/supabase-js';
import { db } from '../../src/database/connection';

// Mock Supabase
jest.mock('@supabase/supabase-js');
const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Database Connection', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      rpc: jest.fn(),
    };

    mockedCreateClient.mockReturnValue(mockSupabaseClient);
  });

  describe('testConnection', () => {
    it('should return true when connection is successful', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await db.testConnection();

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('id');
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(1);
    });

    it('should return false when connection fails', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      });

      const result = await db.testConnection();

      expect(result).toBe(false);
    });

    it('should return false when query throws exception', async () => {
      mockSupabaseClient.limit.mockRejectedValue(new Error('Network error'));

      const result = await db.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return the Supabase client instance', () => {
      const client = db.getClient();

      expect(client).toBe(mockSupabaseClient);
    });
  });

  describe('client initialization', () => {
    it('should create client with correct configuration', () => {
      // Re-import to trigger client creation
      jest.resetModules();
      require('../../src/database/connection');

      expect(mockedCreateClient).toHaveBeenCalledWith(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
    });
  });
});

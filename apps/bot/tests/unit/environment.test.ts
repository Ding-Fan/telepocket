import { config } from '../src/config/environment';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Valid Configuration', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token_123';
      process.env.TELEGRAM_USER_ID = '123456789';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_key_123';
      process.env.NODE_ENV = 'test';
    });

    it('should load telegram configuration correctly', () => {
      const { config: envConfig } = require('../src/config/environment');
      
      expect(envConfig.telegram.botToken).toBe('test_token_123');
      expect(envConfig.telegram.userId).toBe(123456789);
    });

    it('should load supabase configuration correctly', () => {
      const { config: envConfig } = require('../src/config/environment');
      
      expect(envConfig.supabase.url).toBe('https://test.supabase.co');
      expect(envConfig.supabase.anonKey).toBe('test_key_123');
    });

    it('should load app configuration correctly', () => {
      const { config: envConfig } = require('../src/config/environment');
      
      expect(envConfig.app.environment).toBe('test');
      expect(envConfig.app.isDevelopment).toBe(false);
      expect(envConfig.app.isProduction).toBe(false);
    });
  });

  describe('Invalid Configuration', () => {
    it('should throw error when TELEGRAM_BOT_TOKEN is missing', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_USER_ID = '123456789';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_key_123';

      expect(() => {
        require('../src/config/environment');
      }).toThrow('Missing required environment variables: TELEGRAM_BOT_TOKEN');
    });

    it('should throw error when multiple variables are missing', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.SUPABASE_URL;

      expect(() => {
        require('../src/config/environment');
      }).toThrow('Missing required environment variables: TELEGRAM_BOT_TOKEN, SUPABASE_URL');
    });

    it('should throw error when TELEGRAM_USER_ID is invalid', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test_token_123';
      process.env.TELEGRAM_USER_ID = 'invalid_user_id';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_key_123';

      expect(() => {
        require('../src/config/environment');
      }).toThrow('TELEGRAM_USER_ID must be a valid number');
    });
  });
});

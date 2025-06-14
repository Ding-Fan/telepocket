import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Set test timeout
jest.setTimeout(30000);
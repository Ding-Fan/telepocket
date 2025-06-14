// Mock data factories for tests

export const createMockMessage = (overrides = {}) => ({
  telegram_user_id: 123456789,
  telegram_message_id: 1001,
  content: 'Test message with links',
  ...overrides,
});

export const createMockLink = (overrides = {}) => ({
  message_id: 'msg-uuid-123',
  url: 'https://example.com',
  title: 'Example Title',
  description: 'Example Description',
  og_image: 'https://example.com/image.jpg',
  ...overrides,
});

export const createMockMetadata = (overrides = {}) => ({
  title: 'Default Title',
  description: 'Default Description',
  og_image: 'https://example.com/default.jpg',
  ...overrides,
});

export const createMockContext = (overrides = {}) => ({
  message: {
    text: 'Test message',
    from: { id: 123456789 },
    message_id: 1001,
    ...overrides.message,
  },
  chat: { id: 123456789 },
  reply: jest.fn().mockResolvedValue({ message_id: 2001 }),
  ...overrides,
});

export const createMockSupabaseResponse = (data: any, error: any = null) => ({
  data,
  error,
});

export const createMockAxiosResponse = (data: any, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {},
});

// HTML templates for testing metadata extraction
export const createMockHtml = (options: {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
} = {}) => `
<!DOCTYPE html>
<html>
<head>
  ${options.title ? `<title>${options.title}</title>` : ''}
  ${options.description ? `<meta name="description" content="${options.description}">` : ''}
  ${options.ogTitle ? `<meta property="og:title" content="${options.ogTitle}">` : ''}
  ${options.ogDescription ? `<meta property="og:description" content="${options.ogDescription}">` : ''}
  ${options.ogImage ? `<meta property="og:image" content="${options.ogImage}">` : ''}
</head>
<body>
  <h1>Test Page</h1>
  <p>Test content</p>
</body>
</html>
`;

export const createMockBot = () => ({
  on: jest.fn(),
  api: {
    sendMessage: jest.fn(),
    editMessageText: jest.fn(),
  },
  catch: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
});

export const createMockDbOpsResult = (overrides = {}) => ({
  success: true,
  messageId: 'msg-uuid-123',
  linkCount: 1,
  ...overrides,
});

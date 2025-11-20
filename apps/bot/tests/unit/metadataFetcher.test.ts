import axios from 'axios';
import { metadataFetcher, LinkMetadata } from '../../src/services/metadataFetcher';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MetadataFetcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchMetadata', () => {
    it('should extract title, description and og:image from valid HTML', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Page Title</title>
            <meta name="description" content="Test page description">
            <meta property="og:title" content="OG Title">
            <meta property="og:description" content="OG Description">
            <meta property="og:image" content="https://example.com/image.jpg">
          </head>
          <body>Content</body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const metadata = await metadataFetcher.fetchMetadata('https://example.com');

      expect(metadata).toEqual({
        title: 'OG Title',
        description: 'OG Description',
        og_image: 'https://example.com/image.jpg'
      });
    });

    it('should fallback to regular title when no og:title present', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Regular Title</title>
            <meta name="description" content="Regular description">
          </head>
          <body>Content</body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const metadata = await metadataFetcher.fetchMetadata('https://example.com');

      expect(metadata.title).toBe('Regular Title');
      expect(metadata.description).toBe('Regular description');
    });

    it('should handle HTML with no metadata', async () => {
      const mockHtml = `
        <html>
          <head></head>
          <body>Just content</body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const metadata = await metadataFetcher.fetchMetadata('https://example.com');

      expect(metadata).toEqual({});
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const metadata = await metadataFetcher.fetchMetadata('https://example.com');

      expect(metadata).toEqual({});
    });

    it('should handle timeout errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout of 10000ms exceeded'));

      const metadata = await metadataFetcher.fetchMetadata('https://example.com');

      expect(metadata).toEqual({});
    });

    it('should trim whitespace from extracted values', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>  Whitespace Title  </title>
            <meta name="description" content="  Whitespace Description  ">
            <meta property="og:image" content="  https://example.com/image.jpg  ">
          </head>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const metadata = await metadataFetcher.fetchMetadata('https://example.com');

      expect(metadata.title).toBe('Whitespace Title');
      expect(metadata.description).toBe('Whitespace Description');
      expect(metadata.og_image).toBe('https://example.com/image.jpg');
    });

    it('should ignore relative og:image URLs', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:image" content="/relative/image.jpg">
          </head>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const metadata = await metadataFetcher.fetchMetadata('https://example.com');

      expect(metadata.og_image).toBeUndefined();
    });

    it('should call axios with correct configuration', async () => {
      const mockHtml = '<html><head><title>Test</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      await metadataFetcher.fetchMetadata('https://example.com');

      expect(mockedAxios.get).toHaveBeenCalledWith('https://example.com', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Telepocket/1.0; +https://github.com/telepocket)'
        },
        maxRedirects: 5,
        validateStatus: expect.any(Function)
      });
    });
  });

  describe('fetchMetadataForUrls', () => {
    it('should fetch metadata for multiple URLs', async () => {
      const mockHtml1 = '<html><head><title>Page 1</title></head></html>';
      const mockHtml2 = '<html><head><title>Page 2</title></head></html>';

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockHtml1 })
        .mockResolvedValueOnce({ data: mockHtml2 });

      const results = await metadataFetcher.fetchMetadataForUrls([
        'https://example1.com',
        'https://example2.com'
      ]);

      expect(results).toEqual([
        { url: 'https://example1.com', metadata: { title: 'Page 1' } },
        { url: 'https://example2.com', metadata: { title: 'Page 2' } }
      ]);
    });

    it('should handle mixed success and failure URLs', async () => {
      const mockHtml = '<html><head><title>Success Page</title></head></html>';

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockHtml })
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await metadataFetcher.fetchMetadataForUrls([
        'https://success.com',
        'https://failure.com'
      ]);

      expect(results).toEqual([
        { url: 'https://success.com', metadata: { title: 'Success Page' } },
        { url: 'https://failure.com', metadata: {} }
      ]);
    });

    it('should handle empty URL array', async () => {
      const results = await metadataFetcher.fetchMetadataForUrls([]);

      expect(results).toEqual([]);
    });
  });
});

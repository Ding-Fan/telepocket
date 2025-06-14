import { linkExtractor } from '../../src/services/linkExtractor';
import { metadataFetcher } from '../../src/services/metadataFetcher';

describe('Integration: LinkExtractor + MetadataFetcher', () => {
  // Real integration test without mocks for core functionality
  describe('End-to-end URL processing', () => {
    it('should extract URLs and fetch metadata', async () => {
      const message = 'Check out https://httpbin.org/html and https://httpbin.org/json';
      
      // Extract URLs
      const urls = linkExtractor.extractAndValidateUrls(message);
      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://httpbin.org/html');
      expect(urls).toContain('https://httpbin.org/json');
      
      // Fetch metadata (this will make real HTTP requests to httpbin.org)
      const results = await metadataFetcher.fetchMetadataForUrls(urls);
      
      expect(results).toHaveLength(2);
      expect(results[0].url).toBe('https://httpbin.org/html');
      expect(results[1].url).toBe('https://httpbin.org/json');
      
      // httpbin.org/html returns HTML with a title
      expect(results[0].metadata.title).toBeDefined();
    }, 30000); // 30 second timeout for real HTTP requests

    it('should handle URLs with different metadata availability', async () => {
      const message = 'Valid HTML: https://httpbin.org/html and JSON endpoint: https://httpbin.org/json';
      
      const urls = linkExtractor.extractAndValidateUrls(message);
      const results = await metadataFetcher.fetchMetadataForUrls(urls);
      
      // HTML endpoint should have metadata
      const htmlResult = results.find(r => r.url === 'https://httpbin.org/html');
      expect(htmlResult?.metadata.title).toBeDefined();
      
      // JSON endpoint probably won't have HTML metadata
      const jsonResult = results.find(r => r.url === 'https://httpbin.org/json');
      expect(jsonResult?.metadata).toBeDefined();
    }, 30000);
  });

  describe('Error handling integration', () => {
    it('should handle mix of valid and invalid URLs', async () => {
      const message = 'Valid: https://httpbin.org/html Invalid: https://invalid-domain-that-does-not-exist.com';
      
      const urls = linkExtractor.extractAndValidateUrls(message);
      expect(urls).toHaveLength(2);
      
      const results = await metadataFetcher.fetchMetadataForUrls(urls);
      
      // Should still return results for all URLs, even if some fail
      expect(results).toHaveLength(2);
      
      // Valid URL should have some metadata
      const validResult = results.find(r => r.url === 'https://httpbin.org/html');
      expect(validResult?.metadata).toBeDefined();
      
      // Invalid URL should have empty metadata
      const invalidResult = results.find(r => r.url === 'https://invalid-domain-that-does-not-exist.com');
      expect(invalidResult?.metadata).toEqual({});
    }, 30000);
  });
});

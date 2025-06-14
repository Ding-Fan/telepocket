import { linkExtractor } from '../../src/services/linkExtractor';

describe('LinkExtractor', () => {
  describe('extractAndValidateUrls', () => {
    it('should extract single URL from text', () => {
      const text = 'Check out this website: https://example.com';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual(['https://example.com']);
    });

    it('should extract multiple URLs from text', () => {
      const text = 'Visit https://example.com and also http://test.org for more info';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual(['https://example.com', 'http://test.org']);
    });

    it('should extract URLs with various protocols', () => {
      const text = 'Links: https://secure.com http://regular.com ftp://files.com';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual(['https://secure.com', 'http://regular.com', 'ftp://files.com']);
    });

    it('should extract URLs with query parameters and fragments', () => {
      const text = 'Complex URL: https://example.com/path?param=value&other=123#section';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual(['https://example.com/path?param=value&other=123#section']);
    });

    it('should handle URLs in parentheses', () => {
      const text = 'Check this out (https://example.com) for details';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual(['https://example.com']);
    });

    it('should handle URLs with punctuation at the end', () => {
      const text = 'Visit https://example.com. Also check https://test.org!';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual(['https://example.com', 'https://test.org']);
    });

    it('should return empty array when no URLs found', () => {
      const text = 'This is just plain text with no links';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual([]);
    });

    it('should handle empty string', () => {
      const urls = linkExtractor.extractAndValidateUrls('');
      
      expect(urls).toEqual([]);
    });

    it('should remove duplicate URLs', () => {
      const text = 'Same link: https://example.com and again https://example.com';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual(['https://example.com']);
    });

    it('should handle malformed URLs gracefully', () => {
      const text = 'Bad URLs: htp://wrong.com and https:// incomplete';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual([]);
    });

    it('should extract URLs from markdown-style links', () => {
      const text = 'Check [this link](https://example.com) and [another](http://test.org)';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual(['https://example.com', 'http://test.org']);
    });

    it('should handle URLs with international domains', () => {
      const text = 'International: https://example.рф and https://测试.中国';
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);
      const text = `Long URL: ${longUrl}`;
      const urls = linkExtractor.extractAndValidateUrls(text);
      
      expect(urls).toEqual([longUrl]);
    });
  });
});
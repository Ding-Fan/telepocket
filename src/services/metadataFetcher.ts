import axios from 'axios';
import * as cheerio from 'cheerio';

export interface LinkMetadata {
  title?: string;
  description?: string;
  og_image?: string;
}

export class MetadataFetcher {
  private timeout = 10000; // 10 seconds
  private userAgent = 'Mozilla/5.0 (compatible; Telepocket/1.0; +https://github.com/telepocket)';

  async fetchMetadata(url: string): Promise<LinkMetadata> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400, // Accept 2xx and 3xx
      });

      return this.parseHtml(response.data);
    } catch (error) {
      console.error(`Failed to fetch metadata for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
      return {};
    }
  }

  private parseHtml(html: string): LinkMetadata {
    const $ = cheerio.load(html);
    
    // Extract title
    const title = this.extractTitle($);
    
    // Extract description
    const description = this.extractDescription($);
    
    // Extract Open Graph image
    const og_image = this.extractOgImage($);

    return {
      title: title || undefined,
      description: description || undefined,
      og_image: og_image || undefined,
    };
  }

  private extractTitle($: cheerio.CheerioAPI): string | null {
    // Try Open Graph title first, then regular title
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle?.trim()) return ogTitle.trim();

    const title = $('title').text();
    if (title?.trim()) return title.trim();

    return null;
  }

  private extractDescription($: cheerio.CheerioAPI): string | null {
    // Try Open Graph description first, then meta description
    const ogDescription = $('meta[property="og:description"]').attr('content');
    if (ogDescription?.trim()) return ogDescription.trim();

    const metaDescription = $('meta[name="description"]').attr('content');
    if (metaDescription?.trim()) return metaDescription.trim();

    return null;
  }

  private extractOgImage($: cheerio.CheerioAPI): string | null {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage?.trim()) {
      // Handle relative URLs
      try {
        new URL(ogImage);
        return ogImage.trim();
      } catch {
        // If it's a relative URL, we'd need the base URL to resolve it
        // For now, just return null for relative URLs
        return null;
      }
    }

    return null;
  }

  async fetchMetadataForUrls(urls: string[]): Promise<{ url: string; metadata: LinkMetadata }[]> {
    const results = await Promise.allSettled(
      urls.map(async (url) => ({
        url,
        metadata: await this.fetchMetadata(url),
      }))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<{ url: string; metadata: LinkMetadata }> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }
}

export const metadataFetcher = new MetadataFetcher();

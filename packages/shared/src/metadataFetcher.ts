import ogs from 'open-graph-scraper';

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
      const { result, error } = await ogs({
        url,
        timeout: this.timeout,
        fetchOptions: {
          headers: {
            'User-Agent': this.userAgent,
          },
        },
      });

      if (error) {
        console.error(`OGS error for ${url}:`, error);
        return {};
      }

      return this.normalizeMetadata(result);
    } catch (error) {
      console.error(`Failed to fetch metadata for ${url}:`,
        error instanceof Error ? error.message : 'Unknown error');
      return {};
    }
  }

  private normalizeMetadata(result: any): LinkMetadata {
    // Handle title (Open Graph > Twitter > HTML fallbacks)
    const title = result.ogTitle || result.twitterTitle || result.dcTitle;

    // Handle description (Open Graph > Twitter > HTML fallbacks)
    const description = result.ogDescription || result.twitterDescription || result.dcDescription;

    // Handle image (can be array, object, or string)
    let og_image: string | undefined;

    // Try Open Graph image first
    if (result.ogImage) {
      if (Array.isArray(result.ogImage)) {
        og_image = result.ogImage[0]?.url;
      } else if (typeof result.ogImage === 'object' && result.ogImage.url) {
        og_image = result.ogImage.url;
      } else if (typeof result.ogImage === 'string') {
        og_image = result.ogImage;
      }
    }

    // Fallback to Twitter image if Open Graph image not found
    if (!og_image && result.twitterImage) {
      if (Array.isArray(result.twitterImage)) {
        og_image = result.twitterImage[0]?.url;
      } else if (typeof result.twitterImage === 'object' && result.twitterImage.url) {
        og_image = result.twitterImage.url;
      } else if (typeof result.twitterImage === 'string') {
        og_image = result.twitterImage;
      }
    }

    return {
      title: title?.trim() || undefined,
      description: description?.trim() || undefined,
      og_image: og_image?.trim() || undefined,
    };
  }

  async fetchMetadataForUrls(urls: string[]): Promise<{ url: string; metadata: LinkMetadata }[]> {
    const results = await Promise.allSettled(
      urls.map(async (url) => ({
        url,
        metadata: await this.fetchMetadata(url),
      }))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<{ url: string; metadata: LinkMetadata }> =>
        r.status === 'fulfilled'
      )
      .map(r => r.value);
  }
}

export const metadataFetcher = new MetadataFetcher();

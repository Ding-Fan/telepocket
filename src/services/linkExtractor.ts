export class LinkExtractor {
  private urlRegex = /https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.]*))?(?:\#(?:[\w.]*))?)?/gi;

  extractUrls(text: string): string[] {
    const urls = text.match(this.urlRegex);
    return urls ? [...new Set(urls)] : []; // Remove duplicates
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  extractAndValidateUrls(text: string): string[] {
    const urls = this.extractUrls(text);
    return urls.filter(url => this.isValidUrl(url));
  }
}

export const linkExtractor = new LinkExtractor();
